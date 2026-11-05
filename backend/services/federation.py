"""FaeHub-only sessions; opaque tokens stay encrypted on the server."""
import base64
import hashlib
import json
import secrets
import time
import uuid
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

from cryptography.fernet import Fernet, InvalidToken
from flask import current_app, session
from flask_login import login_user, logout_user
from sqlalchemy import delete, update, text
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models import User, HubLink, HubSession, HubFlow, HubPending


class FederationError(Exception):
    def __init__(self, message, status=400, field=None):
        self.message, self.status, self.field = message, status, field
        super().__init__(message)


def required():
    return current_app.config['FAEHUB_LOGIN_REQUIRED']


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def protector():
    key = current_app.config['FAEHUB_SSO_CLIENT_SECRET']
    if len(key) < 43:
        raise FederationError('A entrada com FaeHub aguarda configuração. Tente novamente mais tarde.', 503)
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest()))


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def hub_request(endpoint, fields):
    protector()  # Fail closed before any network call.
    url = current_app.config['FAEHUB_SSO_ORIGIN'] + '/sso/faenet/' + endpoint
    req = Request(url, data=urlencode(fields).encode(), method='POST', headers={
        'Authorization': 'Bearer ' + current_app.config['FAEHUB_SSO_CLIENT_SECRET'],
        'Accept': 'application/json'})
    try:
        with build_opener(NoRedirect).open(req, timeout=8) as response:
            data = json.loads(response.read(16384))
            if not isinstance(data, dict):
                raise ValueError('Invalid identity response')
            return data
    except HTTPError as exc:
        if exc.code >= 500 or exc.code == 429:
            raise FederationError('FaeHub indisponível. Nenhum acesso foi liberado; tente novamente.', 503) from None
        raise FederationError('Não foi possível confirmar o acesso. Reabra a entrada com FaeHub.', 401) from None
    except (URLError, OSError, ValueError):
        raise FederationError('FaeHub indisponível. Nenhum acesso foi liberado; tente novamente.', 503) from None


def profile_for(token):
    data = hub_request('introspect', dict(token=token))
    profile = data.get('profile') or {}
    if not isinstance(profile, dict):
        raise FederationError('Resposta de identidade inválida.', 401)
    if (data.get('active') is not True or profile.get('iss') != current_app.config['FAEHUB_SSO_ORIGIN']
            or profile.get('aud') != 'faenet' or profile.get('role') not in ('aluno','professor','diretor','responsavel')):
        raise FederationError('Sua conta precisa de uma nova confirmação no FaeHub.', 401)
    try:
        uuid.UUID(profile['sub'])
        if not isinstance(profile['name'], str) or not 1 <= len(profile['name']) <= 160:
            raise ValueError()
    except (KeyError, ValueError, TypeError):
        raise FederationError('Resposta de identidade inválida.', 401) from None
    return profile


def destination(value):
    return value if value in ('/feed','/messages','/explore','/faemap','/faematch','/notifications','/profile','/hub') else '/feed'


def start(next_path):
    protector()
    state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(48)
    db.session.add(HubFlow(id=digest(state), verifier_ciphertext=protector().encrypt(verifier.encode()).decode(),
                           expires_at=int(time.time()) + 600))
    db.session.commit()
    session['hub_state'] = state
    session['hub_next'] = destination(next_path)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
    return current_app.config['FAEHUB_SSO_ORIGIN'] + '/sso/faenet/authorize?' + urlencode(dict(
        client_id='faenet', response_type='code', redirect_uri=current_app.config['FAEHUB_SSO_CALLBACK'],
        code_challenge=challenge, code_challenge_method='S256', state=state))


