// Executado no mundo da página para observar os diálogos nativos do X2.
(()=>{
 if(!/sinalizar_procura_produto\.jsp/i.test(location.href))return;
 const emit=(kind,message)=>window.postMessage({__rildonX2:true,kind,message:String(message||''),at:Date.now()},location.origin);
 const success=/quantidade\s+informada\s+com\s+sucesso/i;
 const oldAlert=window.alert;
 window.alert=function(message){if(success.test(String(message)))emit('success-alert',message);return oldAlert.apply(this,arguments)};
 const oldConfirm=window.confirm;
 window.confirm=function(message){const answer=oldConfirm.apply(this,arguments);if(answer)emit('confirm-ok',message);return answer};
 // Monitorar mensagens geradas por bibliotecas (sweetalert, toastr etc.).
 const check=()=>{const body=document.body;if(!body)return;const nodes=body.querySelectorAll('[role="alert"],.alert,.swal2-popup,.sweet-alert,.toast,.ui-dialog,.modal');for(const n of nodes){if(success.test(n.textContent||'')){emit('success-dom',n.textContent);return}}};
 const start=()=>{new MutationObserver(check).observe(document.documentElement,{subtree:true,childList:true,characterData:true});check()};
 if(document.documentElement)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
