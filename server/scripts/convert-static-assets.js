import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const assetsRoot = fileURLToPath(new URL('../../client/src/assets', import.meta.url));
const maxEdge = 1600;

async function collectPngs(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectPngs(entryPath));
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.png') files.push(entryPath);
  }

  return files;
}

const pngFiles = await collectPngs(assetsRoot);

for (const inputPath of pngFiles) {
  const outputPath = inputPath.replace(/\.png$/i, '.webp');
  const metadata = await sharp(inputPath).metadata();
  const image = sharp(inputPath);
  const edge = Math.max(metadata.width || 0, metadata.height || 0);

  if (edge > maxEdge) image.resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true });
  await image.webp({ quality: 82, effort: 4 }).toFile(outputPath);
  console.log(`${path.relative(assetsRoot, inputPath)} -> ${path.relative(assetsRoot, outputPath)}`);
}

console.log(`Converted ${pngFiles.length} PNG assets to WebP.`);