const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'assets', 'images');
const manifestPath = path.join(sourceRoot, 'manifest.json');
const widths = [480, 800, 1200, 1600];
const exts = new Set(['.jpg', '.jpeg', '.png']);

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function walk(dir) {
  if (!(await exists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (exts.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

async function removeThumbDirs(dir) {
  if (!(await exists(dir))) return;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name === 'thumb') await fs.rm(full, { recursive: true, force: true });
    else await removeThumbDirs(full);
  }
}

function publicPath(file) {
  return file.split(path.sep).join('/');
}

function thumbDirFor(absPath) {
  const parts = absPath.split(path.sep);
  const fullIndex = parts.lastIndexOf('full');
  if (fullIndex === -1) return null;
  parts[fullIndex] = 'thumb';
  parts.pop();
  return parts.join(path.sep);
}

async function optimizeOne(absPath, relPath) {
  const outDir = thumbDirFor(absPath);
  if (!outDir) return null;

  const image = sharp(absPath, { limitInputPixels: false });
  const meta = await image.metadata();
  if (!meta.width || !meta.height) return null;

  const parsed = path.parse(relPath);
  const candidates = widths.filter((w) => w <= meta.width);
  if (!candidates.includes(meta.width) && meta.width < widths[0]) candidates.push(meta.width);
  const finalWidths = [...new Set(candidates.length ? candidates : [meta.width])].sort((a, b) => a - b);
  const variants = { avif: [], webp: [], jpeg: [] };

  await fs.mkdir(outDir, { recursive: true });

  for (const width of finalWidths) {
    const height = Math.round((meta.height / meta.width) * width);
    const base = sharp(absPath, { limitInputPixels: false }).rotate().resize({ width, withoutEnlargement: true });

    const avifName = `${parsed.name}-${width}.avif`;
    const webpName = `${parsed.name}-${width}.webp`;
    const jpgName = `${parsed.name}-${width}.jpg`;

    const avifPath = path.join(outDir, avifName);
    const webpPath = path.join(outDir, webpName);
    const jpgPath = path.join(outDir, jpgName);

    await base.clone().avif({ quality: 50, effort: 4 }).toFile(avifPath);
    await base.clone().webp({ quality: 80, effort: 5 }).toFile(webpPath);
    await base.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(jpgPath);

    variants.avif.push({ width, height, src: publicPath(path.relative(root, avifPath)) });
    variants.webp.push({ width, height, src: publicPath(path.relative(root, webpPath)) });
    variants.jpeg.push({ width, height, src: publicPath(path.relative(root, jpgPath)) });
  }

  return {
    original: publicPath(relPath),
    width: meta.width,
    height: meta.height,
    variants,
  };
}

async function main() {
  await removeThumbDirs(sourceRoot);

  const allFiles = await walk(sourceRoot);
  const fullFiles = allFiles
    .map((file) => path.relative(root, file))
    .filter((rel) => rel.split(path.sep).includes('full'))
    .sort();

  const manifest = {};
  let index = 0;
  for (const rel of fullFiles) {
    index += 1;
    console.log(`[${index}/${fullFiles.length}] ${publicPath(rel)}`);
    const result = await optimizeOne(path.join(root, rel), rel);
    if (result) manifest[publicPath(rel)] = result;
  }

  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${Object.keys(manifest).length} manifest entries to ${path.relative(root, manifestPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
