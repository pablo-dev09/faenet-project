"""
FaeNet - Service: autenticacao
==============================
Encapsula registro, login e atualizacao de status online.
"""

from datetime import datetime

from flask_login import login_user, logout_user

from ..extensions import db
from ..models import User
from ..utils.security import (
    is_valid_password,
    is_valid_username,
    sanitize_text,
)


class AuthError(Exception):
    """Erro de autenticacao com mensagem amigavel para o usuario."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def register_user(
    *,
    username: str,
    password: str,
    name: str,
    curso: str | None = None,
    turma: str | None = None,
) -> User:
    """Cria um novo usuario. Levanta ``AuthError`` em caso de inconsistencia."""
    from .federation import required
    if required():
        raise AuthError('Crie sua conta pelo convite da escola no FaeHub.', 403)
    username = sanitize_text(username).lower()
    name = sanitize_text(name)

    if not is_valid_username(username):
        raise AuthError("Nome de usuario invalido. Use 3-30 letras, numeros, _ ou .", 400)
    if not is_valid_password(password):
        raise AuthError("Senha deve ter pelo menos 6 caracteres.", 400)
    if not name:
        raise AuthError("Informe seu nome completo.", 400)

    from .onboarding import find_user
    if find_user(username):
        raise AuthError("Esse nome de usuario ja esta em uso.", 409)

    user = User(
        username=username,
        handle=username,
        name=name,
        curso=(sanitize_text(curso) or None) if curso else None,
        turma=(sanitize_text(turma) or None) if turma else None,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return user


def authenticate(*, username: str, password: str) -> User:
    """Valida credenciais e retorna o usuario. Levanta ``AuthError`` caso falhe."""
    from .federation import required
    if required():
        raise AuthError('Entre com sua conta FaeHub.', 403)
    username = sanitize_text(username).lower()
    if not username or not password:
        raise AuthError("Informe usuario e senha.", 400)

    user = User.query.get(username)
    if not user or not user.check_password(password):
        raise AuthError("Usuario ou senha invalidos.", 401)

    login_user(user, remember=True)
    user.online = True
    user.last_seen = datetime.utcnow()
    db.session.commit()
    return user


def logout_current_user() -> None:
    """Encerra a sessao do usuario atual."""
    user = None
    from flask_login import current_user

    if current_user and current_user.is_authenticated:
        user = current_user
        logout_user()
    if user is not None:
        try:
            user.online = False
            user.last_seen = datetime.utcnow()
            db.session.commit()
        except Exception:
            db.session.rollback()


def mark_user_online(username: str) -> None:
    """Atualiza o timestamp/flag de online para um usuario."""
    user = User.query.get(username)
    if not user:
        return
    user.online = True
    user.last_seen = datetime.utcnow()
    db.session.commit()
