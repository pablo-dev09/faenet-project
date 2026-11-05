'use strict';
const setup=document.querySelector('[data-profile-setup]');
const errorBox=document.getElementById('identityError');
let leaving=false,dirty=false,step=0;
const steps=setup?Array.from(setup.querySelectorAll('[data-setup-step]')):[];
const urls=new Map();
function identitySubmitUrl(form){
    // A named input such as name="action" shadows HTMLFormElement.action.
    return form.getAttribute('action')||window.location.href;
}
function identityResponseError(response,body){
    if((response.headers.get('Content-Type')||'').includes('application/json')){
        try{const data=JSON.parse(body);if(typeof data.error?.message==='string')return data.error.message;}catch(_){}
    }
    return `Não foi possível concluir o cadastro (erro ${response.status}). Tente novamente; se continuar, reabra a entrada com FaeHub.`;
}
const showError=(message,field)=>{
    errorBox.textContent=message;errorBox.tabIndex=-1;
    if(field){field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',(field.getAttribute('aria-describedby')||'')+' identityError');const owner=field.closest('[data-setup-step]');if(owner)showStep(Number(owner.dataset.setupStep));field.focus();}
    else errorBox.focus();
};
function showStep(index){
    step=index;steps.forEach((part,i)=>part.hidden=i!==index);
    setup.querySelector('[data-setup-back]').hidden=index===0;
    setup.querySelector('[data-setup-next]').hidden=index!==0;
    setup.querySelector('[data-setup-submit]').hidden=index===0;
    setup.querySelectorAll('[data-step-label]').forEach((label,i)=>{if(i===index)label.setAttribute('aria-current','step');else label.removeAttribute('aria-current');});
}
function validatePart(part){
    const invalid=Array.from(part.querySelectorAll('input,textarea')).find(field=>!field.validity.valid);
    if(invalid){showError(invalid.validity.valueMissing?'Preencha este campo.':'Confira o formato e o limite deste campo.',invalid);return false;}
    const name=setup.elements.name;
    if(part.contains(name)&&(!/^[\p{L} '.-]+$/u.test(name.value)||name.value.trim().split(/\s+/).length<2)){showError('Informe seu nome e sobrenome.',name);return false;}
    const handle=setup.elements.handle;
    if(part.contains(handle)&&(handle.value.toLowerCase().startsWith('fh_')||['online','suggestions'].includes(handle.value.toLowerCase()))){showError('Escolha outro @; este identificador é reservado.',handle);return false;}
    return true;
}
function updatePreview(){
    if(!setup)return;
    const name=setup.elements.name.value.trim()||'Seu nome';
    document.querySelector('[data-preview-name]').textContent=name;
    document.querySelector('[data-preview-handle]').textContent='@'+(setup.elements.handle.value.trim().toLowerCase()||'seu.usuario');
    document.querySelector('[data-preview-bio]').textContent=setup.elements.bio.value||'Sua história no campus começa aqui.';
    document.querySelector('[data-bio-count]').textContent=Array.from(setup.elements.bio.value).length;
    document.querySelector('[data-preview-initials]').textContent=name.split(/\s+/).map(p=>p[0]).slice(0,2).join('').toUpperCase();
}
function selectedImage(field){
    const kind=field.dataset.setupImage,file=field.files[0],image=document.querySelector('[data-image-preview='+kind+']');
    const label=document.querySelector('[data-file-label='+kind+']'),message=document.getElementById(kind+'Error'),remove=document.querySelector('[data-remove-image='+kind+']');
    if(urls.has(kind)){URL.revokeObjectURL(urls.get(kind));urls.delete(kind);}
    message.textContent='';field.removeAttribute('aria-invalid');
    if(image.dataset.original)image.src=image.dataset.original;else image.removeAttribute('src');
    image.hidden=!image.dataset.original;
    label.textContent=file?file.name+' · '+Math.ceil(file.size/1024)+' KB':'Nenhum arquivo selecionado';remove.hidden=!file;
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size===0||file.size>5*1024*1024){
        message.textContent='Escolha JPG, PNG ou WebP não vazio de até 5 MB.';field.setAttribute('aria-invalid','true');return;
    }
    const url=URL.createObjectURL(file);urls.set(kind,url);image.src=url;image.hidden=false;
}
if(setup){
    document.querySelectorAll('[data-image-preview]').forEach(image=>image.dataset.original=image.getAttribute('src')||'');
    showStep(document.querySelector('[aria-invalid=true]')?.closest('[data-setup-step]')?.dataset.setupStep==='1'?1:0);
    setup.querySelector('[data-setup-next]').addEventListener('click',()=>{if(validatePart(steps[0])){showStep(1);steps[1].querySelector('legend').tabIndex=-1;steps[1].querySelector('legend').focus();}});
    setup.querySelector('[data-setup-back]').addEventListener('click',()=>{showStep(0);setup.elements.handle.focus();});
    setup.addEventListener('input',event=>{dirty=true;event.target.removeAttribute('aria-invalid');updatePreview();});
    setup.querySelectorAll('[data-setup-image]').forEach(field=>field.addEventListener('change',()=>{dirty=true;selectedImage(field);}));
    setup.querySelectorAll('[data-remove-image]').forEach(button=>button.addEventListener('click',()=>{const field=setup.elements.namedItem(button.dataset.removeImage);field.value='';selectedImage(field);field.focus();dirty=true;}));
    updatePreview();
}
document.querySelector('[data-reveal-password]')?.addEventListener('click',event=>{
    const button=event.currentTarget,field=document.getElementById('oldPassword'),reveal=field.type==='password';
    field.type=reveal?'text':'password';button.textContent=reveal?'Ocultar':'Mostrar';
    button.setAttribute('aria-label',reveal?'Ocultar senha':'Mostrar senha');button.setAttribute('aria-pressed',String(reveal));
});
document.querySelectorAll('[data-identity-form]').forEach(form=>form.addEventListener('submit',async event=>{
    if(form.dataset.busy){event.preventDefault();return;}
    if(form===setup){
        event.preventDefault();
        if(!validatePart(steps[0]))return;
        if(step===0){showStep(1);return;}
        if(!validatePart(steps[1]))return;
        const invalidFile=form.querySelector('input[type=file][aria-invalid=true]');
        if(invalidFile){showError('Corrija ou remova a imagem selecionada.',invalidFile);return;}
    }else{
        const invalid=Array.from(form.elements).find(field=>field.required&&(field.type==='checkbox'?!field.checked:!field.value.trim()));
        if(invalid){event.preventDefault();showError('Preencha os dados e confirme a vinculação antes de continuar.',invalid);return;}
    }
    form.dataset.busy='1';form.setAttribute('aria-busy','true');
    document.querySelectorAll('button').forEach(button=>button.disabled=true);
    if(form!==setup){leaving=true;return;}
    const submit=form.querySelector('[data-setup-submit]'),original=submit.textContent;
    submit.dataset.originalLabel=original;
    submit.style.minWidth=submit.getBoundingClientRect().width+'px';submit.textContent='Salvando perfil…';
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
    try{
        const response=await fetch(identitySubmitUrl(form),{method:'POST',body:new FormData(form),credentials:'same-origin',signal:controller.signal});
        if(response.ok&&response.redirected){leaving=true;window.location.assign(response.url);return;}
        const body=await response.text(),html=new DOMParser().parseFromString(body,'text/html');
        const invalid=html.querySelector('[aria-invalid=true]'),field=invalid?.name?form.elements.namedItem(invalid.name):null;
        showError(html.getElementById('identityError')?.textContent||identityResponseError(response,body),field);
    }catch(_){showError('Não foi possível confirmar o salvamento. Confira a conexão e reabra a entrada com FaeHub antes de tentar novamente.');}
    finally{clearTimeout(timer);if(!leaving){delete form.dataset.busy;form.removeAttribute('aria-busy');document.querySelectorAll('button').forEach(button=>button.disabled=false);submit.textContent=original;}}
}));
if(errorBox?.textContent.trim()){errorBox.tabIndex=-1;errorBox.focus();}
window.addEventListener('beforeunload',event=>{if(dirty&&!leaving){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',event=>{if(!event.persisted)urls.forEach(url=>URL.revokeObjectURL(url));});
window.addEventListener('pageshow',()=>{leaving=false;document.querySelectorAll('[data-identity-form]').forEach(form=>{delete form.dataset.busy;form.removeAttribute('aria-busy');});document.querySelectorAll('button').forEach(button=>{button.disabled=false;if(button.dataset.originalLabel)button.textContent=button.dataset.originalLabel;});});
