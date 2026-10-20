"""Identity bridge tests: isolated SQLite, fake FaeHub responses only."""
import os
import time
import unittest
from urllib.error import HTTPError
from unittest.mock import patch

os.environ.update(FLASK_ENV='testing',DATABASE_URL='sqlite:///:memory:',SECRET_KEY='isolated-tests-only')
from backend.app import app
from backend.extensions import db
from backend.models import User, Post, HubLink, HubSession, HubPending, HubLinkAttempt
from backend.services import federation as sso

SUBJECT='2e25726a-cbbb-4466-bfff-23a7b8e3ffac'
TOKEN='t'*43


class FederationTests(unittest.TestCase):
    def setUp(self):
        self.context=app.app_context();self.context.push()
        app.config.update(FAEHUB_LOGIN_REQUIRED=True,FAEHUB_SSO_CLIENT_SECRET='x'*64)
        db.create_all();self.client=app.test_client()
        self.profile=dict(sub=SUBJECT,name='Pessoa Teste',role='aluno',owner=False,
                          iss='https://faehub-plus.onrender.com',aud='faenet')
        self.mock=patch('backend.services.federation.hub_request',side_effect=self.hub);self.mock.start()

    def tearDown(self):
        self.mock.stop();db.session.remove();db.drop_all();self.context.pop()
        app.config['FAEHUB_LOGIN_REQUIRED']=False

    def hub(self,endpoint,fields):
        return dict(access_token=TOKEN) if endpoint=='token' else dict(active=True,profile=self.profile)

    def callback(self):
        start=self.client.get('/auth/faehub/start?next=/messages')
        self.assertIn('code_challenge_method=S256',start.location)
        with self.client.session_transaction() as session:state=session['hub_state']
        return self.client.get('/auth/faehub/callback',query_string=dict(state=state,code='c'*43,iss=self.profile['iss']))

    def complete(self,**data):
        with self.client.session_transaction() as session:csrf=session['hub_link_csrf']
        return self.client.post('/auth/faehub/link',data=dict(csrf=csrf,**data))

    def test_legacy_routes_remember_cookie_and_upload_cannot_bypass(self):
        for route in ('/api/auth/register','/api/auth/login'):
            self.assertEqual(self.client.post(route,json=dict(username='someone',password='pw')).status_code,403)
        with self.client.session_transaction() as session:session['_user_id']='someone'
        self.assertEqual(self.client.get('/api/me').status_code,401)
        self.assertEqual(self.client.get('/uploads/posts/private.png').status_code,401)
        self.assertEqual(HubLink.query.count(),0)

    def test_callback_state_is_required_and_one_time(self):
        self.assertEqual(self.client.get('/auth/faehub/callback?state=forged').status_code,400)
        self.assertEqual(self.callback().location,'/auth/faehub/link')
        with self.client.session_transaction() as session:self.assertNotIn(TOKEN,str(dict(session)))
        self.assertNotIn(TOKEN,HubPending.query.one().token_ciphertext)
        self.assertEqual(self.client.get('/auth/faehub/callback?state=forged').status_code,400)

    def test_create_unique_profile_no_password_no_admin_and_csrf(self):
        self.callback();self.assertEqual(self.complete(action='create').location,'/messages')
        self.assertEqual(User.query.one().name,'Pessoa Teste');self.assertFalse(User.query.one().is_admin)
        self.assertEqual(User.query.one().password_hash,'!faehub-only')
        with self.client.session_transaction() as session:
            self.assertNotIn(TOKEN,str(dict(session)));csrf=session['hub_csrf']
        self.assertNotIn(TOKEN,HubSession.query.one().token_ciphertext)
        self.assertEqual(self.client.get('/api/me').status_code,200)
        self.assertEqual(self.client.post('/api/me/online').status_code,403)
        self.assertEqual(self.client.post('/api/me/online',headers={'X-FaeNet-CSRF':csrf}).status_code,200)

    def test_link_requires_password_confirmation_and_preserves_posts(self):
        user=User(username='old.person',name='Nome Antigo',password_hash='unused',is_admin=True)
        user.set_password('private-password-test');db.session.add(user);db.session.flush()
        db.session.add(Post(id='historic',username=user.username,content='Preservado'));db.session.commit()
        self.callback()
        self.assertEqual(self.complete(action='link',username='old.person',password='wrong',confirmation='on').status_code,403)
        self.assertEqual(self.complete(action='link',username='old.person',password='private-password-test').status_code,403)
        self.assertEqual(self.complete(action='link',username='old.person',password='private-password-test',confirmation='on').status_code,303)
        self.assertEqual(HubLink.query.one().username,'old.person');self.assertEqual(Post.query.one().content,'Preservado')
        self.assertEqual(User.query.one().name,'Nome Antigo');self.assertFalse(User.query.one().is_admin)

    def test_known_demo_password_is_not_ownership_proof(self):
        user=User(username='demo',name='Old Demo',password_hash='unused');user.set_password('demo1234');db.session.add(user);db.session.commit()
        self.callback()
        for _ in range(4):self.assertEqual(self.complete(action='link',username='demo',password='demo1234',confirmation='on').status_code,403)
        self.assertEqual(self.complete(action='link',username='demo',password='demo1234',confirmation='on').status_code,401)
        self.assertEqual(self.complete(action='create').status_code,401)
        self.assertEqual(HubLink.query.count(),0)

    def test_revocation_outage_and_existing_link(self):
        self.callback();self.complete(action='create')
        with patch('backend.services.federation.hub_request',return_value=dict(active=False)):
            self.assertEqual(self.client.get('/api/me').status_code,401)
        self.assertEqual(HubSession.query.count(),0)
        self.assertEqual(self.callback().location,'/messages')
        with patch('backend.services.federation.hub_request',side_effect=sso.FederationError('Indisponível',503)):
            self.assertEqual(self.client.get('/api/me').status_code,503)
        self.assertEqual(HubSession.query.count(),1)

    def test_owner_only_admin_and_unsafe_next(self):
        self.profile.update(role='diretor',owner=True)
        self.callback();self.complete(action='create');self.assertTrue(User.query.one().is_admin)
        self.assertEqual(sso.destination('https://evil.example'),'/feed')
        self.profile['owner']=False
        self.assertEqual(self.client.get('/api/me').status_code,200)
        self.assertFalse(User.query.one().is_admin)

    def test_long_hub_display_name_is_not_rejected_or_truncated(self):
        self.profile['name']='Nome ' + 'A'*150
        self.callback()
        self.assertEqual(self.complete(action='create').status_code,303)
        self.assertEqual(User.query.one().name,self.profile['name'])

    def test_expired_pending_invalid_csrf_and_duplicate_link_preserve_data(self):
        self.callback()
        self.assertEqual(self.client.post('/auth/faehub/link',data=dict(action='create',csrf='bad')).status_code,403)
        pending=HubPending.query.one();pending.expires_at=int(time.time())-1;db.session.commit()
        self.assertEqual(self.complete(action='create').status_code,401)
        self.assertEqual(User.query.count(),0)

    def test_link_rate_limit_survives_restarting_confirmation(self):
        for _ in range(10):
            self.callback()
            self.assertEqual(self.complete(action='link',username='target',password='wrong',confirmation='on').status_code,403)
        self.callback()
        self.assertEqual(self.complete(action='link',username='target',password='wrong',confirmation='on').status_code,429)
        self.assertEqual(HubLinkAttempt.query.one().attempts,11)
        HubLinkAttempt.query.one().until_at=int(time.time())-1;db.session.commit()
        self.assertEqual(self.complete(action='link',username='target',password='wrong',confirmation='on').status_code,403)
        self.assertEqual(HubLinkAttempt.query.one().attempts,1)

    def test_key_rotation_and_malformed_profile_fail_closed(self):
        self.callback()
        app.config['FAEHUB_SSO_CLIENT_SECRET']='y'*64
        self.assertEqual(self.client.get('/auth/faehub/link').status_code,401)
        app.config['FAEHUB_SSO_CLIENT_SECRET']='x'*64
        with patch('backend.services.federation.hub_request',return_value=dict(active=True,profile=['invalid'])):
            self.assertEqual(self.client.get('/auth/faehub/link').status_code,401)

    def test_remote_http_outage_does_not_become_a_credentials_error(self):
        self.mock.stop()
        try:
            with patch('backend.services.federation.build_opener') as opener:
                opener.return_value.open.side_effect=HTTPError('https://example.invalid',503,'unavailable',{},None)
                with self.assertRaises(sso.FederationError) as failure:sso.hub_request('introspect',dict(token=TOKEN))
                self.assertEqual(failure.exception.status,503)
        finally:self.mock.start()


if __name__=='__main__':unittest.main()
