# FaeNet

> A rede social academica da ETESC.
> Conectando alunos, professores e colaboradores em uma comunidade digital exclusiva para o ambiente escolar.

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0-green)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#licenca)

FaeNet e uma aplicacao web completa inspirada em redes sociais modernas (feed, stories, mensagens, perfil, hub academico). Foi arquitetada desde o inicio para futuramente ser empacotada como aplicativo Android/iOS via **Capacitor** sem reescrever o sistema.

---

## Sumario

1. [Tecnologias](#tecnologias)
2. [Funcionalidades](#funcionalidades)
3. [Estrutura de pastas](#estrutura-de-pastas)
4. [Como instalar e rodar localmente](#como-instalar-e-rodar-localmente)
5. [Como configurar o banco de dados](#como-configurar-o-banco-de-dados)
6. [Como popular dados de demonstracao](#como-popular-dados-de-demonstracao)
7. [Como fazer deploy](#como-fazer-deploy)
8. [Como transformar em aplicativo com Capacitor](#como-transformar-em-aplicativo-com-capacitor)
9. [Endpoints da API](#endpoints-da-api)
10. [Licenca](#licenca)

---

## Tecnologias

### Backend

- **Python 3.10+** com **Flask 3**
- **Flask-SQLAlchemy** como ORM
- **Flask-Login** para autenticacao baseada em sessao (cookie httpOnly)
- **Werkzeug** para hash seguro de senhas (pbkdf2:sha256)
- **Supabase/PostgreSQL** como banco persistente
- Estrutura modular: `models/`, `routes/`, `services/`, `utils/`

### Frontend

- **HTML5 + CSS3 + JavaScript puro** (sem framework pesado)
- Tema escuro com gradientes (Syne + DM Sans)
- Responsivo: desktop, notebook, tablet, mobile
- SPA com roteamento por History API

---

## Funcionalidades

- Cadastro e login com hash seguro
- Feed com publicacoes, ate 6 imagens e enquetes
- Stories de 24h (imagem + legenda)
- Curtir, comentar, repostar, salvar
- Mensagens privadas com texto, imagem, arquivo e respostas
- Perfil editavel (avatar, banner com suporte a GIF, bio, turma)
- Seguir / deixar de seguir com lista de seguidores e seguindo
- Explorar: busca com debounce + grade de pessoas + publicacoes recentes
- Notificacoes (curtidas, comentarios, seguidores, mensagens)
- Indicador de usuarios online (heartbeat a cada 30s)
- FaeMatch: conexoes profissionais por habilidades, interesses e projetos
- FaeMap: mapa 3D do campus com presenca online voluntaria e localizacao aproximada
- FaeHub+: apresentacao integrada do novo portal academico da ETESC
- Redirecionamento configuravel da area FaeHub+ para o portal academico
- Interface administrativa (usuario com `is_admin`) pode apagar qualquer item
- Toasts, modais, loading states, empty states, confirmacoes

---

## Estrutura de pastas

```
faenet/
├── backend/                    # Backend Flask
│   ├── app.py                  # Application factory
│   ├── config.py               # Configuracoes (dev/prod/testing)
│   ├── extensions.py           # Instancias Flask-SQLAlchemy/Login
│   ├── seed.py                 # Dados de demonstracao
│   ├── models/                 # Modelos SQLAlchemy
│   │   ├── user.py
│   │   ├── post.py
│   │   ├── story.py
│   │   ├── message.py
│   │   ├── notification.py
│   │   ├── hub.py
│   │   └── associations.py
│   ├── routes/                 # Blueprints HTTP
│   │   ├── auth.py
│   │   ├── me.py
│   │   ├── posts.py
│   │   ├── stories.py
│   │   ├── users.py
│   │   ├── messages.py
│   │   ├── notifications.py
│   │   ├── hub.py
│   │   ├── uploads.py
│   │   └── pages.py
│   ├── services/               # Logica de negocio
│   │   ├── auth_service.py
│   │   ├── post_service.py
│   │   ├── user_service.py
│   │   ├── story_service.py
│   │   ├── message_service.py
│   │   ├── notification_service.py
│   │   └── hub_service.py
│   ├── utils/                  # Helpers (respostas, seguranca, uploads)
│   │   ├── responses.py
│   │   ├── security.py
│   │   └── uploads.py
│   └── uploads/                # Arquivos enviados (criado em runtime)
│       ├── avatars/
│       ├── banners/
│       ├── posts/
│       ├── stories/
│       └── messages/
│
├── frontend/                   # SPA servida pelo Flask
│   ├── index.html
│   ├── css/
│   │   ├── global.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   ├── responsive.css
│   │   └── experience.css      # Identidade visual e FaeMap
│   └── js/
│       ├── app.js              # SPA principal
│       ├── api.js              # Wrapper de fetch
│       ├── auth.js
│       ├── feed.js
│       ├── profile.js
│       ├── messages.js
│       ├── faematch.js          # Conexoes e projetos colaborativos
│       ├── faemap.js            # Mapa 3D e presenca no campus
│       ├── hub.js
│       ├── notifications.js
│       ├── explore.js
│       └── utils.js
│
├── supabase/migrations/        # Esquema PostgreSQL versionado
├── app.py                      # Entry point (gunicorn/uvicorn)
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

---

## Como instalar e rodar localmente

### 1. Requisitos

- **Python 3.10+** (testado em 3.13)
- **pip**
- Opcional: virtualenv

### 2. Clone o repositorio

```bash
git clone https://github.com/pablo-dev09/faenet.git
cd faenet
```

### 3. Crie e ative o ambiente virtual

```bash
# Windows (PowerShell)
py -m venv .venv
.\.venv\Scripts\Activate.ps1

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
```

### 4. Instale as dependencias

```bash
pip install -r requirements.txt
```

### 5. Configure as variaveis de ambiente

Copie o arquivo de exemplo e ajuste conforme necessario:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

Edite o `.env` e ajuste pelo menos o `SECRET_KEY` (gere um valor aleatorio forte).

### 6. Inicie o servidor

```bash
# Padrao (porta 5000)
python app.py

# Ou com o CLI do Flask
flask --app backend.app run --debug --port 5000
```

Acesse **http://localhost:5000**.

---

## Banco de dados Supabase

O banco persistente da FaeNet e um projeto Supabase separado do FaeHub+.
O esquema versionado esta em `supabase/migrations/` e contempla toda a rede
social: usuarios, feed, comentarios, reacoes, stories, mensagens,
notificacoes e Hub do curso.

1. Em **Supabase > Connect**, copie a URL **Session pooler**.
2. Crie um `.env` a partir de `.env.example` e configure:

   ```env
   DATABASE_URL=postgresql://postgres.PROJECT_REF:SENHA@HOST-DO-POOLER:5432/postgres
   DB_SSLMODE=require
   DB_POOL_SIZE=5
   FLASK_ENV=production
   SECRET_KEY=<valor-aleatorio-forte>
   ```

3. O esquema e aplicado por migration no Supabase. Para preencher uma
   instalacao de demonstracao, execute uma unica vez:

   ```bash
   flask --app backend.app seed-demo
   ```

SQLite continua disponivel apenas como fallback local descartavel e nos
testes; nunca e usado no deploy de producao.

---

## Como popular dados de demonstracao

```bash
flask --app backend.app seed-demo
```

Sao criados 6 usuarios, publicacoes, likes, estagios, provas, topicos de forum e notificacoes.

Contas de demonstracao (todas com senha `demo1234`):

| Usuario  | Tipo     | Curso       |
|----------|----------|-------------|
| `pablo`  | Aluno    | Informatica |
| `marlon` | Aluno    | Informatica |
| `aline`  | Professor | Informatica |
| `luciana`| Professor | Informatica |
| `rafael` | Aluno    | Informatica |
| `beatriz`| Aluno    | Informatica |

> Estes usuarios e senhas sao apenas para demonstracao. Em producao, remova ou altere.

---

## Como fazer deploy

### Railway

1. Suba o projeto para um repositorio no GitHub.
2. Em [railway.app](https://railway.app/), clique em **New Project > Deploy from GitHub**.
3. Selecione o repositorio da FaeNet.
4. Em **Supabase > Connect**, copie a URL **Session pooler**.
5. Nas variaveis de ambiente do servico web:
   ```
   DATABASE_URL = <session-pooler-do-supabase>
   DB_SSLMODE = require
   DB_POOL_SIZE = 5
   SECRET_KEY = (gere um valor aleatorio forte)
   FLASK_ENV = production
   ```
6. Configure o **Start Command**:
   ```
   gunicorn -w 2 -b 0.0.0.0:$PORT backend.app:app
   ```
7. Railway fara o deploy automaticamente. Acesse a URL gerada.

### Render

O arquivo `render.yaml` da raiz ja descreve o servico gratuito, o health
check, o comando Gunicorn e todas as variaveis nao secretas.

1. Em [render.com](https://render.com/), clique em **New > Blueprint**.
2. Selecione o repositorio `pablo-dev09/faenet-project`.
3. Informe apenas `DATABASE_URL` usando a URL **Session pooler** do Supabase.
4. Confirme a criacao do servico `faenet`; os demais campos sao aplicados
   automaticamente pelo Blueprint.

> O sistema de arquivos do plano gratuito do Render e temporario. O banco
> fica seguro no Supabase, mas uploads de imagens ainda precisam ser movidos
> para o Supabase Storage para persistirem depois de reinicios e novos deploys.

### Docker (opcional)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=5000
EXPOSE 5000
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "backend.app:app"]
```

---

## Como transformar em aplicativo com Capacitor

A FaeNet foi arquitetada com **frontend desacoplado** e **API REST independente**, exatamente para facilitar a migracao para mobile. Os passos gerais:

1. **Build do frontend** para producao (versao estaticamente otimizada em uma pasta, ex.: `dist/`).
2. **Criar o projeto Capacitor**:
   ```bash
   npm init @capacitor/app
   npx cap add android
   npx cap add ios
   ```
3. Apontar o `webDir` do Capacitor para a pasta de build.
4. Configurar a URL da API nas variaveis de ambiente.
5. Trocar `localStorage` por **Capacitor Preferences** se houver caches.
6. Para uploads, usar **Capacitor Camera / Filesystem** e enviar via API.
7. Build e deploy com Android Studio / Xcode.

Como o backend ja aceita autenticacao por sessao (cookie httpOnly) e os endpoints sao REST puros, a maior parte do trabalho sera apenas empacotar o frontend e ajustar pontos de UI para UX mobile.

---

## Endpoints da API

Base: `/api`. Toda resposta segue `{ "ok": true, "data": ... }` ou `{ "ok": false, "error": { "message": ... } }`.

### Autenticacao

| Metodo | Endpoint              | Descricao                          |
|--------|-----------------------|------------------------------------|
| POST   | `/api/auth/register`  | Cria nova conta                    |
| POST   | `/api/auth/login`     | Faz login (sessao)                 |
| POST   | `/api/auth/logout`    | Encerra a sessao                   |

### Usuario logado

| Metodo | Endpoint                    | Descricao                          |
|--------|-----------------------------|------------------------------------|
| GET    | `/api/me`                   | Dados do usuario logado            |
| PUT    | `/api/me`                   | Edita perfil (nome, bio, etc.)     |
| POST   | `/api/me/online`            | Heartbeat de presenca              |
| POST   | `/api/me/uploads`           | Upload (avatar, banner, post, story, message) |

### Publicacoes

| Metodo | Endpoint                          | Descricao                            |
|--------|-----------------------------------|--------------------------------------|
| GET    | `/api/posts?scope=following`      | Feed do usuario                      |
| POST   | `/api/posts`                      | Criar publicacao                     |
| GET    | `/api/posts/<id>`                 | Detalhes                             |
| DELETE | `/api/posts/<id>`                 | Apagar (autor ou admin)              |
| POST   | `/api/posts/<id>/like`            | Curtir / descurtir                   |
| POST   | `/api/posts/<id>/save`            | Salvar / remover                     |
| POST   | `/api/posts/<id>/repost`          | Repostar / remover repost            |
| GET    | `/api/posts/<id>/comment`         | Listar comentarios                   |
| POST   | `/api/posts/<id>/comment`         | Comentar                            |
| POST   | `/api/posts/<id>/poll`            | Votar em enquete                    |

### Stories

| Metodo | Endpoint                       | Descricao                       |
|--------|--------------------------------|---------------------------------|
| GET    | `/api/stories`                 | Listar stories ativos           |
| POST   | `/api/stories`                 | Publicar story                  |
| DELETE | `/api/stories/<id>`            | Apagar (autor)                  |
| POST   | `/api/stories/<id>/view`       | Marcar como visto               |

### Usuarios

| Metodo | Endpoint                                | Descricao                     |
|--------|-----------------------------------------|-------------------------------|
| GET    | `/api/users?q=<busca>`                  | Buscar usuarios               |
| GET    | `/api/users/suggestions`                | Sugestoes para seguir         |
| GET    | `/api/users/online`                     | Usuarios online               |
| GET    | `/api/users/<username>`                 | Perfil publico                |
| GET    | `/api/users/<username>/posts`           | Publicacoes do usuario        |
| POST   | `/api/users/<username>/follow`          | Seguir                        |
| DELETE | `/api/users/<username>/follow`          | Deixar de seguir              |
| GET    | `/api/users/<username>/followers`       | Lista de seguidores           |
| GET    | `/api/users/<username>/following`       | Lista de quem segue           |

### Mensagens

| Metodo | Endpoint                          | Descricao                       |
|--------|-----------------------------------|---------------------------------|
| GET    | `/api/messages`                   | Lista de conversas              |
| GET    | `/api/messages/<username>`        | Historico de uma conversa       |
| POST   | `/api/messages`                   | Enviar mensagem                 |
| POST   | `/api/messages/<username>/read`   | Marcar como lida                |

### Notificacoes

| Metodo | Endpoint                              | Descricao                  |
|--------|---------------------------------------|----------------------------|
| GET    | `/api/notifications`                  | Listar (com contador)      |
| POST   | `/api/notifications/read`             | Marcar todas como lidas    |
| POST   | `/api/notifications/<id>/read`        | Marcar uma como lida       |

### API legada do Hub do Curso

> A interface `/hub` agora apresenta o FaeHub+. Estes endpoints foram mantidos para compatibilidade com os dados existentes.

| Metodo | Endpoint                                          | Descricao                      |
|--------|---------------------------------------------------|--------------------------------|
| GET    | `/api/hub?type=estagio&curso=Informatica`         | Listar estagios                |
| GET    | `/api/hub?type=prova&curso=Informatica`           | Listar avisos de prova         |
| GET    | `/api/hub?type=forum_topic&curso=Informatica`      | Listar topicos do forum        |
| GET    | `/api/hub/<id>`                                   | Detalhes de um item            |
| GET    | `/api/hub/<id>/answers`                           | Respostas de um topico         |
| POST   | `/api/hub`                                        | Criar item                     |
| POST   | `/api/hub/<id>/reply`                             | Responder topico               |
| PUT    | `/api/hub/<id>`                                   | Editar (autor/admin)           |
| DELETE | `/api/hub/<id>`                                   | Apagar (autor/admin)           |
| POST   | `/api/hub/<id>/solve`                             | Marcar como resolvido          |

---

## Licenca

Projeto academico desenvolvido como Projeto Final do curso de Informatica da ETESC / FAETEC. Licenca MIT.
