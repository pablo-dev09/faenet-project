"""
FaeNet - Service: posts
=======================
Logica de negocio de publicacoes: criacao, listagem, curtir, salvar,
repostar, comentar, votar em enquete e remover.
"""

from datetime import datetime
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from ..extensions import db
from ..models import Comment, Notification, Post, User, followers, post_likes, post_reposts, post_saves
from .serialization import serialize_posts, serialize_users
from ..utils.security import MAX_TEXT_LEN, sanitize_text


class PostError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def _user_liked_post(user: User, post: Post) -> bool:
    return db.session.query(post_likes).filter_by(user_id=user.username, post_id=post.id).first() is not None


def _user_saved_post(user: User, post: Post) -> bool:
    return db.session.query(post_saves).filter_by(user_id=user.username, post_id=post.id).first() is not None


def _user_reposted_post(user: User, post: Post) -> bool:
    return db.session.query(post_reposts).filter_by(user_id=user.username, post_id=post.id).first() is not None


def _post_query():
    # Scalar joins preserve page size; no join to unbounded reaction collections.
    return Post.query.options(joinedload(Post.author),
                              joinedload(Post.original).joinedload(Post.author))


def get_post(viewer: User, post_id: str) -> dict:
    post = _post_query().filter_by(id=post_id).first()
    if not post:
        raise PostError("Publicacao nao encontrada.", 404)
    # Detail/create endpoints historically do not embed repost_of_data.
    return serialize_posts([post], viewer, include_original=False)[0]


def list_feed(viewer: User, limit: int = 50, offset: int = 0, scope: str = "following") -> list[dict]:
    """Retorna o feed para o usuario logado.

    ``scope`` pode ser ``"following"`` (apenas seguidos) ou ``"all"`` (geral).
    """
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    if scope == "following":
        followed = select(followers.c.followed_id).where(followers.c.follower_id == viewer.username)
        query = _post_query().filter((Post.username == viewer.username) | Post.username.in_(followed))
    else:
        query = _post_query()

    posts = (
        query.order_by(Post.timestamp.desc()).offset(offset).limit(limit).all()
    )
    return serialize_posts(posts, viewer)


