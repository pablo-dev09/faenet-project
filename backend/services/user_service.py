"""
FaeNet - Service: usuarios
=========================
Busca, perfil, seguir/deixar de seguir e atualizacao do proprio perfil.
"""

from datetime import datetime

from sqlalchemy import or_, select

from ..extensions import db
from ..models import User, followers
from .serialization import serialize_users
from .onboarding import find_user
from ..utils.security import (
    MAX_BIO_LEN,
    MAX_NAME_LEN,
    sanitize_text,
)


class UserError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def search_users(viewer: User, query: str, limit: int = 20) -> list[dict]:
    query = sanitize_text(query)
    if not query:
        return []
    like = f"%{query.lower()}%"
    users = (
        User.query.filter(
            or_(
                db.func.lower(User.username).like(like),
                db.func.lower(User.handle).like(like),
                db.func.lower(User.name).like(like),
                db.func.lower(User.curso).like(like),
            )
        )
        .order_by(User.username)
        .limit(max(1, min(limit, 50)))
        .all()
    )
    return serialize_users(users)


def get_profile(viewer: User | None, username: str) -> dict:
    user = find_user(username)
    if not user:
        raise UserError("Usuario nao encontrado.", 404)
    data = user.to_public_dict()
    if viewer:
        data["is_following"] = db.session.execute(select(followers.c.follower_id).where(
            followers.c.follower_id == viewer.username, followers.c.followed_id == user.username
        )).first() is not None
        data["is_me"] = viewer.username == user.username
    else:
        data["is_following"] = False
        data["is_me"] = False
    return data


def follow_user(viewer: User, username: str) -> dict:
    target = find_user(username)
    if not target:
        raise UserError("Usuario nao encontrado.", 404)
    if target.username == viewer.username:
        raise UserError("Voce nao pode seguir a si mesmo.", 400)

    existing = db.session.query(followers).filter_by(
        follower_id=viewer.username, followed_id=target.username
    ).first()
    if existing:
        return {"following": True, "followers_count": len(target.followers) if target.followers else 0}

    db.session.execute(
        followers.insert().values(follower_id=viewer.username, followed_id=target.username)
    )

    # Notificacao de follow
    from ..models import Notification
    n = Notification(
        to_user=target.username,
        from_name=viewer.name,
        from_avatar_text=viewer.avatar_initials(),
        from_avatar_img=viewer.avatar_img,
        notif_type="follow",
        text=f"{viewer.name} comecou a seguir voce",
        meta_json=None,
    )
    db.session.add(n)
    db.session.commit()
    return {"following": True, "followers_count": len(target.followers) if target.followers else 0}


def unfollow_user(viewer: User, username: str) -> dict:
    target = find_user(username)
    if not target:
        raise UserError("Usuario nao encontrado.", 404)
    db.session.execute(
        followers.delete().where(
            (followers.c.follower_id == viewer.username) & (followers.c.followed_id == target.username)
        )
    )
    db.session.commit()
    return {"following": False, "followers_count": len(target.followers) if target.followers else 0}


def update_profile(*, viewer: User, fields: dict) -> dict:
    if "name" in fields:
        name = sanitize_text(fields.get("name") or "")
        if not name:
            raise UserError("Nome nao pode estar vazio.", 400)
        if len(name) > MAX_NAME_LEN:
            raise UserError("Nome muito longo.", 400)
        viewer.name = name

    if "bio" in fields:
        bio = sanitize_text(fields.get("bio") or "")
        viewer.bio = bio[:MAX_BIO_LEN]

    if "curso" in fields:
        viewer.curso = sanitize_text(fields.get("curso") or "")[:80] or None

    if "turma" in fields:
        viewer.turma = sanitize_text(fields.get("turma") or "")[:100] or None

    if "avatar_text" in fields:
        viewer.avatar_text = sanitize_text(fields.get("avatar_text") or "")[:4] or None

    if "avatar_img" in fields:
        viewer.avatar_img = fields.get("avatar_img") or None

    if "banner_img" in fields:
        viewer.banner_img = fields.get("banner_img") or None

    db.session.commit()
    return viewer.to_public_dict()


def suggest_users(viewer: User, limit: int = 8) -> list[dict]:
    """Sugere usuarios para seguir: exclui o proprio usuario e quem ja segue."""
    following_ids = select(followers.c.followed_id).where(followers.c.follower_id == viewer.username)
    users = (
        User.query.filter(User.username != viewer.username, ~User.username.in_(following_ids))
        .order_by(User.joined.desc())
        .limit(max(1, min(limit, 30)))
        .all()
    )
    return serialize_users(users)


def list_followers(viewer: User | None, username: str) -> list[dict]:
    user = find_user(username)
    if not user:
        raise UserError("Usuario nao encontrado.", 404)
    return serialize_users(user.followers)


def list_following(viewer: User | None, username: str) -> list[dict]:
    user = find_user(username)
    if not user:
        raise UserError("Usuario nao encontrado.", 404)
    return serialize_users(user.followed)


def list_online_users(limit: int = 30) -> list[dict]:
    users = (
        User.query.filter_by(online=True)
        .order_by(User.last_seen.desc())
        .limit(max(1, min(limit, 100)))
        .all()
    )
    return serialize_users(users)
