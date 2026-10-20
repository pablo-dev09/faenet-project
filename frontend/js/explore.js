/* =====================================================
   FaeNet - explore.js
   Pagina Explorar: busca com debounce, grade de pessoas
   e publicacoes recentes.
   ===================================================== */

(function (global) {
    'use strict';

    const Explore = {
        async render(container) {
            const me = FaeAuth.currentUser;
            if (!me) return;

            const header = FaeUtils.el('div', { class: 'page-header' },
                FaeUtils.el('div', {},
                    FaeUtils.el('h1', { class: 'page-header__title' }, 'Explorar'),
                    FaeUtils.el('div', { class: 'page-header__subtitle' }, 'Encontre pessoas e descubra publicacoes.'),
                ),
            );
            container.appendChild(header);

            const search = FaeUtils.el('input', { class: 'search-bar', type: 'search', placeholder: 'Buscar por nome, @usuario ou curso...', maxlength: 80 });
            container.appendChild(FaeUtils.el('div', { class: 'mb-2' }, search));

            const results = FaeUtils.el('div', {});
            container.appendChild(results);

            // Sugestoes e publicacoes por padrao
            const defaultArea = FaeUtils.el('div', {});
            results.appendChild(defaultArea);
            await this.renderDefault(defaultArea);

            const searchHandler = FaeUtils.debounce(async () => {
                const q = search.value.trim();
                if (!q) {
                    results.innerHTML = '';
                    const area = FaeUtils.el('div', {});
                    results.appendChild(area);
                    await this.renderDefault(area);
                    return;
                }
                results.innerHTML = '';
                results.appendChild(FaeUtils.el('div', { class: 'skeleton', style: { height: '80px' } }));
                try {
                    const users = await FaeAPI.searchUsers(q);
                    results.innerHTML = '';
                    if (!users.length) {
                        results.appendChild(FaeUtils.el('div', { class: 'empty' }, 'Nenhum resultado encontrado.'));
                        return;
                    }
                    results.appendChild(FaeUtils.el('h2', { class: 'profile__name' }, 'Pessoas'));
                    users.forEach(u => results.appendChild(this.renderUserCard(u)));
                } catch (e) {
                    results.innerHTML = '';
                    FaeUtils.error(e.message);
                }
            }, 250);
            search.addEventListener('input', searchHandler);
        },

        async renderDefault(container) {
            // Sugestoes
            try {
                const suggestions = await FaeAPI.suggestions(8);
                if (suggestions.length) {
                    container.appendChild(FaeUtils.el('h2', { class: 'profile__name' }, 'Sugestoes para seguir'));
                    suggestions.forEach(u => container.appendChild(this.renderUserCard(u)));
                }
            } catch (e) { /* silencioso */ }

            // Publicacoes recentes
            container.appendChild(FaeUtils.el('h2', { class: 'profile__name mt-3' }, 'Publicacoes recentes'));
            try {
                const posts = await FaeAPI.feed({ scope: 'all', limit: 20 });
                if (!posts.length) {
                    container.appendChild(FaeUtils.el('div', { class: 'empty' }, 'Nenhuma publicacao ainda.'));
                } else {
                    posts.forEach(p => FaeFeed.renderPostCard(p, container));
                }
            } catch (e) { FaeUtils.error(e.message); }
        },

        renderUserCard(user) {
            const card = FaeUtils.el('a', { href: FaeUtils.profilePath(user), 'data-link': true, class: 'card card--hover flex gap-2 mb-1' },
                FaeUtils.avatarNode(user, 'sm'),
                FaeUtils.el('div', { class: 'flex-1' },
                    FaeUtils.el('div', { style: { fontWeight: 600 } }, user.name || user.username),
                    FaeUtils.el('div', { class: 'muted text-xs' },
                        `@${FaeUtils.userHandle(user)}` + (user.curso ? ` · ${user.curso}` : '') + (user.turma ? ` · ${user.turma}` : ''),
                    ),
                    user.bio ? FaeUtils.el('div', { class: 'text-sm text-soft mt-1' }, user.bio) : null,
                ),
            );
            const btn = FaeUtils.followButton(user, FaeAuth.currentUser, false);
            if (btn) card.appendChild(btn);
            return card;
        },
    };

    global.FaeExplore = Explore;
})(window);
