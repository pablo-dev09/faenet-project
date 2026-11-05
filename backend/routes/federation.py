"""Entry, callback and proof-of-ownership linking for FaeHub accounts."""
import secrets
from flask import Blueprint, current_app, jsonify, redirect, render_template, request, session
from cryptography.fernet import InvalidToken
from ..services import federation as sso
from ..services import onboarding
from ..extensions import db
from ..models import User

federation_bp = Blueprint('federation', __name__)


@federation_bp.get('/api/auth/options')
def options():
    session.setdefault('hub_csrf', secrets.token_urlsafe(32))
    return jsonify(ok=True, data=dict(faehub_only=sso.required(), csrf=session['hub_csrf']))


def failure(error):
    return render_template('faehub_identity.html', error=error.message, pending=False), error.status


@federation_bp.get('/auth/faehub/start')
def start():
    if not sso.required():
        return redirect('/login')
    try:
        return redirect(sso.start(request.args.get('next', '/feed')))
    except sso.FederationError as exc:
        return failure(exc)


@federation_bp.get('/auth/faehub/callback')
def callback():
    if not sso.required():
        return redirect('/login')
    try:
        pending = sso.callback(request.args)
        if not pending and not db.session.get(User,session['_user_id']).profile_complete:
            return redirect('/auth/faehub/profile',code=303)
        return redirect('/auth/faehub/link' if pending else sso.destination(session.pop('hub_next', '/feed')), code=303)
    except (sso.FederationError, InvalidToken) as exc:
        return failure(exc if isinstance(exc, sso.FederationError) else sso.FederationError('Recomece a confirmação.', 401))


@federation_bp.route('/auth/faehub/link', methods=['GET', 'POST'])
def link():
    if not sso.required():
        return redirect('/login')
    error = None
    try:
        if request.method == 'POST':
            sso.link_or_create(request.form,request.files)
            return redirect(sso.destination(session.pop('hub_next', '/feed')), code=303)
        _, _, profile = sso.pending_identity()
    except sso.FederationError as exc:
        if exc.status in (401, 503):
            return failure(exc)
        error = exc
        try:
            _, _, profile = sso.pending_identity()
        except sso.FederationError as expired:
            return failure(expired)
    return render_template('faehub_identity.html', pending=True, profile=profile,
                           csrf=session['hub_link_csrf'], field_error=error.field if error else None,
                           error=error.message if error else None), error.status if error else 200


@federation_bp.route('/auth/faehub/profile',methods=['GET','POST'])
def profile_setup():
    if not sso.required():return redirect('/login')
    error=None
    try:
        sso.validate_session()
        user=db.session.get(User,session['_user_id'])
        if request.method=='POST':
            if not session.get('hub_csrf') or not secrets.compare_digest(session['hub_csrf'],request.form.get('csrf','')):
                raise sso.FederationError('Sessão expirada. Reabra a entrada com FaeHub.',403)
            onboarding.complete_existing(user,request.form,request.files)
            return redirect(sso.destination(session.pop('hub_next','/feed')),code=303)
    except sso.FederationError as exc:return failure(exc)
    except onboarding.ProfileError as exc:error=exc
    return render_template('faehub_identity.html',pending=True,editing=True,profile=user,
        csrf=session['hub_csrf'],field_error=error.field if error else None,error=error.message if error else None), error.status if error else 200


def install_guards(app):
    @app.before_request
    def faehub_access():
        if not sso.required():
            return None
        protected = request.path.startswith(('/api/', '/uploads/'))
        if not protected or request.path == '/api/auth/options':
            return None
        if request.path in ('/api/auth/login', '/api/auth/register'):
            return jsonify(ok=False, error=dict(message='Use Entrar com FaeHub. O cadastro independente está fechado.')), 403
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            if (not session.get('hub_csrf') or not secrets.compare_digest(
                    session['hub_csrf'], request.headers.get('X-FaeNet-CSRF', ''))):
                return jsonify(ok=False, error=dict(message='Sessão expirada. Atualize a página.')), 403
        if request.path == '/api/auth/logout':
            sso.logout()
            return jsonify(ok=True, data=dict(message='Sessão encerrada.'))
        try:
            sso.validate_session()
        except sso.FederationError as exc:
            if exc.status == 401:
                sso.logout()
            return jsonify(ok=False, error=dict(message=exc.message)), exc.status
        user=db.session.get(User,session['_user_id'])
        if not user.profile_complete and not (request.path=='/api/me' and request.method=='GET'):
            return jsonify(ok=False,error=dict(message='Escolha seu @ e conclua seu perfil para continuar.',code='profile_setup_required')),428

    @app.after_request
    def privacy(response):
        if request.path.startswith(('/auth/', '/api/', '/uploads/')):
            response.headers['Cache-Control'] = 'no-store'
            response.headers['Referrer-Policy'] = 'no-referrer'
            response.headers['X-Frame-Options'] = 'DENY'
            response.headers['X-Content-Type-Options'] = 'nosniff'
        return response