def list_user_posts(viewer: User | None, username: str, limit: int = 50, offset: int = 0) -> list[dict]:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    posts = (
        _post_query().filter_by(username=username)
        .order_by(Post.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return serialize_posts(posts, viewer)


def list_saved_posts(viewer: User, limit: int = 50, offset: int = 0) -> list[dict]:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    posts = (
        _post_query().join(post_saves, post_saves.c.post_id == Post.id)
        .filter(post_saves.c.user_id == viewer.username)
        .order_by(Post.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return serialize_posts(posts, viewer)


def create_post(
    *,
    author: User,
    content: str = "",
    images: list[str] | None = None,
    poll: dict | None = None,
    repost_of: str | None = None,
) -> Post:
    content = sanitize_text(content)[:MAX_TEXT_LEN]
    images = (images or [])[:6]  # max 6 imagens

    poll_data: dict | None = None
    if poll and isinstance(poll, dict):
        question = sanitize_text(poll.get("question", ""))[:200]
        opts = poll.get("options") or []
        if not question or not isinstance(opts, list) or len(opts) < 2:
            raise PostError("A enquete precisa de uma pergunta e pelo menos 2 opcoes.", 400)
        clean_opts = []
        for opt in opts[:6]:
            text = sanitize_text(str(opt))[:80]
            if text:
                clean_opts.append({"text": text, "votes": 0, "voters": []})
        if len(clean_opts) < 2:
            raise PostError("A enquete precisa de pelo menos 2 opcoes validas.", 400)
        poll_data = {"question": question, "options": clean_opts}

    if not content and not images and not poll_data:
        raise PostError("A publicacao nao pode estar vazia.", 400)

    if repost_of:
        if not Post.query.get(repost_of):
            raise PostError("Publicacao original nao encontrada.", 404)
        # Repost: normalmente so reposta, sem texto/imagens adicionais obrigatorios,
        # mas permitimos um comentario opcional do autor.
        if not content:
            content = ""

    post = Post(
        username=author.username,
        content=content,
        repost_of=repost_of,
    )
    post.images = images
    post.poll = poll_data

    db.session.add(post)
    db.session.commit()
    return post


def delete_post(*, viewer: User, post_id: str) -> None:
    post = Post.query.get(post_id)
    if not post:
        raise PostError("Publicacao nao encontrada.", 404)
    if post.username != viewer.username and not viewer.is_admin:
        raise PostError("Voce nao pode apagar essa publicacao.", 403)
    db.session.delete(post)
    db.session.commit()


def toggle_like(*, viewer: User, post_id: str) -> dict:
    post = Post.query.get(post_id)
    if not post:
        raise PostError("Publicacao nao encontrada.", 404)

    if _user_liked_post(viewer, post):
        db.session.execute(
            post_likes.delete().where(
                (post_likes.c.user_id == viewer.username) & (post_likes.c.post_id == post_id)
            )
        )
        liked = False
    else:
        db.session.execute(post_likes.insert().values(user_id=viewer.username, post_id=post_id))
        liked = True
        if post.username != viewer.username:
            _create_notification(
                to_user=post.username,
                from_user=viewer,
                notif_type="like",
                text=f"{viewer.name} curtiu sua publicacao",
                meta={"post_id": post_id},
            )
    db.session.commit()
    return {"liked": liked, "likes_count": _reaction_count(post_likes, post_id)}


def toggle_save(*, viewer: User, post_id: str) -> dict:
    post = Post.query.get(post_id)
    if not post:
        raise PostError("Publicacao nao encontrada.", 404)

    if _user_saved_post(viewer, post):
        db.session.execute(
            post_saves.delete().where(
                (post_saves.c.user_id == viewer.username) & (post_saves.c.post_id == post_id)
            )
        )
        saved = False
    else:
        db.session.execute(post_saves.insert().values(user_id=viewer.username, post_id=post_id))
        saved = True
    db.session.commit()
    return {"saved": saved, "saves_count": _reaction_count(post_saves, post_id)}


def toggle_repost(*, viewer: User, post_id: str) -> dict:
    post = Post.query.get(post_id)
    if not post:
        raise PostError("Publicacao nao encontrada.", 404)

    if _user_reposted_post(viewer, post):
        db.session.execute(
            post_reposts.delete().where(
                (post_reposts.c.user_id == viewer.username) & (post_reposts.c.post_id == post_id)
            )
        )
        reposted = False
    else:
        db.session.execute(post_reposts.insert().values(user_id=viewer.username, post_id=post_id))
        reposted = True
        if post.username != viewer.username:
            _create_notification(
                to_user=post.username,
                from_user=viewer,
                notif_type="repost",
                text=f"{viewer.name} repostou sua publicacao",
                meta={"post_id": post_id},
            )
    db.session.commit()
    return {"reposted": reposted, "reposts_count": _reaction_count(post_reposts, post_id)}


def _reaction_count(table, post_id: str) -> int:
    return db.session.scalar(select(func.count()).select_from(table).where(table.c.post_id == post_id))


def add_comment(*, viewer: User, post_id: str, content: str) -> Comment:
    post = Post.query.get(post_id)
    if not post:
        raise PostError("Publicacao nao encontrada.", 404)
    content = sanitize_text(content)
    if not content:
        raise PostError("Comentario vazio.", 400)
    if len(content) > 1000:
        raise PostError("Comentario muito longo.", 400)
    comment = Comment(post_id=post_id, username=viewer.username, content=content)
    db.session.add(comment)
    if post.username != viewer.username:
        _create_notification(
            to_user=post.username,
            from_user=viewer,
            notif_type="comment",
            text=f"{viewer.name} comentou: {content[:60]}",
            meta={"post_id": post_id, "comment_id": comment.id},
        )
    db.session.commit()
    return comment


def list_comments(*, post_id: str) -> list[dict]:
    post = Post.query.get(post_id)
    if not post:
        raise PostError("Publicacao nao encontrada.", 404)
    comments = Comment.query.options(joinedload(Comment.author)).filter_by(post_id=post_id).order_by(Comment.timestamp).all()
    authors = {c.author.username: c.author for c in comments if c.author}
    data = {u["username"]: u for u in serialize_users(authors.values())}
    return [c.to_dict(author_data=data.get(c.username)) for c in comments]


def vote_poll(*, viewer: User, post_id: str, option_index: int) -> dict:
    post = Post.query.get(post_id)
    if not post or not post.poll:
        raise PostError("Enquete nao encontrada.", 404)

    options = post.poll.get("options", [])
    if not isinstance(option_index, int) or option_index < 0 or option_index >= len(options):
        raise PostError("Opcao invalida.", 400)

    # Verifica se o usuario ja votou.
    for idx, opt in enumerate(options):
        voters = opt.get("voters", [])
        if viewer.username in voters:
            if idx == option_index:
                # Permite remover voto (toggle off)
                opt["voters"] = [v for v in voters if v != viewer.username]
                opt["votes"] = max(0, int(opt.get("votes", 0)) - 1)
                post.poll = post.poll
                db.session.commit()
                return _poll_payload(post)
            else:
                # Troca de voto: remove do anterior
                opt["voters"] = [v for v in voters if v != viewer.username]
                opt["votes"] = max(0, int(opt.get("votes", 0)) - 1)
                break

    target = options[option_index]
    target.setdefault("voters", []).append(viewer.username)
    target["votes"] = int(target.get("votes", 0)) + 1
    post.poll = post.poll
    db.session.commit()
    return _poll_payload(post)


def _poll_payload(post: Post) -> dict:
    options = post.poll.get("options", []) if post.poll else []
    total = sum(int(o.get("votes", 0)) for o in options) or 0
    enriched = []
    for o in options:
        votes = int(o.get("votes", 0))
        percent = (votes / total * 100.0) if total else 0.0
        enriched.append({
            "text": o.get("text", ""),
            "votes": votes,
            "percent": round(percent, 1),
        })
    return {
        "question": post.poll.get("question") if post.poll else "",
        "options": enriched,
        "total_votes": total,
    }


def _create_notification(*, to_user: str, from_user: User, notif_type: str, text: str, meta: dict | None = None):
    import json
    n = Notification(
        to_user=to_user,
        from_name=from_user.name,
        from_avatar_text=from_user.avatar_initials(),
        from_avatar_img=from_user.avatar_img,
        notif_type=notif_type,
        text=text[:200],
        meta_json=json.dumps(meta) if meta else None,
    )
    db.session.add(n)
