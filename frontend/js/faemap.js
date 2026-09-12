/* =====================================================
   FaeMap - presenca social no campus em um mapa 3D.
   A localizacao exibida e aproximada e controlada pelo aluno.
   ===================================================== */

(function (global) {
    'use strict';

    const LOCATIONS = [
        { name: 'Laboratório de Informática', short: 'Lab. de Informática', x: 25, y: 35, activity: 'Caminhando' },
        { name: 'Biblioteca', short: 'Biblioteca', x: 73, y: 39, activity: 'Estudando' },
        { name: 'Pátio', short: 'Pátio', x: 49, y: 65, activity: 'Disponível para projeto', project: true },
        { name: 'Bloco B', short: 'Bloco B', x: 20, y: 67, activity: 'A caminho da aula' },
        { name: 'Quadra', short: 'Quadra', x: 71, y: 75, activity: 'Em intervalo' },
        { name: 'Cantina', short: 'Cantina', x: 81, y: 59, activity: 'Online agora' },
    ];

    const FALLBACK_USERS = [
        { username: 'joao', name: 'João Pedro', avatar_text: 'JP', online: true },
        { username: 'beatriz', name: 'Beatriz Lima', avatar_text: 'BL', online: true },
        { username: 'marlon', name: 'Marlon Amaral', avatar_text: 'MA', online: true },
        { username: 'aline', name: 'Aline Serrão', avatar_text: 'AS', online: true },
        { username: 'juliana', name: 'Juliana Costa', avatar_text: 'JC', online: true },
    ];

    const FaeMap = {
        async render(container) {
            const me = FaeAuth.currentUser || { username: 'aluno', name: 'Aluno' };
            const root = FaeUtils.el('section', { class: 'faemap' });
            root.innerHTML = `
                <header class="faemap__header">
                    <div class="faemap__title"><span class="faemap__title-icon">⌖</span><div><h1>Fae<span>Map</span></h1><p>Veja quem está online pelo campus.</p></div></div>
                    <label class="faemap__search"><span>⌕</span><input type="search" placeholder="Buscar aluno ou ambiente..." aria-label="Buscar aluno ou ambiente" /></label>
                    <div class="faemap__online-count"><span class="presence-dot"></span><b data-map-online-count>0</b> alunos online</div>
                </header>
                <div class="faemap__layout">
                    <div class="faemap__viewport">
                        <div class="faemap__scene" data-map-scene>
                            <img src="/img/faemap-campus.png" alt="Mapa 3D do campus da ETESC" draggable="false" />
                            <div class="faemap__pins" data-map-pins></div>
                        </div>
                        <div class="faemap__campus-card"><i></i><div><b>ETESC</b><span>Escola Técnica<br />que forma o futuro.</span></div></div>
                        <div class="faemap__controls" aria-label="Controles do mapa">
                            <button type="button" data-map-action="zoom-in" aria-label="Aumentar zoom">＋</button>
                            <button type="button" data-map-action="zoom-out" aria-label="Diminuir zoom">−</button>
                            <span></span>
                            <button type="button" data-map-action="rotate" aria-label="Girar mapa">↻</button>
                            <button type="button" data-map-action="reset" aria-label="Centralizar mapa">⌾</button>
                        </div>
                        <div class="faemap__floors" role="group" aria-label="Selecionar andar">
                            <button type="button" data-floor="1">1º andar</button><button type="button" class="is-active" data-floor="0">Térreo</button>
                        </div>
                        <div class="faemap__legend"><span><i class="is-online"></i>Online</span><span><i class="is-class"></i>Em aula</span><span><i class="is-project">★</i>Disponível para projeto</span></div>
                    </div>
                    <aside class="faemap__aside">
                        <section class="faemap-card faemap-card--people">
                            <div class="faemap-card__heading"><h2>Alunos online</h2><span>Localização aproximada</span></div>
                            <div class="faemap__people" data-map-people></div>
                        </section>
                        <section class="faemap-card faemap-presence">
                            <div class="faemap-card__heading"><h2>Sua presença</h2><span>Privacidade</span></div>
                            <div class="faemap-presence__profile"><div data-map-me-avatar></div><div><b data-map-me-name></b><p>Você está visível no <strong>Pátio</strong>.</p></div></div>
                            <label class="faemap-switch"><span><b>Aparecer no mapa</b><small>Somente enquanto você estiver online</small></span><input type="checkbox" checked data-map-presence /><i></i></label>
                            <div class="faemap-presence__privacy">ⓘ Sua posição representa uma área aproximada, nunca sua localização exata.</div>
                        </section>
                        <section class="faemap-card faemap-tip"><span>⌖</span><div><b>Pessoas certas nos lugares certos.</b><p>Encontre colegas, forme grupos e explore o campus.</p></div></section>
                    </aside>
                </div>`;

            container.appendChild(root);
            const meSlot = root.querySelector('[data-map-me-avatar]');
            meSlot.appendChild(FaeUtils.avatarNode(me, 'lg'));
            root.querySelector('[data-map-me-name]').textContent = me.name || me.username;

            let users = [];
            try { users = await FaeAPI.onlineUsers(24); } catch (e) { /* usa demonstracao */ }
            const byUsername = new Map(users.map(user => [user.username, user]));
            FALLBACK_USERS.forEach(user => { if (!byUsername.has(user.username)) users.push(user); });
            users = users.filter(user => user.username !== me.username).slice(0, 5);
            this.renderPeople(root, users);
            this.bind(root);
            root.querySelector('[data-map-online-count]').textContent = Math.max(users.length + 1, 6);
        },

        renderPeople(root, users) {
            const pins = root.querySelector('[data-map-pins]');
            const list = root.querySelector('[data-map-people]');
            FaeUtils.clear(pins);
            FaeUtils.clear(list);

            users.forEach((user, index) => {
                const location = LOCATIONS[index % LOCATIONS.length];
                const nameParts = (user.name || user.username).split(' ');
                const firstName = nameParts[0].endsWith('.') && nameParts[1] ? nameParts[1] : nameParts[0];
                const pin = FaeUtils.el('button', {
                    class: 'faemap-pin' + (location.project ? ' faemap-pin--project' : ''),
                    type: 'button',
                    title: `${user.name || user.username} · ${location.name}`,
                    style: { left: `${location.x}%`, top: `${location.y}%` },
                    data: { username: user.username, location: location.name },
                },
                    FaeUtils.el('span', { class: 'faemap-pin__pulse' }),
                    FaeUtils.el('span', { class: 'faemap-pin__label' },
                        FaeUtils.el('b', {}, firstName),
                        FaeUtils.el('small', {}, location.short),
                        location.project ? FaeUtils.el('em', {}, '★ Disponível para projeto') : null,
                    ),
                );
                pins.appendChild(pin);

                const item = FaeUtils.el('button', {
                    class: 'faemap-person', type: 'button', data: { username: user.username, location: location.name },
                },
                    FaeUtils.avatarNode({ ...user, online: true }, 'sm'),
                    FaeUtils.el('span', { class: 'faemap-person__copy' },
                        FaeUtils.el('b', {}, user.name || user.username),
                        FaeUtils.el('small', {}, location.short),
                    ),
                    FaeUtils.el('span', { class: 'faemap-person__locate' }, '⌖'),
                );
                list.appendChild(item);
            });
        },

        bind(root) {
            const scene = root.querySelector('[data-map-scene]');
            const search = root.querySelector('.faemap__search input');
            let zoom = 1;
            let rotation = 0;

            const updateScene = () => {
                scene.style.setProperty('--map-scale', zoom.toFixed(2));
                scene.style.setProperty('--map-rotation', `${rotation}deg`);
            };

            root.querySelectorAll('[data-map-action]').forEach(button => {
                button.addEventListener('click', () => {
                    const action = button.dataset.mapAction;
                    if (action === 'zoom-in') zoom = Math.min(1.35, zoom + 0.1);
                    if (action === 'zoom-out') zoom = Math.max(0.9, zoom - 0.1);
                    if (action === 'rotate') rotation = rotation === 0 ? -1.5 : 0;
                    if (action === 'reset') { zoom = 1; rotation = 0; }
                    updateScene();
                });
            });

            const locate = (username, location) => {
                root.querySelectorAll('.faemap-pin').forEach(pin => pin.classList.toggle('is-focused', pin.dataset.username === username));
                FaeUtils.info(`${location} · localização aproximada`);
            };
            root.addEventListener('click', event => {
                const target = event.target.closest('[data-username][data-location]');
                if (target) locate(target.dataset.username, target.dataset.location);
            });

            search.addEventListener('input', () => {
                const query = search.value.trim().toLocaleLowerCase('pt-BR');
                root.querySelectorAll('[data-username][data-location]').forEach(item => {
                    const content = `${item.textContent} ${item.dataset.location}`.toLocaleLowerCase('pt-BR');
                    item.classList.toggle('is-filtered', !!query && !content.includes(query));
                });
            });

            root.querySelectorAll('[data-floor]').forEach(button => {
                button.addEventListener('click', () => {
                    root.querySelectorAll('[data-floor]').forEach(item => item.classList.toggle('is-active', item === button));
                    scene.classList.toggle('is-upper-floor', button.dataset.floor === '1');
                    FaeUtils.info(button.dataset.floor === '1' ? 'Visualizando o 1º andar.' : 'Visualizando o térreo.');
                });
            });

            root.querySelector('[data-map-presence]').addEventListener('change', event => {
                root.classList.toggle('is-invisible', !event.target.checked);
                const copy = root.querySelector('.faemap-presence__profile p');
                copy.innerHTML = event.target.checked ? 'Você está visível no <strong>Pátio</strong>.' : 'Você está <strong>invisível</strong> no mapa.';
                FaeUtils.info(event.target.checked ? 'Sua presença está visível.' : 'Você não aparece mais no mapa.');
            });
        },
    };

    global.FaeMap = FaeMap;
})(window);
