import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
var isProductionBuild = false;
const pages = [
  'index',
  'mural',
  'mensagens',
  'calendario',
  'tarefas',
  'projetos',
  'documentos',
  'pessoas',
  'meu-espaco',
  'ajuda',
  'perfil',
  'configuracoes',
  'login'
];

export default defineConfig({
  base: './',
  plugins: [{
    name: 'copy-static-assets',
    configResolved: function(config) {
      isProductionBuild = config.command === 'build';
    },
    transformIndexHtml: function(html) {
      if (isProductionBuild) return html;
      return html.replace(
        /\b(src|href)=(["'])((?:\.\/)?assets\/[^"'?#]+)(?:\?[^"'#]*)?(#[^"']*)?\2/gi,
        function(match, attribute, quote, assetPath, fragment) {
          var relativePath = assetPath.replace(/^\.\//, '');
          var filePath = resolve(root, relativePath);
          var hash = createHash('sha256')
            .update(readFileSync(filePath))
            .digest('hex')
            .slice(0, 16);
          return attribute + '=' + quote + assetPath + '?v=' + hash +
            (fragment || '') + quote;
        }
      );
    },
    closeBundle: function() {
      if (!isProductionBuild) return;
      var outputAssets = resolve(root, 'dist', 'assets');
      mkdirSync(outputAssets, { recursive: true });
      cpSync(resolve(root, 'assets'), outputAssets, { recursive: true });
      cpSync(resolve(root, 'icones_personalizados'), resolve(root, 'dist', 'icones_personalizados'), { recursive: true });

      function collectFiles(directory) {
        return readdirSync(directory, { withFileTypes: true }).flatMap(function(entry) {
          var entryPath = resolve(directory, entry.name);
          return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
        });
      }

      function hashFile(filePath) {
        return createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 16);
      }

      var assetVersions = {};
      collectFiles(outputAssets).forEach(function(filePath) {
        var relativePath = filePath.slice(outputAssets.length + 1).replace(/\\/g, '/');
        assetVersions['assets/' + relativePath] = hashFile(filePath);
      });

      var releaseHasher = createHash('sha256');
      pages.forEach(function(page) {
        var outputPage = resolve(root, 'dist', page + '.html');
        releaseHasher.update(page + '.html\0');
        releaseHasher.update(readFileSync(outputPage));
      });
      releaseHasher.update('vite.config.js\0' + hashFile(resolve(root, 'vite.config.js')) + '\0');
      Object.keys(assetVersions).sort().forEach(function(assetPath) {
        releaseHasher.update(assetPath + '\0' + assetVersions[assetPath] + '\0');
      });
      var releaseVersion = releaseHasher.digest('hex').slice(0, 16);
      writeFileSync(resolve(root, 'dist', 'version.json'), JSON.stringify({ version: releaseVersion }));

      pages.forEach(function(page) {
        var outputPage = resolve(root, 'dist', page + '.html');
        var html = readFileSync(outputPage, 'utf8').replace(
          /\b(src|href)=(["'])((?:\.\/)?assets\/[^"'?#]+)(?:\?[^"'#]*)?(#[^"']*)?\2/gi,
          function(match, attribute, quote, assetPath, fragment) {
            var normalizedPath = assetPath.replace(/^\.\//, '');
            var assetVersion = assetVersions[normalizedPath];
            if (!assetVersion) {
              throw new Error('Não foi possível gerar a versão do recurso local: ' + assetPath);
            }
            return attribute + '=' + quote + assetPath + '?v=' + assetVersion +
              (fragment || '') + quote;
          }
        );
        if (!/href=["'](?:\.\/)?assets\/css\/styles\.css(?:\?[^"']*)?["']/i.test(html)) {
          html = html.replace(
            /<\/head>/i,
            '<link rel="stylesheet" href="./assets/css/styles.css?v=' + assetVersions['assets/css/styles.css'] + '">\n</head>'
          );
        }
        html = html.replace(
          /<\/head>/i,
          '<script>window.RildonXBuildVersion = ' + JSON.stringify(releaseVersion) +
            '; window.RildonXAssetVersions = ' + JSON.stringify({
              'assets/css/support-center.css': assetVersions['assets/css/support-center.css'],
              'assets/css/infrastructure-center.css': assetVersions['assets/css/infrastructure-center.css']
            }) + ';</script>\n' +
            '<script defer src="./assets/js/update-notifier.js?v=' +
            assetVersions['assets/js/update-notifier.js'] + '"></script>\n</head>'
        );
        writeFileSync(outputPage, html);
      });
    }
  }],
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map(function(page) {
        return [page, resolve(root, page + '.html')];
      }))
    }
  }
});
