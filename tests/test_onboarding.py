"""Chosen public identity, persistent images and migration-safe onboarding."""
from io import BytesIO
import unittest
from unittest.mock import patch

from PIL import Image
from werkzeug.datastructures import FileStorage
import test_federation as fixture
from backend.app import app
from backend.extensions import db
from backend.models import User, Post, HubLink, ProfileImage, Notification, followers
from backend.services import onboarding


def photo():
    output=BytesIO()
    Image.new('RGB',(640,480),'#4455aa').save(output,'PNG')
    output.seek(0)
    return output


class OnboardingTests(unittest.TestCase):
    setUp=fixture.FederationTests.setUp
    tearDown=fixture.FederationTests.tearDown
    hub=fixture.FederationTests.hub
    callback=fixture.FederationTests.callback
    complete=fixture.FederationTests.complete

    def csrf(self):
        with self.client.session_transaction() as session:return session['hub_csrf']

    def test_real_choices_persist_and_images_are_normalized_and_protected(self):
        self.callback()
        result=self.complete(action='create',handle='Minha.Pessoa',name='Minha Pessoa',bio='Minha bio',curso='Redes',turma='3110',avatar=(photo(),'foto.png'),banner=(photo(),'capa.png'))
        self.assertEqual(result.status_code,303,result.data.decode())
        user=User.query.one()
        self.assertTrue(user.username.startswith('fh_'))
        self.assertEqual((user.handle,user.name,user.bio,user.curso,user.turma),('minha.pessoa','Minha Pessoa','Minha bio','Redes','3110'))
        self.assertTrue(user.profile_complete)
        self.assertEqual(ProfileImage.query.count(),2)
        for kind,size in [('avatar',(320,320)),('banner',(1280,480))]:
            response=self.client.get(f'/api/users/minha.pessoa/image/{kind}')
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.mimetype,'image/jpeg')
            self.assertEqual(Image.open(BytesIO(response.data)).size,size)
            self.assertLess(len(response.data),400*1024)
            self.assertEqual(response.headers['Cache-Control'],'no-store')
        anonymous=app.test_client()
        self.assertEqual(anonymous.get('/api/users/minha.pessoa/image/avatar').status_code,401)

    def test_collision_name_validation_and_reserved_handles_allow_correction(self):
        db.session.add(User(username='legacy',handle='ocupado',name='Outra Pessoa',password_hash='unused'))
        db.session.commit();self.callback()
        for handle in ('OCUPADO','LEGACY','fh_abc','online','suggestions','a','com espaço'):
            self.assertIn(self.complete(action='create',handle=handle).status_code,(409,422))
            self.assertEqual(HubLink.query.count(),0)
        for name in ('Nome','Nome 123','Nome -',''):
            self.assertEqual(self.complete(action='create',name=name).status_code,422)
        self.assertEqual(self.complete(action='create',handle='livre',name='Pessoa Nova').status_code,303)
        self.assertEqual(User.query.count(),2)

    def test_file_rejection_is_atomic_and_does_not_consume_pending(self):
        self.callback()
        result=self.complete(action='create',avatar=(BytesIO(b'<svg></svg>'),'foto.jpg'))
        self.assertEqual(result.status_code,422)
        self.assertEqual((User.query.count(),HubLink.query.count(),ProfileImage.query.count()),(0,0,0))
        self.assertEqual(self.complete(action='create',handle='corrigido').status_code,303)

    def test_existing_generated_profile_must_finish_without_losing_relations(self):
        self.callback();self.complete(action='create')
        user=User.query.one();key=user.username
        user.profile_complete=False;user.handle=None
        db.session.add(User(username='other',name='Outra Pessoa',password_hash='unused'))
        db.session.flush()
        db.session.add(Post(id='kept',username=key,content='Conteúdo preservado'))
        db.session.execute(followers.insert().values(follower_id='other',followed_id=key))
        db.session.commit()
        self.assertEqual(self.client.get('/api/posts').status_code,428)
        self.assertEqual(self.client.get('/api/me').status_code,200)
        self.assertEqual(self.callback().location,'/auth/faehub/profile')
        self.assertEqual(self.client.get('/auth/faehub/profile').status_code,200)
        self.assertEqual(self.client.post('/auth/faehub/profile',data=dict(csrf='invalid',handle='novo.nome',name='Novo Nome')).status_code,403)
        result=self.client.post('/auth/faehub/profile',data=dict(csrf=self.csrf(),handle='novo.nome',name='Novo Nome',bio='Nova bio',avatar=(photo(),'foto.png')))
        self.assertEqual(result.status_code,303,result.data.decode())
        self.assertEqual(db.session.get(User,key).handle,'novo.nome')
        self.assertEqual(Post.query.one().username,key)
        self.assertEqual(HubLink.query.one().username,key)
        self.assertEqual(db.session.query(followers).count(),1)
        profile=self.client.get('/api/users/novo.nome').json['data']
        self.assertTrue(profile['is_me']);self.assertEqual(profile['followers_count'],1)
        self.assertEqual(self.client.get('/api/users/novo.nome/posts').json['data'][0]['id'],'kept')

    def test_edit_keeps_id_and_existing_photo_and_cannot_elevate_role(self):
        self.callback();self.complete(action='create',avatar=(photo(),'foto.png'))
        user=User.query.one();key=user.username;image=user.avatar_img
        result=self.client.post('/auth/faehub/profile',data=dict(csrf=self.csrf(),handle='outro.nome',name='Outro Nome',is_admin='true'))
        self.assertEqual(result.status_code,303)
        self.assertEqual((user.username,user.avatar_img,user.is_admin),(key,image,False))
        self.assertEqual(self.client.get('/api/users/outro.nome').json['data']['handle'],'outro.nome')

    def test_large_and_misleading_images_rejected(self):
        for data in (b'',b'x'*(5*1024*1024+1),b'not an image'):
            with self.assertRaises(onboarding.ProfileError):
                onboarding.normalize_image(FileStorage(stream=BytesIO(data),filename='fake.png'),'avatar')

    def test_all_active_roles_can_choose_identity_without_becoming_admin(self):
        for role in ('aluno','professor','diretor','responsavel'):
            with self.subTest(role=role):
                self.profile['role']=role
                self.profile['sub']=f'2e25726a-cbbb-4466-bfff-{len(role):012d}'
                self.callback()
                self.assertEqual(self.complete(action='create',handle='perfil.'+role).status_code,303)
                self.assertFalse(User.query.filter_by(handle='perfil.'+role).one().is_admin)

    def test_autoflush_race_rolls_back_handle_and_photo(self):
        self.callback();self.complete(action='create')
        user=User.query.one();old=user.handle
        from sqlalchemy.exc import IntegrityError
        with patch('backend.services.onboarding.apply',side_effect=IntegrityError('update',{},Exception('duplicate'))):
            with self.assertRaises(onboarding.ProfileError):
                onboarding.complete_existing(user,dict(handle='livre.novo',name='Pessoa Nova'),{})
        self.assertEqual(db.session.get(User,user.username).handle,old)

    def test_long_display_name_and_actor_identity_survive_notifications(self):
        self.callback();self.complete(action='create',name='Pessoa '+'A'*150)
        user=User.query.one();key=user.username
        target=User(username='recipient',handle='destino',name='Outra Pessoa',password_hash='unused')
        db.session.add(target);db.session.commit()
        from backend.services import user_service, message_service
        user_service.follow_user(user,'destino')
        notification=Notification.query.one().to_dict()
        self.assertEqual(notification['meta']['username'],key)
        self.assertLessEqual(len(notification['from_name']),120)
        onboarding.complete_existing(user,dict(handle='mudou.nome',name='Nome Alterado'),{})
        self.assertEqual(onboarding.find_user(notification['meta']['username']).handle,'mudou.nome')
        user.name='Pessoa '+'A'*150;db.session.commit()
        message_service.send_message(sender=user,to_user='recipient',text='Oi')
        self.assertTrue(all(len(n.text)<=200 and len(n.from_name)<=120 for n in Notification.query.all()))


if __name__=='__main__':unittest.main()
