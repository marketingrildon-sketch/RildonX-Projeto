// RILDON v2.9: captura DOM do X2 e associa a janela de sinalização ao produto pesquisado.
(()=>{
 const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
 const number=s=>{let v=String(s??'').replace(/[^\d,.-]/g,'');if(v.includes(','))v=v.replace(/\./g,'').replace(',','.');return Number(v)};
 const isPopup=/sinalizar_procura_produto\.jsp/i.test(location.pathname);
 const codeFromUrl=()=>new URLSearchParams(location.search).get('id_produto_estoque')||'';
 const readSeller=()=>{const t=document.body?.innerText||'';return clean(t.match(/(?:Vers[aã]o\s*\d+\s*-\s*IP:[^\n]*?-\s*)([^\n]+)/i)?.[1]||t.match(/(?:Vendedor|Usu[aá]rio)\s*:\s*([^\n]+)/i)?.[1]||'')};
 const popupTitle=()=>clean((document.querySelector('.panel-heading,.modal-title,h1,h2,h3')?.innerText||document.body?.innerText||'').match(/Sinalizar\s+Procura\s+(?:do|de)\s+Produto\s*:\s*([^\n]+)/i)?.[1]||'');
 const qty=()=>{const inputs=[...document.querySelectorAll('input')];const field=inputs.find(e=>/qtd|qtde|quantidade|qnt/i.test([e.name,e.id,e.placeholder].join(' ')))||inputs.find(e=>/^(?:\d+[.,]?\d*)$/.test(e.value||''));return number(field?.value)};
 function parentItem(el){
  const card=el.closest('.panel,.card,.produto,.box')||[...document.querySelectorAll('div')].find(x=>x.contains(el)&&/C[oó]digo\s+Produto\s*\d+/i.test(x.innerText||'')&&/Estoque\s+Dispon/i.test(x.innerText||'')&&x.innerText.length<1800)||el.parentElement?.parentElement?.parentElement;
  const t=card?.innerText||'';
  const code=t.match(/C[oó]digo\s+Produto\s*(\d+)/i)?.[1]||'';
  const desc=clean(t.match(/C[oó]digo\s+Produto\s*\d+\s*-\s*([^\n]+)/i)?.[1]||'');
  const reference=clean(t.match(/C[oó]digo\s+Fornecedor\s*-\s*([^\n]+)/i)?.[1]||'');
  const price=t.match(/R\$\s*[\d.,]+/)?.[0];
  const stock=t.match(/Estoque\s+Dispon[ií]vel[\s\S]{0,160}?(\d+(?:[.,]\d+)?)\s*PC/i)?.[1];
  return {code,desc,reference,price:price?number(price):null,availableQty:stock!=null?number(stock):null,seller:readSeller(),at:Date.now()};
 }
 if(!isPopup){
  document.addEventListener('click',e=>{
   const el=e.target.closest('a,button,span,div');if(!el)return;
   const candidate=el.closest('a,button')||el;
   if(!/Sinalizar\s+Procura\s+(?:de|do)\s+Produto/i.test(clean(candidate.innerText||candidate.textContent)))return;
   const item=parentItem(candidate); item.sourceUrl=location.href;
   chrome.runtime.sendMessage({type:'RILDON_PROCURA_CONTEXT',item},()=>void chrome.runtime.lastError);
  },true);
  return;
 }
 let sent=false, lastQty=0;
 // A ponte no contexto da página observa alert/confirm que content scripts isolados não enxergam.
 window.addEventListener('message',e=>{
  if(e.source!==window||e.origin!==location.origin||!e.data?.__rildonX2)return;
  if(e.data.kind==='confirm-ok'){lastQty=lastQty||qty();chrome.runtime.sendMessage({type:'RILDON_PROCURA_DIAG',stage:'confirm-ok',url:location.href},()=>void chrome.runtime.lastError)}
  if(e.data.kind==='success-alert'||e.data.kind==='success-dom')confirmed(e.data.kind);
 });
 function confirmed(origin){
  if(sent)return;sent=true;
  const item={id:crypto.randomUUID(),popupCode:codeFromUrl(),popupDesc:popupTitle(),qty:lastQty||qty(),capturedAt:new Date().toISOString(),sourceUrl:location.href,confirmationSource:origin};
  chrome.runtime.sendMessage({type:'RILDON_X2_PROCURA_CONFIRMED',item},()=>void chrome.runtime.lastError);
 }
 chrome.runtime.sendMessage({type:'RILDON_PROCURA_DIAG',stage:'popup-loaded',url:location.href},()=>void chrome.runtime.lastError);

 document.addEventListener('click',e=>{const b=e.target.closest('button,input[type=button],input[type=submit]');if(b&&/gravar/i.test(clean(b.innerText||b.value)))lastQty=qty()},true);
 const success=/Quantidade\s+informada\s+com\s+sucesso/i;
 function check(){
  if(sent||!document.body||!success.test(document.body.innerText||''))return;
  confirmed('dom-text');
 }
 const observer=new MutationObserver(check);
 function init(){observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});check()}
 if(document.documentElement)init();else document.addEventListener('DOMContentLoaded',init,{once:true});
})();
