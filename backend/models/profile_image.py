"""Small normalized profile photos persist alongside the profile, not on Render disk."""
from ..extensions import db


class ProfileImage(db.Model):
    __tablename__ = 'profile_images'
    username = db.Column(db.String(60), db.ForeignKey('users.username', ondelete='CASCADE'), primary_key=True)
    kind = db.Column(db.String(6), primary_key=True)
    content = db.Column(db.LargeBinary, nullable=False)
    revision = db.Column(db.String(32), nullable=False)
    __table_args__ = (db.CheckConstraint("kind IN ('avatar','banner')"),)
