/* =====================================================
   FaeNet - feed.js
   Composicao, renderizacao de posts, stories, curtir,
   salvar, repostar, comentar e votar em enquete.
   ===================================================== */

(function (global) {
    'use strict';

    const Feed = {
        /* ===========================================================
         * Compose box
         * =========================================================== */
        renderCompose(container, onPosted) {
            const me = FaeAuth.currentUser;
            if (!me) return;

            const wrapper = FaeUtils.el('div', { class: 'compose' });
            const ta = FaeUtils.el('textarea', {
                class: 'compose__textarea',
                placeholder: `O que esta acontecendo, ${(me.name || me.username).split(' ')[0]}?`,
                rows: 2,
            });

            const media = FaeUtils.el('div', { class: 'compose__media', hidden: true });
            const pollBox = FaeUtils.el('div', { class: 'compose__poll-builder', hidden: true });
            const pollQuestionInput = FaeUtils.el('input', {
                class: 'field__input', type: 'text', placeholder: 'Pergunta da enquete', maxlength: 200,
            });
            const pollOptionsWrap = FaeUtils.el('div');
            const pollOptions = [];

            function renderPollOptions() {
                FaeUtils.clear(pollOptionsWrap);
                pollOptions.forEach((opt, idx) => {
                    const row = FaeUtils.el('div', { class: 'flex gap-1 mb-1' },
                        opt.input,
                        FaeUtils.el('button', {
                            type: 'button',
                            class: 'btn btn--ghost btn--sm',
                            onclick: () => {
                                pollOptions.splice(idx, 1);
                                renderPollOptions();
                            },
                        }, '×'),
                    );
                    pollOptionsWrap.appendChild(row);
                });
            }
            function addPollOption() {
                if (pollOptions.length >= 6) return;
                const inp = FaeUtils.el('input', {
                    class: 'field__input', type: 'text', placeholder: `Opcao ${pollOptions.length + 1}`, maxlength: 80,
                });
                pollOptions.push({ input: inp });
                renderPollOptions();
            }

            pollBox.appendChild(pollQuestionInput);
            pollBox.appendChild(FaeUtils.el('div', { class: 'muted text-xs mb-1' }, 'Adicione 2 a 6 opcoes.'));
            pollBox.appendChild(pollOptionsWrap);
            pollBox.appendChild(FaeUtils.el('button', {
                type: 'button', class: 'btn btn--ghost btn--sm mt-1', onclick: addPollOption,
            }, '+ Adicionar opcao'));
            pollOptions.push({ input: FaeUtils.el('input', { class: 'field__input', type: 'text', placeholder: 'Opcao 1', maxlength: 80 }) });
            pollOptions.push({ input: FaeUtils.el('input', { class: 'field__input', type: 'text', placeholder: 'Opcao 2', maxlength: 80 }) });
            renderPollOptions();

            // Upload de midia
            const fileInput = FaeUtils.el('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
            let pendingImages = [];

            async function handleFiles(files) {
                for (const file of files) {
                    if (pendingImages.length >= 6) break;
                    try {
                        const dataUrl = await FaeUtils.compressImage(file);
                        pendingImages.push({ dataUrl, name: file.name });
                    } catch (err) {
                        FaeUtils.error(err.message);
                        continue;
                    }
                }
                renderMedia();
            }
            function renderMedia() {
                FaeUtils.clear(media);
                if (!pendingImages.length) { media.hidden = true; return; }
                media.hidden = false;
                pendingImages.forEach((img, idx) => {
                    const item = FaeUtils.el('div', { class: 'compose__media-item' },
                        FaeUtils.el('img', { src: img.dataUrl, alt: '' }),
                        FaeUtils.el('button', {
                            type: 'button', onclick: () => {
                                pendingImages.splice(idx, 1);
                                renderMedia();
                            },
                        }, '×'),
                    );
                    media.appendChild(item);
                });
            }
            fileInput.addEventListener('change', () => handleFiles(fileInput.files));

            // Drag & drop
            wrapper.addEventListener('dragover', (e) => { e.preventDefault(); wrapper.classList.add('is-drag'); });
            wrapper.addEventListener('dragleave', () => wrapper.classList.remove('is-drag'));
            wrapper.addEventListener('drop', (e) => {
                e.preventDefault();
                wrapper.classList.remove('is-drag');
                if (e.dataTransfer.files && e.dataTransfer.files.length) {
                    handleFiles(e.dataTransfer.files);
                }
            });

            const btnImage = FaeUtils.el('button', {
                type: 'button', class: 'btn btn--ghost btn--sm', title: 'Adicionar imagem',
                onclick: () => fileInput.click(),
            }, '🖼️ Imagem');

            const btnPoll = FaeUtils.el('button', {
                type: 'button', class: 'btn btn--ghost btn--sm', title: 'Adicionar enquete',
                onclick: () => { pollBox.hidden = !pollBox.hidden; },
            }, '📊 Enquete');

            const submit = FaeUtils.el('button', {
                class: 'btn btn--primary',
                onclick: async () => {
                    submit.disabled = true;
                    const originalText = submit.textContent;
                    submit.textContent = 'Publicando...';
                    try {
                        const images = [];
                        for (const img of pendingImages) {
                            const form = new FormData();
                            form.append('category', 'post');
                            form.append('data_url', img.dataUrl);
                            const { url } = await FaeAPI.uploadMedia(form);
                            images.push(url);
                        }

                        let poll = null;
                        if (!pollBox.hidden) {
                            const question = pollQuestionInput.value.trim();
                            const options = pollOptions
                                .map(o => o.input.value.trim())
                                .filter(Boolean);
                            if (!question || options.length < 2) {
                                throw new Error('Enquete precisa de pergunta e pelo menos 2 opcoes.');
                            }
                            poll = { question, options };
                        }

                        const text = ta.value.trim();
                        if (!text && !images.length && !poll) {
                            throw new Error('Escreva algo, adicione uma imagem ou crie uma enquete.');
                        }

                        const post = await FaeAPI.createPost({ content: text, images, poll });
                        FaeUtils.success('Publicado!');
                        ta.value = '';
                        pendingImages = [];
                        renderMedia();
                        pollBox.hidden = true;
                        if (typeof onPosted === 'function') onPosted(post);
                    } catch (err) {
                        FaeUtils.error(err.message);
                    } finally {
                        submit.disabled = false;
                        submit.textContent = originalText;
                    }
                },
            }, 'Publicar');

            const actions = FaeUtils.el('div', { class: 'compose__actions' });
            actions.appendChild(btnImage);
            actions.appendChild(btnPoll);
            actions.appendChild(fileInput);
            actions.appendChild(submit);

            const row = FaeUtils.el('div', { class: 'compose__row' },
                FaeUtils.avatarNode(me, 'sm'),
                FaeUtils.el('div', { class: 'flex-1' }, ta, media, pollBox),
            );

            wrapper.appendChild(row);
            wrapper.appendChild(actions);
            container.appendChild(wrapper);
        },

        /* ===========================================================
         * Stories bar
         * =========================================================== */
        async renderStories(container) {
            const me = FaeAuth.currentUser;
            const bar = FaeUtils.el('div', { class: 'stories' });

            const addBtn = FaeUtils.el('button', {
                class: 'story', onclick: () => this.openCreateStory(),
            },
                FaeUtils.el('div', { class: 'avatar avatar--sm story-ring story-ring--add' }, '+'),
                FaeUtils.el('span', { class: 'story__label' }, 'Seu story'),
            );
            bar.appendChild(addBtn);

            let stories = [];
            try { stories = await FaeAPI.stories(); } catch (e) { /* silencioso */ }
            stories.forEach(s => {
                const btn = FaeUtils.el('button', {
                    class: 'story',
                    onclick: () => this.openStoryViewer(stories, stories.indexOf(s)),
                },
                    FaeUtils.el('div', { class: 'story-ring' + (s.viewed_by_me ? ' story-ring--seen' : '') },
                        FaeUtils.avatarNode(s.author, 'sm'),
                    ),
                    FaeUtils.el('span', { class: 'story__label' }, s.author ? s.author.username : ''),
                );
                bar.appendChild(btn);
            });
            container.appendChild(bar);
        },

        openCreateStory() {
            const fileInput = FaeUtils.el('input', { type: 'file', accept: 'image/*' });
            const captionInput = FaeUtils.el('input', { class: 'field__input', type: 'text', placeholder: 'Legenda (opcional)', maxlength: 200 });
            const preview = FaeUtils.el('div', { class: 'muted text-sm' }, 'Selecione uma imagem para o story.');
            let dataUrl = null;
            fileInput.addEventListener('change', async () => {
                const f = fileInput.files[0];
                if (!f) return;
                try {
                    dataUrl = await FaeUtils.compressImage(f, 1280, 0.85);
                    preview.innerHTML = '';
                    const img = FaeUtils.el('img', { src: dataUrl, style: { maxWidth: '100%', borderRadius: '12px' } });
                    preview.appendChild(img);
                } catch (e) {
                    FaeUtils.error(e.message);
                }
            });
            const wrap = FaeUtils.el('div', {},
                preview,
                FaeUtils.el('div', { class: 'field mt-2' }, FaeUtils.el('span', { class: 'field__label' }, 'Imagem'), fileInput),
                FaeUtils.el('div', { class: 'field mt-2' }, FaeUtils.el('span', { class: 'field__label' }, 'Legenda'), captionInput),
            );
            const modal = FaeUtils.openModal({
                title: 'Novo story',
                body: wrap,
                footer: [
                    FaeUtils.el('button', { class: 'btn btn--ghost', onclick: () => modal.close() }, 'Cancelar'),
                    FaeUtils.el('button', { class: 'btn btn--primary', onclick: async () => {
                        if (!dataUrl) { FaeUtils.error('Selecione uma imagem.'); return; }
                        try {
                            await FaeAPI.createStory({ image_data_url: dataUrl, caption: captionInput.value });
                            FaeUtils.success('Story publicado!');
                            modal.close();
                            window.FaeApp.refresh();
                        } catch (err) { FaeUtils.error(err.message); }
                    } }, 'Publicar'),
                ],
            });
        },

        openStoryViewer(stories, startIndex) {
            let idx = startIndex || 0;
            const root = FaeUtils.el('div', { class: 'story-viewer' });
            const progressWrap = FaeUtils.el('div', { class: 'story-viewer__progress' });
            stories.forEach(() => progressWrap.appendChild(FaeUtils.el('div', { class: 'story-viewer__progress-bar' },
                FaeUtils.el('div', { class: 'story-viewer__progress-fill' }))));
            const header = FaeUtils.el('div', { class: 'story-viewer__header' });
            const img = FaeUtils.el('img', { class: 'story-viewer__image' });
            const cap = FaeUtils.el('div', { class: 'story-viewer__caption' });
            const navPrev = FaeUtils.el('button', { class: 'story-viewer__nav story-viewer__nav--prev' });
            const navNext = FaeUtils.el('button', { class: 'story-viewer__nav story-viewer__nav--next' });
            root.appendChild(progressWrap);
            root.appendChild(header);
            root.appendChild(img);
            root.appendChild(cap);
            root.appendChild(navPrev);
            root.appendChild(navNext);

            let timer = null;
            let progressTimer = null;
            const DURATION = 5000;

            const close = () => {
                if (timer) clearTimeout(timer);
                if (progressTimer) clearInterval(progressTimer);
                root.remove();
            };

            const renderCurrent = () => {
                const s = stories[idx];
                if (!s) { close(); return; }
                img.src = s.image;
                cap.textContent = s.caption || '';
                FaeUtils.clear(header);
                header.appendChild(FaeUtils.avatarNode(s.author, 'sm'));
                header.appendChild(FaeUtils.el('div', {},
                    FaeUtils.el('div', { style: { fontWeight: 600 } }, s.author ? s.author.name : ''),
                    FaeUtils.el('div', { style: { fontSize: '12px', color: 'rgba(255,255,255,0.6)' } }, `@${s.author ? s.author.username : ''}`),
                ));
                if (s.username === FaeAuth.currentUser.username) {
                    const delBtn = FaeUtils.el('button', {
                        class: 'story-viewer__close', style: { marginRight: '6px' },
                        title: 'Apagar story',
                        onclick: async () => {
                            try {
                                await FaeAPI.deleteStory(s.id);
                                stories.splice(idx, 1);
                                if (!stories.length) { close(); window.FaeApp.refresh(); return; }
                                if (idx >= stories.length) idx = stories.length - 1;
                                renderCurrent();
                            } catch (e) { FaeUtils.error(e.message); }
                        },
                    }, '🗑');
                    header.appendChild(delBtn);
                }
                const closeBtn = FaeUtils.el('button', { class: 'story-viewer__close', onclick: close }, '×');
                header.appendChild(closeBtn);

                FaeAPI.viewStory(s.id).catch(() => {});

                const fills = progressWrap.querySelectorAll('.story-viewer__progress-fill');
                fills.forEach((f, i) => { f.style.width = i < idx ? '100%' : '0%'; });
                if (timer) clearTimeout(timer);
                if (progressTimer) clearInterval(progressTimer);
                const start = Date.now();
                const fill = fills[idx];
                if (!fill) return;
                progressTimer = setInterval(() => {
                    const elapsed = Date.now() - start;
                    const pct = Math.min(100, (elapsed / DURATION) * 100);
                    fill.style.width = `${pct}%`;
                    if (pct >= 100) clearInterval(progressTimer);
                }, 50);
                timer = setTimeout(() => {
                    clearInterval(progressTimer);
                    if (idx < stories.length - 1) { idx++; renderCurrent(); } else { close(); }
                }, DURATION);
            };

            navPrev.addEventListener('click', () => { if (idx > 0) { idx--; renderCurrent(); } });
            navNext.addEventListener('click', () => { if (idx < stories.length - 1) { idx++; renderCurrent(); } else { close(); } });
            const keyHandler = (e) => {
                if (e.key === 'Escape') { close(); document.removeEventListener('keydown', keyHandler); }
                if (e.key === 'ArrowRight') { if (idx < stories.length - 1) { idx++; renderCurrent(); } }
                if (e.key === 'ArrowLeft') { if (idx > 0) { idx--; renderCurrent(); } }
            };
            document.addEventListener('keydown', keyHandler);

            document.body.appendChild(root);
            renderCurrent();
        },

        /* ===========================================================
         * Post card
         * =========================================================== */
        renderPostCard(post, container) {
            const card = FaeUtils.el('article', { class: 'post', data: { id: post.id } });
            if (post.repost_of_data) card.classList.add('post--repost');

            const author = post.author || { username: post.username, name: post.username };

            // Header
            const header = FaeUtils.el('div', { class: 'post__header' });
            header.appendChild(FaeUtils.el('a', { href: `/profile/${author.username}`, 'data-link': true, class: 'flex' },
                FaeUtils.avatarNode(author, 'sm'),
            ));
            header.appendChild(FaeUtils.el('div', { class: 'post__user' },
                FaeUtils.el('div', { class: 'post__name' },
                    FaeUtils.el('a', { href: `/profile/${author.username}`, 'data-link': true, style: { color: 'inherit' } }, author.name || author.username),
                ),
                FaeUtils.el('div', { class: 'post__meta' },
                    `@${author.username}`,
                    author.curso ? ` · ${author.curso}` : '',
                    author.turma ? ` · ${author.turma}` : '',
                    ' · ',
                    FaeUtils.el('span', { title: new Date(post.timestamp).toLocaleString('pt-BR') }, FaeUtils.timeAgo(post.timestamp)),
                ),
            ));

            // Menu
            const menuWrap = FaeUtils.el('div', { class: 'post__menu' }, '⋯');
            const dropdown = FaeUtils.el('div', { class: 'post__menu-dropdown' });
            if (post.username === FaeAuth.currentUser.username) {
                dropdown.appendChild(FaeUtils.el('button', {
                    class: 'post__menu-item post__menu-item--danger',
                    onclick: async (e) => {
                        e.stopPropagation();
                        if (!await FaeUtils.confirm('Apagar essa publicacao?')) return;
                        try {
                            await FaeAPI.deletePost(post.id);
                            card.remove();
                            FaeUtils.success('Publicacao apagada.');
                        } catch (err) { FaeUtils.error(err.message); }
                    },
                }, '🗑 Apagar publicacao'));
            }
            if (post.username !== FaeAuth.currentUser.username) {
                dropdown.appendChild(FaeUtils.el('button', {
                    class: 'post__menu-item',
                    onclick: () => {
                        const url = `${window.location.origin}/profile/${post.username}`;
                        navigator.clipboard?.writeText(url);
                        FaeUtils.info('Link copiado.');
                    },
                }, '🔗 Copiar link'));
                dropdown.appendChild(FaeUtils.el('button', {
                    class: 'post__menu-item',
                    onclick: () => {
                        const text = post.content || '';
                        navigator.clipboard?.writeText(text);
                        FaeUtils.info('Texto copiado.');
                    },
                }, '📋 Copiar texto'));
            }
            if (dropdown.children.length) {
                menuWrap.appendChild(dropdown);
                menuWrap.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.post__menu.is-open').forEach(m => { if (m !== menuWrap) m.classList.remove('is-open'); });
                    menuWrap.classList.toggle('is-open');
                });
                header.appendChild(menuWrap);
            } else {
                header.appendChild(FaeUtils.el('div', { style: { marginLeft: 'auto' } }));
            }

            card.appendChild(header);

            if (post.repost_of_data) {
                card.appendChild(FaeUtils.el('div', { class: 'post__repost-tag' },
                    `🔁 ${author.name || author.username} repostou`,
                ));
            }

            if (post.content) {
                card.appendChild(FaeUtils.el('div', { class: 'post__content', html: FaeUtils.formatText(post.content) }));
            }

            const images = (post.repost_of_data ? post.repost_of_data.images : post.images) || [];
            if (images.length) card.appendChild(this.renderGallery(images));

            const pollData = (post.repost_of_data ? post.repost_of_data.poll : post.poll);
            if (pollData) card.appendChild(this.renderPoll(pollData, post));

            // Acoes + comentarios
            const actions = this.renderPostActions(post, card);
            card.appendChild(actions);

            const comments = this.renderCommentsSection(post);
            card.appendChild(comments);

            // Liga o botao de comentario a abrir a secao.
            actions.querySelector('[data-act="comment"]').addEventListener('click', () => {
                comments.classList.toggle('is-open');
                if (comments.classList.contains('is-open') && !comments.dataset.loaded) {
                    comments.__load && comments.__load();
                }
            });

            container.appendChild(card);
        },

        renderGallery(images) {
            const n = images.length;
            let cls = 'gallery--g1';
            if (n === 2) cls = 'gallery--g2';
            else if (n === 3) cls = 'gallery--g3';
            else if (n === 4) cls = 'gallery--g4';
            else if (n >= 5) cls = 'gallery--gm';
            const g = FaeUtils.el('div', { class: `gallery ${cls}` });
            images.slice(0, 6).forEach(src => {
                const item = FaeUtils.el('div', { class: 'gallery__item' },
                    FaeUtils.el('img', { src, alt: '', loading: 'lazy' }),
                );
                item.addEventListener('click', () => this.openImageLightbox(src));
                g.appendChild(item);
            });
            return g;
        },

        openImageLightbox(src) {
            const root = FaeUtils.el('div', { class: 'story-viewer' },
                FaeUtils.el('button', { class: 'story-viewer__close', style: { position: 'absolute', top: '16px', right: '16px', zIndex: 2 }, onclick: () => root.remove() }, '×'),
                FaeUtils.el('img', { class: 'story-viewer__image', src }),
            );
            document.body.appendChild(root);
            root.addEventListener('click', (e) => { if (e.target === root) root.remove(); });
        },

        renderPoll(poll, post) {
            const wrap = FaeUtils.el('div', { class: 'poll' });
            wrap.appendChild(FaeUtils.el('div', { class: 'poll__question' }, poll.question));
            const total = poll.total_votes || poll.options.reduce((a, o) => a + (o.votes || 0), 0);
            poll.options.forEach((opt, idx) => {
                const option = FaeUtils.el('div', { class: 'poll__option', data: { idx } });
                const percent = total > 0 ? (opt.votes / total) * 100 : 0;
                option.appendChild(FaeUtils.el('div', { class: 'poll__bar', style: { width: `${percent}%` } }));
                option.appendChild(FaeUtils.el('div', { class: 'poll__option-text' }, opt.text));
                option.appendChild(FaeUtils.el('div', { class: 'poll__option-percent' }, `${Math.round(percent)}%`));
                option.addEventListener('click', async () => {
                    try {
                        const updated = await FaeAPI.votePoll(post.id, idx);
                        const newPoll = this.renderPoll(updated, post);
                        wrap.replaceWith(newPoll);
                    } catch (e) { FaeUtils.error(e.message); }
                });
                wrap.appendChild(option);
            });
            wrap.appendChild(FaeUtils.el('div', { class: 'poll__total' }, `${total} voto${total === 1 ? '' : 's'}`));
            return wrap;
        },

        renderPostActions(post) {
            const actions = FaeUtils.el('div', { class: 'post__actions' });

            const commentBtn = FaeUtils.el('button', {
                class: 'action', 'data-act': 'comment', title: 'Comentar',
            },
                FaeUtils.el('span', {}, '💬'),
                FaeUtils.el('span', { class: 'action__count' }, FaeUtils.formatNumber(post.comments_count || 0)),
            );

            const repostBtn = FaeUtils.el('button', {
                class: 'action action--repost' + (post.reposted_by_me ? ' is-active' : ''),
                title: 'Repostar',
                onclick: async () => {
                    try {
                        if (post.reposted_by_me) {
                            const r = await FaeAPI.toggleRepost(post.id);
                            post.reposted_by_me = r.reposted;
                            post.reposts_count = r.reposts_count;
                        } else {
                            await FaeAPI.createPost({ content: '', repost_of: post.id });
                            const r = await FaeAPI.toggleRepost(post.id);
                            post.reposted_by_me = r.reposted;
                            post.reposts_count = r.reposts_count;
                            FaeUtils.success('Repostado no seu feed!');
                            window.FaeApp.refresh();
                            return;
                        }
                        repostBtn.classList.toggle('is-active', post.reposted_by_me);
                        repostBtn.querySelector('.action__count').textContent = FaeUtils.formatNumber(post.reposts_count);
                    } catch (e) { FaeUtils.error(e.message); }
                },
            },
                FaeUtils.el('span', {}, '🔁'),
                FaeUtils.el('span', { class: 'action__count' }, FaeUtils.formatNumber(post.reposts_count || 0)),
            );

            const likeBtn = FaeUtils.el('button', {
                class: 'action action--like' + (post.liked_by_me ? ' is-active' : ''),
                title: 'Curtir',
                onclick: async () => {
                    try {
                        const r = await FaeAPI.toggleLike(post.id);
                        post.liked_by_me = r.liked;
                        post.likes_count = r.likes_count;
                        likeBtn.classList.toggle('is-active', r.liked);
                        likeBtn.querySelector('.action__count').textContent = FaeUtils.formatNumber(r.likes_count);
                    } catch (e) { FaeUtils.error(e.message); }
                },
            },
                FaeUtils.el('span', {}, '♥'),
                FaeUtils.el('span', { class: 'action__count' }, FaeUtils.formatNumber(post.likes_count || 0)),
            );

            const saveBtn = FaeUtils.el('button', {
                class: 'action action--save' + (post.saved_by_me ? ' is-active' : ''),
                title: 'Salvar',
                onclick: async () => {
                    try {
                        const r = await FaeAPI.toggleSave(post.id);
                        post.saved_by_me = r.saved;
                        saveBtn.classList.toggle('is-active', r.saved);
                        FaeUtils.info(r.saved ? 'Salvo nos favoritos.' : 'Removido dos salvos.');
                    } catch (e) { FaeUtils.error(e.message); }
                },
            },
                FaeUtils.el('span', {}, post.saved_by_me ? '🔖' : '🏷'),
            );

            actions.appendChild(commentBtn);
            actions.appendChild(repostBtn);
            actions.appendChild(likeBtn);
            actions.appendChild(saveBtn);
            return actions;
        },

        renderCommentsSection(post) {
            const wrap = FaeUtils.el('div', { class: 'comments' });
            const list = FaeUtils.el('div', { class: 'comments__list' });
            wrap.appendChild(list);

            const form = FaeUtils.el('form', { class: 'comment-form' },
                FaeUtils.avatarNode(FaeAuth.currentUser, 'xs'),
                FaeUtils.el('input', {
                    class: 'comment-form__input', type: 'text', placeholder: 'Escreva um comentario...', maxlength: 1000,
                }),
                FaeUtils.el('button', { class: 'btn btn--primary btn--sm', type: 'submit' }, 'Enviar'),
            );
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const input = form.querySelector('input');
                const text = input.value.trim();
                if (!text) return;
                try {
                    const c = await FaeAPI.comment(post.id, text);
                    list.appendChild(this.renderCommentNode(c));
                    input.value = '';
                } catch (err) { FaeUtils.error(err.message); }
            });
            wrap.appendChild(form);

            wrap.__load = async () => {
                try {
                    const items = await FaeAPI.comments(post.id);
                    FaeUtils.clear(list);
                    items.forEach(c => list.appendChild(this.renderCommentNode(c)));
                    wrap.dataset.loaded = '1';
                } catch (e) { FaeUtils.error(e.message); }
            };
            return wrap;
        },

        renderCommentNode(c) {
            return FaeUtils.el('div', { class: 'comment' },
                FaeUtils.el('a', { href: `/profile/${c.username}`, 'data-link': true },
                    FaeUtils.avatarNode(c.author, 'xs'),
                ),
                FaeUtils.el('div', { class: 'comment__body' },
                    FaeUtils.el('div', { class: 'comment__name' }, c.author ? c.author.name : c.username),
                    FaeUtils.el('div', { class: 'comment__text', html: FaeUtils.formatText(c.content) }),
                    FaeUtils.el('div', { class: 'comment__time' }, FaeUtils.timeAgo(c.timestamp)),
                ),
            );
        },

        /* ===========================================================
         * Feed
         * =========================================================== */
        async renderFeed(container, scope = 'following') {
            const me = FaeAuth.currentUser;
            if (!me) return;

            await this.renderStories(container);
            this.renderCompose(container, () => this.renderFeed(container, scope));

            const skel = FaeUtils.el('div', { class: 'skeleton', style: { height: '160px', marginBottom: '12px' } });
            container.appendChild(skel);

            try {
                const posts = await FaeAPI.feed({ scope, limit: 30 });
                skel.remove();
                if (!posts.length) {
                    container.appendChild(FaeUtils.el('div', { class: 'empty' },
                        scope === 'following'
                            ? 'Nenhuma publicacao ainda. Siga alguem ou crie a primeira!'
                            : 'Nenhuma publicacao no momento.',
                    ));
                } else {
                    posts.forEach(p => this.renderPostCard(p, container));
                }
            } catch (e) {
                skel.remove();
                FaeUtils.error(e.message);
            }
        },

        async renderSaved(container) {
            const skel = FaeUtils.el('div', { class: 'skeleton', style: { height: '120px' } });
            container.appendChild(skel);
            try {
                const posts = await FaeAPI.feed({ scope: 'all', limit: 100 });
                const saved = posts.filter(p => p.saved_by_me);
                skel.remove();
                if (!saved.length) {
                    container.appendChild(FaeUtils.el('div', { class: 'empty' }, 'Voce ainda nao salvou nenhuma publicacao.'));
                } else {
                    saved.forEach(p => this.renderPostCard(p, container));
                }
            } catch (e) {
                skel.remove();
                FaeUtils.error(e.message);
            }
        },
    };

    global.FaeFeed = Feed;
})(window);
