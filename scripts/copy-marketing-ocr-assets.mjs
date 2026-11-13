import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(projectRoot, 'dist', 'assets', 'marketing-ocr');
const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm', 'tesseract-core-simd-lstm.wasm'],
  ['node_modules/@tesseract.js-data/por/4.0.0/por.traineddata.gz', 'por.traineddata.gz']
];

await mkdir(target, { recursive: true });
await Promise.all(files.map(function (entry) {
  return copyFile(path.join(projectRoot, entry[0]), path.join(target, entry[1]));
}));
