/* =====================================================
   FaeNet - utils.js
   Utilidades compartilhadas: formatadores, DOM, toasts,
   modais, tempo relativo, debounce, sanitizacao basica.
   ===================================================== */

(function (global) {
    'use strict';

    const Utils = {
        userHandle(user) { return user?.handle || (user?.profile_complete === false ? 'perfil.em.configuracao' : user?.username || ''); },
        profilePath(user) { return '/profile/' + encodeURIComponent(user.handle || user.username); },
        /* ---- DOM helpers ---- */
        el(tag, attrs = {}, ...children) {
            const node = document.createElement(tag);
            Object.entries(attrs || {}).forEach(([k, v]) => {
                if (v === false || v === null || v === undefined) return;
                if (k === 'class') node.className = v;
                else if (k === 'html') node.innerHTML = v;
                else if (k === 'text') node.textContent = v;
                else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
                else if (k.startsWith('on') && typeof v === 'function') {
                    node.addEventListener(k.slice(2).toLowerCase(), v);
                } else if (k === 'data' && typeof v === 'object') {
                    Object.entries(v).forEach(([dk, dv]) => node.dataset[dk] = dv);
                } else {
                    node.setAttribute(k, v);
                }
            });
            children.flat().forEach(c => {
                if (c === null || c === undefined || c === false) return;
                if (typeof c === 'string' || typeof c === 'number') {
                    node.appendChild(document.createTextNode(String(c)));
                } else {
                    node.appendChild(c);
                }
            });
            return node;
        },

        clear(node) {
            while (node.firstChild) node.removeChild(node.firstChild);
        },

        /* ---- Format ---- */
        escapeHTML(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        /** Faz links e @mencoes clicaveis. Retorna HTML escapado. */
        formatText(str) {
            const safe = this.escapeHTML(str || '');
            return safe
                .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
                .replace(/(^|\s)@([A-Za-z0-9_.]{3,30})/g, '$1<a href="/profile/$2" data-link>@$2</a>')
                .replace(/(^|\s)#([A-Za-z0-9_]+)/g, '$1<a href="/explore?q=%23$2" data-link>#$2</a>');
        },

        timeAgo(iso) {
            if (!iso) return '';
            const then = new Date(iso).getTime();
            if (Number.isNaN(then)) return '';
            const now = Date.now();
            const diff = Math.max(0, Math.floor((now - then) / 1000));
            if (diff < 30) return 'agora';
            if (diff < 60) return `${diff}s`;
            if (diff < 3600) return `${Math.floor(diff / 60)}m`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
            if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
            return new Date(iso).toLocaleDateString('pt-BR');
        },

        formatNumber(n) {
            if (n === null || n === undefined) return '0';
            if (n < 1000) return String(n);
            if (n < 1000000) return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '') + 'k';
            return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        },

        initials(name, fallback) {
            if (fallback) return fallback.slice(0, 4).toUpperCase();
            if (!name) return 'FN';
            const parts = name.trim().split(/\s+/);
            if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        },

        /* ---- Toasts ---- */
        toast(message, type = 'info', timeout = 3200) {
            const root = document.getElementById('toast-root');
            if (!root) return;
            const t = this.el('div', { class: `toast toast--${type}` },
                this.el('span', {}, message),
                this.el('button', { class: 'toast__close', onclick: () => t.remove() }, '×')
            );
            root.appendChild(t);
            setTimeout(() => {
                t.style.opacity = '0';
                setTimeout(() => t.remove(), 200);
            }, timeout);
        },

        success(msg) { this.toast(msg, 'success'); },
        error(msg) { this.toast(msg, 'error', 4500); },
        info(msg) { this.toast(msg, 'info'); },
        warn(msg) { this.toast(msg, 'warning'); },

        confirm(message) {
            return new Promise(resolve => {
                const overlay = this.el('div', { class: 'modal-root' });
                const modal = this.el('div', { class: 'modal', style: { maxWidth: '420px' } },
                    this.el('div', { class: 'modal__header' },
                        this.el('h3', { class: 'modal__title' }, 'Confirmar'),
                        this.el('button', { class: 'modal__close', onclick: () => close(false) }, '×'),
                    ),
                    this.el('div', { class: 'modal__body' },
                        this.el('p', {}, message),
                    ),
                    this.el('div', { class: 'modal__footer' },
                        this.el('button', { class: 'btn btn--ghost', onclick: () => close(false) }, 'Cancelar'),
                        this.el('button', { class: 'btn btn--danger', onclick: () => close(true) }, 'Confirmar'),
                    ),
                );
                overlay.appendChild(modal);
                document.body.appendChild(overlay);
                const close = (ok) => { overlay.remove(); resolve(ok); };
                overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
            });
        },

        /* ---- Modal generico ---- */
        openModal({ title, body, footer, size = '' } = {}) {
            const root = document.getElementById('modal-root');
            if (!root) return null;
            root.hidden = false;

            const close = () => {
                root.hidden = true;
                Utils.clear(root);
            };

            const modal = this.el('div', { class: 'modal' + (size ? ` modal--${size}` : '') },
                this.el('div', { class: 'modal__header' },
                    this.el('h3', { class: 'modal__title' }, title || ''),
                    this.el('button', { class: 'modal__close', onclick: close }, '×'),
                ),
                this.el('div', { class: 'modal__body' },
                    typeof body === 'string' ? this.el('div', { html: body }) : body
                ),
                footer ? this.el('div', { class: 'modal__footer' }, ...(Array.isArray(footer) ? footer : [footer])) : null,
            );

            Utils.clear(root);
            root.appendChild(modal);
            root.addEventListener('click', (e) => { if (e.target === root) close(); }, { once: true });

            return { close, modal };
        },

        /* ---- Debounce ---- */
        debounce(fn, wait = 300) {
            let t;
            return function (...args) {
                clearTimeout(t);
                t = setTimeout(() => fn.apply(this, args), wait);
            };
        },

        /* ---- Avatar (imagem ou texto) ---- */
        avatarNode(user, size = '') {
            const cls = 'avatar' + (size ? ` avatar--${size}` : '') + (user && user.online ? ' avatar--online' : '');
            const a = this.el('div', { class: cls }, (user && this.initials(user.name || user.username, user.avatar_text)) || 'FN');
            if (user && user.avatar_img) {
                const img = this.el('img', { src: user.avatar_img, alt: user.name || this.userHandle(user) });
                a.appendChild(img);
            }
            return a;
        },

        userLink(user, extraClass = '') {
            return this.el('a', {
                href: this.profilePath(user),
                class: `user-card ${extraClass || ''}`,
                'data-link': true,
            },
                this.avatarNode(user, 'sm'),
                this.el('div', { class: 'user-card__info' },
                    this.el('div', { class: 'user-card__name' }, user.name || user.username),
                    this.el('div', { class: 'user-card__username' }, `@${this.userHandle(user)}`),
                ),
            );
        },

        followButton(user, currentUser, isFollowing) {
            if (!user || !currentUser) return null;
            if (user.username === currentUser.username) return null;
            const btn = this.el('button', {
                class: 'btn btn--sm ' + (isFollowing ? 'btn--ghost' : 'btn--primary'),
                onclick: async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    btn.disabled = true;
                    try {
                        if (isFollowing) {
                            await FaeAPI.unfollow(user.username);
                            btn.textContent = 'Seguir';
                            btn.classList.remove('btn--ghost');
                            btn.classList.add('btn--primary');
                            isFollowing = false;
                        } else {
                            await FaeAPI.follow(user.username);
                            btn.textContent = 'Seguindo';
                            btn.classList.add('btn--ghost');
                            btn.classList.remove('btn--primary');
                            isFollowing = true;
                        }
                    } catch (err) {
                        Utils.error(err.message);
                    } finally {
                        btn.disabled = false;
                    }
                },
            }, isFollowing ? 'Seguindo' : 'Seguir');
            return btn;
        },

        /** Le um arquivo como Data URL. */
        readFileAsDataURL(file) {
            return new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.onerror = () => reject(new Error('Falha ao ler arquivo.'));
                r.readAsDataURL(file);
            });
        },

        /** Reduz o tamanho de uma imagem antes do upload. */
        async compressImage(file, maxDim = 1600, quality = 0.85) {
            if (!file.type || !file.type.startsWith('image/')) return file;
            if (file.type === 'image/gif') return file; // mantem GIFs
            const dataUrl = await this.readFileAsDataURL(file);
            const img = await new Promise((resolve, reject) => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.onerror = () => reject(new Error('Imagem invalida.'));
                i.src = dataUrl;
            });
            let { width, height } = img;
            if (width <= maxDim && height <= maxDim) return file;
            if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
            } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality);
            return compressed;
        },
    };

    global.FaeUtils = Utils;
})(window);
