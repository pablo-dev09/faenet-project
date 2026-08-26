"""
FaeNet - Application Factory
============================
Ponto de entrada do backend Flask. A funcao ``create_app`` monta a
aplicacao, registra blueprints, configura extensoes e expõe o
comando CLI ``flask seed-demo`` para popular dados de demonstracao.
"""

import os
import traceback
from datetime import datetime, timedelta
from pathlib import Path

from flask import Flask, jsonify, request
from flask_login import current_user
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from .config import get_config
from .extensions import db, login_manager


def _ensure_upload_dirs(app: Flask) -> None:
    """Cria as pastas de upload se ainda nao existirem."""
    for folder in app.config["UPLOAD_FOLDERS"].values():
        folder.mkdir(parents=True, exist_ok=True)


def _register_blueprints(app: Flask) -> None:
    from .routes.auth import auth_bp
    from .routes.hub import hub_bp
    from .routes.me import me_bp
    from .routes.messages import messages_bp
    from .routes.notifications import notifications_bp
    from .routes.pages import pages_bp
    from .routes.posts import posts_bp
    from .routes.stories import stories_bp
    from .routes.uploads import uploads_bp
    from .routes.users import users_bp

    app.register_blueprint(pages_bp)
    app.register_blueprint(uploads_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(me_bp)
    app.register_blueprint(posts_bp)
    app.register_blueprint(stories_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(messages_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(hub_bp)


def _register_user_loader(app: Flask) -> None:
    """Faz o Flask-Login carregar usuarios pelo username."""
    from .models import User

    @login_manager.user_loader
    def load_user(username: str):
        return User.query.get(username)

    @login_manager.unauthorized_handler
    def _unauth():
        return jsonify({
            "ok": False,
            "error": {"message": "Autenticacao necessaria.", "code": "unauthorized"},
        }), 401


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(404)
    def not_found(e):
        # Se for requisicao de API, retorna JSON; caso contrario, deixa o
        # cliente decidir (a SPA lida com o fallback no router).
        if request.path.startswith("/api/"):
            return jsonify({"ok": False, "error": {"message": "Nao encontrado."}}), 404
        return e

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({"ok": False, "error": {"message": "Arquivo muito grande."}}), 413

    @app.errorhandler(OperationalError)
    def db_unavailable(e):
        """Mensagem amigavel quando o banco nao esta acessivel.

        Causas comuns:
          - Banco SQLite nao criado (rode ``flask --app backend.app init-db``)
          - ``DATABASE_URL`` apontando para URL invalida
          - PostgreSQL em producao sem tabelas
        """
        app.logger.error("Falha ao acessar o banco: %s", e)
        return jsonify({
            "ok": False,
            "error": {
                "message": "Banco de dados indisponivel. Rode 'flask --app backend.app init-db' e 'flask --app backend.app seed-demo'.",
                "code": "db_unavailable",
            }
        }), 503

    @app.errorhandler(500)
    def server_error(e):
        app.logger.exception("Erro interno")
        return jsonify({"ok": False, "error": {"message": "Erro interno do servidor."}}), 500


def _register_shell_context(app: Flask) -> None:
    @app.shell_context_processor
    def shell_context():
        from .models import User
        return {"db": db, "User": User}


def _register_cli(app: Flask) -> None:
    @app.cli.command("seed-demo")
    def seed_demo():
        """Popula o banco com dados de demonstracao (apenas para dev)."""
        from .seed import seed_demo_data
        seed_demo_data()
        print("Dados de demonstracao criados/atualizados.")

    @app.cli.command("init-db")
    def init_db():
        """Cria todas as tabelas (equivalente a um migrate inicial)."""
        db.create_all()
        print("Tabelas criadas.")


def create_app() -> Flask:
    """Cria e configura a instancia Flask da FaeNet."""
    app = Flask(
        __name__,
        static_folder=None,  # frontend servido pelo pages_bp
    )
    cfg = get_config()
    app.config.from_object(cfg)

    # Limite de upload do Flask.
    app.config["MAX_CONTENT_LENGTH"] = app.config.get("MAX_UPLOAD_BYTES", 16 * 1024 * 1024)

    db.init_app(app)
    login_manager.init_app(app)

    _ensure_upload_dirs(app)
    _register_blueprints(app)
    _register_user_loader(app)
    _register_error_handlers(app)
    _register_shell_context(app)
    _register_cli(app)

    return app


# Permite ``flask --app backend.app run`` alem do entrypoint direto.
app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=app.config.get("DEBUG", False))
