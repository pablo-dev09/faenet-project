"""
FaeNet - Model: User
====================
Representa um usuario da plataforma (aluno, professor ou colaborador).
Contem credenciais (hash bcrypt via werkzeug), informacoes de perfil
e indicadores de presenca online.
"""

from datetime import datetime

from flask_login import UserMixin
from sqlalchemy import Boolean, DateTime, String, Text, func, select
from sqlalchemy.orm import relationship
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from .associations import followers, post_likes, post_reposts, post_saves, story_viewers


class User(UserMixin, db.Model):
    """Entidade central: usuario da FaeNet."""

    __tablename__ = "users"

    # Identidade
    username = db.Column(String(60), primary_key=True)
    password_hash = db.Column(String(256), nullable=False)

    # Perfil
    name = db.Column(String(160), nullable=False)
    curso = db.Column(String(80), nullable=True)
    turma = db.Column(String(100), nullable=True)
    bio = db.Column(Text, nullable=True)

    # Avatar / banner
    avatar_text = db.Column(String(4), nullable=True)  # iniciais para fallback
    avatar_img = db.Column(Text, nullable=True)  # URL do upload
    banner_img = db.Column(Text, nullable=True)  # URL do upload (pode ser gif)

    # Presenca
    online = db.Column(Boolean, default=False, nullable=False)
    last_seen = db.Column(DateTime, default=datetime.utcnow, nullable=False)

    # Auditoria
    joined = db.Column(DateTime, default=datetime.utcnow, nullable=False)
    is_admin = db.Column(Boolean, default=False, nullable=False)

    # Relacionamentos
    posts = relationship(
        "Post",
        back_populates="author",
        cascade="all, delete-orphan",
        foreign_keys="Post.username",
    )
    comments = relationship(
        "Comment",
        back_populates="author",
        cascade="all, delete-orphan",
        foreign_keys="Comment.username",
    )
    stories = relationship(
        "Story",
        back_populates="author",
        cascade="all, delete-orphan",
        foreign_keys="Story.username",
    )
    messages_sent = relationship(
        "Message",
        back_populates="sender",
        cascade="all, delete-orphan",
        foreign_keys="Message.from_user",
    )
    notifications = relationship(
        "Notification",
        back_populates="recipient",
        cascade="all, delete-orphan",
        foreign_keys="Notification.to_user",
    )
    hub_items = relationship(
        "HubItem",
        back_populates="author",
        cascade="all, delete-orphan",
        foreign_keys="HubItem.username",
    )

    # Tabelas de associacao
    likes = relationship(
        "Post", secondary=post_likes, back_populates="liked_by", passive_deletes=True
    )
    saves = relationship(
        "Post", secondary=post_saves, back_populates="saved_by", passive_deletes=True
    )
    reposts = relationship(
        "Post", secondary=post_reposts, back_populates="reposted_by", passive_deletes=True
    )

    followed = relationship(
        "User",
        secondary=followers,
        primaryjoin=(followers.c.follower_id == username),
        secondaryjoin=(followers.c.followed_id == username),
        backref=db.backref(
            "followers",
            primaryjoin=(followers.c.followed_id == username),
            viewonly=True,
        ),
        passive_deletes=True,
    )

    def get_id(self) -> str:
        """Retorna o identificador unico (necessario para Flask-Login)."""
        return self.username

    # --- Password helpers ---
    def set_password(self, password: str) -> None:
        """Gera hash seguro (pbkdf2:sha256 via werkzeug) para a senha."""
        self.password_hash = generate_password_hash(password, method="pbkdf2:sha256", salt_length=16)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    # --- Profile helpers ---
    def avatar_initials(self) -> str:
        """Retorna iniciais do nome para o avatar textual."""
        if self.avatar_text:
            return self.avatar_text[:4].upper()
        if not self.name:
            return (self.username[:2] or "FN").upper()
        parts = [p for p in self.name.strip().split() if p]
        if len(parts) == 1:
            return parts[0][:2].upper()
        return (parts[0][0] + parts[-1][0]).upper()

    def to_public_dict(self, *, counts: dict | None = None) -> dict:
        """Serializacao para o frontend (sem dados sensiveis)."""
        if counts is None:
            counts = {
                "followers_count": db.session.scalar(select(func.count()).select_from(followers).where(
                    followers.c.followed_id == self.username)),
                "following_count": db.session.scalar(select(func.count()).select_from(followers).where(
                    followers.c.follower_id == self.username)),
            }
        return {
            "username": self.username,
            "name": self.name,
            "curso": self.curso,
            "turma": self.turma,
            "bio": self.bio,
            "avatar_text": self.avatar_text or self.avatar_initials(),
            "avatar_img": self.avatar_img,
            "banner_img": self.banner_img,
            "online": bool(self.online),
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "joined": self.joined.isoformat() if self.joined else None,
            "is_admin": bool(self.is_admin),
            "followers_count": counts["followers_count"],
            "following_count": counts["following_count"],
        }

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User {self.username}>"
