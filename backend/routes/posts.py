"""
FaeNet - Rotas /api/posts
=========================
Feed, criacao, curtir, salvar, repostar, comentar e enquetes.
"""

from flask import Blueprint, request
from flask_login import current_user, login_required

from ..services import post_service
from ..utils.responses import fail, ok

posts_bp = Blueprint("posts", __name__, url_prefix="/api/posts")


@posts_bp.route("", methods=["GET"])
@login_required
def list_feed():
    scope = (request.args.get("scope") or "following").lower()
    if scope not in {"following", "all"}:
        scope = "following"
    try:
        limit = int(request.args.get("limit", 30))
        offset = int(request.args.get("offset", 0))
    except ValueError:
        limit, offset = 30, 0
    posts = post_service.list_feed(current_user, limit=limit, offset=offset, scope=scope)
    return ok(posts)


@posts_bp.route("", methods=["POST"])
@login_required
def create():
    data = request.get_json(silent=True) or {}
    try:
        post = post_service.create_post(
            author=current_user,
            content=data.get("content", ""),
            images=data.get("images") or [],
            poll=data.get("poll") or None,
            repost_of=data.get("repost_of") or None,
        )
    except post_service.PostError as exc:
        return fail(exc.message, exc.status)
    return ok(post_service.serialize_posts([post], current_user, include_original=False)[0], 201)


@posts_bp.route("/<post_id>", methods=["DELETE"])
@login_required
def delete(post_id: str):
    try:
        post_service.delete_post(viewer=current_user, post_id=post_id)
    except post_service.PostError as exc:
        return fail(exc.message, exc.status)
    return ok({"deleted": True})


@posts_bp.route("/<post_id>", methods=["GET"])
@login_required
def detail(post_id: str):
    try:
        return ok(post_service.get_post(current_user, post_id))
    except post_service.PostError as exc:
        return fail(exc.message, exc.status)


@posts_bp.route("/<post_id>/like", methods=["POST"])
@login_required
def toggle_like(post_id: str):
    try:
        result = post_service.toggle_like(viewer=current_user, post_id=post_id)
    except post_service.PostError as exc:
        return fail(exc.message, exc.status)
    return ok(result)


@posts_bp.route("/<post_id>/save", methods=["POST"])
@login_required
def toggle_save(post_id: str):
    try:
        result = post_service.toggle_save(viewer=current_user, post_id=post_id)
    except post_service.PostError as exc:
        return fail(exc.message, exc.status)
    return ok(result)


@posts_bp.route("/<post_id>/repost", methods=["POST"])
@login_required
def toggle_repost(post_id: str):
    try:
        result = post_service.toggle_repost(viewer=current_user, post_id=post_id)
    except post_service.PostError as exc:
        return fail(exc.message, exc.status)
    return ok(result)


@posts_bp.route("/<post_id>/comment", methods=["GET", "POST"])
@login_required
def comments(post_id: str):
    if request.method == "GET":
        try:
            items = post_service.list_comments(post_id=post_id)
        except post_service.PostError as exc:
            return fail(exc.message, exc.status)
        return ok(items)
    data = request.get_json(silent=True) or {}
    try:
        comment = post_service.add_comment(
            viewer=current_user, post_id=post_id, content=data.get("content", "")
        )
    except post_service.PostError as exc:
        return fail(exc.message, exc.status)
    return ok(comment.to_dict(), 201)


@posts_bp.route("/<post_id>/poll", methods=["POST"])
@login_required
def vote_poll(post_id: str):
    data = request.get_json(silent=True) or {}
    option_index = data.get("option_index")
    if not isinstance(option_index, int):
        return fail("option_index deve ser um numero inteiro.", 400)
    try:
        result = post_service.vote_poll(viewer=current_user, post_id=post_id, option_index=option_index)
    except post_service.PostError as exc:
        return fail(exc.message, exc.status)
    return ok(result)
