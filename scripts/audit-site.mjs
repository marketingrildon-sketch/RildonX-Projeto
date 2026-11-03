import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteUrl = process.env.SITE_URL || 'https://marketingrildon-sketch.github.io/RildonX-Projeto/';
const edgeFunctionUrl = process.env.EMPLOYEE_FUNCTION_URL ||
  'https://lgzokudzdezgufddoicy.supabase.co/functions/v1/invite-rildonx-user';
const failures = [];

function fail(message) {
  failures.push(message);
  console.error('FALHA: ' + message);
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && (entry.name === '.git' || entry.name === 'node_modules')) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function localFilePath(reference, sourceFile) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) return null;
  let pathname;
  try {
    const sourceRelative = path.relative(root, sourceFile).split(path.sep).join('/');
    const baseUrl = new URL(sourceRelative, 'https://audit.invalid/');
    pathname = decodeURIComponent(new URL(reference, baseUrl).pathname);
  } catch (error) {
    throw new Error('URL local inválida "' + reference + '": ' + error.message);
  }
  const targetRelative = pathname.replace(/^\/+/, '');
  const resolved = path.resolve(root, ...path.posix.normalize(targetRelative).split('/'));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('Referência sai da pasta do site: "' + reference + '".');
  }
  return resolved;
}

async function checkLocalReferences(sourceFile, content, pattern) {
  for (const match of content.matchAll(pattern)) {
    const reference = (match[1] || match[2] || '').trim();
    if (!reference || /^(?:data:|blob:|javascript:|mailto:|tel:)/i.test(reference)) continue;
    let target;
    try {
      target = localFilePath(reference, sourceFile);
    } catch (error) {
      fail(path.relative(root, sourceFile) + ': ' + error.message);
      continue;
    }
    if (!target) continue;
    try {
      await stat(target);
    } catch (error) {
      fail(path.relative(root, sourceFile) + ' referencia arquivo inexistente: ' + reference);
    }
  }
}

async function checkHtmlAndAssets() {
  const requiredPages = [
    'index.html', 'login.html', 'mural.html', 'mensagens.html', 'calendario.html',
    'tarefas.html', 'projetos.html', 'documentos.html', 'meu-espaco.html',
    'pessoas.html', 'perfil.html', 'configuracoes.html', 'ajuda.html'
  ];
  for (const page of requiredPages) {
    try {
      await stat(path.join(root, page));
    } catch (error) {
      fail('Página obrigatória ausente: ' + page);
    }
  }

  const htmlFiles = (await filesUnder(root)).filter(function (file) {
    return file.endsWith('.html');
  });
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    await checkLocalReferences(file, html, /(?:^|\s)(?:src|href|poster|action)\s*=\s*["']([^"']+)["']/gi);
  }

  const assetRoot = path.join(root, 'assets');
  const assetFiles = await filesUnder(assetRoot);
  const cssFiles = assetFiles.filter(function (file) { return file.endsWith('.css'); });
  for (const file of cssFiles) {
    const css = await readFile(file, 'utf8');
    await checkLocalReferences(file, css, /url\(\s*["']?([^"')]+)["']?\s*\)/gi);
  }

  const jsRoot = path.join(assetRoot, 'js');
  const jsFiles = (await filesUnder(jsRoot)).filter(function (file) { return file.endsWith('.js'); });
  for (const file of jsFiles) {
    const source = await readFile(file, 'utf8');
    try {
      execFileSync(process.execPath, ['--check', '--input-type=module'], {
        cwd: root,
        input: source,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error) {
      const detail = error.stderr ? String(error.stderr).trim() : error.message;
      fail('Sintaxe JavaScript inválida em ' + path.relative(root, file) + ': ' + detail);
    }
    await checkLocalReferences(file, source, /(?:import|export)\s+(?:[^'"]*?\s+from\s*)?["']((?:\.{1,2}\/|\/)[^"']+)["']|import\(\s*["']((?:\.{1,2}\/|\/)[^"']+)["']\s*\)/g);
  }
  console.log('Site estático: ' + htmlFiles.length + ' páginas, ' + cssFiles.length +
    ' folhas CSS e ' + jsFiles.length + ' scripts JavaScript verificados.');
}

async function checkProductionHealth() {
  const siteResponse = await fetch(siteUrl, { signal: AbortSignal.timeout(20000) });
  if (!siteResponse.ok) throw new Error('GitHub Pages respondeu HTTP ' + siteResponse.status + '.');
  const page = await siteResponse.text();
  if (!page.toLowerCase().includes('<html')) throw new Error('A URL publicada não retornou uma página HTML.');
  console.log('GitHub Pages: HTTP ' + siteResponse.status + '.');

  const origin = new URL(siteUrl).origin;
  const response = await fetch(edgeFunctionUrl, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,apikey,content-type,x-client-info'
    },
    signal: AbortSignal.timeout(20000)
  });
  const allowedOrigin = response.headers.get('access-control-allow-origin');
  const allowedMethods = response.headers.get('access-control-allow-methods') || '';
  if (!response.ok) throw new Error('Preflight da função de cadastro respondeu HTTP ' + response.status + '.');
  if (allowedOrigin !== origin) {
    throw new Error('CORS da função de cadastro não permite a origem publicada. Esperado "' +
      origin + '", recebido "' + (allowedOrigin || 'ausente') + '".');
  }
  if (!allowedMethods.split(',').some(function (method) { return method.trim().toUpperCase() === 'POST'; })) {
    throw new Error('CORS da função de cadastro não permite POST.');
  }
  console.log('Edge Function de cadastro: preflight CORS aceito para ' + origin + '.');
}

await checkHtmlAndAssets();
try {
  await checkProductionHealth();
} catch (error) {
  fail('Saúde dos serviços publicados: ' + error.message);
}

if (failures.length) {
  console.error('\nAuditoria terminou com ' + failures.length + ' falha(s).');
  process.exitCode = 1;
} else {
  console.log('\nAuditoria concluída sem falhas.');
}
