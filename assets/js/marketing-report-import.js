import '../css/sales-time-off.css';

const MAX_PDF_PAGES = 12;
const OCR_ASSET_PATH = new URL('assets/marketing-ocr/', document.baseURI).href;

function isImage(file) {
  return /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(file.name);
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
}

function textFromPdfPage(page) {
  return page.getTextContent().then(function (content) {
    return (content.items || []).map(function (item) { return item.str || ''; }).join('\n');
  });
}

async function recognizeImage(image) {
  const tesseract = await import('tesseract.js');
  const worker = await tesseract.createWorker('por', 1, {
    workerPath: OCR_ASSET_PATH + 'worker.min.js',
    corePath: OCR_ASSET_PATH,
    langPath: OCR_ASSET_PATH,
    workerBlobURL: false,
    logger: function (message) {
      if (message.status === 'recognizing text' && typeof window.showToast === 'function') {
        window.showToast('Lendo imagem: ' + Math.round((message.progress || 0) * 100) + '%');
      }
    }
  });
  try {
    const result = await worker.recognize(image);
    return result.data.text || '';
  } finally {
    await worker.terminate();
  }
}

async function extractPdfText(file) {
  const pdfjsLib = await import('pdfjs-dist');
  const pdfWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new Error('O PDF tem ' + pdf.numPages + ' páginas. Para evitar uma leitura incompleta, envie um arquivo com até ' + MAX_PDF_PAGES + ' páginas.');
  }
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    pages.push({ page: page, text: await textFromPdfPage(page) });
  }
  const extracted = pages.map(function (entry) { return entry.text; }).join('\n');
  if (normalizeText(extracted).length >= 20) return extracted;

  const tesseract = await import('tesseract.js');
  const worker = await tesseract.createWorker('por', 1, {
    workerPath: OCR_ASSET_PATH + 'worker.min.js',
    corePath: OCR_ASSET_PATH,
    langPath: OCR_ASSET_PATH,
    workerBlobURL: false,
    logger: function (message) {
      if (message.status === 'recognizing text' && typeof window.showToast === 'function') {
        window.showToast('Lendo PDF digitalizado: ' + Math.round((message.progress || 0) * 100) + '%');
      }
    }
  });
  try {
    const recognizedPages = [];
    for (const entry of pages) {
      const viewport = entry.page.getViewport({ scale: 1.6 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('O navegador não conseguiu preparar uma página do PDF para leitura.');
      await entry.page.render({ canvasContext: context, viewport: viewport }).promise;
      const result = await worker.recognize(canvas);
      recognizedPages.push(result.data.text || '');
      canvas.width = 0;
      canvas.height = 0;
    }
    return recognizedPages.join('\n');
  } finally {
    await worker.terminate();
  }
}

function parseSpreadsheet(file) {
  return Promise.all([file.arrayBuffer(), import('@e965/xlsx')]).then(function (loaded) {
    const buffer = loaded[0];
    const XLSX = loaded[1];
    const workbook = String(file.name || '').toLowerCase().endsWith('.csv')
      ? XLSX.read(new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, ''), { type: 'string', cellDates: true, raw: true })
      : XLSX.read(buffer, { type: 'array', cellDates: true, raw: true });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new Error('A planilha não contém abas para leitura.');
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
      header: 1,
      defval: '',
      raw: true,
      blankrows: false
    });
    if (!rows.length) throw new Error('A planilha está vazia.');
    return { rows: rows, text: '' };
  });
}

export async function readMarketingReport(file) {
  if (!file) throw new Error('Selecione um arquivo para importar.');
  const extension = String(file.name || '').split('.').pop().toLowerCase();
  if (isImage(file)) return { rows: [], text: await recognizeImage(file), fileName: file.name };
  if (extension === 'pdf' || file.type === 'application/pdf') {
    return { rows: [], text: await extractPdfText(file), fileName: file.name };
  }
  if (['csv', 'xls', 'xlsx'].indexOf(extension) !== -1) {
    return Object.assign(await parseSpreadsheet(file), { fileName: file.name });
  }
  if (/^image\//i.test(String(file.type || ''))) {
    throw new Error('Formato de imagem não suportado. Use PNG, JPG, WebP, BMP ou TIFF.');
  }
  throw new Error('Formato não suportado. Envie CSV, XLS, XLSX, PDF ou uma imagem PNG/JPG/WebP/BMP/TIFF.');
}

