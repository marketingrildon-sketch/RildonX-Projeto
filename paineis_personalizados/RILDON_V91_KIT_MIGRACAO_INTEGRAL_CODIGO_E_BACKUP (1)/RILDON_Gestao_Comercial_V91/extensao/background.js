// Ponte local: aceita somente páginas localhost declaradas no manifest.
chrome.runtime.onMessageExternal.addListener((message,sender,respond)=>{
 if(message?.type==='RILDON_SALES_SNAPSHOT'){chrome.storage.local.get(['capturas','erroCaptura'],({capturas={},erroCaptura=null})=>respond({ok:true,capturas,erroCaptura}));return true;}
 if(message?.type!=='RILDON_LOCAL_LOOKUP')return;
 const order=String(message.order||'').trim();
 if(!/^\d{1,12}$/.test(order)){respond({error:'Número de carrinho inválido.'});return;}
 (async()=>{
  const tabs=await chrome.tabs.query({url:'https://sistemas7.xprocess.com.br/x2rildon/*'});
  let seen=[];
  for(const tab of tabs){
   const frames=await chrome.webNavigation.getAllFrames({tabId:tab.id}).catch(()=>[]);
   for(const frame of frames){
    try{
     const data=await chrome.tabs.sendMessage(tab.id,{type:'RILDON_READ_CART'},{frameId:frame.frameId});
     if(data?.order)seen.push(data.order);
     if(data?.order===order&&Array.isArray(data.items))return {ok:true,data};
    }catch(e){}
   }
  }
  return {error:'Carrinho '+order+' não encontrado nas abas abertas do X2. Abra esse carrinho no X2 e tente novamente.',seen:[...new Set(seen)]};
 })().then(respond).catch(e=>respond({error:e.message}));
 return true;
});

chrome.runtime.onMessageExternal.addListener((msg,sender,respond)=>{
 if(msg?.type==='RILDON_PROCURA_QUEUE'){
  chrome.storage.local.get({rildonProcuraQueue:[]},data=>respond({ok:true,items:data.rildonProcuraQueue}));return true;
 }
 if(msg?.type==='RILDON_PROCURA_ACK'){
  const ids=new Set(Array.isArray(msg.ids)?msg.ids:[]);
  chrome.storage.local.get({rildonProcuraQueue:[]},data=>{
   const queue=(data.rildonProcuraQueue||[]).filter(x=>!ids.has(x.id));
   chrome.storage.local.set({rildonProcuraQueue:queue},()=>respond({ok:true}));
  });return true;
 }
});

// Contexto da busca: associa a confirmação na janela popup ao item exibido na pesquisa.
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
 if(msg?.type==='RILDON_PROCURA_DIAG'){
  chrome.storage.local.set({rildonProcuraDiag:{stage:msg.stage,url:msg.url,at:new Date().toISOString()}},()=>respond({ok:true}));return true;
 }
 if(msg?.type==='RILDON_PROCURA_CONTEXT'){
  const item=msg.item||{};
  chrome.storage.local.set({rildonProcuraContext:item},()=>respond({ok:true}));return true;
 }
 if(msg?.type==='RILDON_X2_PROCURA_CONFIRMED'){
  const raw=msg.item||{};
  chrome.storage.local.get({rildonProcuraContext:null,rildonProcuraQueue:[]},data=>{
   const ctx=data.rildonProcuraContext;
   const fresh=ctx&&Date.now()-ctx.at<120000;
   const item={...raw};
   if(fresh){item.code=ctx.code;item.desc=ctx.desc;item.reference=ctx.reference;item.price=ctx.price;item.availableQty=ctx.availableQty;item.seller=ctx.seller;}
   if(!item.code&&item.popupCode)item.code=item.popupCode;
   if(!item.desc)item.desc=item.popupDesc||'';
   const queue=data.rildonProcuraQueue||[];
   // Bloqueia somente retransmissões do mesmo evento, nunca uma nova sinalização.
   if(queue.some(x=>x.id===item.id)){respond({ok:true,duplicate:true});return;}
   queue.push(item);
   chrome.storage.local.set({rildonProcuraQueue:queue.slice(-1500),rildonProcuraDiag:{stage:'confirmed',url:item.sourceUrl,at:item.capturedAt}},()=>respond({ok:true}));
  });return true;
 }
});
