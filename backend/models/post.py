"""
FaeNet - Models: Post e Comment
================================
Publicacoes do feed (texto, imagens, enquetes, reposts) e comentarios
associados a um post.
"""

import json
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from ..extensions import db
from .associations import post_likes, post_reposts, post_saves


def _new_id(prefix: str = "p") -> str:
    """Gera um ID curto e legivel: prefixo + 8 chars hex."""
    return f"{prefix}{uuid.uuid4().hex[:8]}"


class Post(db.Model):
    """Publicacao no feed."""

    __tablename__ = "posts"

    id = db.Column(String(24), primary_key=True, default=lambda: _new_id("p"))
    username = db.Column(String(60), ForeignKey("users.username", ondelete="CASCADE"), nullable=False, index=True)
    content = db.Column(Text, nullable=False, default="")

    # Imagens: lista JSON de URLs (1..6).
    images_json = db.Column(Text, nullable=True)

    # Enquete: {"question": str, "options": [{"text": str, "votes": int, "voters": [usernames]}]}
    poll_json = db.Column(Text, nullable=True)

    # Repost: id do post original (sem cascata porque eh apenas referencia).
    repost_of = db.Column(String(24), ForeignKey("posts.id", ondelete="SET NULL"), nullable=True)

    timestamp = db.Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    edited = db.Column(Boolean, default=False, nullable=False)

    # Relacionamentos
    author = relationship(
        "User",
        back_populates="posts",
        foreign_keys=[username],
    )
    comments = relationship(
        "Comment",
        back_populates="post",
        cascade="all, delete-orphan",
        order_by="Comment.timestamp",
    )

    liked_by = relationship("User", secondary=post_likes, back_populates="likes", passive_deletes=True)
    saved_by = relationship("User", secondary=post_saves, back_populates="saves", passive_deletes=True)
    reposted_by = relationship("User", secondary=post_reposts, back_populates="reposts", passive_deletes=True)

    original = relationship("Post", remote_side=[id], foreign_keys=[repost_of])

    # --- Helpers para JSON ---
    @property
    def images(self) -> list[str]:
        if not self.images_json:
            return []
        try:
            return json.loads(self.images_json)
        except (TypeError, ValueError):
            return []

    @images.setter
    def images(self, value: list[str]) -> None:
        self.images_json = json.dumps(value or [])

    @property
    def poll(self) -> dict | None:
        if not self.poll_json:
            return None
        try:
            return json.loads(self.poll_json)
        except (TypeError, ValueError):
            return None

    @poll.setter
    def poll(self, value: dict | None) -> None:
        if value is None:
            self.poll_json = None
        else:
            self.poll_json = json.dumps(value)

    # --- Serializacao ---
    def to_dict(self, current_user: str | None = None, *, relations: dict | None = None) -> dict:
        # List endpoints supply request-local aggregates, not entire user/comment lists.
        if relations is None:
            relations = {
                "likes_count": len(self.liked_by),
                "saves_count": len(self.saved_by),
                "reposts_count": len(self.reposted_by),
                "comments_count": len(self.comments),
                "author": self.author.to_public_dict() if self.author else None,
            }
            if current_user:
                relations.update(
                    liked_by_me=any(u.username == current_user for u in self.liked_by),
                    saved_by_me=any(u.username == current_user for u in self.saved_by),
                    reposted_by_me=any(u.username == current_user for u in self.reposted_by),
                )
        data = {
            "id": self.id,
            "username": self.username,
            "content": self.content or "",
            "images": self.images,
            "poll": self.poll,
            "repost_of": self.repost_of,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "edited": bool(self.edited),
            **relations,
        }
        return data

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Post {self.id} by {self.username}>"


class Comment(db.Model):
    """Comentario em uma publicacao."""

    __tablename__ = "comments"

    id = db.Column(String(24), primary_key=True, default=lambda: _new_id("c"))
    post_id = db.Column(String(24), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    username = db.Column(String(60), ForeignKey("users.username", ondelete="CASCADE"), nullable=False, index=True)
    content = db.Column(Text, nullable=False)
    timestamp = db.Column(DateTime, default=datetime.utcnow, nullable=False)

    post = relationship("Post", back_populates="comments")
    author = relationship("User", back_populates="comments", foreign_keys=[username])

    def to_dict(self, *, author_data: dict | None = None) -> dict:
        return {
            "id": self.id,
            "post_id": self.post_id,
            "username": self.username,
            "content": self.content,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "author": author_data if author_data is not None else (self.author.to_public_dict() if self.author else None),
        }

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Comment {self.id} on {self.post_id}>"