function metricDefinition(header) {
  const value = normalizeText(header);
  const definitions = [
    { key: 'reach', label: 'Alcance', category: 'Visibilidade', aliases: ['alcance', 'reach', 'accounts reached', 'contas alcancadas', 'pessoas alcancadas'] },
    { key: 'impressions', label: 'Impressões', category: 'Visibilidade', aliases: ['impressao', 'impressions', 'views', 'visualizacoes', 'impressoes'] },
    { key: 'followers', label: 'Seguidores', category: 'Visibilidade', aliases: ['seguidores', 'followers', 'follows', 'new followers'] },
    { key: 'engagement', label: 'Engajamentos', category: 'Engajamento', aliases: ['engajamento', 'engagement', 'interacoes', 'interactions', 'engaged', 'reacoes', 'curtidas', 'comments', 'comentarios', 'shares', 'compartilhamentos', 'saves', 'salvamentos'] },
    { key: 'clicks', label: 'Cliques', category: 'Oportunidades', aliases: ['cliques', 'clicks', 'link clicks', 'outbound clicks'] },
    { key: 'sessions', label: 'Sessões', category: 'Oportunidades', aliases: ['sessoes', 'sessions', 'visitas'] },
    { key: 'leads', label: 'Leads', category: 'Oportunidades', aliases: ['leads', 'oportunidades', 'contatos'] },
    { key: 'conversions', label: 'Conversões', category: 'Oportunidades', aliases: ['conversoes', 'conversions', 'purchases', 'compras', 'key events'] },
    { key: 'spend', label: 'Investimento', category: 'Oportunidades', aliases: ['investimento', 'spend', 'amount spent', 'valor gasto', 'cost', 'custo'] },
    { key: 'revenue', label: 'Receita', category: 'Oportunidades', aliases: ['receita', 'revenue', 'conversion value', 'purchase revenue', 'valor de conversao'] }
  ];
  return definitions.find(function (definition) {
    return definition.aliases.some(function (alias) {
      const normalizedAlias = normalizeText(alias);
      return value === normalizedAlias || value.indexOf(normalizedAlias) !== -1;
    });
  }) || null;
}

function numberValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let text = String(value || '').trim().replace(/[^\d,.-]/g, '');
  if (!text || !/\d/.test(text)) return null;
  if (text.indexOf(',') !== -1 && text.indexOf('.') !== -1) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.')
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '');
  } else if (text.indexOf(',') !== -1) {
    text = text.replace(',', '.');
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function monthValue(value, fallback) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getFullYear() + '-' + String(value.getMonth() + 1).padStart(2, '0');
  }
  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?/);
  if (iso) return iso[1] + '-' + String(Number(iso[2])).padStart(2, '0');
  const br = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (br) return String(Number(br[3]) < 100 ? 2000 + Number(br[3]) : Number(br[3])) + '-' + String(Number(br[2])).padStart(2, '0');
  const monthYear = text.match(/^(\d{1,2})[/-](\d{4})$/);
  if (monthYear) return monthYear[2] + '-' + String(Number(monthYear[1])).padStart(2, '0');
  return fallback || '';
}

function headerIndex(headers, matcher) {
  return headers.findIndex(function (header) { return matcher(normalizeText(header)); });
}

