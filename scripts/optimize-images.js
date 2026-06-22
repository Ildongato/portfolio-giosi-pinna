const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const sourceRoots = ['images', path.join('assets', 'images', 'full')];
const outDir = path.join(root, 'images', 'optimized');
const manifestPath = path.join(outDir, 'manifest.json');
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

function slugify(rel) {
  const parsed = path.parse(rel);
  const noExt = path.join(parsed.dir, parsed.name).split(path.sep).join('__');
  return noExt
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function publicPath(file) {
  return file.split(path.sep).join('/');
}

async function optimizeOne(absPath, relPath) {
  const image = sharp(absPath, { limitInputPixels: false });
  const meta = await image.metadata();
  if (!meta.width || !meta.height) return null;

  const slug = slugify(relPath);
  const candidates = widths.filter((w) => w <= meta.width);
  if (!candidates.includes(meta.width) && meta.width < widths[0]) candidates.push(meta.width);
  const finalWidths = [...new Set(candidates.length ? candidates : [meta.width])].sort((a, b) => a - b);
  const variants = { avif: [], webp: [], jpeg: [] };

  await fs.mkdir(outDir, { recursive: true });

  for (const width of finalWidths) {
    const height = Math.round((meta.height / meta.width) * width);
    const base = sharp(absPath, { limitInputPixels: false }).rotate().resize({ width, withoutEnlargement: true });

    const avifName = `${slug}-${width}.avif`;
    const webpName = `${slug}-${width}.webp`;
    const jpgName = `${slug}-${width}.jpg`;

    await base.clone().avif({ quality: 50, effort: 4 }).toFile(path.join(outDir, avifName));
    await base.clone().webp({ quality: 80, effort: 5 }).toFile(path.join(outDir, webpName));
    await base.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(outDir, jpgName));

    variants.avif.push({ width, height, src: `images/optimized/${avifName}` });
    variants.webp.push({ width, height, src: `images/optimized/${webpName}` });
    variants.jpeg.push({ width, height, src: `images/optimized/${jpgName}` });
  }

  return {
    original: publicPath(relPath),
    width: meta.width,
    height: meta.height,
    variants,
  };
}

async function main() {
  const all = [];
  for (const relRoot of sourceRoots) {
    const absRoot = path.join(root, relRoot);
    const files = await walk(absRoot);
    for (const file of files) {
      const rel = path.relative(root, file);
      if (rel.includes(`${path.sep}optimized${path.sep}`)) continue;
      all.push(rel);
    }
  }

  const unique = [...new Set(all)].sort();
  const manifest = {};
  let index = 0;
  for (const rel of unique) {
    index += 1;
    console.log(`[${index}/${unique.length}] ${rel}`);
    const result = await optimizeOne(path.join(root, rel), rel);
    if (result) manifest[publicPath(rel)] = result;
  }

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${Object.keys(manifest).length} manifest entries to ${path.relative(root, manifestPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
