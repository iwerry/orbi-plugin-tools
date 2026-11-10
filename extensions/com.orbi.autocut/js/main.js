/*
 * Orbi Autocut — painel (Premiere + After Effects).
 * Remove silêncios com três ritmos: Natural, FastCut (tira respiros e pausas
 * curtas) e HyperCut (jump cuts secos com zoom de corte alternado).
 * Opcional: J-cut / L-cut para suavizar os cortes no áudio.
 * Draft Creative Studio Ltda · Daniel Rodrigues
 */
(function () {
  'use strict';
  var ui = ORBI.ui, $ = ui.$, host = ORBI.host;
  var TAG = 'orbi:autocut';
  var last = null;      // último resultado da análise
  var lastKey = '';     // configurações usadas nele
  var applyingPreset = false;

  var PRESETS = {
    natural: {
      hint: 'Corta só os silêncios claros e mantém respiros e pausas naturais.',
      v: { bias: 35, minSil: 350, padB: 120, padA: 180, minKeep: 120 }, zoom: false
    },
    fast: {
      hint: 'Tira respiros e pausas curtas, para vídeos falados mais dinâmicos.',
      v: { bias: 45, minSil: 180, padB: 60, padA: 90, minKeep: 100 }, zoom: false
    },
    hyper: {
      hint: 'Jump cuts secos, com zoom de corte alternado entre os trechos (Reels/TikTok).',
      v: { bias: 50, minSil: 120, padB: 30, padA: 50, minKeep: 80 }, zoom: true
    },
    custom: { hint: 'Ajuste livre: mexa nos controles abaixo.' }
  };

  var get = {
    thr: ui.bindSlider('thr', function (v) { return v + ' dB'; }),
    bias: ui.bindSlider('bias', function (v) { return v + '%'; }),
    minSil: ui.bindSlider('minSil', function (v) { return v + ' ms'; }),
    padB: ui.bindSlider('padB', function (v) { return v + ' ms'; }),
    padA: ui.bindSlider('padA', function (v) { return v + ' ms'; }),
    minKeep: ui.bindSlider('minKeep', function (v) { return v + ' ms'; }),
    zoomScale: ui.bindSlider('zoomScale', function (v) { return v + '%'; }),
    jlMs: ui.bindSlider('jlMs', function (v) { return v + ' ms'; })
  };

  function radio(name) { return document.querySelector('input[name=' + name + ']:checked').value; }
  function setRadio(name, value) {
    var el = document.querySelector('input[name=' + name + '][value=' + value + ']');
    if (el) el.checked = true;
  }
  function setSlider(id, v) {
    var el = $('#' + id);
    el.value = v;
    el.dispatchEvent(new Event('input'));
  }

  function applyPreset(name, persist) {
    var p = PRESETS[name] || PRESETS.custom;
    $('#presetHint').textContent = p.hint;
    if (persist) { try { localStorage.setItem('orbi.autocut.preset', name); } catch (e) { /* ok */ } }
    if (!p.v) return;
    applyingPreset = true;
    Object.keys(p.v).forEach(function (k) { setSlider(k, p.v[k]); });
    $('#zoomOn').checked = !!p.zoom;
    $('#autoThr').checked = true;
    syncUi();
    applyingPreset = false;
  }

  function markCustom() {
    if (applyingPreset) return;
    setRadio('preset', 'custom');
    $('#presetHint').textContent = PRESETS.custom.hint;
    try { localStorage.setItem('orbi.autocut.preset', 'custom'); } catch (e) { /* ok */ }
  }

  function params() {
    return {
      thresholdDb: $('#autoThr').checked ? null : get.thr(),
      autoBias: get.bias() / 100,
      minSilenceMs: get.minSil(),
      padBeforeMs: get.padB(),
      padAfterMs: get.padA(),
      minKeepMs: get.minKeep()
    };
  }

  function editOpts() {
    return {
      zoom: { enabled: $('#zoomOn').checked, scale: get.zoomScale(), pattern: 'alternate' },
      jl: { mode: radio('jl'), ms: get.jlMs() }
    };
  }

  function source() {
    return { track: +$('#track').value, selectedOnly: $('#selectedOnly').checked };
  }

  function syncUi() {
    var auto = $('#autoThr').checked;
    $('#thrRow').style.display = auto ? 'none' : '';
    $('#biasRow').style.display = auto ? '' : 'none';
    var z = $('#zoomOn').checked;
    var chip = $('#zoomChip');
    chip.textContent = z ? get.zoomScale() + '%' : 'desligado';
    chip.classList.toggle('on', z);
    $('#zoomScale').disabled = !z;
    $('#jlMs').disabled = radio('jl') === 'none';
  }

  function rateFromFps(fps) {
    var r = Math.round(fps);
    return { timebase: r, ntsc: Math.abs(fps - r) > 0.01 };
  }

  function showStats(r) {
    $('#sCuts').textContent = r ? r.cuts : '–';
    $('#sRemoved').textContent = r ? ui.fmtTime(r.removedSeconds) : '–';
    $('#sNew').textContent = r ? ui.fmtTime(r.newDuration) : '–';
  }

  function settingsKey() { return JSON.stringify([params(), editOpts(), source()]); }

  function analyze() {
    var src = source();
    return host.call('autocut.getClips', src).then(function (info) {
      if (!info.clips.length) throw new Error(host.isPremiere ? 'Nenhum clipe com mídia na faixa escolhida.' : 'Selecione uma camada com áudio.');
      var xml = ORBI.engine.tempFile('autocut', '.xml');
      var opts = editOpts();
      return ORBI.engine.request('autocut', {
        clips: info.clips,
        params: params(),
        zoom: opts.zoom,
        jl: opts.jl,
        rate: rateFromFps(info.fps),
        width: info.width,
        height: info.height,
        sequenceName: info.name + ' — ' + presetLabel(),
        xmlOut: host.isPremiere ? xml : null
      }).then(function (r) {
        r.info = info;
        last = r;
        lastKey = settingsKey();
        showStats(r);
        var errs = r.clips.filter(function (c) { return c.error; });
        var msg = r.cuts + ' silêncio(s) em ' + r.clips.length + ' clipe(s) · ' + r.segments.length + ' trecho(s).';
        if (errs.length) msg += '\n' + errs.length + ' clipe(s) sem áudio legível foram mantidos inteiros.';
        return msg;
      });
    });
  }

  function presetLabel() {
    return { natural: 'Autocut', fast: 'FastCut', hyper: 'HyperCut', custom: 'Autocut' }[radio('preset')];
  }

  function ensureAnalysis() {
    if (last && lastKey === settingsKey()) return Promise.resolve();
    return analyze();
  }

  function apply() {
    return ensureAnalysis().then(function () {
      var r = last;
      if (!r.cuts) return 'Nada para cortar com essas configurações.';
      if (radio('mode') === 'markers') {
        return host.call('autocut.addMarkers', { ranges: r.silentSequence, tag: TAG, layers: r.info.layers })
          .then(function (h) { return h.count + ' marcador(es) de silêncio criados.'; });
      }
      if (host.isPremiere) {
        return host.call('autocut.importXml', { path: r.xmlPath, name: r.info.name + ' — ' + presetLabel() })
          .then(function (h) { return 'Nova sequência: ' + h.sequence + ' (' + ui.fmtTime(r.removedSeconds) + ' removidos).'; });
      }
      return host.call('autocut.apply', { segments: r.segments, layers: r.info.layers, refStart: r.info.clips[0].start })
        .then(function (h) { return h.segments + ' trecho(s) em ' + h.layers + ' camada(s). Originais desativadas.'; });
    });
  }

  // Liga os controles.
  var presetSaved = 'natural';
  try { presetSaved = localStorage.getItem('orbi.autocut.preset') || 'natural'; } catch (e) { /* ok */ }
  setRadio('preset', presetSaved);
  $('#presetHint').textContent = (PRESETS[presetSaved] || PRESETS.natural).hint;
  try {
    $('#zoomOn').checked = localStorage.getItem('orbi.autocut.zoom') === '1';
    setRadio('jl', localStorage.getItem('orbi.autocut.jl') || 'none');
  } catch (e) { /* ok */ }

  Array.prototype.forEach.call(document.querySelectorAll('input[name=preset]'), function (el) {
    el.addEventListener('change', function () { applyPreset(el.value, true); });
  });
  ['bias', 'minSil', 'padB', 'padA', 'minKeep', 'thr'].forEach(function (id) {
    $('#' + id).addEventListener('input', markCustom);
  });
  $('#autoThr').addEventListener('change', function () { markCustom(); syncUi(); });
  $('#zoomOn').addEventListener('change', function () {
    try { localStorage.setItem('orbi.autocut.zoom', this.checked ? '1' : '0'); } catch (e) { /* ok */ }
    syncUi();
  });
  $('#zoomScale').addEventListener('input', syncUi);
  Array.prototype.forEach.call(document.querySelectorAll('input[name=jl]'), function (el) {
    el.addEventListener('change', function () {
      try { localStorage.setItem('orbi.autocut.jl', el.value); } catch (e) { /* ok */ }
      syncUi();
    });
  });
  syncUi();

  ui.boot(function () {
    $('#btnAnalyze').addEventListener('click', function () { ui.task('Analisando áudio…', analyze); });
    $('#btnApply').addEventListener('click', function () { ui.task('Aplicando cortes…', apply); });
    $('#btnClear').addEventListener('click', function () {
      ui.task('Limpando…', function () {
        return host.call('autocut.clearMarkers', { tag: TAG }).then(function (h) { return h.count + ' marcador(es) removidos.'; });
      });
    });
  });
})();
