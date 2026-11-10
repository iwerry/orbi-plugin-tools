// Instala/remove um plugin UXP no Premiere como o Creative Cloud faz (pasta External + PluginsInfo).
// Uso: node uxp-install.mjs install <pastaDoPlugin> | remove <pluginId>
import fs from 'node:fs';
import path from 'node:path';
const [cmd, arg] = process.argv.slice(2);
const root = path.join(process.env.APPDATA, 'Adobe', 'UXP');
const info = path.join(root, 'PluginsInfo', 'v1', 'premierepro.json');
const backup = info + '.orbi-backup';
if (!fs.existsSync(backup)) fs.copyFileSync(info, backup);
const db = JSON.parse(fs.readFileSync(info, 'utf8'));

if (cmd === 'install') {
  const m = JSON.parse(fs.readFileSync(path.join(arg, 'manifest.json'), 'utf8'));
  const dirName = `${m.id}_${m.version}`;
  const dest = path.join(root, 'Plugins', 'External', dirName);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(arg, dest, { recursive: true });
  db.plugins = db.plugins.filter((p) => p.pluginId !== m.id);
  db.plugins.push({
    hostMinVersion: m.host.minVersion, name: m.name, path: `$localPlugins\\External\\${dirName}`,
    pluginId: m.id, status: 'enabled', type: 'uxp', versionString: m.version,
  });
  console.log('instalado em', dest);
} else if (cmd === 'remove') {
  for (const p of db.plugins.filter((x) => x.pluginId === arg)) {
    fs.rmSync(path.join(root, 'Plugins', p.path.replace('$localPlugins\\', '')), { recursive: true, force: true });
  }
  db.plugins = db.plugins.filter((p) => p.pluginId !== arg);
  console.log('removido', arg);
} else {
  throw new Error('uso: install <pasta> | remove <id>');
}
fs.writeFileSync(info, JSON.stringify(db));
console.log('plugins registrados:', db.plugins.map((p) => p.pluginId).join(', '));
console.log('backup do original:', backup);
