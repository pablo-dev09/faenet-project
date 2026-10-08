"""
FaeNet - Rotas /api/hub
=======================
Hub do Curso: estagios, provas e forum de duvidas.
"""

from urllib.parse import urlparse

from flask import Blueprint, current_app, redirect, request
from flask_login import current_user, login_required

from ..services import hub_service
from ..utils.responses import fail, ok

hub_bp = Blueprint("hub", __name__, url_prefix="/api/hub")


@hub_bp.route("/faehub", methods=["GET"])
def open_faehub():
    """Redireciona a area FaeHub+ da FaeNet para o portal academico."""
    target = str(current_app.config.get("FAEHUB_URL", "")).strip()
    parsed = urlparse(target)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return fail("Endereco do FaeHub+ nao configurado.", 503)
    return redirect(target, code=302)


@hub_bp.route("", methods=["GET"])
@login_required
def list_items():
    item_type = (request.args.get("type") or "").strip().lower()
    if not item_type:
        return fail("Parametro ``type`` obrigatorio (estagio, prova, forum_topic, forum_answer).", 400)
    curso = request.args.get("curso") or None
    try:
        limit = int(request.args.get("limit", 50))
        offset = int(request.args.get("offset", 0))
    except ValueError:
        limit, offset = 50, 0
    try:
        items = hub_service.list_items(curso=curso, item_type=item_type, limit=limit, offset=offset)
    except hub_service.HubError as exc:
        return fail(exc.message, exc.status)
    return ok(items)


@hub_bp.route("/<item_id>", methods=["GET"])
@login_required
def get_item(item_id: str):
    try:
        return ok(hub_service.get_item(item_id))
    except hub_service.HubError as exc:
        return fail(exc.message, exc.status)


@hub_bp.route("/<item_id>/answers", methods=["GET"])
@login_required
def list_answers(item_id: str):
    try:
        return ok(hub_service.list_answers(item_id))
    except hub_service.HubError as exc:
        return fail(exc.message, exc.status)


@hub_bp.route("", methods=["POST"])
@login_required
def create():
    data = request.get_json(silent=True) or {}
    item_type = (data.get("item_type") or "").strip().lower()
    try:
        item = hub_service.create_item(
            author=current_user,
            item_type=item_type,
            curso=data.get("curso", ""),
            title=data.get("title"),
            content=data.get("content"),
            extra=data.get("extra") or None,
        )
    except hub_service.HubError as exc:
        return fail(exc.message, exc.status)
    return ok(item.to_dict(), 201)


@hub_bp.route("/<item_id>/reply", methods=["POST"])
@login_required
def reply(item_id: str):
    data = request.get_json(silent=True) or {}
    try:
        answer = hub_service.reply_topic(
            author=current_user,
            topic_id=item_id,
            content=data.get("content", ""),
        )
    except hub_service.HubError as exc:
        return fail(exc.message, exc.status)
    return ok(answer.to_dict(), 201)


@hub_bp.route("/<item_id>", methods=["PUT", "PATCH"])
@login_required
def update(item_id: str):
    data = request.get_json(silent=True) or {}
    try:
        return ok(hub_service.update_item(viewer=current_user, item_id=item_id, fields=data))
    except hub_service.HubError as exc:
        return fail(exc.message, exc.status)


@hub_bp.route("/<item_id>", methods=["DELETE"])
@login_required
def delete(item_id: str):
    try:
        hub_service.delete_item(viewer=current_user, item_id=item_id)
    except hub_service.HubError as exc:
        return fail(exc.message, exc.status)
    return ok({"deleted": True})


@hub_bp.route("/<item_id>/solve", methods=["POST"])
@login_required
def solve(item_id: str):
    data = request.get_json(silent=True) or {}
    solved = bool(data.get("solved", True))
    try:
        return ok(hub_service.mark_solved(viewer=current_user, topic_id=item_id, solved=solved))
    except hub_service.HubError as exc:
        return fail(exc.message, exc.status)
