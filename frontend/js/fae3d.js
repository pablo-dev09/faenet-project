import * as THREE from '/vendor/three.module.js';

let FAEHUB_AVATAR_SVG = '';
let avatarSvgSequence = 0;
try {
    FAEHUB_AVATAR_SVG = await fetch('/assets/faehub-avatar.svg').then(response => {
        if (!response.ok) throw new Error('Avatar FaeHub+ indisponível.');
        return response.text();
    });
} catch (error) {
    console.error(error);
}

const PALETTE = {
    skin: { light: 0xf2c7ae, warm: 0xd9946b, medium: 0xb86f4e, brown: 0x7a482f, deep: 0x472b21 },
    hair: { dark: 0x171923, brown: 0x523225, auburn: 0x874534, blonde: 0xe1b967, blue: 0x356fc1, pink: 0xd96c9e },
    top: { violet: 0x7258d9, blue: 0x347fc4, mint: 0x3ba984, rose: 0xc45e82, amber: 0xd19a3e, black: 0x30333d },
    bottom: { navy: 0x26334f, denim: 0x3e6685, black: 0x232630, gray: 0x5a606b, sand: 0x927b64 },
    shoe: { white: 0xe9ebef, black: 0x252832, violet: 0x7959cb, blue: 0x397abd },
};

const DEFAULT_AVATAR = Object.freeze({
    skin: 'medium', gender: 'male', hair_style: 'short', hair_color: 'dark', top_style: 'hoodie',
    top_color: '#7258d9', bottom_style: 'pants', bottom_color: '#26334f',
    shoe_style: 'sneakers', shoe_color: '#e9ebef', accessories: [],
});

const makeMaterial = (color, roughness = .72, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const makeMesh = (geometry, material, shadows = true) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    return mesh;
};
const changeLightness = (color, amount) => new THREE.Color(color).offsetHSL(0, 0, amount).getHex();
const resolveColor = (palette, value, fallback) => {
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return Number.parseInt(value.slice(1), 16);
    return palette[value] || palette[fallback];
};

function disposeTree(root) {
    const materials = new Set();
    root.traverse(node => {
        if (node.geometry) node.geometry.dispose();
        const list = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : [];
        list.forEach(item => {
            if (!materials.has(item)) { item.dispose(); materials.add(item); }
        });
    });
}

function ellipsoid(radius, colorMaterial, scale, position, rotation = [0, 0, 0], segments = 18) {
    const result = makeMesh(new THREE.SphereGeometry(radius, segments, Math.max(12, segments - 4)), colorMaterial);
    result.scale.set(...scale);
    result.position.set(...position);
    result.rotation.set(...rotation);
    return result;
}

