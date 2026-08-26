/* =====================================================
   FaeNet - api.js
   Wrapper para fetch com JSON, tratamento de erros
   e injecao automatica de credenciais (cookie de sessao).
   ===================================================== */

(function (global) {
    'use strict';

    const API = {
        base: '/api',

        /** Faz uma requisicao autenticada. */
        async request(path, options = {}) {
            const opts = {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
                ...options,
            };

            if (opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)) {
                opts.body = JSON.stringify(opts.body);
                opts.headers['Content-Type'] = 'application/json';
            }

            let response;
            try {
                response = await fetch(this.base + path, opts);
            } catch (err) {
                throw new Error('Sem conexao com o servidor.');
            }

            // Tenta parsear JSON; se falhar, devolve texto cru.
            const text = await response.text();
            let data;
            try {
                data = text ? JSON.parse(text) : null;
            } catch (err) {
                data = { ok: false, error: { message: text || 'Resposta invalida.' } };
            }

            if (!response.ok || (data && data.ok === false)) {
                const message = (data && data.error && data.error.message) || `Erro ${response.status}`;
                const error = new Error(message);
                error.status = response.status;
                error.payload = data;
                throw error;
            }

            return data && Object.prototype.hasOwnProperty.call(data, 'data') ? data.data : data;
        },

        get(path) { return this.request(path, { method: 'GET' }); },
        post(path, body) { return this.request(path, { method: 'POST', body }); },
        put(path, body) { return this.request(path, { method: 'PUT', body }); },
        patch(path, body) { return this.request(path, { method: 'PATCH', body }); },
        del(path) { return this.request(path, { method: 'DELETE' }); },

        /* ---- Auth ---- */
        login: (username, password) => API.post('/auth/login', { username, password }),
        register: (data) => API.post('/auth/register', data),
        logout: () => API.post('/auth/logout'),

        /* ---- Me ---- */
        me: () => API.get('/me'),
        updateMe: (data) => API.put('/me', data),
        heartbeat: () => API.post('/me/online'),
        uploadMedia: async (formData) => {
            // Espera FormData: file | data_url + category
            return API.post('/me/uploads', formData);
        },

        /* ---- Posts ---- */
        feed: (params = {}) => {
            const q = new URLSearchParams(params).toString();
            return API.get('/posts' + (q ? `?${q}` : ''));
        },
        createPost: (data) => API.post('/posts', data),
        deletePost: (id) => API.del(`/posts/${id}`),
        toggleLike: (id) => API.post(`/posts/${id}/like`),
        toggleSave: (id) => API.post(`/posts/${id}/save`),
        toggleRepost: (id) => API.post(`/posts/${id}/repost`),
        comments: (id) => API.get(`/posts/${id}/comment`),
        comment: (id, content) => API.post(`/posts/${id}/comment`, { content }),
        votePoll: (id, option_index) => API.post(`/posts/${id}/poll`, { option_index }),

        /* ---- Stories ---- */
        stories: () => API.get('/stories'),
        createStory: (data) => API.post('/stories', data),
        deleteStory: (id) => API.del(`/stories/${id}`),
        viewStory: (id) => API.post(`/stories/${id}/view`),

        /* ---- Users ---- */
        searchUsers: (q) => API.get(`/users?q=${encodeURIComponent(q)}`),
        suggestions: (limit = 8) => API.get(`/users/suggestions?limit=${limit}`),
        onlineUsers: (limit = 30) => API.get(`/users/online?limit=${limit}`),
        profile: (username) => API.get(`/users/${encodeURIComponent(username)}`),
        userPosts: (username, params = {}) => {
            const q = new URLSearchParams(params).toString();
            return API.get(`/users/${encodeURIComponent(username)}/posts` + (q ? `?${q}` : ''));
        },
        follow: (username) => API.post(`/users/${encodeURIComponent(username)}/follow`),
        unfollow: (username) => API.del(`/users/${encodeURIComponent(username)}/follow`),
        followers: (username) => API.get(`/users/${encodeURIComponent(username)}/followers`),
        following: (username) => API.get(`/users/${encodeURIComponent(username)}/following`),
        savedPosts: (params = {}) => {
            const q = new URLSearchParams(params).toString();
            // saved eh a lista de posts do usuario logado; usamos o mesmo endpoint com scope.
            return API.get('/posts' + (q ? `?${q}` : '')); // simplificado: frontend usa /me/saved
        },

        /* ---- Messages ---- */
        conversations: () => API.get('/messages'),
        thread: (username) => API.get(`/messages/${encodeURIComponent(username)}`),
        sendMessage: (data) => API.post('/messages', data),
        markRead: (username) => API.post(`/messages/${encodeURIComponent(username)}/read`),

        /* ---- Notifications ---- */
        notifications: (limit = 50) => API.get(`/notifications?limit=${limit}`),
        markAllNotificationsRead: () => API.post('/notifications/read'),
        markNotificationRead: (id) => API.post(`/notifications/${id}/read`),

        /* ---- Hub ---- */
        hubList: (type, params = {}) => {
            const q = new URLSearchParams({ type, ...params }).toString();
            return API.get(`/hub?${q}`);
        },
        hubGet: (id) => API.get(`/hub/${id}`),
        hubAnswers: (id) => API.get(`/hub/${id}/answers`),
        hubCreate: (data) => API.post('/hub', data),
        hubUpdate: (id, data) => API.put(`/hub/${id}`, data),
        hubDelete: (id) => API.del(`/hub/${id}`),
        hubReply: (id, content) => API.post(`/hub/${id}/reply`, { content }),
        hubSolve: (id, solved = true) => API.post(`/hub/${id}/solve`, { solved }),
    };

    global.FaeAPI = API;
})(window);
