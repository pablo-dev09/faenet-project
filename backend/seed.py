"""
FaeNet - Dados de demonstracao
==============================
Popula o banco com usuarios, publicacoes, estagios, provas e topicos
de forum. Util para ver a interface sem precisar criar tudo manualmente.

Aviso: este seed cria contas com senhas conhecidas. Em producao,
substitua ou remova estas contas.
"""

from datetime import datetime, timedelta

from .extensions import db
from .models import (
    HubItem,
    Notification,
    Post,
    User,
    followers,
    post_likes,
)


DEMO_USERS = [
    {
        "username": "pablo",
        "password": "demo1234",
        "name": "Pablo Sousa",
        "curso": "Informatica",
        "turma": "3 Ano - Informatica",
        "bio": "Dev full-stack & fundador da FaeNet. Amante de redes, IA e boa UI.",
    },
    {
        "username": "marlon",
        "password": "demo1234",
        "name": "Marlon Amaral",
        "curso": "Informatica",
        "turma": "3 Ano - Informatica",
        "bio": "Back-end Flask, SQL e tudo que roda no servidor.",
    },
    {
        "username": "aline",
        "password": "demo1234",
        "name": "Profa. Aline Serrão",
        "curso": "Informatica",
        "turma": "Docente",
        "bio": "Professora orientadora do projeto FaeNet.",
    },
    {
        "username": "luciana",
        "password": "demo1234",
        "name": "Profa. Luciana Teixeira",
        "curso": "Informatica",
        "turma": "Docente",
        "bio": "Professora co-orientadora. Banco de dados e sistemas.",
    },
    {
        "username": "rafael",
        "password": "demo1234",
        "name": "Rafael Costa",
        "curso": "Informatica",
        "turma": "2 Ano - Informatica",
        "bio": "Front-end, design e um cafe na mao.",
    },
    {
        "username": "beatriz",
        "password": "demo1234",
        "name": "Beatriz Lima",
        "curso": "Informatica",
        "turma": "3 Ano - Informatica",
        "bio": "Seguranca da informacao e CTF nas horas vagas.",
    },
]


def _create_user(data: dict) -> User:
    user = User.query.get(data["username"])
    if not user:
        user = User(
            username=data["username"],
            name=data["name"],
            curso=data.get("curso"),
            turma=data.get("turma"),
            bio=data.get("bio"),
        )
        user.set_password(data["password"])
        db.session.add(user)
    else:
        # Atualiza dados basicos para refletir o seed.
        user.name = data["name"]
        user.curso = data.get("curso")
        user.turma = data.get("turma")
        user.bio = data.get("bio")
    return user


def _follow(a: str, b: str) -> None:
    """Cria follow de a -> b se nao existir."""
    exists = db.session.query(followers).filter_by(follower_id=a, followed_id=b).first()
    if not exists:
        db.session.execute(followers.insert().values(follower_id=a, followed_id=b))


def _like(user: str, post_id: str) -> None:
    exists = db.session.query(post_likes).filter_by(user_id=user, post_id=post_id).first()
    if not exists:
        db.session.execute(post_likes.insert().values(user_id=user, post_id=post_id))


def _make_post(username: str, content: str, hours_ago: int = 1, images: list[str] | None = None, poll: dict | None = None) -> Post:
    post = Post(username=username, content=content)
    post.images = images or []
    post.poll = poll
    post.timestamp = datetime.utcnow() - timedelta(hours=hours_ago)
    db.session.add(post)
    db.session.flush()  # garante o ID do post para uso em likes/seguidores
    return post


def _make_hub(curso: str, item_type: str, username: str, title: str, content: str, extra: dict | None = None, hours_ago: int = 12) -> HubItem:
    item = HubItem(
        curso=curso,
        item_type=item_type,
        username=username,
        title=title,
        content=content,
    )
    item.extra = extra or {}
    item.timestamp = datetime.utcnow() - timedelta(hours=hours_ago)
    db.session.add(item)
    return item


