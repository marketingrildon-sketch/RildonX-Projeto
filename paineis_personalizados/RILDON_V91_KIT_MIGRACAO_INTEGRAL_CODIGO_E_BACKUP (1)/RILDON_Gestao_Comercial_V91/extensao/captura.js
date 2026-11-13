(() => {
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  const centavos = s => {
    const m = norm(s).match(/R\$\s*([\d.]+),(\d{2})/);
    return m ? Number(m[1].replace(/\./g, '')) * 100 + Number(m[2]) : null;
  };
  const title = [...document.querySelectorAll('div.normal')].map(x=>norm(x.textContent)).find(x=>/Produtos vendidos no per[ií]odo/i.test(x)) || '';
  const period = title.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/);
  if (!period || period[1] !== period[2]) return; // somente relatórios de um dia
  const registros = [];
  for (const th of document.querySelectorAll('th.grid_left')) {
    const heading = norm(th.textContent);
    if (!/^VENDEDOR\s*:/i.test(heading)) continue;
    const tabela = th.closest('table')?.nextElementSibling;
    if (!tabela || tabela.tagName !== 'TABLE') continue;
    const row = [...tabela.querySelectorAll('tfoot tr')].find(tr => {
      const tds=tr.querySelectorAll('td');
      return tds.length > 1 && norm(tds[0].textContent).toUpperCase() === 'TOTAL';
    });
    if (!row) continue;
    const totalCentavos = centavos(row.querySelector('td:last-child')?.textContent);
    if (totalCentavos === null) continue;
    const nomeX2 = heading.replace(/^VENDEDOR\s*:\s*/i,'');
    registros.push({nomeX2, canal: /\(DIST\)/i.test(nomeX2) ? 'distribuidora' : /\bB2B\b/i.test(nomeX2) ? 'b2b' : 'matriz', totalCentavos});
  }
  if (!registros.length) return;
  const [dia,mes,ano] = period[1].split('/');
  const data = `${ano}-${mes}-${dia}`;
  const totalCentavos = registros.reduce((s,r)=>s+r.totalCentavos,0);
  const geral = [...document.querySelectorAll('table#tabela tfoot tr')].find(tr=>norm(tr.querySelector('td')?.textContent).toUpperCase()==='TOTAL GERAL');
  const geralCentavos = geral ? centavos(geral.querySelector('td:last-child')?.textContent) : null;
  if (geralCentavos !== null && geralCentavos !== totalCentavos) {
    chrome.storage.local.set({erroCaptura:`Divergência em ${data}: ${totalCentavos} vs ${geralCentavos}`});
    return;
  }
  chrome.storage.local.get(['capturas'], ({capturas={}})=> {
    capturas[data] = {data, registros, totalCentavos, capturadoEm: new Date().toISOString(), origem:'X2 - relatório aberto no navegador'};
    chrome.storage.local.set({capturas, ultimaCaptura:data, erroCaptura:null});
  });
})();
