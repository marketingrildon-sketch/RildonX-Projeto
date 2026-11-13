const RILDON_FABRICANTES = ["12M MEDIDORES", "3-RHO", "AEC ARRANQUES E ALTERNADORES", "AEROFLEX", "ALMAPY", "ALTERNATIVE", "AMEFIL", "AMS", "ARIELO", "ARTEB", "ASX", "AUTOMAXX", "AUTOPOLI", "BASTOS JUNTAS", "BC CABOS", "BERGSON", "BEST SOLDAS", "BILBAO", "BOBINAUTO", "BOSCH", "BRITE", "BUILDING", "BZM", "CAR80", "CARTO", "CAST SOLDAS", "CAV", "CEMAK", "CECOSAR", "CINAP", "CINOV", "CONIMEL", "CONTACT", "CONTINENTAL", "DAYLUX", "DELCO REMY", "DELPHI", "DIAL INTERRUPTORES", "DIRETEC", "DIVERSOS P/ USO E CONSUMO", "DML", "DNI", "D PAULA", "DPL", "DRIFT DO BRASIL", "DSC", "D.S. SCHIAVETTO", "EDANTI", "ELETRICWAY", "ELLEN", "ENGATCAR", "ETESSADAHNIAR", "EUROMOLD", "EXCELITE", "FACOBRAS", "FACOEX", "FEK", "FERIAT", "FIAMM", "FILTROS BRASIL", "FORNECEDORES DIVERSOS", "FORTLUZ", "FRONTEC", "GAPBR", "GAUSS", "GBM", "G BUSCH", "GE", "GLK", "GM", "HBR BRASIL", "IGUACU", "IKRO", "ILG", "INDEBRAS", "INDIEL", "INDUTEC", "INTERMEC", "JLC", "KATHO COMPONENTES DE FREIOS", "KAUAI AUTOMOTIVO", "KHELLER", "KOSTAL", "KTR", "LCG", "LUCAS", "MARFLEX", "MARILIA", "MARVIN", "MARZU", "MCM BOBINAS", "MECABRAZIL", "MG MANGUEIRAS", "MOBENSANI", "MTE", "MULTILIGHT", "MULTI QUALITA", "NEGRÃO", "NEOLUX", "NEW COIL", "NGK", "NINO FARÓIS", "NSK", "OLIMPIC", "ORBI", "OSPINA", "OSRAM", "PARKER", "PERFECT", "PHILIPS", "PLATINAC", "POLO", "PRADOLUX", "PREMIER BOBINAS", "PRIME PARTS", "PROGERAL", "RECRIN ORIGINAL", "REXON", "SEG AUTOMOTIVE", "SHERMAN", "SIEMENS", "SINDAL", "SKF", "SPEED BRAKE", "SULCARBON", "SUPRENS", "TANCLICK", "TC CHICOTES", "TECFIL FILTROS", "THERMOVAL VALVULAS", "TIGER AUTO", "TORPA", "TOTAL SUL", "TROMAR", "TSA", "UEDA", "UETA", "UNIAO JM", "UNIFAP", "USIFIO", "VALEO", "VANZO", "VARVINI", "VENKA", "VETOR", "VETTORE E BRAGA", "VOLDA", "VOX FILTROS", "VP", "WEGA MOTORS", "WILLTEC", "WISA", "YMAX", "ZEN", "ZM", "ZWF"];
const RILDON_ALIASES = {"SEG": "SEG AUTOMOTIVE", "POLO": "POLO", "DNI": "DNI", "MARÍLIA": "MARILIA", "MTE THOMSON": "MTE", "MTE-THOMSON": "MTE", "DS": "D.S. SCHIAVETTO"};
function rildonFabricante(desc,ref){
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
 const chunks=normalize(desc).split(/\s+-\s+/).map(s=>s.trim()).filter(Boolean);
 const options=Object.keys(RILDON_ALIASES).concat(RILDON_FABRICANTES).sort((a,b)=>b.length-a.length);
 // Check only trailing manufacturer segments, not car make/model names earlier in description.
 for(const chunk of chunks.slice(-3).reverse()){
  for(const candidate of options){
   const name=normalize(candidate);
   if(chunk===name || chunk.startsWith(name+' ') || chunk.startsWith(name+'/')){
    return RILDON_ALIASES[candidate]||candidate;
   }
  }
 }
 // Do not guess manufacturer from an arbitrary supplier code.
 return 'Não identificado';
}

(()=>{
const trim=s=>(s||'').replace(/\s+/g,' ').trim();
const decimal=s=>{const t=String(s??'0').trim();return Number(t.includes(',')?t.replace(/\./g,'').replace(',','.'):t)};
function collect(){
 const cards=[...document.querySelectorAll('input[name^="qnt_produto_"]')].map(q=>q.closest('.card')||q.closest('[id^="anc_"]')).filter((c,i,a)=>c&&a.indexOf(c)===i);
 if(!cards.length)return null;
 const txt=trim(document.body.innerText.slice(0,5000));
 const order=txt.match(/Carrinho\s*N[ºo°.]?\s*(\d+)/i)?.[1]||'';
 const seller=txt.match(/Carrinho\s+Aberto\s+por\s+(.+?)\s+em\s+\d{2}\/\d{2}\/\d{4}/i)?.[1]||'';
 const items=cards.map(card=>{
  const itemId=card.querySelector('input[name="ids_carrinho_produto"]')?.value||'';
  const qtyEl=card.querySelector('input[name^="qnt_produto_"]');
  const priceEl=card.querySelector('input[name^="vl_unidade_"]');
  const link=[...card.querySelectorAll('a')].find(a=>/C[oó]digo Produto\s+\d+/i.test(a.textContent));
  const line=trim(link?.textContent||'');const match=line.match(/C[oó]digo Produto\s+(\d+)\s*-\s*(.*)/i);
  const fornecedor=trim(card.innerText).match(/C[oó]digo Fornecedor\s*:\s*([^\n]+)/i)?.[1]||'';
  const stock=trim(card.innerText).match(/Estoque Dispon[ií]vel\s*:\s*([\d.,]+)/i)?.[1];
  const liberated=trim(card.innerText).match(/Estoque Liberado\s*:\s*([\d.,]+)/i)?.[1];
  const qty=decimal(qtyEl?.value||'0'),price=decimal(priceEl?.value||'0');
  const brand=rildonFabricante(match?.[2]||'',fornecedor);
  const partial=stock!==undefined&&decimal(stock)>0;
  return {manufacturer:brand,itemId,code:match?.[1]||'',description:match?.[2]||line,reference:fornecedor,qty,price,stock:stock===undefined?null:decimal(stock),liberated:liberated===undefined?null:decimal(liberated),type:partial?'parcial':'sem_estoque'};
 }).filter(x=>x.itemId&&x.qty>0&&Number.isFinite(x.price)&&x.stock!==null&&x.qty>x.stock);
 return {order,seller,items,capturedAt:new Date().toISOString(),source:'X2 - carrinho aberto'};
}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(msg?.type!=='RILDON_READ_CART')return;
 const data=collect();reply(data||{error:'Nenhum produto em falta encontrado neste frame.'});
});
})();