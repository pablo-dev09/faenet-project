"""
FaeNet - Service: stories
=========================
Stories com expiracao de 24h. A verificacao de expiracao acontece em
tempo de consulta (story.is_expired) e na limpeza, sem job em background.
"""

from datetime import datetime, timedelta
from sqlalchemy import case, func, select
from sqlalchemy.orm import joinedload

from ..extensions import db
from ..models import Story, User, followers, story_viewers
from .serialization import serialize_users
from ..utils.security import MAX_CAPTION_LEN, sanitize_text


STORY_TTL_HOURS = 24


class StoryError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def cleanup_expired() -> int:
    """Remove stories expirados. Retorna a quantidade removida."""
    cutoff = datetime.utcnow() - timedelta(hours=STORY_TTL_HOURS)
    expired = Story.query.filter(Story.timestamp < cutoff).all()
    count = len(expired)
    for s in expired:
        db.session.delete(s)
    if count:
        db.session.commit()
    return count


def list_active(viewer: User) -> list[dict]:
    cutoff = datetime.utcnow() - timedelta(hours=STORY_TTL_HOURS)
    followed = select(followers.c.followed_id).where(followers.c.follower_id == viewer.username)
    stories = (
        Story.query.options(joinedload(Story.author)).filter(
            Story.timestamp >= cutoff,
            (Story.username == viewer.username) | Story.username.in_(followed),
        )
        .order_by(Story.timestamp.desc())
        .all()
    )
    if not stories:
        return []
    authors = {s.author.username: s.author for s in stories if s.author}
    authors = {u["username"]: u for u in serialize_users(authors.values())}
    views = {story_id: (count, bool(mine)) for story_id, count, mine in db.session.execute(
        select(story_viewers.c.story_id, func.count(),
               func.max(case((story_viewers.c.user_id == viewer.username, 1), else_=0)))
        .where(story_viewers.c.story_id.in_([s.id for s in stories]))
        .group_by(story_viewers.c.story_id)
    )}
    return [s.to_dict(relations={"views_count": views.get(s.id, (0, False))[0],
                                 "viewed_by_me": views.get(s.id, (0, False))[1],
                                 "author": authors.get(s.username)}) for s in stories]


def create_story(*, author: User, image_url: str, caption: str | None = None) -> Story:
    if not image_url:
        raise StoryError("Imagem obrigatoria.", 400)
    story = Story(
        username=author.username,
        image=image_url,
        caption=(sanitize_text(caption)[:MAX_CAPTION_LEN] if caption else None),
    )
    db.session.add(story)
    db.session.commit()
    return story


def delete_story(*, viewer: User, story_id: str) -> None:
    story = Story.query.get(story_id)
    if not story:
        raise StoryError("Story nao encontrado.", 404)
    if story.username != viewer.username and not viewer.is_admin:
        raise StoryError("Voce nao pode apagar esse story.", 403)
    db.session.delete(story)
    db.session.commit()


def mark_viewed(*, viewer: User, story_id: str) -> None:
    story = Story.query.get(story_id)
    if not story or story.username == viewer.username:
        return
    exists = db.session.query(story_viewers).filter_by(user_id=viewer.username, story_id=story_id).first()
    if exists:
        return
    db.session.execute(
        story_viewers.insert().values(user_id=viewer.username, story_id=story_id)
    )
    db.session.commit()
