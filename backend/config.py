"""
FaeNet - Configuracoes
======================
Centraliza as configuracoes da aplicacao Flask, lendo valores do ambiente
via python-dotenv. Suporta SQLite (desenvolvimento) e PostgreSQL (producao)
atraves de uma unica variavel ``DATABASE_URL``.
"""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

# Carrega .env da raiz do projeto (um nivel acima de backend/)
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Config:
    """Configuracao base compartilhada por todos os ambientes."""

    # Chave usada pelo Flask para assinar sessoes e tokens.
    SECRET_KEY = os.getenv("SECRET_KEY", "faenet-dev-secret-change-me")

    # Portal academico aberto pela area FaeHub+ da FaeNet. A URL pode ser
    # sobrescrita no ambiente para apontar a uma instancia local ou de testes.
    FAEHUB_URL = os.getenv("FAEHUB_URL", "https://faehub-plus.onrender.com/")

    # Banco de dados (aceita sqlite:///... e postgresql+psycopg2://...)
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{BASE_DIR / 'instance' / 'faenet.db'}",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Limite de upload (padrao 16 MB)
    _max_upload = os.getenv("MAX_UPLOAD_BYTES", str(16 * 1024 * 1024))
    try:
        MAX_UPLOAD_BYTES = int(_max_upload)
    except (TypeError, ValueError):
        MAX_UPLOAD_BYTES = 16 * 1024 * 1024

    # Caminho para uploads (servido via rota /uploads/...)
    UPLOAD_ROOT = BASE_DIR / "backend" / "uploads"
    UPLOAD_FOLDERS = {
        "avatar": UPLOAD_ROOT / "avatars",
        "banner": UPLOAD_ROOT / "banners",
        "post": UPLOAD_ROOT / "posts",
        "story": UPLOAD_ROOT / "stories",
        "message": UPLOAD_ROOT / "messages",
    }

    # Sessao longa o suficiente para a UX de rede social, curta o suficiente
    # para forcar re-login periodico. Ajustavel conforme politica futura.
    PERMANENT_SESSION_LIFETIME = timedelta(days=30)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    REMEMBER_COOKIE_DURATION = timedelta(days=30)

    # Tipos de midia aceitos para upload (MIME -> extensao).
    # GIFs sao permitidos no banner e stories.
    ALLOWED_IMAGE_EXT = {"png", "jpg", "jpeg", "webp", "gif"}
    ALLOWED_FILE_EXT = {"pdf", "doc", "docx", "txt", "zip", "rar", "xls", "xlsx", "ppt", "pptx"}

    # Extensoes por categoria de upload.
    IMAGE_ONLY_CATEGORIES = {"avatar", "banner", "post", "story"}


class DevelopmentConfig(Config):
    DEBUG = True
    ENV = "development"


class ProductionConfig(Config):
    DEBUG = False
    ENV = "production"
    SESSION_COOKIE_SECURE = True


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


# Mapa usado pela factory para resolver a classe a partir de FLASK_ENV.
CONFIG_MAP = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


def get_config() -> type[Config]:
    """Retorna a classe de configuracao apropriada para o ambiente atual."""
    env = os.getenv("FLASK_ENV", "development").lower()
    return CONFIG_MAP.get(env, DevelopmentConfig)
