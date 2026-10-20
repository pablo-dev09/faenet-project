/* =====================================================
   FaeNet - auth.js
   Telas de login e cadastro. Mantem o estado de sessao
   em memoria (sincronizado com o cookie de sessao do Flask).
   ===================================================== */

(function (global) {
    'use strict';

    const Auth = {
        currentUser: null,
        hubOnly: false,
        returnTo: '/feed',

        async bootstrap() {
            // Config failure must never reveal an independent registration path.
            const options = await FaeAPI.get('/auth/options');
            this.hubOnly = options.faehub_only;
            FaeAPI.csrf = options.csrf;
            try {
                this.currentUser = await FaeAPI.me();
            } catch (err) {
                this.currentUser = null;
            }
            return this.currentUser;
        },

        async login(username, password) {
            const user = await FaeAPI.login(username, password);
            this.currentUser = user;
            return user;
        },

        async register(data) {
            const user = await FaeAPI.register(data);
            this.currentUser = user;
            return user;
        },

        async logout() {
            try { await FaeAPI.logout(); } catch (e) {}
            this.currentUser = null;
        },

        isAuthed() { return !!this.currentUser; },

        renderLogin() {
            document.title = 'Entrar · FaeNet';
            if (this.hubOnly) { this.renderHubLogin(); return; }
            const tpl = document.getElementById('tpl-login');
            const root = document.getElementById('app');
            root.innerHTML = '';
            root.appendChild(tpl.content.cloneNode(true));

            const form = root.querySelector('[data-form="login"]');
            const password = form.querySelector('input[name="password"]');
            const togglePassword = form.querySelector('[data-action="toggle-password"]');
            if (togglePassword && password) {
                togglePassword.addEventListener('click', () => {
                    const visible = password.type === 'text';
                    password.type = visible ? 'password' : 'text';
                    togglePassword.setAttribute('aria-pressed', String(!visible));
                    togglePassword.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
                    togglePassword.firstElementChild.textContent = visible ? '◉' : '⊘';
                });
            }

            root.querySelectorAll('[data-demo-user]').forEach(button => {
                button.addEventListener('click', () => {
                    form.elements.username.value = button.dataset.demoUser;
                    form.elements.password.value = 'demo1234';
                    form.elements.username.focus();
                    FaeUtils.info('Conta de demonstração preenchida.');
                });
            });

            const forgot = root.querySelector('[data-action="forgot-password"]');
            if (forgot) {
                forgot.addEventListener('click', () => {
                    FaeUtils.info('A recuperação de senha será liberada em breve.');
                });
            }

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = new FormData(form);
                const submit = form.querySelector('button[type="submit"]');
                submit.disabled = true;
                submit.textContent = 'Entrando...';
                try {
                    await Auth.login(data.get('username').trim(), data.get('password'));
                    FaeUtils.success('Bem-vindo de volta!');
                    window.FaeApp.mount();
                } catch (err) {
                    FaeUtils.error(err.message);
                } finally {
                    submit.disabled = false;
                    submit.textContent = 'Entrar';
                }
            });
        },

        renderRegister() {
            if (this.hubOnly) { this.renderHubLogin(); return; }
            const tpl = document.getElementById('tpl-register');
            const root = document.getElementById('app');
            root.innerHTML = '';
            root.appendChild(tpl.content.cloneNode(true));

            const form = root.querySelector('[data-form="register"]');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = new FormData(form);
                const submit = form.querySelector('button[type="submit"]');
                submit.disabled = true;
                submit.textContent = 'Criando conta...';
                try {
                    await Auth.register({
                        username: data.get('username').trim(),
                        name: data.get('name').trim(),
                        curso: data.get('curso')?.trim(),
                        turma: data.get('turma')?.trim(),
                        password: data.get('password'),
                    });
                    FaeUtils.success('Conta criada! Entrando...');
                    window.FaeApp.mount();
                } catch (err) {
                    FaeUtils.error(err.message);
                } finally {
                    submit.disabled = false;
                    submit.textContent = 'Cadastrar';
                }
            });
        },

        renderHubLogin() {
            document.title = 'Entrar com FaeHub · FaeNet';
            const root = document.getElementById('app');
            root.replaceChildren(document.getElementById('tpl-login').content.cloneNode(true));
            const form = root.querySelector('[data-form="login"]');
            const title = document.createElement('h1'); title.className = 'auth__title'; title.textContent = 'Sua conta. Seu campus.';
            const copy = document.createElement('p'); copy.className = 'auth__subtitle';
            copy.textContent = 'A FaeNet é exclusiva para a comunidade do FaeHub. Use sua conta da escola, sem criar outra senha.';
            const enter = document.createElement('a'); enter.className = 'btn btn--primary btn--block auth__submit';
            enter.href = '/auth/faehub/start?next=' + encodeURIComponent(this.returnTo); enter.textContent = 'Entrar com FaeHub →';
            const help = document.createElement('p'); help.className = 'auth__hint';
            help.textContent = 'Primeiro acesso? Ative a conta pelo convite da escola. Perfis antigos da FaeNet podem ser vinculados após confirmar sua identidade.';
            const error = document.createElement('p'); error.className = 'auth__hint'; error.setAttribute('role','alert');
            const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn btn--ghost btn--block';
            retry.textContent = 'Tentar novamente'; retry.hidden = true;
            retry.addEventListener('click', () => { enter.removeAttribute('aria-disabled'); enter.style.pointerEvents=''; enter.textContent='Entrar com FaeHub →'; error.textContent=''; retry.hidden=true; });
            enter.addEventListener('click', event => {
                if (enter.getAttribute('aria-disabled') === 'true') { event.preventDefault(); return; }
                if (navigator.onLine === false) { event.preventDefault(); error.textContent='Sem conexão. Confira a internet e tente novamente.'; retry.hidden=false; return; }
                enter.setAttribute('aria-disabled','true'); enter.textContent='Abrindo o FaeHub…';
            });
            const recovery = document.createElement('a'); recovery.className='auth__hint';
            recovery.href='https://faehub-plus.onrender.com/recuperar-senha';recovery.textContent='Recuperar senha ou usuário pelo e-mail';
            form.replaceChildren(title, copy, enter, help, recovery, error, retry);
            window.addEventListener('pageshow',()=>{enter.removeAttribute('aria-disabled');enter.textContent='Entrar com FaeHub →';},{once:true});
        },
    };

    global.FaeAuth = Auth;
})(window);
