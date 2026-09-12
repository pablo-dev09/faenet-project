/* =====================================================
   FaeNet - auth.js
   Telas de login e cadastro. Mantem o estado de sessao
   em memoria (sincronizado com o cookie de sessao do Flask).
   ===================================================== */

(function (global) {
    'use strict';

    const Auth = {
        currentUser: null,

        async bootstrap() {
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
    };

    global.FaeAuth = Auth;
})(window);
