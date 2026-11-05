/* =====================================================
   FaeNet - profile.js
   Pagina de perfil do usuario: banner, avatar editavel,
   bio, contadores, abas de publicacoes e salvos.
   ===================================================== */

(function (global) {
    'use strict';

    const Profile = {
        async render(container, username) {
            const me = FaeAuth.currentUser;
            if (!me) return;

            const targetUsername = username || me.username;
            let isMe = targetUsername === me.username;

            const skel = FaeUtils.el('div', { class: 'skeleton', style: { height: '200px', marginBottom: '16px' } });
            container.appendChild(skel);

            let profile;
            try {
                profile = await FaeAPI.profile(targetUsername);
                isMe = profile.username === me.username;
            } catch (e) {
                skel.remove();
                FaeUtils.error(e.message);
                return;
            }

            const wrap = FaeUtils.el('div', {});

            // Card de perfil
            const card = FaeUtils.el('div', { class: 'profile' });
            const banner = FaeUtils.el('div', { class: 'profile__banner' });
            if (profile.banner_img) {
                banner.style.backgroundImage = `url("${profile.banner_img}")`;
            }
            card.appendChild(banner);
            if (isMe) {
                const editBanner = FaeUtils.el('button', { class: 'profile__banner-edit is-visible' }, '🖼 Trocar banner');
                editBanner.addEventListener('click', () => this.editBanner(banner, profile));
                banner.appendChild(editBanner);
            }

            const main = FaeUtils.el('div', { class: 'profile__main' });
            const avWrap = FaeUtils.el('div', { class: 'profile__avatar-wrap' });
            const av = FaeUtils.avatarNode(profile, 'xl');
            if (profile.online) av.classList.add('avatar--online');
            avWrap.appendChild(av);
            if (isMe) {
                const editAv = FaeUtils.el('button', { class: 'profile__avatar-edit is-visible', title: 'Trocar foto' }, '✎');
                editAv.addEventListener('click', () => this.editAvatar(av, profile));
                avWrap.appendChild(editAv);
            }
            main.appendChild(avWrap);

            main.appendChild(FaeUtils.el('h1', { class: 'profile__name' }, profile.name || profile.username));
            main.appendChild(FaeUtils.el('div', { class: 'profile__username' }, `@${FaeUtils.userHandle(profile)}`));

            if (profile.bio) main.appendChild(FaeUtils.el('div', { class: 'profile__bio' }, profile.bio));

            const meta = FaeUtils.el('div', { class: 'profile__meta' });
            if (profile.curso) meta.appendChild(FaeUtils.el('span', {}, `📚 ${profile.curso}`));
            if (profile.turma) meta.appendChild(FaeUtils.el('span', {}, `🎓 ${profile.turma}`));
            meta.appendChild(FaeUtils.el('span', {}, `📅 Entrou em ${new Date(profile.joined).toLocaleDateString('pt-BR')}`));
            meta.appendChild(FaeUtils.el('span', {}, `👥 ${FaeUtils.formatNumber(profile.followers_count)} seguidores`));
            meta.appendChild(FaeUtils.el('span', {}, `➡️ ${FaeUtils.formatNumber(profile.following_count)} seguindo`));
            main.appendChild(meta);

            // Acoes
            const actions = FaeUtils.el('div', { class: 'profile__actions' });
            if (isMe) {
                const editBtn = FaeUtils.el('button', { class: 'btn btn--ghost', onclick: () => this.editProfile(profile) }, '✎ Editar perfil');
                actions.appendChild(editBtn);
                const settingsBtn = FaeUtils.el('a', { class: 'btn btn--ghost', href: '/settings', 'data-link': true }, '⚙ Configuracoes');
                actions.appendChild(settingsBtn);
            } else {
                const followBtn = FaeUtils.followButton(profile, me, profile.is_following);
                if (followBtn) actions.appendChild(followBtn);
                const msgBtn = FaeUtils.el('a', { class: 'btn btn--primary', href: `/messages?to=${profile.username}`, 'data-link': true }, '✉️ Mensagem');
                actions.appendChild(msgBtn);
            }
            main.appendChild(actions);

            // Tabs
            const tabs = FaeUtils.el('div', { class: 'profile__tabs' });
            const tabPosts = FaeUtils.el('button', { class: 'profile__tab is-active' }, 'Publicacoes');
            const tabSaved = FaeUtils.el('button', { class: 'profile__tab' }, 'Salvos');
            const tabFollowers = FaeUtils.el('button', { class: 'profile__tab' }, 'Seguidores');
            const tabFollowing = FaeUtils.el('button', { class: 'profile__tab' }, 'Seguindo');
            tabs.appendChild(tabPosts);
            if (isMe) tabs.appendChild(tabSaved);
            tabs.appendChild(tabFollowers);
            tabs.appendChild(tabFollowing);
            main.appendChild(tabs);

            // Area de conteudo das abas
            const tabContent = FaeUtils.el('div', { class: 'profile__tab-content', style: { marginTop: '14px' } });
            main.appendChild(tabContent);

            card.appendChild(main);
            wrap.appendChild(card);

            async function loadPosts() {
                tabContent.innerHTML = '';
                tabContent.appendChild(FaeUtils.el('div', { class: 'skeleton', style: { height: '120px' } }));
                try {
                    const posts = await FaeAPI.userPosts(profile.username, { limit: 50 });
                    tabContent.innerHTML = '';
                    if (!posts.length) {
                        tabContent.appendChild(FaeUtils.el('div', { class: 'empty' }, 'Nenhuma publicacao ainda.'));
                        return;
                    }
                    posts.forEach(p => FaeFeed.renderPostCard(p, tabContent));
                } catch (e) {
                    tabContent.innerHTML = '';
                    FaeUtils.error(e.message);
                }
            }
            async function loadSaved() {
                tabContent.innerHTML = '';
                tabContent.appendChild(FaeUtils.el('div', { class: 'skeleton', style: { height: '120px' } }));
                try {
                    const posts = await FaeAPI.feed({ scope: 'all', limit: 100 });
                    const saved = posts.filter(p => p.saved_by_me);
                    tabContent.innerHTML = '';
                    if (!saved.length) {
                        tabContent.appendChild(FaeUtils.el('div', { class: 'empty' }, 'Voce ainda nao salvou nada.'));
                        return;
                    }
                    saved.forEach(p => FaeFeed.renderPostCard(p, tabContent));
                } catch (e) {
                    tabContent.innerHTML = '';
                    FaeUtils.error(e.message);
                }
            }
            async function loadList(kind) {
                tabContent.innerHTML = '';
                tabContent.appendChild(FaeUtils.el('div', { class: 'skeleton', style: { height: '120px' } }));
                try {
                    const list = kind === 'followers' ? await FaeAPI.followers(profile.username) : await FaeAPI.following(profile.username);
                    tabContent.innerHTML = '';
                    if (!list.length) {
                        tabContent.appendChild(FaeUtils.el('div', { class: 'empty' }, `Sem ${kind === 'followers' ? 'seguidores' : 'seguindo'} ainda.`));
                        return;
                    }
                    list.forEach(u => {
                        const card = FaeUtils.el('a', { href: FaeUtils.profilePath(u), 'data-link': true, class: 'card card--hover flex gap-2 mb-1' },
                            FaeUtils.avatarNode(u, 'sm'),
                            FaeUtils.el('div', { class: 'flex-1' },
                                FaeUtils.el('div', { style: { fontWeight: 600 } }, u.name || u.username),
                                FaeUtils.el('div', { class: 'muted text-xs' }, `@${FaeUtils.userHandle(u)}` + (u.curso ? ` · ${u.curso}` : '')),
                            ),
                        );
                        const btn = FaeUtils.followButton(u, FaeAuth.currentUser, kind === 'following');
                        if (btn) card.appendChild(btn);
                        tabContent.appendChild(card);
                    });
                } catch (e) {
                    tabContent.innerHTML = '';
                    FaeUtils.error(e.message);
                }
            }

            tabPosts.addEventListener('click', () => {
                [tabPosts, tabSaved, tabFollowers, tabFollowing].forEach(t => t.classList.remove('is-active'));
                tabPosts.classList.add('is-active');
                loadPosts();
            });
            if (isMe) {
                tabSaved.addEventListener('click', () => {
                    [tabPosts, tabSaved, tabFollowers, tabFollowing].forEach(t => t.classList.remove('is-active'));
                    tabSaved.classList.add('is-active');
                    loadSaved();
                });
            }
            tabFollowers.addEventListener('click', () => {
                [tabPosts, tabSaved, tabFollowers, tabFollowing].forEach(t => t.classList.remove('is-active'));
                tabFollowers.classList.add('is-active');
                loadList('followers');
            });
            tabFollowing.addEventListener('click', () => {
                [tabPosts, tabSaved, tabFollowers, tabFollowing].forEach(t => t.classList.remove('is-active'));
                tabFollowing.classList.add('is-active');
                loadList('following');
            });

            skel.remove();
            container.appendChild(wrap);
            loadPosts();
        },

        async editProfile(profile) {
            if(FaeAuth.hubOnly){window.location.assign('/auth/faehub/profile');return;}
            const form = FaeUtils.el('form', {},
                FaeUtils.el('div', { class: 'field' },
                    FaeUtils.el('span', { class: 'field__label' }, 'Nome completo'),
                    FaeUtils.el('input', { class: 'field__input', type: 'text', name: 'name', value: profile.name || '', maxlength: 120, required: true }),
                ),
                FaeUtils.el('div', { class: 'field' },
                    FaeUtils.el('span', { class: 'field__label' }, 'Bio'),
                    FaeUtils.el('textarea', { class: 'field__textarea', name: 'bio', maxlength: 280 }, profile.bio || ''),
                ),
                FaeUtils.el('div', { class: 'field' },
                    FaeUtils.el('span', { class: 'field__label' }, 'Turma'),
                    FaeUtils.el('input', { class: 'field__input', type: 'text', name: 'turma', value: profile.turma || '', maxlength: 100 }),
                ),
            );
            const modal = FaeUtils.openModal({
                title: 'Editar perfil',
                body: form,
                footer: [
                    FaeUtils.el('button', { class: 'btn btn--ghost', onclick: () => modal.close() }, 'Cancelar'),
                    FaeUtils.el('button', { class: 'btn btn--primary', type: 'submit', onclick: async (e) => {
                        e.preventDefault();
                        try {
                            const data = {
                                name: form.name.value.trim(),
                                bio: form.bio.value.trim(),
                                turma: form.turma.value.trim(),
                            };
                            const updated = await FaeAPI.updateMe(data);
                            FaeAuth.currentUser = updated;
                            FaeUtils.success('Perfil atualizado!');
                            modal.close();
                            window.FaeApp.refresh();
                        } catch (err) { FaeUtils.error(err.message); }
                    } }, 'Salvar'),
                ],
            });
        },

        async editAvatar(avatarEl, profile) {
            if(FaeAuth.hubOnly){window.location.assign('/auth/faehub/profile');return;}
            const fileInput = FaeUtils.el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
            const preview = FaeUtils.el('div', { class: 'muted' }, 'Selecione uma imagem para o avatar.');
            let dataUrl = null;
            fileInput.addEventListener('change', async () => {
                const f = fileInput.files[0];
                if (!f) return;
                dataUrl = await FaeUtils.compressImage(f, 512, 0.9);
                preview.innerHTML = '';
                preview.appendChild(FaeUtils.el('img', { src: dataUrl, style: { width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover' } }));
            });
            const modal = FaeUtils.openModal({
                title: 'Trocar avatar',
                body: FaeUtils.el('div', {}, preview, FaeUtils.el('div', { class: 'field mt-2' }, FaeUtils.el('span', { class: 'field__label' }, 'Imagem'), fileInput)),
                footer: [
                    FaeUtils.el('button', { class: 'btn btn--ghost', onclick: () => modal.close() }, 'Cancelar'),
                    FaeUtils.el('button', { class: 'btn btn--primary', onclick: async () => {
                        if (!dataUrl) { FaeUtils.error('Selecione uma imagem.'); return; }
                        try {
                            const form = new FormData();
                            form.append('category', 'avatar');
                            form.append('data_url', dataUrl);
                            const { url } = await FaeAPI.uploadMedia(form);
                            const updated = await FaeAPI.updateMe({ avatar_img: url });
                            FaeAuth.currentUser = updated;
                            FaeUtils.success('Avatar atualizado!');
                            modal.close();
                            window.FaeApp.refresh();
                        } catch (e) { FaeUtils.error(e.message); }
                    } }, 'Salvar'),
                ],
            });
        },

        async editBanner(bannerEl, profile) {
            if(FaeAuth.hubOnly){window.location.assign('/auth/faehub/profile');return;}
            const fileInput = FaeUtils.el('input', { type: 'file', accept: 'image/*' });
            const preview = FaeUtils.el('div', { class: 'muted' }, 'Selecione uma imagem (PNG, JPG, WEBP ou GIF).');
            let dataUrl = null;
            fileInput.addEventListener('change', async () => {
                const f = fileInput.files[0];
                if (!f) return;
                try {
                    dataUrl = await FaeUtils.compressImage(f, 2000, 0.85);
                    preview.innerHTML = '';
                    preview.appendChild(FaeUtils.el('img', { src: dataUrl, style: { maxWidth: '100%', borderRadius: '12px', aspectRatio: '4/1', objectFit: 'cover' } }));
                } catch (e) { FaeUtils.error(e.message); }
            });
            const modal = FaeUtils.openModal({
                title: 'Trocar banner',
                body: FaeUtils.el('div', {}, preview, FaeUtils.el('div', { class: 'field mt-2' }, FaeUtils.el('span', { class: 'field__label' }, 'Imagem (suporta GIF)'), fileInput)),
                footer: [
                    FaeUtils.el('button', { class: 'btn btn--ghost', onclick: () => modal.close() }, 'Cancelar'),
                    FaeUtils.el('button', { class: 'btn btn--primary', onclick: async () => {
                        if (!dataUrl) { FaeUtils.error('Selecione uma imagem.'); return; }
                        try {
                            const form = new FormData();
                            form.append('category', 'banner');
                            form.append('data_url', dataUrl);
                            const { url } = await FaeAPI.uploadMedia(form);
                            const updated = await FaeAPI.updateMe({ banner_img: url });
                            FaeAuth.currentUser = updated;
                            FaeUtils.success('Banner atualizado!');
                            modal.close();
                            window.FaeApp.refresh();
                        } catch (e) { FaeUtils.error(e.message); }
                    } }, 'Salvar'),
                ],
            });
        },
    };

    global.FaeProfile = Profile;
})(window);
