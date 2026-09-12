/* =====================================================
   FaeNet - hub.js
   Apresentacao do portal academico FaeHub+.
   ===================================================== */

(function (global) {
    'use strict';

    const FEATURES = [
        { icon: '▥', tone: 'violet', title: 'Notas', text: 'Acompanhe seu desempenho em tempo real.' },
        { icon: '▣', tone: 'green', title: 'Frequência', text: 'Veja suas presenças e faltas.' },
        { icon: '◷', tone: 'blue', title: 'Horários', text: 'Consulte suas aulas e turmas.' },
        { icon: '▤', tone: 'pink', title: 'Provas', text: 'Fique por dentro das avaliações e datas importantes.' },
        { icon: '▱', tone: 'amber', title: 'Documentos', text: 'Acesse declarações e outros documentos acadêmicos.' },
        { icon: '⚑', tone: 'blue', title: 'Comunicados', text: 'Receba avisos oficiais da escola.' },
        { icon: '▣', tone: 'green', title: 'Estágios', text: 'Confira oportunidades e programas.' },
        { icon: '•••', tone: 'slate', title: 'E muito mais', text: 'Tudo integrado para facilitar sua vida acadêmica.' },
    ];

    const Hub = {
        render(container) {
            const page = FaeUtils.el('div', { class: 'faehub-page' });
            page.appendChild(this.renderHeader());
            page.appendChild(this.renderHero());

            const body = FaeUtils.el('div', { class: 'faehub-layout' });
            body.appendChild(this.renderFeatures());
            body.appendChild(this.renderIntegration());
            page.appendChild(body);
            page.appendChild(this.renderTip());
            container.appendChild(page);
        },

        renderHeader() {
            return FaeUtils.el('header', { class: 'faehub-header' },
                FaeUtils.el('div', { class: 'faehub-brand' },
                    FaeUtils.el('span', { class: 'faehub-brand__icon', 'aria-hidden': 'true' }, '🎓'),
                    FaeUtils.el('div', {},
                        FaeUtils.el('h1', { html: 'Fae<span>Hub+</span>' }),
                        FaeUtils.el('p', {}, 'Seu portal acadêmico, agora mais conectado à FaeNet.'),
                    ),
                ),
                FaeUtils.el('div', { class: 'faehub-header__links' },
                    FaeUtils.el('button', { class: 'faehub-mini-card', onclick: () => this.notAvailable() },
                        FaeUtils.el('span', { class: 'faehub-mini-card__icon' }, '↗'),
                        FaeUtils.el('span', {}, FaeUtils.el('b', {}, 'Site oficial do FaeHub+'), FaeUtils.el('small', {}, 'Em desenvolvimento')),
                    ),
                    FaeUtils.el('button', { class: 'faehub-mini-card faehub-mini-card--support', onclick: () => this.notAvailable('O suporte do FaeHub+ será disponibilizado em breve.') },
                        FaeUtils.el('span', { class: 'faehub-mini-card__icon' }, '?'),
                        FaeUtils.el('span', {}, FaeUtils.el('b', {}, 'Dúvidas? Acesse o suporte')),
                    ),
                ),
            );
        },

        renderHero() {
            return FaeUtils.el('section', { class: 'faehub-hero' },
                FaeUtils.el('div', { class: 'faehub-hero__overlay' },
                    FaeUtils.el('span', { class: 'faehub-kicker' }, 'SUA VIDA ACADÊMICA EM UM SÓ LUGAR'),
                    FaeUtils.el('h2', { html: 'Acesse o <strong>FaeHub+</strong>' }),
                    FaeUtils.el('p', {}, 'O FaeHub+ é o portal oficial da ETESC para acompanhar sua vida acadêmica: notas, frequências, horários, provas, documentos e muito mais.'),
                    FaeUtils.el('button', { class: 'btn btn--primary faehub-cta', onclick: () => this.notAvailable() },
                        FaeUtils.el('span', {}, '↗'),
                        FaeUtils.el('b', {}, 'Abrir o FaeHub+'),
                        FaeUtils.el('span', {}, '→'),
                    ),
                    FaeUtils.el('small', {}, 'O FaeHub+ ainda está sendo desenvolvido. O acesso será liberado em breve.'),
                ),
            );
        },

        renderFeatures() {
            const section = FaeUtils.el('section', { class: 'faehub-features' },
                FaeUtils.el('h2', {}, 'O que você encontra no FaeHub+'),
                FaeUtils.el('p', {}, 'Tudo o que você precisa para acompanhar sua jornada na ETESC.'),
            );
            const grid = FaeUtils.el('div', { class: 'faehub-feature-grid' });
            FEATURES.forEach(feature => {
                grid.appendChild(FaeUtils.el('article', { class: 'faehub-feature' },
                    FaeUtils.el('span', { class: `faehub-feature__icon faehub-feature__icon--${feature.tone}` }, feature.icon),
                    FaeUtils.el('h3', {}, feature.title),
                    FaeUtils.el('p', {}, feature.text),
                ));
            });
            section.appendChild(grid);
            return section;
        },

        renderIntegration() {
            return FaeUtils.el('aside', { class: 'faehub-integration' },
                FaeUtils.el('h2', {}, 'Integração com a FaeNet'),
                FaeUtils.el('p', {}, 'Em breve, algumas informações do FaeHub+ poderão aparecer aqui na sua linha do tempo, como avisos importantes, provas e eventos.'),
                FaeUtils.el('ul', {},
                    FaeUtils.el('li', {}, FaeUtils.el('span', {}, '♧'), 'Avisos importantes'),
                    FaeUtils.el('li', {}, FaeUtils.el('span', {}, '▣'), 'Calendário de provas'),
                    FaeUtils.el('li', {}, FaeUtils.el('span', {}, '□'), 'Eventos da escola'),
                    FaeUtils.el('li', {}, FaeUtils.el('span', {}, '▱'), 'Oportunidades de estágio'),
                ),
                FaeUtils.el('div', { class: 'faehub-integration__footer' },
                    FaeUtils.el('span', { class: 'faehub-integration__symbol' }, '⌘'),
                    FaeUtils.el('p', {}, FaeUtils.el('b', {}, 'Duas plataformas.'), FaeUtils.el('br'), 'Uma comunidade.'),
                ),
                FaeUtils.el('div', { class: 'faehub-integration__wave', 'aria-hidden': 'true' }),
                FaeUtils.el('div', { class: 'faehub-integration__school' }, FaeUtils.el('b', {}, 'ETESC'), FaeUtils.el('span', {}, 'Construindo futuros todos os dias.')),
            );
        },

        renderTip() {
            return FaeUtils.el('section', { class: 'faehub-tip' },
                FaeUtils.el('span', {}, '💡'),
                FaeUtils.el('div', {},
                    FaeUtils.el('h2', {}, 'Dica da FaeNet'),
                    FaeUtils.el('p', {}, 'Mantenha seus dados atualizados no FaeHub+ para receber informações mais relevantes por aqui.'),
                ),
            );
        },

        notAvailable(message = 'O FaeHub+ ainda está sendo desenvolvido. O redirecionamento será adicionado em breve.') {
            FaeUtils.info(message);
        },
    };

    global.FaeHub = Hub;
})(window);