def callback(args):
    state = session.pop('hub_state', '')
    if (not state or not secrets.compare_digest(state, args.get('state', ''))
            or args.get('iss') != current_app.config['FAEHUB_SSO_ORIGIN']):
        raise FederationError('A confirmação expirou ou não pertence a esta sessão. Recomece.')
    flow = db.session.get(HubFlow, digest(state))
    if not flow or flow.expires_at <= time.time():
        raise FederationError('A confirmação expirou. Recomece.')
    try:
        verifier = protector().decrypt(flow.verifier_ciphertext.encode()).decode()
    except InvalidToken:
        raise FederationError('A confirmação expirou. Recomece.', 401) from None
    consumed = db.session.execute(delete(HubFlow).where(HubFlow.id == flow.id, HubFlow.expires_at > int(time.time())))
    db.session.commit()
    if consumed.rowcount != 1:
        raise FederationError('Confirmação já utilizada. Recomece.')
    data = hub_request('token', dict(grant_type='authorization_code', code=args.get('code',''),
        code_verifier=verifier, redirect_uri=current_app.config['FAEHUB_SSO_CALLBACK']))
    token = data.get('access_token', '')
    if not isinstance(token,str) or len(token) != 43:
        raise FederationError('Não foi possível concluir o acesso.', 401)
    profile = profile_for(token)
    link = db.session.get(HubLink, profile['sub'])
    if link:
        finish(link, token, profile)
        return False
    pending = secrets.token_urlsafe(32)
    db.session.add(HubPending(id=digest(pending), subject=profile['sub'],
        token_ciphertext=protector().encrypt(token.encode()).decode(), expires_at=int(time.time()) + 600))
    db.session.commit()
    logout_user()
    session['hub_pending'] = pending
    session['hub_link_csrf'] = secrets.token_urlsafe(32)
    return True


def pending_identity():
    raw = session.get('hub_pending', '')
    pending = db.session.get(HubPending, digest(raw)) if raw else None
    if not pending or pending.expires_at <= time.time() or pending.attempts >= 5:
        raise FederationError('A confirmação expirou. Reabra a entrada com FaeHub.', 401)
    try:
        token = protector().decrypt(pending.token_ciphertext.encode()).decode()
    except InvalidToken:
        raise FederationError('A confirmação expirou. Reabra a entrada com FaeHub.', 401) from None
    profile = profile_for(token)
    if profile['sub'] != pending.subject:
        raise FederationError('Confirmação inválida.', 401)
    return pending, token, profile