def seed_demo_data() -> None:
    """Cria/atualiza dados de demonstracao."""
    # Usuarios
    users = {u["username"]: _create_user(u) for u in DEMO_USERS}
    db.session.flush()

    # Seguidores: rede coerente
    _follow("marlon", "pablo")
    _follow("aline", "pablo")
    _follow("luciana", "pablo")
    _follow("rafael", "pablo")
    _follow("beatriz", "pablo")
    _follow("pablo", "aline")
    _follow("pablo", "luciana")
    _follow("pablo", "rafael")
    _follow("marlon", "rafael")
    _follow("rafael", "beatriz")
    _follow("beatriz", "marlon")
    db.session.flush()

    # Publicacoes (apenas se ainda nao houver nenhuma)
    if not Post.query.first():
        p1 = _make_post(
            "pablo",
            "Bem-vindos a FaeNet! 🚀 Primeira publicacao oficial da rede academica da ETESC. "
            "Aqui a gente se conecta, troca ideias e compartilha o que rola no curso. "
            "Se curtiu, deixa um like e segue quem ta construindo isso aqui comigo.",
            hours_ago=2,
        )
        p2 = _make_post(
            "marlon",
            "Backend Flask no ar. API REST pronta pra desktop e, no futuro, tambem pro app. "
            "Stack: Flask + SQLAlchemy + Supabase/PostgreSQL. Login, feed, stories, mensagens, hub. "
            "Tudo organizado pra escalar com a FaeNet.",
            hours_ago=4,
        )
        p3 = _make_post(
            "rafael",
            "Acabei de fechar o layout da sidebar. Tema escuro com a identidade que a gente combinou - "
            "elegante, academico e com cara de produto de verdade. Bora?",
            hours_ago=6,
        )
        p4 = _make_post(
            "beatriz",
            "Alguem mais ta estudando pra prova de Redes semana que vem? Topico: TCP/IP e Camadas OSI. "
            "Se quiserem montar um grupo de estudo, comenta aqui.",
            hours_ago=8,
            poll={
                "question": "Quando a gente marca o grupo de estudo?",
                "options": [
                    {"text": "Terca a noite", "votes": 0, "voters": []},
                    {"text": "Quarta a tarde", "votes": 0, "voters": []},
                    {"text": "Sexta de manha", "votes": 0, "voters": []},
                    {"text": "Sabado a tarde", "votes": 0, "voters": []},
                ],
            },
        )
        p5 = _make_post(
            "aline",
            "Lembrando que a entrega do projeto final foi adiada para a proxima sexta. "
            "Quem tiver duvidas, abre um topico no Hub do Curso - Forum. A gente responde por la.",
            hours_ago=10,
        )
        p6 = _make_post(
            "luciana",
            "Publicadas as notas de Banco de Dados no mural. Parabens a todos pelo semestre! "
            "Bora descansar um pouco antes do proximo. ✨",
            hours_ago=14,
        )
        p7 = _make_post(
            "marlon",
            "Encontrei um bug bem doido no post de enquete antigo. Ja consertei. "
            "Quem tiver registrado algum problema, manda no privado.",
            hours_ago=20,
        )

        # Likes
        _like("pablo", p2.id)
        _like("marlon", p1.id)
        _like("rafael", p1.id)
        _like("beatriz", p1.id)
        _like("aline", p1.id)
        _like("pablo", p3.id)
        _like("marlon", p3.id)
        _like("rafael", p4.id)
        _like("pablo", p4.id)
        _like("marlon", p5.id)
        _like("rafael", p5.id)
        _like("beatriz", p5.id)

    # Hub do Curso - estagios, provas, forum
    if not HubItem.query.first():
        # Estagios
        _make_hub(
            curso="Informatica",
            item_type="estagio",
            username="aline",
            title="Estagio em Desenvolvimento Web - Empresa X",
            content="Vaga para estagiario em desenvolvimento web full-stack. "
                    "Conhecimentos em Python, JavaScript e bancos relacionais.",
            extra={
                "empresa": "Empresa X Tecnologia",
                "prazo": "2026-09-30",
                "link": "https://exemplo.com/vagas/estagio-web",
                "tags": "python, flask, javascript",
            },
            hours_ago=3,
        )
        _make_hub(
            curso="Informatica",
            item_type="estagio",
            username="luciana",
            title="Estagio em Suporte Tecnico - ETESC",
            content="A escola abriu 2 vagas para estagio de suporte tecnico no laboratorio.",
            extra={
                "empresa": "ETESC - Laboratorio",
                "prazo": "2026-09-20",
                "link": "",
                "tags": "suporte, redes",
            },
            hours_ago=30,
        )

        # Provas
        _make_hub(
            curso="Informatica",
            item_type="prova",
            username="aline",
            title="Prova de Programacao Web",
            content="Avaliacao sobre Flask, SQLAlchemy e APIs REST. "
                    "Estudar pelo material do classroom.",
            extra={
                "disciplina": "Programacao Web",
                "data": "2026-09-12",
                "conteudo": "Flask, SQLAlchemy, REST, templates",
            },
            hours_ago=5,
        )
        _make_hub(
            curso="Informatica",
            item_type="prova",
            username="luciana",
            title="Prova de Banco de Dados",
            content="Modelagem, normalizacao e SQL. Trazer calculadora.",
            extra={
                "disciplina": "Banco de Dados",
                "data": "2026-09-18",
                "conteudo": "Modelagem, SQL, normalizacao",
            },
            hours_ago=24,
        )

        # Forum - topicos
        t1 = _make_hub(
            curso="Informatica",
            item_type="forum_topic",
            username="beatriz",
            title="Como funciona o relacionamento many-to-many no SQLAlchemy?",
            content="To tentando modelar seguidores no FaeNet. Alguem consegue me explicar "
                    "a diferenca entre usar uma tabela associativa explicita e o parametro ``secondary``?",
            extra={"tags": "sqlalchemy, banco, flask"},
            hours_ago=12,
        )
        _make_hub(
            curso="Informatica",
            item_type="forum_topic",
            username="rafael",
            title="Qual a melhor forma de organizar o CSS de uma SPA?",
            content="Estou separando em global, layout, components e responsive. "
                    "Faz sentido ou eh exagero?",
            extra={"tags": "css, frontend, arquitetura"},
            hours_ago=20,
        )

        # Respostas
        if t1.id:
            db.session.flush()
            r1 = HubItem(
                curso="Informatica",
                item_type="forum_answer",
                parent_id=t1.id,
                username="marlon",
                title=None,
                content="A tabela associativa explicita te da mais controle (adicionar colunas, "
                        "consultas customizadas). O ``secondary`` eh mais enxuto mas menos flexivel. "
                        "Pra algo como seguidores, vai de tabela explicita.",
            )
            r1.timestamp = datetime.utcnow() - timedelta(hours=10)
            db.session.add(r1)

    # Notificacoes iniciais
    if not Notification.query.first():
        n1 = Notification(
            to_user="pablo",
            from_name="Marlon Amaral",
            from_avatar_text="MA",
            from_avatar_img=None,
            notif_type="follow",
            text="Marlon Amaral comecou a seguir voce",
        )
        n1.timestamp = datetime.utcnow() - timedelta(hours=1)
        n2 = Notification(
            to_user="pablo",
            from_name="Rafael Costa",
            from_avatar_text="RC",
            from_avatar_img=None,
            notif_type="like",
            text="Rafael Costa curtiu sua publicacao",
        )
        n2.timestamp = datetime.utcnow() - timedelta(hours=2)
        n3 = Notification(
            to_user="pablo",
            from_name="Beatriz Lima",
            from_avatar_text="BL",
            from_avatar_img=None,
            notif_type="comment",
            text="Beatriz Lima comentou: Ficou show!",
        )
        n3.timestamp = datetime.utcnow() - timedelta(hours=3)
        db.session.add_all([n1, n2, n3])

    db.session.commit()
