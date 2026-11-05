"""API dos avatares 3D usados no editor e no FaeMap."""

import re

from flask import Blueprint, request
from flask_login import current_user, login_required
from sqlalchemy.orm import selectinload

from ..extensions import db
from ..models import User, UserAvatar
from ..utils.responses import fail, ok

avatars_bp = Blueprint("avatars", __name__, url_prefix="/api/avatars")

DEFAULT_AVATAR = {
    "skin": "medium",
    "gender": "male",
    "hair_style": "short",
    "hair_color": "dark",
    "top_style": "hoodie",
    "top_color": "#7258d9",
    "bottom_style": "pants",
    "bottom_color": "#26334f",
    "shoe_style": "sneakers",
    "shoe_color": "#e9ebef",
    "accessories": [],
}

OPTIONS = {
    "skin": {"light", "warm", "medium", "brown", "deep"},
    "gender": {"male", "female"},
    "hair_style": {"short", "fade", "curly", "afro", "long", "wavy", "bun", "spiky", "coils"},
    "hair_color": {"dark", "brown", "auburn", "blonde", "blue", "pink"},
    "top_style": {"shirt", "hoodie", "tank"},
    "bottom_style": {"pants", "shorts"},
    "shoe_style": {"sneakers", "flipflops"},
}

COLOR_FIELDS = {"top_color", "bottom_color", "shoe_color"}
LEGACY_COLORS = {
    "top_color": {"violet", "blue", "mint", "rose", "amber", "black"},
    "bottom_color": {"navy", "denim", "black", "gray", "sand"},
    "shoe_color": {"white", "black", "violet", "blue"},
}
ACCESSORIES = {"glasses", "headphones", "backpack", "earring", "watch"}
HEX_COLOR = re.compile(r"^#[0-9a-f]{6}$")


def _avatar_for(user: User) -> dict:
    config = dict(DEFAULT_AVATAR)
    if user.avatar_3d:
        config.update(user.avatar_3d.to_dict())
    return config


@avatars_bp.get("/me")
@login_required
def my_avatar():
    return ok({"username": current_user.username, "config": _avatar_for(current_user)})


@avatars_bp.put("/me")
@login_required
def save_my_avatar():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return fail("Informe a configuração do avatar.", 400, "invalid_avatar_config")
    config = data.get("config") if isinstance(data.get("config"), dict) else data
    clean = {}
    for field, allowed in OPTIONS.items():
        value = str(config.get(field, DEFAULT_AVATAR[field])).strip().lower()
        if value not in allowed:
            return fail(f"Opcao invalida para {field}.", 400, "invalid_avatar_option")
        clean[field] = value
    for field in COLOR_FIELDS:
        value = str(config.get(field, DEFAULT_AVATAR[field])).strip().lower()
        if not HEX_COLOR.fullmatch(value) and value not in LEGACY_COLORS[field]:
            return fail(f"Cor invalida para {field}.", 400, "invalid_avatar_color")
        clean[field] = value

    requested_accessories = config.get("accessories", [])
    if isinstance(requested_accessories, str):
        requested_accessories = [item for item in requested_accessories.split(",") if item]
    if not isinstance(requested_accessories, list):
        return fail("Lista de acessorios invalida.", 400, "invalid_avatar_accessories")
    selected_accessories = []
    for item in requested_accessories:
        value = str(item).strip().lower()
        if value not in ACCESSORIES:
            return fail("Acessorio invalido.", 400, "invalid_avatar_accessory")
        if value not in selected_accessories:
            selected_accessories.append(value)

    avatar = UserAvatar.query.get(current_user.username)
    if avatar is None:
        avatar = UserAvatar(username=current_user.username)
        db.session.add(avatar)
    for field, value in clean.items():
        setattr(avatar, field, value)
    avatar.accessories = ",".join(selected_accessories)
    avatar.accessory = selected_accessories[0] if selected_accessories else "none"
    db.session.commit()
    return ok({"username": current_user.username, "config": avatar.to_dict()})


@avatars_bp.get("/<username>")
@login_required
def user_avatar(username: str):
    user = User.query.get_or_404(username)
    return ok({"username": user.username, "config": _avatar_for(user)})


@avatars_bp.get("/online")
@login_required
def online_avatars():
    try:
        limit = min(max(int(request.args.get("limit", 24)), 1), 60)
    except ValueError:
        limit = 24
    users = (User.query.options(selectinload(User.avatar_3d)).filter_by(online=True)
             .order_by(User.last_seen.desc()).limit(limit).all())
    if current_user not in users:
        users.insert(0, current_user)
    return ok([
        {"user": user.to_public_dict(), "config": _avatar_for(user)}
        for user in users[:limit]
    ])
