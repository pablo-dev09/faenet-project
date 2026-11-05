"""Server-private state for the single, fixed FaeHub identity provider."""
from ..extensions import db


class HubLink(db.Model):
    __tablename__ = 'faehub_links'
    subject = db.Column(db.String(36), primary_key=True)
    username = db.Column(db.String(60), db.ForeignKey('users.username'), unique=True, nullable=False)


class HubSession(db.Model):
    __tablename__ = 'faehub_sessions'
    id = db.Column(db.String(64), primary_key=True)
    subject = db.Column(db.String(36), nullable=False)
    token_ciphertext = db.Column(db.Text, nullable=False)
    expires_at = db.Column(db.BigInteger, nullable=False)


class HubFlow(db.Model):
    __tablename__ = 'faehub_flows'
    id = db.Column(db.String(64), primary_key=True)
    verifier_ciphertext = db.Column(db.Text, nullable=False)
    expires_at = db.Column(db.BigInteger, nullable=False)


class HubPending(db.Model):
    __tablename__ = 'faehub_pending'
    id = db.Column(db.String(64), primary_key=True)
    subject = db.Column(db.String(36), nullable=False)
    token_ciphertext = db.Column(db.Text, nullable=False)
    expires_at = db.Column(db.BigInteger, nullable=False)
    attempts = db.Column(db.Integer, nullable=False, default=0)


class HubLinkAttempt(db.Model):
    __tablename__ = 'faehub_link_attempts'
    id = db.Column(db.String(64), primary_key=True)
    attempts = db.Column(db.Integer, nullable=False)
    until_at = db.Column(db.BigInteger, nullable=False)