function recordsFromRows(rows, fallbackMonth) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const limit = Math.min(rows.length, 10);
  let headerRow = -1;
  let metricColumns = [];
  let metaColumns = {};
  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const headers = rows[rowIndex].map(String);
    const columns = headers.map(function (header, columnIndex) {
      const definition = metricDefinition(header);
      return definition ? { columnIndex: columnIndex, definition: definition } : null;
    }).filter(Boolean);
    if (columns.length) {
      headerRow = rowIndex;
      metricColumns = columns;
      metaColumns = {
        date: headerIndex(headers, function (text) { return /(^| )(date|data|period|periodo|month|mes|dia)( |$)/.test(text); }),
        channel: headerIndex(headers, function (text) { return /^(channel|canal|platform|plataforma|account|conta)$/.test(text); }),
        campaign: headerIndex(headers, function (text) { return /campaign|campanha/.test(text); })
      };
      break;
    }
  }
  if (headerRow < 0) {
    const headers = rows[0].map(String);
    const metricColumn = headerIndex(headers, function (text) { return /^(metric|metrica|indicador)$/.test(text); });
    const valueColumn = headerIndex(headers, function (text) { return /^(value|valor|amount|total)$/.test(text); });
    if (metricColumn < 0 || valueColumn < 0) return [];
    const dateColumn = headerIndex(headers, function (text) { return /^(date|data|period|periodo|month|mes|dia)$/.test(text); });
    const channelColumn = headerIndex(headers, function (text) { return /^(channel|canal|platform|plataforma)$/.test(text); });
    const campaignColumn = headerIndex(headers, function (text) { return /campaign|campanha/.test(text); });
    return rows.slice(1).reduce(function (result, row) {
      const definition = metricDefinition(row[metricColumn]);
      const value = numberValue(row[valueColumn]);
      const month = monthValue(dateColumn >= 0 ? row[dateColumn] : '', fallbackMonth);
      if (!definition || value === null || !month) return result;
      result.push({
        metric: definition.key,
        label: definition.label,
        category: definition.category,
        value: value,
        month: month,
        channel: channelColumn >= 0 ? String(row[channelColumn] || '').trim() : '',
        campaign: campaignColumn >= 0 ? String(row[campaignColumn] || '').trim() : ''
      });
      return result;
    }, []);
  }
  const result = [];
  rows.slice(headerRow + 1).forEach(function (row) {
    const seenMetrics = new Set();
    const values = metricColumns.map(function (column) {
      return { definition: column.definition, value: numberValue(row[column.columnIndex]) };
    }).filter(function (metric) {
      if (metric.value === null || seenMetrics.has(metric.definition.key)) return false;
      seenMetrics.add(metric.definition.key);
      return true;
    });
    if (!values.length) return;
    const month = monthValue(metaColumns.date >= 0 ? row[metaColumns.date] : '', fallbackMonth);
    if (!month) return;
    values.forEach(function (metric) {
      result.push({
        metric: metric.definition.key,
        label: metric.definition.label,
        category: metric.definition.category,
        value: metric.value,
        month: month,
        channel: metaColumns.channel >= 0 ? String(row[metaColumns.channel] || '').trim() : '',
        campaign: metaColumns.campaign >= 0 ? String(row[metaColumns.campaign] || '').trim() : ''
      });
    });
  });
  return result;
}

function recordsFromText(text, fallbackMonth) {
  const output = [];
  String(text || '').split(/\r?\n/).forEach(function (line) {
    const parts = line.trim().match(/^(.{2,60}?)(?:\s*[:|;\t]\s*|\s+)([-+]?\d[\d.,\s]*)\s*$/);
    if (!parts) return;
    const definition = metricDefinition(parts[1]);
    const value = numberValue(parts[2]);
    if (!definition || value === null || !fallbackMonth) return;
    output.push({
      metric: definition.key,
      label: definition.label,
      category: definition.category,
      value: value,
      month: fallbackMonth,
      channel: '',
      campaign: ''
    });
  });
  return output;
}

export function normalizeMarketingReport(report, fallbackMonth) {
  const month = monthValue(fallbackMonth, '');
  const records = recordsFromRows(report.rows || [], month);
  const extracted = records.length ? records : recordsFromText(report.text || '', month);
  if (!extracted.length) {
    throw new Error('Não encontrei métricas reconhecíveis neste arquivo. Use colunas como Data, Canal, Campanha, Alcance, Impressões, Engajamentos, Cliques, Leads, Conversões ou Receita.');
  }
  return extracted;
}

window.RildonXMarketingReportImport = {
  read: readMarketingReport,
  normalize: normalizeMarketingReport
};
window.dispatchEvent(new Event('rildonx-marketing-import-ready'));