function hairFrontTexture(style,color){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d');
    const base=`#${color.toString(16).padStart(6,'0')}`,shine=`#${changeLightness(color,.13).toString(16).padStart(6,'0')}`;
    ctx.clearRect(0,0,512,512);ctx.lineCap='round';ctx.lineJoin='round';ctx.fillStyle=base;
    if(style==='curly'||style==='coils'||style==='afro'){
        const big=style==='afro';ctx.beginPath();ctx.moveTo(55,335);ctx.bezierCurveTo(big?25:48,big?105:145,130,65,256,big?55:90);ctx.bezierCurveTo(395,55,big?495:465,big?125:160,457,335);
        for(let i=0;i<7;i+=1){const x=430-i*58,y=315+(i%2)*18;ctx.quadraticCurveTo(x-24,y+55,x-52,330);}ctx.closePath();ctx.fill();
        ctx.strokeStyle=shine;ctx.lineWidth=15;for(let i=0;i<7;i+=1){const x=105+i*50;ctx.beginPath();ctx.arc(x,185+(i%2)*20,31,.15*Math.PI,1.55*Math.PI);ctx.stroke();}
    }else if(style==='fade'){
        ctx.beginPath();ctx.moveTo(70,325);ctx.bezierCurveTo(95,150,185,105,270,115);ctx.bezierCurveTo(375,105,445,195,446,325);ctx.quadraticCurveTo(260,275,70,325);ctx.fill();
        ctx.strokeStyle=shine;ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(142,241);ctx.quadraticCurveTo(245,150,365,224);ctx.stroke();
    }else{
        ctx.beginPath();ctx.moveTo(48,344);ctx.bezierCurveTo(55,170,125,105,223,104);
        if(style==='spiky'){ctx.quadraticCurveTo(260,20,282,109);ctx.quadraticCurveTo(347,28,337,130);ctx.quadraticCurveTo(430,70,390,170);}
        ctx.bezierCurveTo(450,186,468,255,456,344);
        ctx.quadraticCurveTo(420,307,386,355);ctx.quadraticCurveTo(344,302,310,362);ctx.quadraticCurveTo(267,300,230,365);ctx.quadraticCurveTo(188,304,151,355);ctx.quadraticCurveTo(104,302,48,344);ctx.closePath();ctx.fill();
        ctx.strokeStyle=shine;ctx.lineWidth=17;ctx.beginPath();ctx.moveTo(118,250);ctx.bezierCurveTo(178,126,268,120,338,194);ctx.stroke();ctx.beginPath();ctx.moveTo(238,151);ctx.quadraticCurveTo(320,99,397,203);ctx.stroke();
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

function buildHair(inputStyle,color){
    const aliases={spiky:'short',coils:'curly'};
    const style=aliases[inputStyle]||inputStyle;
    const root=new THREE.Group();
    const base=makeMaterial(color,.76),shade=makeMaterial(changeLightness(color,-.07),.82),shine=makeMaterial(changeLightness(color,.09),.7);
    const cap=makeMesh(new THREE.SphereGeometry(.37,40,28,0,Math.PI*2,0,Math.PI*.62),base);
    cap.scale.set(1,.62,1);cap.position.set(0,.005,-.025);root.add(cap);
    const addLock=(points,radius=.04,material=base)=>{
        const curve=new THREE.CatmullRomCurve3(points.map(point=>new THREE.Vector3(...point)));
        root.add(makeMesh(new THREE.TubeGeometry(curve,20,radius,12,false),material));
    };
    if(style==='fade'){
        cap.scale.set(.98,.46,.98);cap.position.y=.015;
        for(let i=-2;i<=2;i+=1){
            const lock=ellipsoid(.11,i%2?shine:base,[.66,.72,1.18],[i*.105,.17,.24],[.12,i*.06,-i*.08],24);root.add(lock);
        }
    }else if(style==='short'){
        cap.scale.set(1,.59,1);cap.position.y=.025;
        const locks=[
            [-.24,.15,.20,.13],[-.13,.23,.24,.06],[0,.26,.25,0],[.13,.23,.24,-.06],[.24,.15,.20,-.13],
            [-.18,.20,.02,.08],[-.06,.27,.04,.03],[.07,.27,.04,-.03],[.19,.20,.02,-.08],
        ];
        locks.forEach(([x,y,z,rz],index)=>{const lock=ellipsoid(.12,index%3===0?shine:base,[.72,1.05,1.16],[x,y,z],[.12,0,rz],24);root.add(lock);});
    }else if(style==='curly'||style==='afro'){
        cap.scale.set(style==='afro'?1.17:1.03,style==='afro'?.9:.7,style==='afro'?1.12:1.02);cap.position.y=style==='afro'?.08:.025;
        const rows=style==='afro'?4:3;
        for(let row=0;row<rows;row+=1){
            const count=8-row, y=.03+row*.09;
            for(let i=0;i<count;i+=1){const angle=(i/count)*Math.PI*2+row*.34,r=.31-row*.035;const curl=ellipsoid(.075,row%2?shine:shade,[1,.82,1],[Math.cos(angle)*r,y,Math.sin(angle)*r]);root.add(curl);}
        }
    }else if(style==='long'||style==='wavy'){
        const waves=style==='wavy'?.055:.025;
        [-1,1].forEach(side=>{
            for(let i=0;i<4;i+=1){const x=side*(.22+i*.037),z=.14-i*.08;addLock([[x,.10,z],[x+side*waves,.00,z+.03],[x-side*waves,-.19,z],[x+side*waves,-.40,z-.04],[x,-.62,z-.06]],.052,i%2?base:shade);}
        });
        for(let i=-2;i<=2;i+=1)addLock([[i*.08,.12,-.29],[i*.09,-.12,-.34],[i*.075,-.38,-.32],[i*.07,-.59,-.27]],.055,i%2?shade:base);
        [[-.20,.10,.29,.20],[-.07,.11,.34,.05],[.07,.12,.34,-.05],[.20,.10,.29,-.20]].forEach(([x,y,z,rz],index)=>{
            const fringe=ellipsoid(.115,index%2?base:shine,[.78,.55,1.15],[x,y,z],[.15,0,rz],26);root.add(fringe);
        });
    }else if(style==='bun'){
        [-1,1].forEach(side=>addLock([[side*.24,.08,.24],[side*.30,-.06,.12],[side*.29,-.24,-.02]],.052,base));
        const bun=ellipsoid(.19,base,[1,1.04,.92],[0,.31,-.22]);root.add(bun);
        const bunRing=makeMesh(new THREE.TorusGeometry(.15,.025,9,28),shine);bunRing.rotation.x=Math.PI/2;bunRing.position.set(0,.31,-.37);root.add(bunRing);
    }
    return root;
}

function buildFaceTexture(skinColor, hairColor) {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,512,512);ctx.lineCap='round';ctx.lineJoin='round';
    const hair=`#${hairColor.toString(16).padStart(6,'0')}`;
    const eye=(x)=>{
        ctx.fillStyle='#fffdf8';ctx.beginPath();ctx.ellipse(x,220,43,34,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(52,32,28,.32)';ctx.lineWidth=5;ctx.stroke();
        ctx.fillStyle='#765238';ctx.beginPath();ctx.arc(x,224,20,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#201b20';ctx.beginPath();ctx.arc(x,226,10,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-6,217,5,0,Math.PI*2);ctx.fill();
    };
    eye(170);eye(342);
    ctx.strokeStyle=hair;ctx.lineWidth=18;
    ctx.beginPath();ctx.moveTo(130,153);ctx.quadraticCurveTo(170,132,207,153);ctx.stroke();
    ctx.beginPath();ctx.moveTo(305,153);ctx.quadraticCurveTo(342,132,382,153);ctx.stroke();
    ctx.strokeStyle='rgba(105,55,46,.58)';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(256,230);ctx.quadraticCurveTo(242,272,263,281);ctx.stroke();
    ctx.fillStyle='rgba(231,110,122,.18)';ctx.beginPath();ctx.ellipse(112,284,45,17,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(400,284,45,17,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#743c43';ctx.lineWidth=10;ctx.beginPath();ctx.arc(256,286,82,.18*Math.PI,.82*Math.PI);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.88)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(256,286,69,.22*Math.PI,.78*Math.PI);ctx.stroke();
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;return texture;
}

function buildArm(side, skinMaterial, sleeveMaterial, topStyle) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side*.35,1.87,0);
    const upperMaterial = topStyle === 'tank' ? skinMaterial : sleeveMaterial;
    const forearmMaterial = topStyle === 'hoodie' ? sleeveMaterial : skinMaterial;
    const upper = makeMesh(new THREE.CapsuleGeometry(.082,.29,6,12),upperMaterial); upper.position.y=-.22; shoulder.add(upper);
    const elbow = new THREE.Group(); elbow.position.y=-.43; shoulder.add(elbow);
    const forearm = makeMesh(new THREE.CapsuleGeometry(.073,.25,6,12),forearmMaterial); forearm.position.y=-.19; elbow.add(forearm);
    const hand = ellipsoid(.086,skinMaterial,[.82,1.12,.72],[0,-.40,0]); elbow.add(hand);
    return {shoulder,elbow};
}

function buildLeg(side, pantsMaterial, shoeMaterial, skinMaterial, bottomStyle, shoeStyle) {
    const hip = new THREE.Group(); hip.position.set(side*.145,1.19,0);
    const thigh = makeMesh(new THREE.CapsuleGeometry(.105,.34,6,12),pantsMaterial); thigh.position.y=-.27; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y=-.50; hip.add(knee);
    const calf = makeMesh(new THREE.CapsuleGeometry(.092,.31,6,12),bottomStyle === 'shorts' ? skinMaterial : pantsMaterial); calf.position.y=-.24; knee.add(calf);
    if(shoeStyle==='flipflops'){
        const sole=makeMesh(new THREE.BoxGeometry(.21,.045,.34),shoeMaterial);sole.position.set(0,-.59,.055);knee.add(sole);
        const strap=makeMesh(new THREE.TorusGeometry(.075,.018,7,18,Math.PI),shoeMaterial,false);strap.rotation.set(Math.PI/2,0,Math.PI);strap.scale.set(1,.7,1);strap.position.set(0,-.55,.11);knee.add(strap);
    }else{
        const shoe = makeMesh(new THREE.BoxGeometry(.225,.15,.36),shoeMaterial); shoe.position.set(0,-.50,.055); knee.add(shoe);
        const sole = makeMesh(new THREE.BoxGeometry(.24,.045,.38),makeMaterial(0xf2f1ef,.76),false); sole.position.set(0,-.595,.055); knee.add(sole);
    }
    return {hip,knee};
}

function createProceduralAvatar(input = {}) {
    const config = {...DEFAULT_AVATAR,...input};
    const group = new THREE.Group(); group.userData.isAvatar=true;
    const visual = new THREE.Group(); group.add(visual);
    const skinColor=PALETTE.skin[config.skin]||PALETTE.skin.medium;
    const hairColor=PALETTE.hair[config.hair_color]||PALETTE.hair.dark;
    const topColor=resolveColor(PALETTE.top,config.top_color,'violet');
    const bottomColor=resolveColor(PALETTE.bottom,config.bottom_color,'navy');
    const shoeColor=resolveColor(PALETTE.shoe,config.shoe_color,'white');
    const skin=makeMaterial(skinColor,.76),top=makeMaterial(topColor,.72),topLight=makeMaterial(changeLightness(topColor,.07),.70);
    const pants=makeMaterial(bottomColor,.78),shoe=makeMaterial(shoeColor,.68),dark=makeMaterial(0x1b1d26,.62),white=makeMaterial(0xeeeeec,.66);

    const hips=makeMesh(new THREE.CapsuleGeometry(.235,.15,6,14),pants);hips.position.y=1.20;hips.rotation.z=Math.PI/2;visual.add(hips);
    if(config.bottom_style==='shorts'){
        [-.145,.145].forEach(x=>{const cuff=makeMesh(new THREE.CylinderGeometry(.118,.112,.23,16),pants);cuff.position.set(x,1.05,0);visual.add(cuff);});
    }
    const torso=makeMesh(new THREE.CapsuleGeometry(.275,.40,8,18),top);torso.scale.set(1,.98,.72);torso.position.y=1.64;visual.add(torso);

    if(config.top_style==='hoodie'){
        const hood=makeMesh(new THREE.TorusGeometry(.205,.052,9,22,Math.PI*1.22),topLight);hood.rotation.set(Math.PI/2,0,-.35);hood.position.set(0,1.96,-.09);visual.add(hood);
        [-.055,.055].forEach(x=>{const cord=makeMesh(new THREE.CylinderGeometry(.006,.006,.22,7),white,false);cord.position.set(x,1.84,.215);visual.add(cord);});
        const pocket=makeMesh(new THREE.BoxGeometry(.29,.115,.022),topLight,false);pocket.position.set(0,1.48,.216);visual.add(pocket);
    }else if(config.top_style==='shirt'){
        const collar=makeMesh(new THREE.TorusGeometry(.095,.021,8,18),white,false);collar.rotation.x=Math.PI/2;collar.position.set(0,1.94,.10);visual.add(collar);
    }else{
        const neckline=makeMesh(new THREE.TorusGeometry(.13,.025,8,22,Math.PI),skin,false);neckline.rotation.z=Math.PI;neckline.rotation.x=Math.PI/2;neckline.position.set(0,1.91,.16);visual.add(neckline);
        const hem=makeMesh(new THREE.TorusGeometry(.245,.018,7,20,Math.PI),topLight,false);hem.rotation.z=Math.PI;hem.position.set(0,1.41,.01);visual.add(hem);
    }

    const neck=makeMesh(new THREE.CylinderGeometry(.085,.095,.15,14),skin);neck.position.y=2.04;visual.add(neck);
    const headRoot=new THREE.Group();headRoot.position.y=2.38;visual.add(headRoot);
    const head=ellipsoid(.36,skin,[.88,1.04,.84],[0,0,0],[0,0,0],28);headRoot.add(head);
    [-.325,.325].forEach(x=>headRoot.add(ellipsoid(.058,skin,[.55,1,.65],[x,0,0],[0,0,0],14)));
    const faceTexture=buildFaceTexture(skinColor,hairColor);
    const face=makeMesh(new THREE.PlaneGeometry(.54,.54),new THREE.MeshBasicMaterial({map:faceTexture,transparent:true,depthWrite:false,side:THREE.DoubleSide}),false);
    face.position.set(0,-.025,.307);headRoot.add(face);
    const hair=buildHair(config.hair_style,hairColor);hair.position.set(0,.20,-.005);headRoot.add(hair);

    const armL=buildArm(-1,skin,top,config.top_style),armR=buildArm(1,skin,top,config.top_style);visual.add(armL.shoulder,armR.shoulder);
    const legL=buildLeg(-1,pants,shoe,skin,config.bottom_style,config.shoe_style),legR=buildLeg(1,pants,shoe,skin,config.bottom_style,config.shoe_style);visual.add(legL.hip,legR.hip);

    const accessories=Array.isArray(config.accessories)?config.accessories:(config.accessory&&config.accessory!=='none'?[config.accessory]:[]);
    if(accessories.includes('glasses')){
        [-.115,.115].forEach(x=>{const frame=makeMesh(new THREE.TorusGeometry(.078,.010,7,18),dark,false);frame.position.set(x,2.415,.315);visual.add(frame);});
        const bridge=makeMesh(new THREE.BoxGeometry(.06,.010,.012),dark,false);bridge.position.set(0,2.415,.315);visual.add(bridge);
    }
    if(accessories.includes('headphones')){
        const band=makeMesh(new THREE.TorusGeometry(.355,.029,8,24,Math.PI),dark);band.rotation.z=Math.PI;band.position.set(0,2.42,0);visual.add(band);
        [-.325,.325].forEach(x=>{const pad=makeMesh(new THREE.BoxGeometry(.07,.20,.12),topLight);pad.position.set(x,2.38,0);visual.add(pad);});
    }
    if(accessories.includes('backpack')){
        const pack=makeMesh(new THREE.BoxGeometry(.41,.52,.16),makeMaterial(0x293750,.72));pack.position.set(0,1.66,-.27);visual.add(pack);
    }
    if(accessories.includes('earring')){
        const earring=makeMesh(new THREE.TorusGeometry(.035,.009,7,18),makeMaterial(0xe8bd57,.3,.72),false);earring.position.set(.345,2.31,.025);visual.add(earring);
    }
    if(accessories.includes('watch')){
        const watch=makeMesh(new THREE.BoxGeometry(.095,.075,.03),dark,false);watch.position.set(-.35,1.42,.015);visual.add(watch);
    }

    const phone=makeMesh(new THREE.BoxGeometry(.13,.23,.023),makeMaterial(0x222a3a,.35,.12));phone.position.set(.02,1.57,.33);phone.visible=false;visual.add(phone);
    let action='stand';
    const resetPose=()=>{
        visual.position.set(0,0,0);visual.rotation.set(0,0,0);headRoot.rotation.set(0,0,0);
        [armL,armR].forEach(arm=>{arm.shoulder.rotation.set(0,0,0);arm.elbow.rotation.set(0,0,0);});
        [legL,legR].forEach(leg=>{leg.hip.rotation.set(0,0,0);leg.knee.rotation.set(0,0,0);});
    };
    return {
        group,config,
        setAction(next){action=next||'stand';phone.visible=action==='phone';},
        update(time,speed=1){
            resetPose();const cycle=Math.sin(time*7*speed),breath=Math.sin(time*2.1);
            visual.position.y=breath*.007;headRoot.rotation.z=breath*.009;
            if(action==='walk'){
                armL.shoulder.rotation.x=cycle*.48;armR.shoulder.rotation.x=-cycle*.48;legL.hip.rotation.x=-cycle*.58;legR.hip.rotation.x=cycle*.58;
                legL.knee.rotation.x=Math.max(0,cycle)*.26;legR.knee.rotation.x=Math.max(0,-cycle)*.26;visual.position.y=Math.abs(cycle)*.025;
            }else if(action==='sit'){
                visual.position.y=-.35;legL.hip.rotation.x=-1.30;legR.hip.rotation.x=-1.30;legL.knee.rotation.x=1.32;legR.knee.rotation.x=1.32;armL.shoulder.rotation.x=-.22;armR.shoulder.rotation.x=-.22;
            }else if(action==='phone'){
                armL.shoulder.rotation.x=-.74;armR.shoulder.rotation.x=-.74;armL.shoulder.rotation.z=-.22;armR.shoulder.rotation.z=.22;armL.elbow.rotation.x=-.72;armR.elbow.rotation.x=-.72;headRoot.rotation.x=.10;
            }else if(action==='wave'){
                armR.shoulder.rotation.z=2.60;armR.shoulder.rotation.x=-.18;armR.elbow.rotation.z=.20+cycle*.15;headRoot.rotation.z=-.045;
            }
        },
        dispose(){disposeTree(group);},
    };
}

function buildAvatarSvg(input = {}) {
    if (!FAEHUB_AVATAR_SVG) return '';
    const config={...DEFAULT_AVATAR,...input};
    const appearance=config.gender==='female'?'feminine':'masculine';
    const hairstyles={curly:'curls',wavy:'waves',spiky:'short',coils:'curls'};
    const hairstyle=hairstyles[config.hair_style]||config.hair_style||'short';
    const outfits={shirt:'tee',hoodie:'hoodie',tank:'tank'};
    const bottoms={pants:'trousers',shorts:'shorts'};
    const shoes={sneakers:'sneakers',flipflops:'flipflops'};
    const selected=Array.isArray(config.accessories)?config.accessories:(config.accessory&&config.accessory!=='none'?[config.accessory]:[]);
    const accessoryClasses=selected.map(value=>`has-${value==='earring'?'earrings':value}`).join(' ');
    const asCss=(palette,value,fallback)=>`#${resolveColor(palette,value,fallback).toString(16).padStart(6,'0')}`;
    const variables=`--skin:${asCss(PALETTE.skin,config.skin,'medium')};--hair:${asCss(PALETTE.hair,config.hair_color,'dark')};--shirt:${asCss(PALETTE.top,config.top_color,'violet')};--bottom:${asCss(PALETTE.bottom,config.bottom_color,'navy')};--shoes:${asCss(PALETTE.shoe,config.shoe_color,'white')}`;
    let svg=FAEHUB_AVATAR_SVG
        .replace('class="faehub-avatar"',`class="faehub-avatar ${accessoryClasses}" style="${variables}"`)
        .replace('data-appearance="masculine"',`data-appearance="${appearance}"`)
        .replace('data-hairstyle="short"',`data-hairstyle="${hairstyle}"`)
        .replace('data-outfit="hoodie"',`data-outfit="${outfits[config.top_style]||'hoodie'}"`)
        .replace('data-bottom="trousers"',`data-bottom="${bottoms[config.bottom_style]||'trousers'}"`)
        .replace('data-shoes="sneakers"',`data-shoes="${shoes[config.shoe_style]||'sneakers'}"`);
    const scope='fae-avatar-' + (++avatarSvgSequence);
    // Cada SVG inline precisa de gradientes exclusivos. IDs repetidos faziam
    // todos os personagens herdarem as cores do primeiro avatar renderizado.
    ['skin','skinSide','cloth','bottom','shoe'].forEach(id=>{
        svg=svg.replaceAll('id="' + id + '"','id="' + id + '-' + scope + '"')
            .replaceAll('url(#' + id + ')','url(#' + id + '-' + scope + ')');
    });
    return svg;
}

function createAvatar(input = {}) {
    const svg=buildAvatarSvg(input);
    if (!svg) return createProceduralAvatar(input);
    const config={...DEFAULT_AVATAR,...input};
    const group=new THREE.Group();group.userData.isAvatar=true;group.userData.avatarSource='FaeHub+';
    const svgData=`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    const texture=new THREE.TextureLoader().load(svgData,loaded=>{loaded.colorSpace=THREE.SRGBColorSpace;loaded.needsUpdate=true;},undefined,error=>console.error('Não foi possível renderizar o avatar FaeHub+.',error));
    texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,alphaTest:.015,toneMapped:false,side:THREE.DoubleSide});
    const sprite=new THREE.Mesh(new THREE.PlaneGeometry(1.91,2.8),material);sprite.position.y=1.4;group.add(sprite);
    let action='stand';
    return {
        group,config,source:'faehub-plus',
        setAction(next){action=next||'stand';},
        update(time,speed=1){
            const cycle=Math.sin(time*7*speed),breath=Math.sin(time*2.1);
            sprite.position.set(0,1.4+breath*.008,0);sprite.scale.set(1,1,1);sprite.rotation.set(0,-group.rotation.y,0);
            if(action==='walk'){sprite.position.y=1.4+Math.abs(cycle)*.045;sprite.rotation.z=cycle*.012;}
            else if(action==='sit'){sprite.scale.set(1,.76,1);sprite.position.y=1.065;}
            else if(action==='wave'){sprite.rotation.z=-.025+cycle*.012;}
            else if(action==='phone'){sprite.rotation.z=.018;}
        },
        dispose(){texture.dispose();sprite.geometry.dispose();material.dispose();},
    };
}

function makeRenderer(canvas,options={}){
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:options.alpha!==false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=options.exposure||1.15;
    return renderer;
}

window.Fae3D={THREE,PALETTE,DEFAULT_AVATAR,createAvatar,avatarSvg:buildAvatarSvg,makeRenderer,disposeTree};
