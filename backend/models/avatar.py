"""Avatar 3D personalizavel associado a uma conta FaeNet."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from ..extensions import db


class UserAvatar(db.Model):
    __tablename__ = "user_avatars"

    username = db.Column(
        String(60),
        ForeignKey("users.username", ondelete="CASCADE"),
        primary_key=True,
    )
    skin = db.Column(String(24), nullable=False, default="medium")
    gender = db.Column(String(16), nullable=False, default="male")
    hair_style = db.Column(String(24), nullable=False, default="spiky")
    hair_color = db.Column(String(24), nullable=False, default="dark")
    top_style = db.Column(String(24), nullable=False, default="hoodie")
    top_color = db.Column(String(24), nullable=False, default="violet")
    bottom_style = db.Column(String(24), nullable=False, default="pants")
    bottom_color = db.Column(String(24), nullable=False, default="navy")
    shoe_style = db.Column(String(24), nullable=False, default="sneakers")
    shoe_color = db.Column(String(24), nullable=False, default="white")
    accessory = db.Column(String(24), nullable=False, default="none")
    accessories = db.Column(String(160), nullable=False, default="")
    updated_at = db.Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="avatar_3d")

    def to_dict(self) -> dict:
        selected_accessories = [item for item in (self.accessories or "").split(",") if item]
        if not selected_accessories and self.accessory and self.accessory != "none":
            selected_accessories = [self.accessory]
        return {
            "skin": self.skin,
            "gender": self.gender,
            "hair_style": self.hair_style,
            "hair_color": self.hair_color,
            "top_style": self.top_style,
            "top_color": self.top_color,
            "bottom_style": self.bottom_style,
            "bottom_color": self.bottom_color,
            "shoe_style": self.shoe_style,
            "shoe_color": self.shoe_color,
            "accessories": selected_accessories,
        }
