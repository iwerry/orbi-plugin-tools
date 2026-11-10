#!/usr/bin/env node
/*
 * Orbi Plugin Tools — monta dist/ a partir de extensions/ + shared/ + motor.
 *   node tools/build.mjs          → build de produção
 *   node tools/build.mjs --dev    → também cria .debug (DevTools) e copia o motor para cada extensão
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const extRoot = path.join(root, 'extensions');
const dist = path.join(root, 'dist');
const distExt = path.join(dist, 'extensions');
const isWin = process.platform === 'win32';

const HOSTS = { PPRO: '[23.0,99.9]', AEFT: '[23.0,99.9]' };

function rm(p) { fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(src, dst, skip = []) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.includes(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d, skip); else fs.copyFileSync(s, d);
  }
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function manifest(cfg) {
  const id = cfg.id, panel = `${id}.panel`;
  const hosts = cfg.hosts.map((h) => `      <Host Name="${h}" Version="${HOSTS[h]}"/>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Gerado por tools/build.mjs — não edite à mão. Orbi Plugin Tools · Draft Creative Studio Ltda -->
<ExtensionManifest Version="7.0" ExtensionBundleId="${id}" ExtensionBundleVersion="${version}"
  ExtensionBundleName="${esc(cfg.name)}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Author>Daniel Rodrigues — Draft Creative Studio Ltda</Author>
  <ExtensionList>
    <Extension Id="${panel}" Version="${version}"/>
  </ExtensionList>
  <ExecutionEnvironment>
    <HostList>
${hosts}
    </HostList>
    <LocaleList><Locale Code="All"/></LocaleList>
    <RequiredRuntimeList><RequiredRuntime Name="CSXS" Version="9.0"/></RequiredRuntimeList>
  </ExecutionEnvironment>
  <DispatchInfoList>
    <Extension Id="${panel}">
      <DispatchInfo>
        <Resources>
          <MainPath>./index.html</MainPath>
          <ScriptPath>./shared/host/orbi-common.jsx</ScriptPath>
          <CEFCommandLine>
            <Parameter>--enable-nodejs</Parameter>
            <Parameter>--mixed-context</Parameter>
          </CEFCommandLine>
        </Resources>
        <Lifecycle><AutoVisible>true</AutoVisible></Lifecycle>
        <UI>
          <Type>Panel</Type>
          <Menu>${esc(cfg.menu)}</Menu>
          <Geometry>
            <Size><Width>${cfg.width}</Width><Height>${cfg.height}</Height></Size>
            <MinSize><Width>240</Width><Height>240</Height></MinSize>
            <MaxSize><Width>1200</Width><Height>2000</Height></MaxSize>
          </Geometry>
        </UI>
      </DispatchInfo>
    </Extension>
  </DispatchInfoList>
</ExtensionManifest>
`;
}

function debugFile(cfg, port) {
  const hosts = cfg.hosts.map((h, i) => `      <Host Name="${h}" Port="${port + i}"/>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ExtensionList>
  <Extension Id="${cfg.id}.panel">
    <HostList>
${hosts}
    </HostList>
  </Extension>
</ExtensionList>
`;
}

rm(distExt);
fs.mkdirSync(distExt, { recursive: true });

const exts = fs.readdirSync(extRoot).filter((d) => fs.existsSync(path.join(extRoot, d, 'orbi.json'))).sort();
let port = 8800;
const listing = [];
for (const dir of exts) {
  const cfg = JSON.parse(fs.readFileSync(path.join(extRoot, dir, 'orbi.json'), 'utf8'));
  const out = path.join(distExt, cfg.id);
  copyDir(path.join(extRoot, dir), out, ['orbi.json', '.debug', 'node_modules']);
  copyDir(path.join(extRoot, 'shared'), path.join(out, 'shared'));
  fs.mkdirSync(path.join(out, 'CSXS'), { recursive: true });
  fs.writeFileSync(path.join(out, 'CSXS', 'manifest.xml'), manifest(cfg));
  if (dev) fs.writeFileSync(path.join(out, '.debug'), debugFile(cfg, port));
  listing.push({ id: cfg.id, name: cfg.name, debugPort: dev ? port : null });
  port += 10;
}

// Motor
const engineName = isWin ? 'orbi-engine.exe' : 'orbi-engine';
const engineSrc = [path.join(root, 'target', 'release', engineName), path.join(root, 'target', 'x86_64-pc-windows-msvc', 'release', 'orbi-engine.exe')]
  .find((p) => fs.existsSync(p));
fs.mkdirSync(path.join(dist, 'bin'), { recursive: true });
if (engineSrc) {
  fs.copyFileSync(engineSrc, path.join(dist, 'bin', path.basename(engineSrc)));
  if (dev) for (const l of listing) {
    const b = path.join(distExt, l.id, 'bin');
    fs.mkdirSync(b, { recursive: true });
    fs.copyFileSync(engineSrc, path.join(b, path.basename(engineSrc)));
  }
} else {
  console.warn('⚠ orbi-engine não compilado ainda — rode: cargo build --release -p orbi-engine');
}

fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify({ version, vendor: 'Draft Creative Studio Ltda', extensions: listing }, null, 2));
console.log(`Orbi Plugin Tools ${version}${dev ? ' (dev)' : ''}: ${listing.length} extensões em dist/extensions`);
for (const l of listing) console.log(`  • ${l.id}${l.debugPort ? `  (DevTools: http://localhost:${l.debugPort})` : ''}`);
