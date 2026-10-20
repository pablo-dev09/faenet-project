/* =====================================================
   FaeNet - messages.js
   Mensagens privadas com lista de conversas, historico
   da conversa, envio de texto, imagens e arquivos.
   ===================================================== */

(function (global) {
    'use strict';

    const Messages = {
        activeOther: null,
        activeThread: null,

        async render(container) {
            const me = FaeAuth.currentUser;
            if (!me) return;

            const chat = FaeUtils.el('div', { class: 'chat' });

            // Sidebar
            const sidebar = FaeUtils.el('div', { class: 'chat__sidebar' });
            const sidebarHeader = FaeUtils.el('div', { class: 'chat__sidebar-header' },
                FaeUtils.el('h2', {}, 'Mensagens'),
            );
            sidebar.appendChild(sidebarHeader);

            const search = FaeUtils.el('input', { class: 'search-bar', type: 'text', placeholder: 'Buscar conversas...', maxlength: 80 });
            const searchWrap = FaeUtils.el('div', { class: 'chat__sidebar-search' }, search);
            sidebar.appendChild(searchWrap);

            const list = FaeUtils.el('div', { class: 'chat__sidebar-list' });
            sidebar.appendChild(list);

            // Thread
            const thread = FaeUtils.el('div', { class: 'chat__thread' });
            thread.appendChild(FaeUtils.el('div', { class: 'chat__empty' },
                FaeUtils.el('div', { style: { fontSize: '40px' } }, '💬'),
                FaeUtils.el('div', {}, 'Selecione uma conversa para comecar.'),
            ));

            chat.appendChild(sidebar);
            chat.appendChild(thread);
            container.appendChild(chat);

            async function loadConversations() {
                list.innerHTML = '';
                let convs = [];
                try { convs = await FaeAPI.conversations(); } catch (e) { FaeUtils.error(e.message); return; }
                const filter = (search.value || '').toLowerCase();
                convs
                    .filter(c => !filter || (c.with && (FaeUtils.userHandle(c.with).toLowerCase().includes(filter) || (c.with.name || '').toLowerCase().includes(filter))))
                    .forEach(c => {
                        const item = FaeUtils.el('div', { class: 'chat__item' + (Messages.activeOther === c.with.username ? ' is-active' : ''), data: { username: c.with.username } },
                            FaeUtils.avatarNode(c.with, 'sm'),
                            FaeUtils.el('div', { class: 'chat__item-info' },
                                FaeUtils.el('div', { class: 'chat__item-name' }, c.with.name || c.with.username),
                                FaeUtils.el('div', { class: 'chat__item-preview' },
                                    (c.last_message.from_user === me.username ? 'Voce: ' : '') + (c.last_message.text || (c.last_message.file_type === 'image' ? '🖼️ Imagem' : '📎 Arquivo')),
                                ),
                            ),
                            FaeUtils.el('div', { class: 'chat__item-meta' },
                                FaeUtils.el('div', { class: 'chat__item-time' }, FaeUtils.timeAgo(c.last_message.timestamp)),
                                c.unread_count > 0 ? FaeUtils.el('div', { class: 'chat__item-badge' }, c.unread_count) : null,
                            ),
                        );
                        item.addEventListener('click', () => openThread(c.with.username));
                        list.appendChild(item);
                    });
                if (!list.children.length) {
                    list.appendChild(FaeUtils.el('div', { class: 'empty' }, 'Nenhuma conversa ainda.'));
                }
            }
            search.addEventListener('input', FaeUtils.debounce(loadConversations, 200));

            async function openThread(username) {
                Messages.activeOther = username;
                chat.classList.add('is-open-thread');
                thread.innerHTML = '';
                thread.appendChild(FaeUtils.el('div', { class: 'skeleton', style: { height: '100%' } }));

                let msgs = [];
                let otherProfile = null;
                try {
                    msgs = await FaeAPI.thread(username);
                    otherProfile = await FaeAPI.profile(username);
                } catch (e) {
                    thread.innerHTML = '';
                    FaeUtils.error(e.message);
                    return;
                }
                thread.innerHTML = '';

                const header = FaeUtils.el('div', { class: 'chat__thread-header' },
                    FaeUtils.el('button', { class: 'chat__back', onclick: () => {
                        chat.classList.remove('is-open-thread');
                        Messages.activeOther = null;
                        thread.innerHTML = '';
                        thread.appendChild(FaeUtils.el('div', { class: 'chat__empty' },
                            FaeUtils.el('div', { style: { fontSize: '40px' } }, '💬'),
                            FaeUtils.el('div', {}, 'Selecione uma conversa para comecar.'),
                        ));
                        loadConversations();
                    } }, '←'),
                    FaeUtils.avatarNode(otherProfile, 'sm'),
                    FaeUtils.el('div', {},
                        FaeUtils.el('div', { style: { fontWeight: 600 } },
                            FaeUtils.el('a', { href: FaeUtils.profilePath(otherProfile), 'data-link': true, style: { color: 'inherit' } }, otherProfile.name || FaeUtils.userHandle(otherProfile)),
                        ),
                        FaeUtils.el('div', { class: 'chat__thread-status' + (otherProfile.online ? ' is-online' : '') },
                            otherProfile.online ? 'Online' : 'Visto por ultimo ' + FaeUtils.timeAgo(otherProfile.last_seen),
                        ),
                    ),
                );
                thread.appendChild(header);

                const messagesBox = FaeUtils.el('div', { class: 'chat__messages' });
                msgs.forEach(m => messagesBox.appendChild(this.renderMessage(m, me)));
                thread.appendChild(messagesBox);
                messagesBox.scrollTop = messagesBox.scrollHeight;

                const fileInput = FaeUtils.el('input', { type: 'file', hidden: true });
                fileInput.addEventListener('change', async () => {
                    if (!fileInput.files[0]) return;
                    await sendFile(fileInput.files[0]);
                    fileInput.value = '';
                });

                const inputRow = FaeUtils.el('div', { class: 'chat__input' },
                    FaeUtils.el('button', { class: 'chat__icon-btn', title: 'Anexar arquivo', onclick: () => fileInput.click() }, '📎'),
                    FaeUtils.el('button', { class: 'chat__icon-btn', title: 'Enviar imagem', onclick: () => {
                        fileInput.accept = 'image/*';
                        fileInput.click();
                    } }, '🖼'),
                    FaeUtils.el('input', { class: 'chat__input-field', type: 'text', placeholder: 'Mensagem...', maxlength: 4000 }),
                    FaeUtils.el('button', { class: 'chat__icon-btn', onclick: sendText }, '➤'),
                );
                const inputField = inputRow.querySelector('.chat__input-field');
                inputField.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); }
                });
                thread.appendChild(inputRow);
                thread.appendChild(fileInput);

                let replyTarget = null;
                function setReply(m) {
                    replyTarget = m;
                    inputField.placeholder = `Respondendo a ${m.from_user}...`;
                }
                function clearReply() {
                    replyTarget = null;
                    inputField.placeholder = 'Mensagem...';
                }

                async function sendText() {
                    const text = inputField.value.trim();
                    if (!text) return;
                    inputField.disabled = true;
                    try {
                        const replyPayload = replyTarget ? {
                            id: replyTarget.id, from_user: replyTarget.from_user, text: replyTarget.text,
                        } : null;
                        const m = await FaeAPI.sendMessage({ to_user: username, text, reply_to: replyPayload });
                        inputField.value = '';
                        clearReply();
                        messagesBox.appendChild(Messages.renderMessage(m, me));
                        messagesBox.scrollTop = messagesBox.scrollHeight;
                    } catch (e) {
                        FaeUtils.error(e.message);
                    } finally {
                        inputField.disabled = false;
                        inputField.focus();
                    }
                }
                async function sendFile(file) {
                    if (!file) return;
                    try {
                        const isImage = (file.type || '').startsWith('image/');
                        let dataUrl;
                        if (isImage) {
                            dataUrl = await FaeUtils.compressImage(file, 1600, 0.85);
                        } else {
                            if (file.size > 16 * 1024 * 1024) throw new Error('Arquivo muito grande (max 16MB).');
                            dataUrl = await FaeUtils.readFileAsDataURL(file);
                        }
                        const m = await FaeAPI.sendMessage({
                            to_user: username,
                            file_data_url: dataUrl,
                            file_name: file.name,
                            file_type: isImage ? 'image' : 'file',
                        });
                        messagesBox.appendChild(Messages.renderMessage(m, me));
                        messagesBox.scrollTop = messagesBox.scrollHeight;
                    } catch (e) {
                        FaeUtils.error(e.message);
                    }
                }

                // Re-renderiza as mensagens (acima) ja com suporte a reply.
                Messages.activeThread = { openThread, sendText, sendFile, setReply, clearReply, loadConversations };
                loadConversations();
            }

            // Suporte a deep-link com ?to=username (vindo do perfil).
            const params = new URLSearchParams(window.location.search);
            const initialTo = params.get('to');
            if (initialTo) {
                openThread(initialTo);
            } else {
                loadConversations();
            }
        },

        renderMessage(m, me) {
            const out = m.from_user === me.username;
            const wrap = FaeUtils.el('div', { class: 'msg' + (out ? ' msg--out' : '') });
            if (m.reply_to) {
                wrap.appendChild(FaeUtils.el('div', { class: 'msg__reply' },
                    FaeUtils.el('strong', {}, `@${m.reply_to.from_user}`),
                    FaeUtils.el('div', { class: 'muted text-xs' }, m.reply_to.text || '...'),
                ));
            }
            if (m.text) {
                wrap.appendChild(FaeUtils.el('div', {}, m.text));
            }
            if (m.file_url) {
                if (m.file_type === 'image') {
                    const a = FaeUtils.el('div', { class: 'msg__image' });
                    a.appendChild(FaeUtils.el('a', { href: m.file_url, target: '_blank', rel: 'noopener' },
                        FaeUtils.el('img', { src: m.file_url, alt: m.file_name || 'imagem' }),
                    ));
                    wrap.appendChild(a);
                } else {
                    wrap.appendChild(FaeUtils.el('a', { class: 'msg__file', href: m.file_url, target: '_blank', rel: 'noopener' },
                        '📎 ', m.file_name || 'arquivo',
                    ));
                }
            }
            wrap.appendChild(FaeUtils.el('span', { class: 'msg__meta' }, FaeUtils.timeAgo(m.timestamp)));

            // Reply on right-click or long press
            wrap.addEventListener('dblclick', () => {
                if (Messages.activeThread) Messages.activeThread.setReply(m);
            });
            return wrap;
        },
    };

    global.FaeMessages = Messages;
})(window);
