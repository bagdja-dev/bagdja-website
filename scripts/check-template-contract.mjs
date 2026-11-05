#!/usr/bin/env node
/**
 * R1 — cek konsistensi kontrak template renderer (template-contract.md §3).
 *
 * Tanpa dependensi: membaca sumber TS sebagai teks lalu memverifikasi bahwa
 *  1. setiap manifest di lib/template-manifests.ts terdaftar di
 *     lib/template-registry.ts (dan sebaliknya), rendererApiVersion = 1;
 *  2. setiap section yang dideklarasikan manifest ditangani View-nya
 *     (case di switch section, atau `hero`/`product_detail` di luar switch);
 *  3. setiap section sistem ditangani ketiga View;
 *  4. case di switch View = manifest ∪ section sistem (tidak ada section
 *     editor yang dirender tapi tidak dideklarasikan);
 *  5. `default:` switch memanggil warnUnknownSection('<slug>', ...);
 *  6. (opsional) identik dengan BUILTIN_TEMPLATE_MANIFESTS di
 *     bagdja-website-api bila repo tersebut ada di sebelah repo ini
 *     (override path lewat env BAGDJA_WEBSITE_API_DIR).
 *
 * Jalankan: `npm run check:contract`. Exit code 1 bila ada pelanggaran.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = process.env.BAGDJA_WEBSITE_API_DIR ?? resolve(ROOT, '..', 'bagdja-website-api');

const errors = [];
const fail = (message) => errors.push(message);

const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const stripLineComments = (source) => source.replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
const parseStringList = (body) => [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);

/** Ambil isi `{ ... }` / `[ ... ]` seimbang mulai dari indeks pembuka. */
function balancedBlock(source, openIndex) {
  const open = source[openIndex];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === open) depth += 1;
    else if (source[i] === close) {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  throw new Error(`Unbalanced block at ${openIndex}`);
}

