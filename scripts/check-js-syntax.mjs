import { readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set([
  '.git',
  '.venv',
  'coverage',
  'dist',
  'node_modules',
  'paineis_personalizados'
]);
const sourceFiles = [];

function collectJavaScriptFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name.toLowerCase())) continue;

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectJavaScriptFiles(entryPath);
    } else if (/\.(?:cjs|js|mjs)$/i.test(entry.name)) {
      sourceFiles.push(entryPath);
    }
  }
}

collectJavaScriptFiles(projectRoot);

let failures = 0;
for (const filePath of sourceFiles) {
  const result = spawnSync(process.execPath, ['--check', filePath], { stdio: 'inherit' });
  if (result.error) {
    console.error(`Could not check ${path.relative(projectRoot, filePath)}: ${result.error.message}`);
    failures += 1;
  } else if (result.status !== 0) {
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`JavaScript syntax check failed for ${failures} file(s).`);
  process.exitCode = 1;
} else {
  console.log(`JavaScript syntax check passed for ${sourceFiles.length} file(s).`);
}
