/* =====================================================
   FaeNet - faematch.js
   Conexoes profissionais para colaboracao academica.
   ===================================================== */

(function (global) {
    'use strict';

    const PRESETS = {
        pablo: { skills: ['Python', 'React', 'Desenvolvimento Web'], interests: ['Projetos', 'Inteligência Artificial'], availability: 'Tardes e fins de semana' },
        marlon: { skills: ['Python', 'Flask', 'Banco de Dados'], interests: ['APIs', 'Startups'], availability: 'Fins de semana' },
        aline: { skills: ['Organização', 'Gestão de Projeto', 'Design'], interests: ['Projetos', 'Educação'], availability: 'Tardes' },
        luciana: { skills: ['Banco de Dados', 'SQL', 'APIs'], interests: ['Pesquisa', 'Tecnologia'], availability: 'Noites' },
        rafael: { skills: ['UI/UX', 'Figma', 'React'], interests: ['Design', 'Jogos'], availability: 'Tardes e fins de semana' },
        beatriz: { skills: ['Redes', 'Segurança', 'Linux'], interests: ['Robótica', 'Inteligência Artificial'], availability: 'Fins de semana' },
    };

    const FALLBACK_PEOPLE = [
        { username: 'gustavo.almeida', name: 'Gustavo Almeida', curso: 'Informática', turma: '3º Ano', bio: 'Gosto de desenvolver projetos e estou sempre aberto para novas ideias.', synthetic: true },
        { username: 'bia.lima', name: 'Beatriz Lima', curso: 'Informática', turma: '3º Ano', bio: 'Apaixonada por design e tecnologia. Quero participar de projetos criativos.', synthetic: true },
        { username: 'lucas.mendes', name: 'Lucas Mendes', curso: 'Eletrônica', turma: '2º Ano', bio: 'Interesse em automação e eletrônica. Quero aprender e colaborar.', synthetic: true },
        { username: 'mariana.souza', name: 'Mariana Souza', curso: 'Administração', turma: '3º Ano', bio: 'Gosto de trabalhar em equipe e ajudar na organização de projetos.', synthetic: true },
        { username: 'caio.nunes', name: 'Caio Nunes', curso: 'Informática', turma: '2º Ano', bio: 'Curto backend e estou buscando um grupo para desenvolver um projeto.', synthetic: true },
        { username: 'aline.serrao', name: 'Aline Serrão', curso: 'Redes', turma: '3º Ano', bio: 'Interesse em infraestrutura, segurança e projetos de redes.', synthetic: true },
    ];

    const FALLBACK_SKILLS = [
        ['Python', 'React', 'Desenvolvimento Web'],
        ['UI/UX', 'Figma', 'Design'],
        ['Arduino', 'C++', 'Robótica'],
        ['Organização', 'Gestão de Projeto', 'Marketing'],
        ['Java', 'Banco de Dados', 'APIs'],
        ['Redes', 'Segurança', 'Linux'],
    ];

    const DEFAULT_PROJECTS = [
        { id: 'feira-tech', icon: '⌁', title: 'Site para a Feira Tecnológica', description: 'Uma vitrine digital para os projetos apresentados na feira da ETESC.', roles: ['1 designer', '2 devs frontend'], skills: ['Frontend', 'Design', 'Marketing'], members: '3/5 membros', time: 'Há 2 dias' },
        { id: 'horarios', icon: '▣', title: 'App de Horários da ETESC', description: 'Aplicativo para consultar aulas, salas e alterações de horário.', roles: ['1 dev mobile', '1 pessoa de UX'], skills: ['React', 'Mobile', 'UI/UX'], members: '2/4 membros', time: 'Há 4 dias' },
        { id: 'robotica', icon: '⌬', title: 'Projeto de Robótica (Arduino)', description: 'Robô autônomo para a mostra de eletrônica e automação.', roles: ['1 documentador', '1 dev C++'], skills: ['Eletrônica', 'C++', 'Documentação'], members: '4/6 membros', time: 'Há 5 dias' },
    ];

    const Match = {
        currentTab: 'people',
        people: [],
        connected: new Set(),
        filters: { query: '', curso: '', skill: '', interest: '', availability: '' },
        root: null,

        svg(name) {
            const icons = {
                people: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
                box: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 16-9 5-9-5V8l9-5 9 5v8Z"/><path d="m3.3 7 8.7 5 8.7-5M12 12v9"/></svg>',
                star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2l-5-4.9 6.9-1L12 2Z"/></svg>',
                link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
                search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
                info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
            };
            return icons[name] || icons.info;
        },

        preferencesKey() {
            const username = FaeAuth.currentUser?.username || 'guest';
            return `faenet:match-preferences:${username}`;
        },

        projectKey() {
            const username = FaeAuth.currentUser?.username || 'guest';
            return `faenet:match-projects:${username}`;
        },

        getPreferences() {
            const fallback = PRESETS[FaeAuth.currentUser?.username] || {
                skills: ['Python', 'Design', 'React'],
                interests: ['Projetos', 'Tecnologia'],
                availability: 'Tardes e fins de semana',
            };
            try {
                const saved = JSON.parse(localStorage.getItem(this.preferencesKey()));
                return saved && Array.isArray(saved.skills) ? saved : fallback;
            } catch (e) {
                return fallback;
            }
        },

        getProjects() {
            try {
                const saved = JSON.parse(localStorage.getItem(this.projectKey())) || [];
                return [...saved, ...DEFAULT_PROJECTS];
            } catch (e) {
                return [...DEFAULT_PROJECTS];
            }
        },

        profileFor(user, index) {
            const preset = PRESETS[user.username];
            if (preset) return preset;
            const skills = FALLBACK_SKILLS[index % FALLBACK_SKILLS.length];
            const interests = [skills[0] === 'UI/UX' ? 'Design' : 'Projetos', index % 2 ? 'Tecnologia' : 'Inteligência Artificial'];
            return { skills, interests, availability: index % 3 === 0 ? 'Tardes' : index % 3 === 1 ? 'Fins de semana' : 'Tardes e fins de semana' };
        },

        compatibility(user, profile) {
            const mine = this.getPreferences();
            const mineValues = new Set([...mine.skills, ...mine.interests].map(v => v.toLowerCase()));
            const overlap = [...profile.skills, ...profile.interests].filter(v => mineValues.has(v.toLowerCase())).length;
            const seed = [...user.username].reduce((sum, char) => sum + char.charCodeAt(0), 0);
            return Math.min(98, 76 + overlap * 5 + (seed % 8));
        },

        async loadPeople() {
            let users = [];
            try {
                const batches = await Promise.all([
                    FaeAPI.searchUsers('a'),
                    FaeAPI.searchUsers('e'),
                    FaeAPI.suggestions(30),
                ]);
                const unique = new Map();
                batches.flat().forEach(user => {
                    if (user.username !== FaeAuth.currentUser.username) unique.set(user.username, user);
                });
                users = [...unique.values()];
            } catch (e) {
                users = [];
            }

            const existing = new Set(users.map(user => user.username));
            FALLBACK_PEOPLE.forEach(user => {
                if (users.length < 6 && !existing.has(user.username)) users.push(user);
            });
            this.people = users.slice(0, 12);
        },

        async render(container) {
            this.root = FaeUtils.el('div', { class: 'match-page' });
            container.appendChild(this.root);
            this.renderLoading();
            await this.loadPeople();
            this.renderPage();
        },

        renderLoading() {
            this.root.appendChild(FaeUtils.el('div', { class: 'match-loading' },
                FaeUtils.el('div', { class: 'app-loading__spinner' }),
                FaeUtils.el('span', {}, 'Buscando boas conexões...'),
            ));
        },

        renderPage() {
            FaeUtils.clear(this.root);
            this.root.appendChild(this.renderHeader());
            this.root.appendChild(this.renderTabs());

            const layout = FaeUtils.el('div', { class: 'match-layout' });
            const content = FaeUtils.el('section', { class: 'match-content', 'aria-live': 'polite' });
            this.renderTabContent(content);
            layout.appendChild(content);
            layout.appendChild(this.renderAside());
            this.root.appendChild(layout);
        },

        renderHeader() {
            return FaeUtils.el('header', { class: 'match-header' },
                FaeUtils.el('div', { class: 'match-header__brand' },
                    FaeUtils.el('span', { class: 'match-header__icon', html: this.svg('people') }),
                    FaeUtils.el('div', {},
                        FaeUtils.el('h1', {}, 'FaeMatch'),
                        FaeUtils.el('p', {}, 'Conecte habilidades. Construa projetos. Faça a diferença.'),
                    ),
                ),
                FaeUtils.el('div', { class: 'match-header__actions' },
                    FaeUtils.el('button', { class: 'btn btn--ghost match-help', onclick: () => this.openHelp(), html: `${this.svg('info')}<span>Como funciona?</span>` }),
                    FaeUtils.el('button', { class: 'btn btn--primary', onclick: () => this.openProjectModal() }, '+ Publicar projeto'),
                ),
            );
        },

        renderTabs() {
            const defs = [
                ['people', 'people', 'Encontrar pessoas'],
                ['projects', 'box', 'Projetos buscando membros'],
                ['interests', 'star', 'Meus interesses'],
                ['connections', 'link', 'Minhas conexões'],
            ];
            const tabs = FaeUtils.el('nav', { class: 'match-tabs', 'aria-label': 'Seções do FaeMatch' });
            defs.forEach(([key, icon, label]) => {
                tabs.appendChild(FaeUtils.el('button', {
                    class: `match-tab${this.currentTab === key ? ' is-active' : ''}`,
                    'aria-current': this.currentTab === key ? 'page' : null,
                    onclick: () => { this.currentTab = key; this.renderPage(); },
                    html: `${this.svg(icon)}<span>${label}</span>`,
                }));
            });
            return tabs;
        },

        renderTabContent(container) {
            if (this.currentTab === 'projects') {
                this.renderProjects(container);
                return;
            }
            if (this.currentTab === 'interests') {
                this.renderInterests(container);
                return;
            }
            if (this.currentTab === 'connections') {
                this.renderPeopleSection(container, true);
                return;
            }
            this.renderPeopleSection(container, false);
        },

        renderHero() {
            return FaeUtils.el('section', { class: 'match-hero' },
                FaeUtils.el('div', { class: 'match-hero__glow', 'aria-hidden': 'true' }),
                FaeUtils.el('div', { class: 'match-hero__copy' },
                    FaeUtils.el('span', { class: 'match-kicker' }, 'COLABORAÇÃO ACADÊMICA'),
                    FaeUtils.el('h2', {}, 'Grandes projetos nascem de grandes conexões.'),
                    FaeUtils.el('p', {}, 'Encontre colegas com habilidades e interesses em comum para estudar, colaborar e criar projetos reais.'),
                ),
                FaeUtils.el('div', { class: 'match-network', 'aria-hidden': 'true' },
                    FaeUtils.el('span', { class: 'match-network__node match-network__node--a' }, 'IDEIAS'),
                    FaeUtils.el('span', { class: 'match-network__node match-network__node--b' }, 'PESSOAS'),
                    FaeUtils.el('span', { class: 'match-network__node match-network__node--c' }, 'PROJETOS'),
                    FaeUtils.el('i', { class: 'match-network__line match-network__line--a' }),
                    FaeUtils.el('i', { class: 'match-network__line match-network__line--b' }),
                ),
            );
        },

        renderFilters() {
            const filters = FaeUtils.el('section', { class: 'match-filter-section' },
                FaeUtils.el('h2', {}, 'Filtrar por habilidades e interesses'),
            );
            const form = FaeUtils.el('form', { class: 'match-filters', onsubmit: e => e.preventDefault() });
            const search = FaeUtils.el('label', { class: 'match-search' },
                FaeUtils.el('span', { html: this.svg('search') }),
                FaeUtils.el('input', { type: 'search', placeholder: 'Buscar por nome, curso ou habilidade...', value: this.filters.query, 'aria-label': 'Buscar pessoas' }),
            );
            search.querySelector('input').addEventListener('input', FaeUtils.debounce(e => {
                this.filters.query = e.target.value;
                this.updatePeopleGrid();
            }, 120));
            form.appendChild(search);
            form.appendChild(this.filterSelect('curso', 'Curso', ['', 'Informática', 'Eletrônica', 'Administração', 'Redes']));
            form.appendChild(this.filterSelect('skill', 'Habilidades', ['', 'Python', 'React', 'Design', 'UI/UX', 'Arduino', 'Banco de Dados', 'Redes']));
            form.appendChild(this.filterSelect('interest', 'Interesses', ['', 'Projetos', 'Tecnologia', 'Design', 'Inteligência Artificial', 'Robótica']));
            form.appendChild(this.filterSelect('availability', 'Disponibilidade', ['', 'Tardes', 'Noites', 'Fins de semana', 'Tardes e fins de semana']));
            filters.appendChild(form);
            return filters;
        },

        filterSelect(key, label, values) {
            const wrap = FaeUtils.el('label', { class: 'match-select' }, FaeUtils.el('span', {}, label));
            const select = FaeUtils.el('select', { 'aria-label': label });
            values.forEach((value, index) => select.appendChild(FaeUtils.el('option', { value, selected: this.filters[key] === value }, index === 0 ? 'Todos' : value)));
            select.addEventListener('change', e => {
                this.filters[key] = e.target.value;
                this.updatePeopleGrid();
            });
            wrap.appendChild(select);
            return wrap;
        },

        filteredPeople(connectedOnly = false) {
            const query = this.filters.query.trim().toLowerCase();
            return this.people.filter((user, index) => {
                const profile = this.profileFor(user, index);
                const haystack = [user.name, user.username, user.curso, user.turma, user.bio, ...profile.skills, ...profile.interests].join(' ').toLowerCase();
                if (connectedOnly && !this.connected.has(user.username)) return false;
                if (query && !haystack.includes(query)) return false;
                if (this.filters.curso && !(user.curso || '').toLowerCase().includes(this.filters.curso.toLowerCase())) return false;
                if (this.filters.skill && !profile.skills.includes(this.filters.skill)) return false;
                if (this.filters.interest && !profile.interests.includes(this.filters.interest)) return false;
                if (this.filters.availability && profile.availability !== this.filters.availability) return false;
                return true;
            });
        },

        renderPeopleSection(container, connectedOnly) {
            if (!connectedOnly) {
                container.appendChild(this.renderHero());
                container.appendChild(this.renderFilters());
            }
            const heading = FaeUtils.el('div', { class: 'match-section-heading' },
                FaeUtils.el('div', {},
                    FaeUtils.el('h2', {}, connectedOnly ? 'Minhas conexões' : 'Pessoas que podem ser uma boa conexão'),
                    connectedOnly ? FaeUtils.el('p', {}, 'Colegas com quem você se conectou no FaeMatch.') : null,
                ),
                FaeUtils.el('span', { class: 'match-sort' }, 'Mais compatíveis primeiro'),
            );
            container.appendChild(heading);
            const grid = FaeUtils.el('div', { class: 'match-people-grid', data: { matchGrid: connectedOnly ? 'connections' : 'people' } });
            container.appendChild(grid);
            this.fillPeopleGrid(grid, connectedOnly);
        },

        updatePeopleGrid() {
            const grid = this.root.querySelector('[data-match-grid]');
            if (!grid) return;
            this.fillPeopleGrid(grid, grid.dataset.matchGrid === 'connections');
        },

        fillPeopleGrid(grid, connectedOnly) {
            FaeUtils.clear(grid);
            const people = this.filteredPeople(connectedOnly).map(user => ({
                user,
                index: this.people.indexOf(user),
                profile: this.profileFor(user, this.people.indexOf(user)),
            })).sort((a, b) => this.compatibility(b.user, b.profile) - this.compatibility(a.user, a.profile));
            if (!people.length) {
                grid.appendChild(FaeUtils.el('div', { class: 'match-empty' },
                    FaeUtils.el('span', { class: 'match-empty__icon', html: this.svg(connectedOnly ? 'link' : 'search') }),
                    FaeUtils.el('h3', {}, connectedOnly ? 'Suas conexões aparecerão aqui' : 'Nenhuma pessoa encontrada'),
                    FaeUtils.el('p', {}, connectedOnly ? 'Conecte-se com colegas que combinam com seus projetos.' : 'Tente remover alguns filtros ou buscar outro termo.'),
                    connectedOnly ? FaeUtils.el('button', { class: 'btn btn--primary', onclick: () => { this.currentTab = 'people'; this.renderPage(); } }, 'Encontrar pessoas') : null,
                ));
                return;
            }
            people.forEach(({ user, index, profile }) => grid.appendChild(this.renderPersonCard(user, profile, index)));
        },

        renderPersonCard(user, profile, index) {
            const compatibility = this.compatibility(user, profile);
            const connected = this.connected.has(user.username);
            const card = FaeUtils.el('article', { class: 'match-person' });
            const avatar = FaeUtils.avatarNode(user, 'sm');
            avatar.classList.add(`match-person__avatar`, `match-person__avatar--${index % 6}`);
            card.appendChild(FaeUtils.el('div', { class: 'match-person__top' },
                avatar,
                FaeUtils.el('div', { class: 'match-person__identity' },
                    FaeUtils.el('h3', {}, user.name || user.username),
                    FaeUtils.el('p', {}, [user.turma, user.curso].filter(Boolean).join(' · ') || 'Aluno ETESC'),
                    FaeUtils.el('span', { class: `match-score match-score--${compatibility >= 86 ? 'high' : 'good'}` }, `✦ ${compatibility}% compatível`),
                ),
                FaeUtils.el('button', { class: 'match-more', title: 'Mais opções', 'aria-label': 'Mais opções' }, '•••'),
            ));

            const tags = FaeUtils.el('div', { class: 'match-tags' });
            profile.skills.slice(0, 3).forEach(skill => tags.appendChild(FaeUtils.el('span', {}, skill)));
            card.appendChild(tags);
            card.appendChild(FaeUtils.el('p', { class: 'match-person__bio' }, user.bio || 'Aberto para conhecer pessoas e construir projetos acadêmicos.'));

            const connect = FaeUtils.el('button', { class: `btn ${connected ? 'btn--ghost' : 'btn--primary'} match-connect` }, connected ? '✓ Conectado' : '♟ Conectar');
            connect.addEventListener('click', () => this.toggleConnection(user, connect));
            card.appendChild(FaeUtils.el('div', { class: 'match-person__actions' },
                FaeUtils.el('button', { class: 'btn btn--ghost', onclick: () => this.openPerson(user) }, 'Ver perfil'),
                connect,
            ));
            return card;
        },

        async toggleConnection(user, button) {
            button.disabled = true;
            const wasConnected = this.connected.has(user.username);
            try {
                if (!user.synthetic) {
                    if (wasConnected) await FaeAPI.unfollow(user.username);
                    else await FaeAPI.follow(user.username);
                }
                if (wasConnected) this.connected.delete(user.username);
                else this.connected.add(user.username);
                button.classList.toggle('btn--primary', wasConnected);
                button.classList.toggle('btn--ghost', !wasConnected);
                button.textContent = wasConnected ? '♟ Conectar' : '✓ Conectado';
                FaeUtils.success(wasConnected ? 'Conexão removida.' : `Você se conectou com ${user.name.split(' ')[0]}!`);
            } catch (error) {
                FaeUtils.error(error.message || 'Não foi possível atualizar a conexão.');
            } finally {
                button.disabled = false;
            }
        },

        openPerson(user) {
            if (user.synthetic) {
                FaeUtils.info('Este é um perfil de demonstração do FaeMatch.');
                return;
            }
            FaeApp.go(`/profile/${user.username}`);
        },

        renderProjects(container) {
            container.appendChild(FaeUtils.el('div', { class: 'match-projects-heading' },
                FaeUtils.el('div', {},
                    FaeUtils.el('span', { class: 'match-kicker' }, 'OPORTUNIDADES PARA COLABORAR'),
                    FaeUtils.el('h2', {}, 'Projetos em busca de membros'),
                    FaeUtils.el('p', {}, 'Encontre uma iniciativa que combina com suas habilidades ou publique a sua.'),
                ),
                FaeUtils.el('button', { class: 'btn btn--primary', onclick: () => this.openProjectModal() }, '+ Publicar projeto'),
            ));
            const grid = FaeUtils.el('div', { class: 'match-project-grid' });
            this.getProjects().forEach(project => grid.appendChild(this.renderProjectCard(project, false)));
            container.appendChild(grid);
        },

        renderProjectCard(project, compact = false) {
            const card = FaeUtils.el('article', { class: `match-project${compact ? ' match-project--compact' : ''}` },
                FaeUtils.el('div', { class: 'match-project__top' },
                    FaeUtils.el('span', { class: 'match-project__icon' }, project.icon || '◇'),
                    FaeUtils.el('div', {},
                        FaeUtils.el('h3', {}, project.title),
                        FaeUtils.el('span', { class: 'match-project__time' }, project.time || 'Agora'),
                    ),
                ),
            );
            if (!compact) {
                card.appendChild(FaeUtils.el('p', { class: 'match-project__description' }, project.description));
                const roles = FaeUtils.el('div', { class: 'match-project__roles' }, FaeUtils.el('b', {}, 'Precisamos de:'));
                (project.roles || []).forEach(role => roles.appendChild(FaeUtils.el('span', {}, role)));
                card.appendChild(roles);
            }
            const tags = FaeUtils.el('div', { class: 'match-tags' });
            (project.skills || []).slice(0, compact ? 3 : 5).forEach(skill => tags.appendChild(FaeUtils.el('span', {}, skill)));
            card.appendChild(tags);
            card.appendChild(FaeUtils.el('div', { class: 'match-project__footer' },
                FaeUtils.el('span', {}, `◉ ${project.members || '1 membro'}`),
                compact ? null : FaeUtils.el('button', { class: 'btn btn--ghost btn--sm', onclick: () => FaeUtils.success('Interesse enviado ao responsável pelo projeto!') }, 'Tenho interesse'),
            ));
            return card;
        },

        renderInterests(container) {
            const preferences = this.getPreferences();
            const section = FaeUtils.el('section', { class: 'match-preferences-page' },
                FaeUtils.el('span', { class: 'match-kicker' }, 'SEU PERFIL PROFISSIONAL'),
                FaeUtils.el('h2', {}, 'Habilidades e interesses'),
                FaeUtils.el('p', {}, 'Essas informações ajudam a FaeNet a sugerir colegas e projetos mais relevantes para você.'),
            );
            section.appendChild(this.preferenceBlock('Habilidades', preferences.skills, 'skills'));
            section.appendChild(this.preferenceBlock('Áreas de interesse', preferences.interests, 'interests'));
            section.appendChild(FaeUtils.el('div', { class: 'match-availability' },
                FaeUtils.el('span', {}, 'Disponibilidade'),
                FaeUtils.el('strong', {}, `▣ ${preferences.availability}`),
            ));
            section.appendChild(FaeUtils.el('button', { class: 'btn btn--primary', onclick: () => this.openPreferences() }, 'Editar meu perfil do FaeMatch'));
            container.appendChild(section);
        },

        preferenceBlock(title, values) {
            const block = FaeUtils.el('div', { class: 'match-preference-block' }, FaeUtils.el('h3', {}, title));
            const tags = FaeUtils.el('div', { class: 'match-tags match-tags--large' });
            values.forEach(value => tags.appendChild(FaeUtils.el('span', {}, value)));
            block.appendChild(tags);
            return block;
        },

        renderAside() {
            const preferences = this.getPreferences();
            const aside = FaeUtils.el('aside', { class: 'match-aside', 'aria-label': 'Resumo do FaeMatch' });
            const interests = FaeUtils.el('section', { class: 'match-aside-card' },
                FaeUtils.el('div', { class: 'match-aside-card__heading' },
                    FaeUtils.el('h2', {}, 'Seus interesses'),
                    FaeUtils.el('button', { onclick: () => this.openPreferences() }, 'Editar'),
                ),
                FaeUtils.el('h3', {}, 'Habilidades'),
            );
            const skillTags = FaeUtils.el('div', { class: 'match-tags' });
            preferences.skills.forEach(skill => skillTags.appendChild(FaeUtils.el('span', {}, skill)));
            interests.appendChild(skillTags);
            interests.appendChild(FaeUtils.el('h3', {}, 'Áreas de interesse'));
            const interestTags = FaeUtils.el('div', { class: 'match-tags' });
            preferences.interests.forEach(interest => interestTags.appendChild(FaeUtils.el('span', {}, interest)));
            interests.appendChild(interestTags);
            interests.appendChild(FaeUtils.el('div', { class: 'match-aside-availability' },
                FaeUtils.el('span', {}, 'Disponibilidade'),
                FaeUtils.el('p', {}, `▣ ${preferences.availability}`),
            ));
            aside.appendChild(interests);

            const projects = FaeUtils.el('section', { class: 'match-aside-card' },
                FaeUtils.el('div', { class: 'match-aside-card__heading' },
                    FaeUtils.el('h2', {}, 'Projetos em busca de membros'),
                    FaeUtils.el('button', { onclick: () => { this.currentTab = 'projects'; this.renderPage(); } }, 'Ver todos →'),
                ),
            );
            this.getProjects().slice(0, 3).forEach(project => projects.appendChild(this.renderProjectCard(project, true)));
            aside.appendChild(projects);

            aside.appendChild(FaeUtils.el('section', { class: 'match-tip' },
                FaeUtils.el('span', { class: 'match-tip__icon' }, '💡'),
                FaeUtils.el('div', {},
                    FaeUtils.el('h2', {}, 'Dica da FaeNet'),
                    FaeUtils.el('p', {}, 'Complete seu perfil com habilidades e interesses para receber sugestões mais assertivas!'),
                    FaeUtils.el('button', { class: 'btn btn--ghost btn--block', onclick: () => this.openPreferences() }, 'Editar meu perfil'),
                ),
            ));
            return aside;
        },

        openPreferences() {
            const preferences = this.getPreferences();
            const body = FaeUtils.el('form', { class: 'match-modal-form', id: 'match-preferences-form' },
                FaeUtils.el('p', { class: 'muted' }, 'Separe os itens com vírgulas. Escolha termos que ajudam outros alunos a encontrar você.'),
                FaeUtils.el('label', { class: 'field' },
                    FaeUtils.el('span', { class: 'field__label' }, 'Habilidades'),
                    FaeUtils.el('input', { class: 'field__input', name: 'skills', value: preferences.skills.join(', '), required: true }),
                ),
                FaeUtils.el('label', { class: 'field' },
                    FaeUtils.el('span', { class: 'field__label' }, 'Áreas de interesse'),
                    FaeUtils.el('input', { class: 'field__input', name: 'interests', value: preferences.interests.join(', '), required: true }),
                ),
                FaeUtils.el('label', { class: 'field' },
                    FaeUtils.el('span', { class: 'field__label' }, 'Disponibilidade'),
                    this.modalSelect('availability', ['Tardes', 'Noites', 'Fins de semana', 'Tardes e fins de semana'], preferences.availability),
                ),
            );
            const cancel = FaeUtils.el('button', { type: 'button', class: 'btn btn--ghost' }, 'Cancelar');
            const save = FaeUtils.el('button', { type: 'submit', class: 'btn btn--primary', form: 'match-preferences-form' }, 'Salvar perfil');
            const modal = FaeUtils.openModal({ title: 'Editar interesses do FaeMatch', body, footer: [cancel, save] });
            cancel.addEventListener('click', modal.close);
            body.addEventListener('submit', e => {
                e.preventDefault();
                const data = new FormData(body);
                const split = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean).slice(0, 8);
                const next = { skills: split(data.get('skills')), interests: split(data.get('interests')), availability: data.get('availability') };
                localStorage.setItem(this.preferencesKey(), JSON.stringify(next));
                modal.close();
                this.renderPage();
                FaeUtils.success('Perfil do FaeMatch atualizado!');
            });
        },

        modalSelect(name, values, selected) {
            const select = FaeUtils.el('select', { class: 'field__select', name });
            values.forEach(value => select.appendChild(FaeUtils.el('option', { value, selected: value === selected }, value)));
            return select;
        },

        openProjectModal() {
            const body = FaeUtils.el('form', { class: 'match-modal-form', id: 'match-project-form' },
                FaeUtils.el('p', { class: 'muted' }, 'Conte do que sua equipe precisa. A FaeNet mostrará a oportunidade a alunos com habilidades relacionadas.'),
                FaeUtils.el('label', { class: 'field' },
                    FaeUtils.el('span', { class: 'field__label' }, 'Nome do projeto'),
                    FaeUtils.el('input', { class: 'field__input', name: 'title', placeholder: 'Ex.: Aplicativo para a Feira Tecnológica', required: true, maxlength: 90 }),
                ),
                FaeUtils.el('label', { class: 'field' },
                    FaeUtils.el('span', { class: 'field__label' }, 'Sobre o projeto'),
                    FaeUtils.el('textarea', { class: 'field__textarea', name: 'description', placeholder: 'Explique a ideia e o objetivo...', required: true, maxlength: 320 }),
                ),
                FaeUtils.el('label', { class: 'field' },
                    FaeUtils.el('span', { class: 'field__label' }, 'Quem vocês procuram?'),
                    FaeUtils.el('input', { class: 'field__input', name: 'roles', placeholder: '1 designer, 2 desenvolvedores', required: true }),
                ),
                FaeUtils.el('label', { class: 'field' },
                    FaeUtils.el('span', { class: 'field__label' }, 'Habilidades relacionadas'),
                    FaeUtils.el('input', { class: 'field__input', name: 'skills', placeholder: 'Design, React, Python', required: true }),
                ),
            );
            const cancel = FaeUtils.el('button', { type: 'button', class: 'btn btn--ghost' }, 'Cancelar');
            const publish = FaeUtils.el('button', { type: 'submit', class: 'btn btn--primary', form: 'match-project-form' }, 'Publicar projeto');
            const modal = FaeUtils.openModal({ title: 'Publicar projeto no FaeMatch', body, footer: [cancel, publish], size: 'lg' });
            cancel.addEventListener('click', modal.close);
            body.addEventListener('submit', e => {
                e.preventDefault();
                const data = new FormData(body);
                const split = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean);
                const project = {
                    id: `project-${Date.now()}`,
                    icon: '✦',
                    title: data.get('title').trim(),
                    description: data.get('description').trim(),
                    roles: split(data.get('roles')),
                    skills: split(data.get('skills')),
                    members: '1 membro',
                    time: 'Agora',
                };
                let saved = [];
                try { saved = JSON.parse(localStorage.getItem(this.projectKey())) || []; } catch (error) { saved = []; }
                localStorage.setItem(this.projectKey(), JSON.stringify([project, ...saved]));
                modal.close();
                this.currentTab = 'projects';
                this.renderPage();
                FaeUtils.success('Projeto publicado no FaeMatch!');
            });
        },

        openHelp() {
            const body = FaeUtils.el('div', { class: 'match-help-steps' },
                this.helpStep('1', 'Complete seu perfil', 'Informe habilidades, interesses e quando você está disponível.'),
                this.helpStep('2', 'Encontre pessoas ou projetos', 'Use os filtros para descobrir colegas e oportunidades relevantes.'),
                this.helpStep('3', 'Construa em equipe', 'Conecte-se, converse pela FaeNet e transforme ideias em projetos reais.'),
            );
            FaeUtils.openModal({ title: 'Como funciona o FaeMatch?', body });
        },

        helpStep(number, title, text) {
            return FaeUtils.el('div', { class: 'match-help-step' },
                FaeUtils.el('span', {}, number),
                FaeUtils.el('div', {}, FaeUtils.el('h3', {}, title), FaeUtils.el('p', {}, text)),
            );
        },
    };

    global.FaeMatch = Match;
})(window);
