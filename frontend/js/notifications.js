/* =====================================================
   FaeNet - notifications.js
   Tela de notificacoes: lista, marca como lida.
   ===================================================== */

(function (global) {
    'use strict';

    const Notifications = {
        async render(container) {
            const me = FaeAuth.currentUser;
            if (!me) return;

            const header = FaeUtils.el('div', { class: 'page-header' },
                FaeUtils.el('div', {},
                    FaeUtils.el('h1', { class: 'page-header__title' }, 'Notificacoes'),
                    FaeUtils.el('div', { class: 'page-header__subtitle', id: 'notif-subtitle' }, 'Atualize sua atividade recente na FaeNet.'),
                ),
                FaeUtils.el('button', { class: 'btn btn--ghost', onclick: async () => {
                    try { await FaeAPI.markAllNotificationsRead(); FaeUtils.success('Notificacoes marcadas como lidas.'); window.FaeApp.refresh(); } catch (e) { FaeUtils.error(e.message); }
                } }, 'Marcar todas como lidas'),
            );
            container.appendChild(header);

            const list = FaeUtils.el('div', { class: 'card', style: { padding: 0 } });
            container.appendChild(list);

            list.appendChild(FaeUtils.el('div', { class: 'skeleton', style: { height: '80px' } }));

            try {
                const data = await FaeAPI.notifications(50);
                const sub = container.querySelector('#notif-subtitle');
                if (sub) sub.textContent = `${data.unread_count} nao lida${data.unread_count === 1 ? '' : 's'}.`;
                list.innerHTML = '';
                if (!data.items.length) {
                    list.appendChild(FaeUtils.el('div', { class: 'empty' }, 'Sem notificacoes por enquanto.'));
                    return;
                }
                data.items.forEach(n => list.appendChild(this.renderNotification(n)));
            } catch (e) {
                list.innerHTML = '';
                FaeUtils.error(e.message);
            }
        },

        renderNotification(n) {
            const item = FaeUtils.el('div', { class: 'notif' + (!n.read ? ' notif--unread' : ''), data: { id: n.id } },
                FaeUtils.el('div', { class: 'avatar avatar--sm' }, (n.from_avatar_text || 'FN').slice(0, 2)),
                FaeUtils.el('div', { class: 'notif__text' },
                    FaeUtils.el('strong', {}, n.from_name || ''),
                    ' ',
                    n.text,
                    FaeUtils.el('div', { class: 'notif__time' }, FaeUtils.timeAgo(n.timestamp)),
                ),
            );
            item.addEventListener('click', async () => {
                try { await FaeAPI.markNotificationRead(n.id); item.classList.remove('notif--unread'); } catch (e) {}
                if (n.type === 'follow' || n.type === 'like' || n.type === 'comment') {
                    if (n.meta?.username) {
                        try {
                            const actor = await FaeAPI.profile(n.meta.username);
                            window.FaeApp.go(FaeUtils.profilePath(actor));
                        } catch (e) { FaeUtils.error(e.message); }
                    } else FaeUtils.info('Esta notificação antiga não possui um perfil vinculado.');
                } else if (n.type === 'message') {
                    window.FaeApp.go('/messages');
                }
            });
            return item;
        },
    };

    global.FaeNotifications = Notifications;
})(window);
