/* =====================================================
   FaeNet - app.js
   SPA principal: roteamento, montagem do shell,
   heartbeat de presenca, atualizacao de badges.
   ===================================================== */

(function (global) {
    'use strict';

    const App = {
        currentRoute: null,
        heartbeatTimer: null,
        notifTimer: null,
        msgTimer: null,

        async init() {
            // Esconde o splash de carregamento
            const splash = document.getElementById('app-loading');
            const appRoot = document.getElementById('app');
            if (splash) {
                splash.classList.add('is-hidden');
                setTimeout(() => { splash.style.display = 'none'; }, 220);
            }
            if (appRoot) appRoot.hidden = false;

            // Tenta descobrir a sessao
            await FaeAuth.bootstrap();

            // Lida com o deep-link inicial
            const initialPath = window.location.pathname || '/';
            if (initialPath === '/register' && !FaeAuth.isAuthed()) {
                FaeAuth.renderRegister();
            } else if (initialPath === '/login' && !FaeAuth.isAuthed()) {
                FaeAuth.renderLogin();
            } else if (!FaeAuth.isAuthed() && !['/login', '/register'].includes(initialPath)) {
                // Redireciona para /login (mantem a URL no estado)
                history.replaceState(null, '', '/login');
                FaeAuth.renderLogin();
            } else {
                await this.mount();
            }

            // Interceptor de cliques em links data-link (rotas internas SPA)
            document.addEventListener('click', (e) => {
                const a = e.target.closest('a[data-link]');
                if (!a) return;
                const href = a.getAttribute('href');
                if (!href || href.startsWith('http') || href.startsWith('mailto:')) return;
                e.preventDefault();
                this.go(href);
            });

            window.addEventListener('popstate', () => {
                if (FaeAuth.isAuthed()) {
                    this.route(window.location.pathname);
                } else {
                    FaeAuth.renderLogin();
                }
            });

            // Heartbeat e atualizacao de badges
            if (FaeAuth.isAuthed()) this.startHeartbeat();
        },

        async mount() {
            // Monta o shell
            const tpl = document.getElementById('tpl-app');
            const root = document.getElementById('app');
            root.innerHTML = '';
            root.appendChild(tpl.content.cloneNode(true));

            this.bindShell();
            this.updateUserChip();

            // Marca o link ativo
            this.highlightActive();

            // Decide a rota inicial
            let path = window.location.pathname;
            if (path === '/' || path === '') path = '/feed';
            if (path === '/login' || path === '/register') path = '/feed';
            if (path !== window.location.pathname) history.replaceState(null, '', path);
            await this.route(path);
        },

        bindShell() {
            const root = document.getElementById('app');
            // Logout
            root.querySelector('[data-action="logout"]').addEventListener('click', async () => {
                if (!await FaeUtils.confirm('Encerrar sessao?')) return;
                try { await FaeAuth.logout(); } catch (e) {}
                history.replaceState(null, '', '/login');
                FaeAuth.renderLogin();
                if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
                if (this.notifTimer) clearInterval(this.notifTimer);
            });

            // Compose button
            root.querySelectorAll('[data-action="compose"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const path = window.location.pathname;
                    if (path === '/feed' || path === '/') {
                        // Foca no compose
                        const ta = document.querySelector('.compose__textarea');
                        if (ta) ta.focus();
                    } else {
                        this.go('/feed');
                        setTimeout(() => {
                            const ta = document.querySelector('.compose__textarea');
                            if (ta) ta.focus();
                        }, 200);
                    }
                });
            });

            // Sidebar user -> perfil proprio
            const user = root.querySelector('[data-action="me-menu"]');
            if (user) {
                user.addEventListener('click', () => this.go('/profile'));
            }
        },

        updateUserChip() {
            const me = FaeAuth.currentUser;
            if (!me) return;
            const root = document.getElementById('app');
            const av = root.querySelector('[data-avatar="me"]');
            if (av) {
                av.textContent = (me.avatar_text || '').slice(0, 2) || (me.name || me.username || 'FN').slice(0, 2).toUpperCase();
                if (me.avatar_img) {
                    const img = FaeUtils.el('img', { src: me.avatar_img, alt: me.username });
                    av.appendChild(img);
                }
            }
            const nameEl = root.querySelector('[data-text="me-name"]');
            if (nameEl) nameEl.textContent = me.name || me.username;
            const usernameEl = root.querySelector('[data-text="me-username"]');
            if (usernameEl) usernameEl.textContent = `@${me.username}`;
        },

        highlightActive() {
            const path = window.location.pathname;
            const root = document.getElementById('app');
            root.querySelectorAll('[data-route]').forEach(el => {
                const route = el.dataset.route;
                if (path.startsWith(`/${route}`)) el.classList.add('is-active');
                else el.classList.remove('is-active');
            });
        },

        async route(path) {
            this.currentRoute = path;
            const main = document.querySelector('[data-view="main"]');
            if (!main) return;
            FaeUtils.clear(main);
            window.scrollTo(0, 0);
            this.highlightActive();

            // Atualiza o rightbar
            this.updateRightbar();

            if (path === '/feed' || path === '/' || path === '') {
                main.appendChild(FaeUtils.el('div', { class: 'page-header' },
                    FaeUtils.el('h1', { class: 'page-header__title' }, 'Inicio'),
                ));
                await FaeFeed.renderFeed(main, 'following');
            } else if (path === '/explore') {
                await FaeExplore.render(main);
            } else if (path === '/hub') {
                await FaeHub.render(main);
            } else if (path === '/messages') {
                await FaeMessages.render(main);
            } else if (path === '/notifications') {
                await FaeNotifications.render(main);
            } else if (path.startsWith('/profile')) {
                const parts = path.split('/').filter(Boolean);
                const username = parts[1] || FaeAuth.currentUser.username;
                await FaeProfile.render(main, username);
            } else if (path === '/settings') {
                this.renderSettings(main);
            } else if (path === '/login') {
                FaeAuth.renderLogin();
                return;
            } else if (path === '/register') {
                FaeAuth.renderRegister();
                return;
            } else {
                main.appendChild(FaeUtils.el('div', { class: 'empty' }, 'Pagina nao encontrada.'));
            }
        },

        renderSettings(container) {
            const me = FaeAuth.currentUser;
            const wrap = FaeUtils.el('div', {});
            wrap.appendChild(FaeUtils.el('h1', { class: 'page-header__title' }, 'Configuracoes'));
            wrap.appendChild(FaeUtils.el('p', { class: 'muted' }, 'Preferencias da sua conta.'));

            const card = FaeUtils.el('div', { class: 'card' });
            card.appendChild(FaeUtils.el('h2', { class: 'card__title' }, 'Conta'));
            card.appendChild(FaeUtils.el('div', { class: 'muted text-sm' },
                `Logado como ${me.name} (@${me.username})`));
            const actions = FaeUtils.el('div', { class: 'flex gap-1 mt-2' });
            actions.appendChild(FaeUtils.el('a', { class: 'btn btn--ghost', href: '/profile', 'data-link': true }, '✎ Editar perfil'));
            actions.appendChild(FaeUtils.el('button', { class: 'btn btn--danger', onclick: async () => {
                if (!await FaeUtils.confirm('Sair da conta?')) return;
                await FaeAuth.logout();
                history.replaceState(null, '', '/login');
                FaeAuth.renderLogin();
            } }, 'Sair'));
            card.appendChild(actions);
            wrap.appendChild(card);

            const info = FaeUtils.el('div', { class: 'card mt-2' });
            info.appendChild(FaeUtils.el('h2', { class: 'card__title' }, 'Sobre a FaeNet'));
            info.appendChild(FaeUtils.el('p', { class: 'text-soft' },
                'FaeNet e a rede social academica da ETESC. ' +
                'Conectamos alunos, professores e colaboradores em um so lugar.'));
            info.appendChild(FaeUtils.el('p', { class: 'muted text-sm' }, 'Backend: Flask + SQLAlchemy · Frontend: HTML/CSS/JS puro.'));
            wrap.appendChild(info);

            container.appendChild(wrap);
        },

        updateRightbar() {
            const list = document.querySelector('[data-list="online"]');
            const sugg = document.querySelector('[data-list="suggestions"]');
            if (!list || !sugg) return;

            FaeUtils.clear(list);
            FaeUtils.clear(sugg);
            list.appendChild(FaeUtils.el('div', { class: 'skeleton', style: { height: '32px' } }));
            sugg.appendChild(FaeUtils.el('div', { class: 'skeleton', style: { height: '32px' } }));

            FaeAPI.onlineUsers(15)
                .then(users => {
                    FaeUtils.clear(list);
                    if (!users.length) { list.appendChild(FaeUtils.el('div', { class: 'muted text-sm' }, 'Nenhum online agora.')); return; }
                    users.forEach(u => {
                        const a = FaeUtils.el('a', { href: `/profile/${u.username}`, 'data-link': true, class: 'user-card' },
                            FaeUtils.avatarNode(u, 'xs'),
                            FaeUtils.el('div', { class: 'user-card__info' },
                                FaeUtils.el('div', { class: 'user-card__name' }, u.name || u.username),
                                FaeUtils.el('div', { class: 'user-card__username' }, '@' + u.username),
                            ),
                        );
                        list.appendChild(a);
                    });
                })
                .catch(() => {});

            FaeAPI.suggestions(6)
                .then(users => {
                    FaeUtils.clear(sugg);
                    if (!users.length) { sugg.appendChild(FaeUtils.el('div', { class: 'muted text-sm' }, 'Sem sugestoes.')); return; }
                    users.forEach(u => {
                        const card = FaeUtils.el('div', { class: 'user-card' },
                            FaeUtils.avatarNode(u, 'xs'),
                            FaeUtils.el('div', { class: 'user-card__info' },
                                FaeUtils.el('div', { class: 'user-card__name' }, u.name || u.username),
                                FaeUtils.el('div', { class: 'user-card__username' }, '@' + u.username),
                            ),
                            FaeUtils.followButton(u, FaeAuth.currentUser, false),
                        );
                        sugg.appendChild(card);
                    });
                })
                .catch(() => {});

            // Badges
            this.updateBadges();
        },

        async updateBadges() {
            try {
                const data = await FaeAPI.notifications(1);
                const n = data.unread_count || 0;
                const badges = document.querySelectorAll('[data-badge="notifications"]');
                badges.forEach(b => { b.hidden = !(n > 0); b.textContent = n; });
            } catch (e) { /* silencioso */ }

            try {
                const convs = await FaeAPI.conversations();
                const total = convs.reduce((acc, c) => acc + (c.unread_count || 0), 0);
                const badges = document.querySelectorAll('[data-badge="messages"]');
                badges.forEach(b => { b.hidden = !(total > 0); b.textContent = total; });
            } catch (e) { /* silencioso */ }
        },

        startHeartbeat() {
            const beat = async () => {
                try { await FaeAPI.heartbeat(); } catch (e) { /* silencioso */ }
            };
            beat();
            if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = setInterval(beat, 30000);

            if (this.notifTimer) clearInterval(this.notifTimer);
            this.notifTimer = setInterval(() => this.updateBadges(), 60000);
        },

        go(path) {
            if (path === window.location.pathname) {
                this.route(path);
                return;
            }
            history.pushState(null, '', path);
            this.route(path);
        },

        refresh() {
            this.route(window.location.pathname);
        },
    };

    global.FaeApp = App;

    document.addEventListener('DOMContentLoaded', () => App.init());
})(window);
