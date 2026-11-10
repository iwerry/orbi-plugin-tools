/*
 * Orbi AutoSoundFX — efeitos sonoros automáticos nos cortes ou marcadores.
 * Os sons são sintetizados pelo orbi-engine (sem bibliotecas de terceiros) e
 * o PICO de cada som é alinhado exatamente no ponto escolhido.
 * Draft Creative Studio Ltda · Daniel Rodrigues
 */
(function () {
  'use strict';
  var ui = ORBI.ui, $ = ui.$, host = ORBI.host;
  var VARIANTS = 3;
  var HINTS = {
    mix: 'Alterna whoosh e swish: o clássico dos jump cuts.',
    whoosh: 'Passagem de ar longa, com o pico no corte.',
    swish: 'Passagem curta e aguda, para cortes rápidos.',
    pop: 'Estalo curto: textos, elementos e marcadores.',
    click: 'Clique seco: UI, contagem, ritmo.',
    impact: 'Impacto grave: virada, revelação, batida forte.',
    riser: 'Subida que termina no ponto: tensão antes do corte.'
  };
  var pack = null; // [{kind, variant, file, duration, peak, label}]

  var minGap = ui.bindSlider('minGap', function (v) { return v ? v + ' ms' : 'sem limite'; });

  function radio(name) { return document.querySelector('input[name=' + name + ']:checked').value; }

  function packDir() {
    var path = cep_node.require('path');
    var base = ORBI.host.userDataPath();
    return path.join(base, 'Orbi Plugin Tools', 'sfx', 'v' + ORBI.VERSION);
  }

  /** Gera (uma vez por versão) e carrega o pacote de sons. */
  function ensurePack() {
    if (pack) return Promise.resolve(pack);
    var fs = cep_node.require('fs'), path = cep_node.require('path');
    var dir = packDir(), idx = path.join(dir, 'pack.json');
    try {
      if (fs.existsSync(idx)) {
        var p = JSON.parse(fs.readFileSync(idx, 'utf8'));
        if (p.every(function (i) { return fs.existsSync(i.file); })) { pack = p; return Promise.resolve(pack); }
      }
    } catch (e) { /* regenera */ }
    ui.status('Gerando os sons Orbi (uma vez só)…', 'info');
    return ORBI.engine.run(['sfx-pack', '--out-dir', dir, '--variants', String(VARIANTS)]).then(function (r) {
      pack = r.items;
      fs.writeFileSync(idx, JSON.stringify(pack), 'utf8');
      return pack;
    });
  }

  function pick(kind, i, vary) {
    var k = kind === 'mix' ? (i % 2 === 0 ? 'whoosh' : 'swish') : kind;
    var v = vary ? (Math.floor(kind === 'mix' ? i / 2 : i) % VARIANTS) + 1 : 1;
    for (var j = 0; j < pack.length; j++) if (pack[j].kind === k && pack[j].variant === v) return pack[j];
    return null;
  }

  /** Remove pontos muito próximos (mantém o primeiro de cada grupo). */
  function thin(points, gapSec) {
    var out = [], last = -1e9;
    points.forEach(function (t) { if (t - last >= gapSec) { out.push(t); last = t; } });
    return out;
  }

  function insert() {
    var kind = radio('kind'), vary = $('#vary').checked;
    return ensurePack().then(function () {
      return host.call('soundfx.getPoints', { source: radio('source'), track: +$('#vtrack').value });
    }).then(function (info) {
      var pts = thin(info.points, minGap() / 1000);
      $('#sPoints').textContent = pts.length;
      if (!pts.length) throw new Error(radio('source') === 'markers' ? 'Nenhum marcador encontrado.' : 'Nenhum corte encontrado nessa faixa.');
      var items = pts.map(function (t, i) {
        var s = pick(kind, i, vary);
        return { file: s.file, label: s.label, duration: s.duration, time: Math.max(0, t - s.peak) };
      });
      return host.call('soundfx.place', { items: items, audioTrack: +$('#atrack').value }).then(function (h) {
        $('#sPlaced').textContent = h.placed;
        $('#sSkipped').textContent = h.skipped;
        var msg = h.placed + ' efeito(s) inserido(s)' + (host.isPremiere ? ' na ' + h.track : '') + '.';
        if (h.skipped) msg += '\n' + h.skipped + ' pulado(s): a faixa já tinha áudio ali. Escolha outra faixa para incluir todos.';
        return msg;
      });
    });
  }

  function syncUi() {
    $('#kindHint').textContent = HINTS[radio('kind')];
    $('#trackRow').style.display = radio('source') === 'cuts' ? '' : 'none';
  }
  Array.prototype.forEach.call(document.querySelectorAll('input[name=kind], input[name=source]'), function (el) {
    el.addEventListener('change', syncUi);
  });
  syncUi();

  ui.boot(function () {
    $('#btnInsert').addEventListener('click', function () { ui.task('Inserindo efeitos…', insert); });
    $('#btnClear').addEventListener('click', function () {
      ui.task('Removendo…', function () {
        return host.call('soundfx.clear', {}).then(function (h) { return h.count + ' efeito(s) Orbi removido(s).'; });
      });
    });
  });
})();
