(function (global) {
    'use strict';

    // Pontos posicionados sobre os caminhos visíveis do cenário isométrico.
    const WALK_AREAS = [
        [50, 84], [35, 49], [67, 51], [42, 38], [73, 40],
        [50, 72], [50, 60], [50, 47], [50, 34], [41, 59],
        [30, 39], [60, 60], [58, 37], [50, 54],
    ];

    const FaeMap = {
        async render(container) {
            if (!global.Fae3D) await global.fae3dReady;

            const me = FaeAuth.currentUser || { username: 'aluno', name: 'Aluno' };
            let people;
            try {
                people = await FaeAPI.onlineAvatars(30);
            } catch (_) {
                people = [{ user: me, config: { ...Fae3D.DEFAULT_AVATAR } }];
            }

            if (!people.some(entry => entry.user.username === me.username)) {
                people.unshift({ user: me, config: { ...Fae3D.DEFAULT_AVATAR } });
            }

            const root = FaeUtils.el('section', { class: 'faemap faemap--world faemap--2d' });
            root.innerHTML = `
                <header class="faemap-world__header">
                    <div class="faemap-world__brand"><span>⌖</span><div><h1>FaeMap</h1><p>O campus ilustrado da sua comunidade.</p></div></div>
                    <div class="faemap-world__presence"><i></i><b>${people.length}</b> online agora</div>
                    <a class="btn btn--ghost" href="/avatar" data-link>Personalizar meu avatar</a>
                </header>
                <div class="faemap-world__viewport faemap-2d__viewport" data-map-viewport>
                    <div class="faemap-2d__scene" data-map-scene>
                        <img class="faemap-2d__background" src="/assets/faemap-campus-2d.png" alt="Mapa ilustrado do campus da ETESC" draggable="false">
                        <div class="faemap-2d__agents" data-map-agents></div>
                    </div>
                    <div class="faemap-world__loading"><span></span>Carregando o campus ilustrado…</div>
                    <div class="faemap-world__intro"><strong>Bem-vindo ao campus</strong><span>Clique em um caminho para movimentar seu avatar.</span></div>
                    <div class="faemap-world__actions" aria-label="Ações do avatar">
                        <button class="is-active" data-world-action="walk"><span>♟</span> Andar</button>
                        <button data-world-action="sit"><span>⌑</span> Sentar</button>
                        <button data-world-action="wave"><span>♧</span> Acenar</button>
                        <button data-world-action="phone"><span>▯</span> Celular</button>
                    </div>
                </div>
                <footer class="faemap-world__footer"><span><i></i> Avatares online em tempo real</span><span>Clique pelo campus para caminhar</span></footer>`;
            container.appendChild(root);

            const viewport = root.querySelector('[data-map-viewport]');
            const scene = root.querySelector('[data-map-scene]');
            const agentsRoot = root.querySelector('[data-map-agents]');
            const background = root.querySelector('.faemap-2d__background');
            background.addEventListener('load', () => root.classList.add('is-ready'), { once: true });
            if (background.complete) root.classList.add('is-ready');

            const agents = people.map((entry, index) => {
                const start = WALK_AREAS[index % WALK_AREAS.length];
                const destination = WALK_AREAS[(index + 3) % WALK_AREAS.length];
                const isMe = entry.user.username === me.username;
                const element = FaeUtils.el('div', {
                    class: `faemap-2d-avatar${isMe ? ' is-me' : ''}`,
                    'data-username': entry.user.username,
                });
                const art = FaeUtils.el('div', { class: 'faemap-2d-avatar__art', 'aria-hidden': 'true' });
                art.innerHTML = Fae3D.avatarSvg(entry.config);
                const label = FaeUtils.el('div', { class: 'faemap-2d-avatar__label' });
                label.innerHTML = `<i></i><strong>${escapeHtml(entry.user.name || entry.user.username)}</strong>${isMe ? '<small>Você</small>' : ''}`;
                element.append(art, label);
                agentsRoot.appendChild(element);

                const agent = {
                    element,
                    x: start[0],
                    y: start[1],
                    targetX: destination[0],
                    targetY: destination[1],
                    wait: index * 0.7,
                    action: 'walk',
                    isMe,
                };
                placeAgent(agent);
                return agent;
            });
            const myAgent = agents.find(agent => agent.isMe) || agents[0];

            const setActiveAction = action => {
                root.querySelectorAll('[data-world-action]').forEach(button => {
                    button.classList.toggle('is-active', button.dataset.worldAction === action);
                });
            };

            viewport.addEventListener('click', event => {
                if (!myAgent || event.target.closest('.faemap-world__actions') || event.target.closest('.faemap-2d-avatar')) return;
                const rect = scene.getBoundingClientRect();
                const clickX = clamp((event.clientX - rect.left) / rect.width * 100, 8, 92);
                const clickY = clamp((event.clientY - rect.top) / rect.height * 100, 20, 88);
                const destination = closestWalkArea(clickX, clickY);
                myAgent.targetX = destination[0];
                myAgent.targetY = destination[1];
                myAgent.wait = 0;
                myAgent.action = 'walk';
                setActiveAction('walk');
            });

            root.querySelector('.faemap-world__actions').addEventListener('click', event => {
                const button = event.target.closest('[data-world-action]');
                if (!button || !myAgent) return;
                myAgent.action = button.dataset.worldAction;
                myAgent.wait = Number.POSITIVE_INFINITY;
                setAgentAction(myAgent, myAgent.action);
                setActiveAction(myAgent.action);
            });

            let previous = performance.now();
            let frameId = 0;
            const animate = now => {
                const dt = Math.min((now - previous) / 1000, 0.05);
                previous = now;
                agents.forEach((agent, index) => updateAgent(agent, dt, index));
                frameId = requestAnimationFrame(animate);
            };
            frameId = requestAnimationFrame(animate);

            return () => cancelAnimationFrame(frameId);
        },
    };

    function updateAgent(agent, dt, index) {
        if (agent.wait > 0) {
            agent.wait -= dt;
            setAgentAction(agent, agent.action === 'walk' ? (index % 3 === 0 ? 'phone' : 'stand') : agent.action);
            if (agent.wait <= 0 && !agent.isMe) chooseTarget(agent);
            return;
        }

        const dx = agent.targetX - agent.x;
        const dy = agent.targetY - agent.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 0.35) {
            agent.action = ['stand', 'phone', 'wave', 'sit'][index % 4];
            agent.wait = agent.isMe ? 1.1 : 2.4 + (index % 3) * 0.9;
            setAgentAction(agent, agent.action);
            return;
        }

        const speed = 4.2 + (index % 3) * 0.28;
        agent.x += dx / distance * speed * dt;
        agent.y += dy / distance * speed * dt;
        agent.element.classList.toggle('is-facing-left', dx < 0);
        setAgentAction(agent, 'walk');
        placeAgent(agent);
    }

    function chooseTarget(agent) {
        const point = WALK_AREAS[Math.floor(Math.random() * WALK_AREAS.length)];
        agent.targetX = point[0] + Math.random() * 2 - 1;
        agent.targetY = point[1] + Math.random() * 2 - 1;
        agent.action = 'walk';
    }

    function closestWalkArea(x, y) {
        return WALK_AREAS.reduce((closest, point) => {
            const distance = Math.hypot(point[0] - x, point[1] - y);
            return distance < closest.distance ? { point, distance } : closest;
        }, { point: WALK_AREAS[0], distance: Number.POSITIVE_INFINITY }).point;
    }

    function placeAgent(agent) {
        agent.element.style.left = `${agent.x}%`;
        agent.element.style.top = `${agent.y}%`;
        agent.element.style.zIndex = String(20 + Math.round(agent.y));
    }

    function setAgentAction(agent, action) {
        agent.element.dataset.action = action || 'stand';
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value;
        return div.innerHTML;
    }

    global.FaeMap = FaeMap;
})(window);
