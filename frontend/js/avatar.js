(function (global) {
    'use strict';

    const hairByGender = {
        male: [['Curto','short'],['Fade','fade'],['Cacheado','curly'],['Afro','afro']],
        female: [['Longo','long'],['Ondulado','wavy'],['Coque','bun']],
    };
    const choiceGroups = [
        ['Base do avatar','gender',[['Masculino','male'],['Feminino','female']]],
        ['Tom de pele','skin',[['Claro','light'],['Quente','warm'],['Médio','medium'],['Marrom','brown'],['Retinto','deep']]],
        ['Cor do cabelo','hair_color',[['Preto','dark'],['Castanho','brown'],['Ruivo','auburn'],['Loiro','blonde'],['Azul','blue'],['Rosa','pink']]],
        ['Parte de cima','top_style',[['Camisa','shirt'],['Moletom','hoodie'],['Regata','tank']]],
        ['Parte de baixo','bottom_style',[['Calça','pants'],['Short','shorts']]],
        ['Calçado','shoe_style',[['Tênis','sneakers'],['Chinelo','flipflops']]],
    ];
    const colorGroups = [
        ['Cor da parte de cima','top_color',['#7258d9','#347fc4','#3ba984','#c45e82','#d19a3e','#30333d']],
        ['Cor da parte de baixo','bottom_color',['#26334f','#3e6685','#232630','#5a606b','#927b64','#8c4568']],
        ['Cor do calçado','shoe_color',['#e9ebef','#252832','#7959cb','#397abd','#d94b4b','#49aa82']],
    ];
    const accessories = [['Óculos','glasses'],['Fone de ouvido','headphones'],['Mochila','backpack'],['Brinco','earring'],['Relógio','watch']];

    const AvatarStudio = {
        cleanup: null,
        async render(container) {
            if (!global.Fae3D) await global.fae3dReady;
            let config;
            try { config = normalizeConfig((await FaeAPI.myAvatar()).config); }
            catch (_) { config = normalizeConfig(Fae3D.DEFAULT_AVATAR); }

            const root = FaeUtils.el('section', { class: 'avatar-studio' });
            root.innerHTML = `
                <header class="avatar-studio__header">
                    <div><span class="avatar-studio__eyebrow">IDENTIDADE FAEHUB+</span><h1>Meu Avatar</h1><p>Use na FaeNet o mesmo modelo visual de personagem do FaeHub+.</p></div>
                    <a class="btn btn--ghost" href="/faemap" data-link>⌖ Encontrar amigos no FaeMap</a>
                </header>
                <div class="avatar-studio__grid">
                    <div class="avatar-stage">
                        <div class="avatar-stage__ambient"></div>
                        <canvas aria-label="Visualização do seu avatar FaeHub+"></canvas>
                        <div class="avatar-stage__tip">RIG VETORIAL 2.5D · FAEHUB+</div>
                        <div class="avatar-stage__actions" aria-label="Testar animações">
                            <button class="is-active" data-avatar-action="stand">Em pé</button>
                            <button data-avatar-action="walk">Andar</button>
                            <button data-avatar-action="sit">Sentar</button>
                            <button data-avatar-action="wave">Acenar</button>
                            <button data-avatar-action="phone">Celular</button>
                        </div>
                    </div>
                    <aside class="avatar-customizer">
                        <div class="avatar-customizer__top"><div><h2>Personalizar</h2><span>Monte seu avatar com peças combináveis.</span></div><span class="avatar-customizer__status">● Prévia ao vivo</span></div>
                        <div class="avatar-customizer__groups" data-avatar-options></div>
                        <div class="avatar-customizer__footer">
                            <button class="btn btn--ghost" type="button" data-avatar-random>Surpreenda-me</button>
                            <button class="btn btn--primary" type="button" data-avatar-save>Salvar avatar</button>
                        </div>
                    </aside>
                </div>`;
            container.appendChild(root);

            const optionsRoot = root.querySelector('[data-avatar-options]');
            const rebuildOptions = () => {
                FaeUtils.clear(optionsRoot);
                appendChoices(optionsRoot,'Cabelo','hair_style',hairByGender[config.gender],config);
                choiceGroups.forEach(([label,field,values],index)=>{
                    const beforeHair=index<2;
                    const block=buildChoices(label,field,values,config);
                    if(beforeHair) optionsRoot.insertBefore(block,optionsRoot.children[index]||null);
                    else optionsRoot.appendChild(block);
                });
                colorGroups.forEach(([label,field,colors])=>optionsRoot.appendChild(buildColorPicker(label,field,colors,config)));
                const accessoryBlock=FaeUtils.el('section',{class:'avatar-option avatar-option--accessories'});
                accessoryBlock.appendChild(FaeUtils.el('h3',{},'Acessórios combináveis'));
                accessoryBlock.appendChild(FaeUtils.el('p',{class:'avatar-option__hint'},'Escolha quantos quiser.'));
                const accessoryChoices=FaeUtils.el('div',{class:'avatar-option__choices avatar-option__choices--accessories'});
                accessories.forEach(([name,value])=>accessoryChoices.appendChild(FaeUtils.el('button',{
                    type:'button',class:config.accessories.includes(value)?'is-active':'','data-avatar-accessory':value,
                    'aria-pressed':config.accessories.includes(value),'aria-label':name,
                },name)));
                accessoryBlock.appendChild(accessoryChoices);optionsRoot.appendChild(accessoryBlock);
            };
            rebuildOptions();

            const canvas = root.querySelector('canvas');
            const { THREE } = Fae3D;
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(28, 1, .1, 100);
            camera.position.set(0, 2.25, 8.1);
            camera.lookAt(0, 1.45, 0);
            const renderer = Fae3D.makeRenderer(canvas, { exposure: 1.25 });
            scene.add(new THREE.HemisphereLight(0xb7d9ff, 0x271c43, 2.6));
            const key = new THREE.DirectionalLight(0xffffff, 4.1); key.position.set(4, 7, 5); key.castShadow = true; scene.add(key);
            const rim = new THREE.PointLight(0x7b4dff, 32, 12); rim.position.set(-3, 3, -2); scene.add(rim);
            const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.9, .16, 48), new THREE.MeshStandardMaterial({ color: 0x111838, roughness: .35, metalness: .35 }));
            platform.position.y = .02; platform.receiveShadow = true; scene.add(platform);
            let avatar = Fae3D.createAvatar(config); scene.add(avatar.group);
            let action = 'stand';
            let targetRotation = .25;
            avatar.group.rotation.y = targetRotation;

            const resize = () => {
                const rect = canvas.getBoundingClientRect();
                renderer.setSize(Math.max(rect.width, 1), Math.max(rect.height, 1), false);
                camera.aspect = rect.width / Math.max(rect.height, 1); camera.updateProjectionMatrix();
            };
            const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
            const timer = new THREE.Timer(); timer.connect(document);
            renderer.setAnimationLoop(timestamp => {
                timer.update(timestamp);
                avatar.group.rotation.y += (targetRotation - avatar.group.rotation.y) * .09;
                avatar.setAction(action); avatar.update(timer.getElapsed()); renderer.render(scene, camera);
            });

            let dragging = false, lastX = 0;
            canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
            canvas.addEventListener('pointermove', e => { if (dragging) { targetRotation += (e.clientX - lastX) * .012; lastX = e.clientX; } });
            canvas.addEventListener('pointerup', () => { dragging = false; });

            const refreshAvatar = () => {
                scene.remove(avatar.group); avatar.dispose(); avatar = Fae3D.createAvatar(config); avatar.group.rotation.y = targetRotation; scene.add(avatar.group);
            };
            optionsRoot.addEventListener('click', e => {
                const accessoryButton=e.target.closest('[data-avatar-accessory]');
                if(accessoryButton){
                    const value=accessoryButton.dataset.avatarAccessory;
                    config.accessories=config.accessories.includes(value)?config.accessories.filter(item=>item!==value):[...config.accessories,value];
                    rebuildOptions();refreshAvatar();return;
                }
                const button = e.target.closest('[data-avatar-field]'); if (!button) return;
                config[button.dataset.avatarField] = button.dataset.avatarValue;
                if(button.dataset.avatarField==='gender'&&!hairByGender[config.gender].some(([,value])=>value===config.hair_style)) config.hair_style=hairByGender[config.gender][0][1];
                rebuildOptions(); refreshAvatar();
            });
            optionsRoot.addEventListener('input',e=>{
                const picker=e.target.closest('[data-avatar-color]');if(!picker)return;
                config[picker.dataset.avatarColor]=picker.value.toLowerCase();
                picker.closest('.avatar-color-picker').style.setProperty('--selected-color',picker.value);refreshAvatar();
            });
            root.querySelector('.avatar-stage__actions').addEventListener('click', e => {
                const button = e.target.closest('[data-avatar-action]'); if (!button) return;
                action = button.dataset.avatarAction;
                root.querySelectorAll('[data-avatar-action]').forEach(b => b.classList.toggle('is-active', b === button));
            });
            root.querySelector('[data-avatar-random]').addEventListener('click', () => {
                const pick=values=>values[Math.floor(Math.random()*values.length)];
                config.gender=pick(['male','female']);config.hair_style=pick(hairByGender[config.gender])[1];
                config.skin=pick(choiceGroups[1][2])[1];config.hair_color=pick(choiceGroups[2][2])[1];
                config.top_style=pick(choiceGroups[3][2])[1];config.bottom_style=pick(choiceGroups[4][2])[1];config.shoe_style=pick(choiceGroups[5][2])[1];
                colorGroups.forEach(([,field,colors])=>{config[field]=pick(colors);});
                config.accessories=accessories.filter(()=>Math.random()>.68).slice(0,3).map(([,value])=>value);
                rebuildOptions(); refreshAvatar();
            });
            root.querySelector('[data-avatar-save]').addEventListener('click', async e => {
                const button = e.currentTarget; button.disabled = true; button.textContent = 'Salvando…';
                try { await FaeAPI.saveAvatar(config); FaeUtils.toast('Avatar salvo. Ele já está pronto para o FaeMap!', 'success'); }
                catch (err) { FaeUtils.toast(err.message || 'Não foi possível salvar.', 'error'); }
                finally { button.disabled = false; button.textContent = 'Salvar avatar'; }
            });

            this.cleanup = () => { renderer.setAnimationLoop(null); timer.dispose(); observer.disconnect(); avatar.dispose(); platform.geometry.dispose(); platform.material.dispose(); renderer.dispose(); };
            return this.cleanup;
        },
    };

    function normalizeConfig(input={}){
        const config={...Fae3D.DEFAULT_AVATAR,...input};
        config.gender=config.gender==='female'?'female':'male';
        const validHair=hairByGender[config.gender].map(([,value])=>value);
        const aliases={spiky:'short',coils:'curly'};
        config.hair_style=aliases[config.hair_style]||config.hair_style;
        if(!validHair.includes(config.hair_style)) config.hair_style=validHair[0];
        config.top_style=['shirt','hoodie','tank'].includes(config.top_style)?config.top_style:'hoodie';
        config.bottom_style=config.bottom_style==='shorts'?'shorts':'pants';
        config.shoe_style=config.shoe_style==='flipflops'?'flipflops':'sneakers';
        config.accessories=Array.isArray(config.accessories)?[...new Set(config.accessories)]:[];
        return config;
    }

    function appendChoices(root,label,field,values,config){root.appendChild(buildChoices(label,field,values,config));}
    function buildChoices(label,field,values,config){
        const block=FaeUtils.el('section',{class:'avatar-option'});block.appendChild(FaeUtils.el('h3',{},label));
        const choices=FaeUtils.el('div',{class:`avatar-option__choices avatar-option__choices--${field}`});
        values.forEach(([name,value])=>{
            const isSwatch=field==='skin'||field==='hair_color';
            const button=FaeUtils.el('button',{type:'button',class:config[field]===value?'is-active':'','data-avatar-field':field,'data-avatar-value':value,title:name,'aria-label':`${label}: ${name}`},isSwatch?'':name);
            if(isSwatch)button.style.setProperty('--swatch',colorFor(field,value));choices.appendChild(button);
        });
        block.appendChild(choices);return block;
    }
    function buildColorPicker(label,field,colors,config){
        const block=FaeUtils.el('section',{class:'avatar-option'});block.appendChild(FaeUtils.el('h3',{},label));
        const row=FaeUtils.el('div',{class:'avatar-color-picker'});row.style.setProperty('--selected-color',colorFor(field,config[field]));
        colors.forEach(color=>row.appendChild(FaeUtils.el('button',{type:'button',class:colorFor(field,config[field])===color?'is-active':'','data-avatar-field':field,'data-avatar-value':color,'aria-label':`Usar cor ${color}`,style:`--swatch:${color}`})));
        const custom=FaeUtils.el('label',{class:'avatar-color-picker__custom',title:'Escolher qualquer cor'});
        custom.appendChild(FaeUtils.el('input',{type:'color',value:colorFor(field,config[field]),'data-avatar-color':field,'aria-label':`${label}: cor personalizada`}));custom.appendChild(FaeUtils.el('span',{},'＋'));
        row.appendChild(custom);block.appendChild(row);return block;
    }

    function colorFor(field, value) {
        if(typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value))return value.toLowerCase();
        const maps = { skin: Fae3D.PALETTE.skin, hair_color: Fae3D.PALETTE.hair, top_color: Fae3D.PALETTE.top, bottom_color: Fae3D.PALETTE.bottom, shoe_color: Fae3D.PALETTE.shoe };
        const number = (maps[field] || {})[value] || 0x777777;
        return `#${number.toString(16).padStart(6, '0')}`;
    }

    global.FaeAvatar = AvatarStudio;
})(window);
