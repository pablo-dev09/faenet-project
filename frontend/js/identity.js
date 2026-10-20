'use strict';
document.querySelector('[data-reveal-password]')?.addEventListener('click', event => {
    const button=event.currentTarget, field=document.getElementById('oldPassword'), reveal=field.type==='password';
    field.type=reveal?'text':'password';button.textContent=reveal?'Ocultar':'Mostrar';
    button.setAttribute('aria-label',reveal?'Ocultar senha':'Mostrar senha');button.setAttribute('aria-pressed',String(reveal));
});
document.querySelectorAll('[data-identity-form]').forEach(form => form.addEventListener('submit', event => {
    if(form.dataset.busy){event.preventDefault();return;}
    const invalid=Array.from(form.elements).find(field=>field.required && (field.type==='checkbox'?!field.checked:!field.value.trim()));
    if(invalid){event.preventDefault();invalid.setAttribute('aria-invalid','true');document.getElementById('identityError').textContent='Preencha os dados e confirme a vinculação antes de continuar.';invalid.focus();return;}
    form.dataset.busy='1';form.setAttribute('aria-busy','true');document.querySelectorAll('button[type=submit]').forEach(button=>button.disabled=true);
}));
document.querySelectorAll('[data-identity-form]').forEach(form=>form.addEventListener('input',event=>{
    event.target.removeAttribute('aria-invalid');
    const error=document.getElementById('identityError');if(error.textContent.startsWith('Preencha'))error.textContent='';
}));
const identityError=document.getElementById('identityError');
if(identityError?.textContent.trim()){identityError.tabIndex=-1;identityError.focus();}
window.addEventListener('pageshow',()=>{document.querySelectorAll('[data-identity-form]').forEach(form=>{delete form.dataset.busy;form.removeAttribute('aria-busy');});document.querySelectorAll('button[type=submit]').forEach(button=>button.disabled=false);});
