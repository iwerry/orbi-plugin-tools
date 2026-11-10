// Gera LUTs .cube de teste em test-media/luts (Orbi Plugin Tools · Draft Creative Studio Ltda).
//   node tools/make-test-luts.mjs
import fs from 'node:fs';
import path from 'node:path';

const N = 17;
const out = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'test-media', 'luts');
const clamp = (v) => Math.min(1, Math.max(0, v));

const looks = {
  'Orbi Quente': (r, g, b) => [r * 1.08 + 0.02, g * 1.0 + 0.01, b * 0.86],
  'Orbi Frio': (r, g, b) => [r * 0.88, g * 0.98 + 0.01, b * 1.1 + 0.03],
  'Orbi Preto e Branco': (r, g, b) => {
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const c = clamp((y - 0.5) * 1.15 + 0.5);
    return [c, c, c];
  },
};

fs.mkdirSync(out, { recursive: true });
for (const [name, fn] of Object.entries(looks)) {
  const lines = [`TITLE "${name}"`, `LUT_3D_SIZE ${N}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
  // .cube: o vermelho varia mais rápido
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
    lines.push(fn(r / (N - 1), g / (N - 1), b / (N - 1)).map((v) => clamp(v).toFixed(6)).join(' '));
  }
  fs.writeFileSync(path.join(out, name + '.cube'), lines.join('\n') + '\n');
  console.log('✓', name);
}
