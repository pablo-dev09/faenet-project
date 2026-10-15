"""
FaeNet - Model: Story
=====================
Stories de 24 horas. Guardamos apenas a URL da imagem (no storage)
e a legenda opcional. A expiracao eh calculada em tempo de consulta
(``is_expired``) para nao depender de um job em background.
"""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from ..extensions import db
from .associations import story_viewers


STORY_TTL_HOURS = 24


def _new_id() -> str:
    return f"s{uuid.uuid4().hex[:8]}"


class Story(db.Model):
    """Story publicado por um usuario."""

    __tablename__ = "stories"

    id = db.Column(String(24), primary_key=True, default=_new_id)
    username = db.Column(String(60), ForeignKey("users.username", ondelete="CASCADE"), nullable=False, index=True)
    image = db.Column(Text, nullable=False)  # URL servida pelo backend
    caption = db.Column(String(200), nullable=True)
    timestamp = db.Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    author = relationship("User", back_populates="stories", foreign_keys=[username])
    viewers = relationship("User", secondary=story_viewers, passive_deletes=True)

    def is_expired(self, now: datetime | None = None) -> bool:
        now = now or datetime.utcnow()
        return (now - (self.timestamp or now)) > timedelta(hours=STORY_TTL_HOURS)

    def to_dict(self, current_user: str | None = None, *, relations: dict | None = None) -> dict:
        if relations is None:
            relations = {
                "views_count": len(self.viewers),
                "viewed_by_me": any(u.username == current_user for u in self.viewers) if current_user else False,
                "author": self.author.to_public_dict() if self.author else None,
            }
        return {
            "id": self.id,
            "username": self.username,
            "image": self.image,
            "caption": self.caption or "",
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "expires_at": (
                self.timestamp + timedelta(hours=STORY_TTL_HOURS)
            ).isoformat() if self.timestamp else None,
            **relations,
        }

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Story {self.id} by {self.username}>"