def link_or_create(fields, files=None):
    if not secrets.compare_digest(session.get('hub_link_csrf', ''), fields.get('csrf', '')) or not session.get('hub_link_csrf'):
        raise FederationError('Sessão expirada. Reabra a entrada com FaeHub.', 403)
    pending, token, profile = pending_identity()
    if fields.get('action') == 'link':
        # Limit ownership-proof attempts, not harmless profile-field corrections.
        count = db.session.execute(update(HubPending).where(HubPending.id == pending.id, HubPending.attempts < 5)
                                   .values(attempts=HubPending.attempts + 1))
        db.session.commit()
        if count.rowcount != 1:
            raise FederationError('Muitas tentativas. Recomece a confirmação.', 429)
        if fields.get('confirmation') != 'on':
            raise FederationError('Confirme que a conta antiga é sua antes de vinculá-la.', 403)
        username, password = fields.get('username','').strip().lower(), fields.get('password','')
        now = int(time.time())
        attempts = db.session.execute(text('''
            INSERT INTO faehub_link_attempts(id, attempts, until_at) VALUES(:id, 1, :until)
            ON CONFLICT(id) DO UPDATE SET
              attempts=CASE WHEN faehub_link_attempts.until_at<=:now THEN 1 ELSE faehub_link_attempts.attempts+1 END,
              until_at=CASE WHEN faehub_link_attempts.until_at<=:now THEN :until ELSE faehub_link_attempts.until_at END
            RETURNING attempts
        '''), dict(id=digest('link:' + username[:256]), now=now, until=now + 900)).scalar_one()
        db.session.commit()
        if attempts > 10:
            raise FederationError('Muitas tentativas para essa conta. Aguarde 15 minutos.', 429)
        user = db.session.get(User, username) if len(username) <= 60 else None
        if (not user or not 1 <= len(password) <= 128 or not user.check_password(password)
                or user.check_password('demo1234') or user.check_password('demo123')):
            raise FederationError('Não foi possível comprovar a conta antiga. Confira os dados; contas demo precisam de validação pelo proprietário.', 403)
        if db.session.query(HubLink).filter_by(username=user.username).first():
            raise FederationError('Essa conta já está vinculada. Entre com a conta FaeHub correspondente.', 409)
    elif fields.get('action') == 'create':
        from . import onboarding
        try:values,images=onboarding.validate(fields,files)
        except onboarding.ProfileError as exc:
            raise FederationError(exc.message,exc.status,exc.field) from None
        user = User(username='fh_' + profile['sub'].replace('-', ''), name=profile['name'], password_hash='!faehub-only')
        user.handle=values['handle']
        db.session.add(user)
    else:
        raise FederationError('Escolha vincular uma conta antiga ou criar seu perfil.')
    try:
        # HubLink has a foreign key but no ORM relationship to User. Flush the
        # parent before adding the link; PostgreSQL checks that FK immediately.
        db.session.flush()
        if fields.get('action') == 'create':
            onboarding.apply(user,values,images)
            db.session.flush()
        link = HubLink(subject=profile['sub'], username=user.username)
        db.session.add(link)
        consumed = db.session.execute(delete(HubPending).where(HubPending.id == pending.id, HubPending.expires_at > int(time.time())))
        if consumed.rowcount != 1:
            db.session.rollback()
            raise FederationError('Confirmação já utilizada. Recomece.', 409)
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        current_app.logger.error('FaeHub profile transaction rejected (SQLSTATE=%s)', getattr(exc.orig,'sqlstate','unknown'))
        if fields.get('action')=='create':
            raise FederationError('Este @ acabou de ser escolhido. Escolha outro ou reabra a entrada com FaeHub.',409,'handle') from None
        raise FederationError('Não foi possível salvar o perfil. Reabra a entrada com FaeHub e tente novamente.', 409) from None
    finish(link, token, profile)


def finish(link, token, profile):
    user = db.session.get(User, link.username)
    if not user:
        raise FederationError('Perfil indisponível.', 401)
    # School directors are NOT automatically social-network administrators.
    user.is_admin = profile.get('owner') is True
    sid = secrets.token_urlsafe(32)
    db.session.add(HubSession(id=digest(sid), subject=profile['sub'],
        token_ciphertext=protector().encrypt(token.encode()).decode(), expires_at=int(time.time()) + 43200))
    db.session.commit()
    next_path = session.get('hub_next', '/feed')
    logout_user()
    session.clear()
    login_user(user, remember=False)
    session.update(hub_session=sid, hub_csrf=secrets.token_urlsafe(32), hub_next=destination(next_path))


def validate_session():
    raw = session.get('hub_session', '')
    row = db.session.get(HubSession, digest(raw)) if raw else None
    if not row or row.expires_at <= time.time():
        raise FederationError('Entre com sua conta FaeHub para continuar.', 401)
    try:
        token = protector().decrypt(row.token_ciphertext.encode()).decode()
    except InvalidToken:
        raise FederationError('A sessão precisa ser confirmada novamente.', 401) from None
    profile = profile_for(token)
    link = db.session.get(HubLink, profile['sub'])
    if row.subject != profile['sub'] or not link or link.username != session.get('_user_id'):
        raise FederationError('Sessão inválida.', 401)
    user = db.session.get(User, link.username)
    owner = profile.get('owner') is True
    if user.is_admin != owner:
        user.is_admin = owner
        db.session.commit()


def logout():
    raw = session.get('hub_session', '')
    if raw:
        db.session.execute(delete(HubSession).where(HubSession.id == digest(raw)))
        db.session.commit()
    logout_user()
    session.clear()
