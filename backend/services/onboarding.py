"""Public profile choices never change the FaeHub subject or relational user ID."""
from io import BytesIO
import secrets
import unicodedata
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models import User, ProfileImage
from ..utils.security import sanitize_text, is_valid_username


class ProfileError(ValueError):
    def __init__(self, message, field=None, status=422):
        super().__init__(message)
        self.message, self.field, self.status = message, field, status


def find_user(identifier):
    identifier = (identifier or '').strip().lower()
    return User.query.filter(or_(User.username == identifier, User.handle == identifier)).first()


def validate(fields, files=None, user=None):
    handle = fields.get('handle','').strip().lower()
    if (not is_valid_username(handle) or handle in ('online','suggestions') or handle.startswith('fh_')):
        raise ProfileError('Escolha um @ de 3 a 30 caracteres: letras sem acento, números, ponto ou sublinhado. Não use o prefixo fh_.','handle')
    query = User.query.filter(or_(User.handle == handle, db.func.lower(User.username) == handle))
    if user: query = query.filter(User.username != user.username)
    if query.first():
        raise ProfileError('Este @ já está em uso. Escolha outro.','handle',409)
    name = ' '.join(unicodedata.normalize('NFC',fields.get('name','')).split())
    parts = name.split()
    if (not 3 <= len(name) <= 160 or len(parts)<2
            or any(not (char.isalpha() or char in " '-.") for char in name)
            or any(not any(char.isalpha() for char in part) for part in parts)):
        raise ProfileError('Informe seu nome e sobrenome, com até 160 caracteres.','name')
    values = dict(handle=handle,name=name)
    for field, limit in (('bio',280),('curso',80),('turma',100)):
        value = sanitize_text(fields.get(field,''))
        if len(value)>limit: raise ProfileError(f'Use até {limit} caracteres neste campo.',field)
        values[field] = value or None
    images = {}
    for kind in ('avatar','banner'):
        file = files.get(kind) if files else None
        if file and file.filename: images[kind] = normalize_image(file,kind)
    return values, images


def normalize_image(file, kind):
    data=file.stream.read(5*1024*1024+1)
    if not data or len(data)>5*1024*1024:
        raise ProfileError('Escolha uma imagem não vazia de até 5 MB.',kind)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as source:
                if source.format not in ('JPEG','PNG','WEBP') or source.width*source.height>20_000_000:
                    raise ValueError()
                source.load()
                image=ImageOps.exif_transpose(source).convert('RGB')
                image=ImageOps.fit(image,(320,320) if kind=='avatar' else (1280,480),method=Image.Resampling.LANCZOS)
                output=BytesIO();image.save(output,format='JPEG',quality=85,optimize=True)
                result=output.getvalue()
                if len(result)>400*1024: raise ValueError()
                return result
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ProfileError('Imagem inválida. Use JPG, PNG ou WebP de até 5 MB e 20 megapixels.',kind) from None


def apply(user, values, images):
    for key,value in values.items():setattr(user,key,value)
    for kind,content in images.items():
        row=db.session.get(ProfileImage,(user.username,kind))
        if not row:
            row=ProfileImage(username=user.username,kind=kind);db.session.add(row)
        row.content=content;row.revision=secrets.token_hex(16)
        setattr(user,'avatar_img' if kind=='avatar' else 'banner_img',
                f'/api/users/{user.username}/image/{kind}?v={row.revision}')
    user.profile_complete=True


def complete_existing(user, fields, files):
    values,images=validate(fields,files,user=user)
    try:
        apply(user,values,images)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ProfileError('Este @ acabou de ser escolhido por outra pessoa. Escolha outro.','handle',409) from None
