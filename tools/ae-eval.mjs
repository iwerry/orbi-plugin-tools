// Roda ExtendScript no After Effects pelo painel "Orbi · Ponte Dev" (tools/ae-bridge, DevTools na porta 8899).
//   node tools/ae-eval.mjs --install     liga o painel na pasta CEP do usuário (sem admin); reinicie o AE
//   node tools/ae-eval.mjs --uninstall   remove a ligação
//   node tools/ae-eval.mjs <arquivo.jsx>  executa e imprime o retorno
// Orbi Plugin Tools · Draft Creative Studio Ltda
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const link = path.join(process.env.APPDATA, 'Adobe', 'CEP', 'extensions', 'com.orbi.dev-bridge');
const arg = process.argv[2];

if (arg === '--install') {
  fs.mkdirSync(path.dirname(link), { recursive: true });
  if (!fs.existsSync(link)) execSync(`cmd /c mklink /J "${link}" "${path.join(here, 'ae-bridge')}"`);
  console.log('Painel ligado em', link, '— reinicie o After Effects e abra Janela › Extensões › Orbi · Ponte Dev');
  process.exit(0);
}
if (arg === '--uninstall') {
  if (fs.existsSync(link)) execSync(`cmd /c rmdir "${link}"`);
  console.log('Painel removido.');
  process.exit(0);
}
if (!arg) throw new Error('uso: node tools/ae-eval.mjs <arquivo.jsx> | --install | --uninstall');

const jsx = fs.readFileSync(arg, 'utf8');
const targets = await (await fetch('http://localhost:8899/json')).json();
const t = targets.find((x) => x.webSocketDebuggerUrl);
if (!t) throw new Error('Painel "Orbi · Ponte Dev" não está aberto no After Effects.');
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const expr = `new Promise(r => window.__adobe_cep__.evalScript(${JSON.stringify(jsx)}, r))`;
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
const msg = await new Promise((r) => { ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id === 1) r(m); }; });
ws.close();
console.log(msg.result && msg.result.result ? msg.result.result.value : JSON.stringify(msg));