function blockAfter(source, marker, opener) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Marker not found: ${marker}`);
  const openerIndex = source.indexOf(opener, start + marker.length);
  if (openerIndex < 0) throw new Error(`Opener "${opener}" not found after: ${marker}`);
  return balancedBlock(source, openerIndex + opener.length - 1);
}

/** Parse objek manifest `{ slug, version, rendererApiVersion, sections }` dari teks. */
function parseManifestEntries(block) {
  const entries = [];
  const re = /slug:\s*'([^']+)'[\s\S]*?version:\s*'([^']+)'[\s\S]*?rendererApiVersion:\s*([\w.]+)[\s\S]*?sections:\s*\[/g;
  let match;
  while ((match = re.exec(block)) !== null) {
    const listOpen = re.lastIndex - 1;
    const sections = parseStringList(balancedBlock(block, listOpen));
    entries.push({ slug: match[1], version: match[2], rendererApiVersion: match[3], sections });
  }
  return entries;
}

// --- 1. Manifest renderer & registry -------------------------------------
const manifestSource = stripLineComments(read('lib/template-manifests.ts'));
const builtBlock = blockAfter(manifestSource, 'export const BUILT_TEMPLATE_MANIFESTS', '= {');
const manifests = parseManifestEntries(builtBlock);
const systemSections = parseStringList(blockAfter(manifestSource, 'export const SYSTEM_SECTION_TYPES', '= ['));

if (manifests.length === 0) fail('No manifests parsed from lib/template-manifests.ts');
for (const manifest of manifests) {
  const keyPattern = new RegExp(`(^|[\\s{,])'?${manifest.slug.replace(/-/g, '\\-')}'?:\\s*\\{`);
  if (!keyPattern.test(builtBlock)) fail(`[${manifest.slug}] manifest key does not match its slug`);
  if (!['1', 'RENDERER_API_VERSION'].includes(manifest.rendererApiVersion)) {
    fail(`[${manifest.slug}] rendererApiVersion must be 1 (got ${manifest.rendererApiVersion})`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) fail(`[${manifest.slug}] version is not semver: ${manifest.version}`);
  const dupes = manifest.sections.filter((type, i, list) => list.indexOf(type) !== i);
  if (dupes.length > 0) fail(`[${manifest.slug}] duplicate sections: ${dupes.join(', ')}`);
  const systemInManifest = manifest.sections.filter((type) => systemSections.includes(type));
  if (systemInManifest.length > 0) fail(`[${manifest.slug}] system sections must not be declared: ${systemInManifest.join(', ')}`);
}

const registrySource = stripLineComments(read('lib/template-registry.ts'));
const registryBlock = blockAfter(registrySource, 'const TEMPLATE_REGISTRY', '= {');
const registry = new Map(
  [...registryBlock.matchAll(/'?([\w-]+)'?\s*:\s*(\w+)/g)].map((m) => [m[1], m[2]]),
);
const viewImports = new Map(
  [...registrySource.matchAll(/import\s*\{\s*(\w+)\s*\}\s*from\s*'(\.\.\/components\/templates\/[^']+)'/g)].map((m) => [
    m[1],
    `${m[2].replace(/^\.\.\//, '')}.tsx`,
  ]),
);

for (const manifest of manifests) {
  if (!registry.has(manifest.slug)) fail(`[${manifest.slug}] manifest has no entry in TEMPLATE_REGISTRY`);
}
for (const slug of registry.keys()) {
  if (!manifests.some((m) => m.slug === slug)) fail(`[${slug}] registered in TEMPLATE_REGISTRY but has no manifest`);
}

// --- 2–5. View section switch --------------------------------------------
const summary = [];
for (const manifest of manifests) {
  const viewName = registry.get(manifest.slug);
  const viewPath = viewName ? viewImports.get(viewName) : undefined;
  if (!viewPath) {
    fail(`[${manifest.slug}] cannot resolve View file for ${viewName ?? '(none)'}`);
    continue;
  }

  const source = read(viewPath);
  const switchIndex = source.indexOf('switch (section.type)');
  if (switchIndex < 0) {
    fail(`[${manifest.slug}] ${viewPath}: section switch not found`);
    continue;
  }
  const switchBody = balancedBlock(source, source.indexOf('{', switchIndex));
  const cases = new Set([...switchBody.matchAll(/case\s+'([^']+)'\s*:/g)].map((m) => m[1]));
  const outside = new Set(
    ['hero', 'product_detail'].filter((type) => new RegExp(`\\.type\\s*===\\s*'${type}'`).test(source)),
  );
  const handled = new Set([...cases, ...outside]);

  for (const type of manifest.sections) {
    if (!handled.has(type)) fail(`[${manifest.slug}] declared section "${type}" is not handled by ${viewPath}`);
  }
  for (const type of systemSections) {
    if (!handled.has(type)) fail(`[${manifest.slug}] system section "${type}" is not handled by ${viewPath}`);
  }
  for (const type of cases) {
    if (!manifest.sections.includes(type) && !systemSections.includes(type)) {
      fail(`[${manifest.slug}] ${viewPath} renders "${type}" but the manifest does not declare it`);
    }
  }
  const defaultMatch = /default\s*:([\s\S]*?)return null/.exec(switchBody);
  if (!defaultMatch || !defaultMatch[1].includes(`warnUnknownSection('${manifest.slug}'`)) {
    fail(`[${manifest.slug}] ${viewPath}: switch default must call warnUnknownSection('${manifest.slug}', section.type)`);
  }

  summary.push(`  ${manifest.slug}@${manifest.version}: ${manifest.sections.length} sections, ${systemSections.length} system sections -> ${viewPath}`);
}

// --- 6. Parity dengan API (opsional) --------------------------------------
const apiManifestPath = resolve(API_DIR, 'src/modules/templates/template-manifest.ts');
let apiNote;
if (existsSync(apiManifestPath)) {
  const apiSource = stripLineComments(readFileSync(apiManifestPath, 'utf8'));
  const apiEntries = parseManifestEntries(blockAfter(apiSource, 'export const BUILTIN_TEMPLATE_MANIFESTS', '= ['));
  for (const apiEntry of apiEntries) {
    const local = manifests.find((m) => m.slug === apiEntry.slug);
    if (!local) {
      fail(`[${apiEntry.slug}] API built-in manifest is not built into this renderer`);
      continue;
    }
    if (local.version !== apiEntry.version) fail(`[${apiEntry.slug}] version differs: renderer ${local.version} vs API ${apiEntry.version}`);
    if (apiEntry.rendererApiVersion !== '1') fail(`[${apiEntry.slug}] API rendererApiVersion is ${apiEntry.rendererApiVersion}`);
    if (local.sections.join(',') !== apiEntry.sections.join(',')) {
      fail(`[${apiEntry.slug}] sections differ:\n    renderer: ${local.sections.join(', ')}\n    API:      ${apiEntry.sections.join(', ')}`);
    }
  }
  for (const local of manifests) {
    if (!apiEntries.some((e) => e.slug === local.slug)) fail(`[${local.slug}] not present in API BUILTIN_TEMPLATE_MANIFESTS`);
  }
  apiNote = `API parity checked against ${apiManifestPath}`;
} else {
  apiNote = `API parity skipped (not found: ${apiManifestPath})`;
}

console.log('Template contract check');
console.log(summary.join('\n'));
console.log(`  ${apiNote}`);
if (errors.length > 0) {
  console.error(`\nFAILED (${errors.length}):`);
  for (const message of errors) console.error(`  - ${message}`);
  process.exit(1);
}
console.log('\nOK');
