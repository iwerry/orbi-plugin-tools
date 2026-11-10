/*
 * Orbi Plugin Tools — utilitários de interface compartilhados.
 */
(function (global) {
  'use strict';
  var ORBI = global.ORBI = global.ORBI || {};

  function $(sel, root) { return (root || document).querySelector(sel); }

  function status(msg, kind) {
    var el = $('#status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  function busy(on, label) {
    document.body.classList.toggle('busy', !!on);
    var btns = document.querySelectorAll('button[data-action]');
    for (var i = 0; i < btns.length; i++) btns[i].disabled = !!on;
    if (on) status(label || 'Processando…', 'info');
  }

  /** Executa uma ação assíncrona com estado de ocupado e mensagens. */
  function task(label, fn) {
    busy(true, label);
    return Promise.resolve().then(fn).then(function (msg) {
      busy(false);
      if (msg) status(msg, 'ok');
    }, function (err) {
      busy(false);
      status((err && err.message) || String(err), 'error');
      if (global.console) console.error(err);
    });
  }

  /** Liga range + número + rótulo e persiste no localStorage. */
  function bindSlider(id, fmt) {
    var input = $('#' + id);
    var out = $('#' + id + '-v');
    var key = 'orbi.' + document.body.dataset.ext + '.' + id;
    try { var saved = global.localStorage.getItem(key); if (saved !== null) input.value = saved; } catch (e) { /* ok */ }
    function upd() {
      if (out) out.textContent = fmt ? fmt(+input.value) : input.value;
      var p = (input.value - input.min) / (input.max - input.min) * 100;
      input.style.setProperty('--fill', p + '%');
      try { global.localStorage.setItem(key, input.value); } catch (e) { /* ok */ }
    }
    input.addEventListener('input', upd);
    upd();
    return function () { return +input.value; };
  }

  function fmtTime(s) {
    var m = Math.floor(s / 60), r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
  }

  /* ---------------- Temas (Escuro · Claro · Terminal) ---------------- */
  var THEMES = [
    { id: 'dark', label: 'Escuro', icon: 'moon' },
    { id: 'light', label: 'Claro', icon: 'sun' },
    { id: 'terminal', label: 'Terminal', icon: 'square-terminal' }
  ];
  var THEME_EVENT = 'com.orbi.themeChanged';

  function nodeReq(m) {
    var r = global.cep_node ? global.cep_node.require : (typeof global.require === 'function' ? global.require : null);
    return r ? r(m) : null;
  }

  /** settings.json compartilhado por todos os painéis Orbi (em %APPDATA%). */
  function settingsFile() {
    var path = nodeReq('path');
    var base = ORBI.host && ORBI.host.userDataPath ? ORBI.host.userDataPath() : '';
    return path && base ? path.join(base, 'Orbi Plugin Tools', 'settings.json') : null;
  }
  function readSettings() {
    try {
      var f = settingsFile(), fs = nodeReq('fs');
      if (f && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch (e) { /* ignora */ }
    return {};
  }
  function writeSettings(patch) {
    try {
      var f = settingsFile(), fs = nodeReq('fs'), path = nodeReq('path');
      if (!f) return;
      var cur = readSettings();
      for (var k in patch) cur[k] = patch[k];
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, JSON.stringify(cur, null, 2), 'utf8');
    } catch (e) { /* ignora */ }
  }

  function validTheme(t) { return t === 'light' || t === 'terminal' ? t : 'dark'; }

  function applyTheme(t) {
    t = validTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    try { global.localStorage.setItem('orbi.theme', t); } catch (e) { /* ok */ }
    var btns = document.querySelectorAll('.theme-switch button');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', btns[i].getAttribute('data-theme') === t);
    return t;
  }

  function setTheme(t) {
    t = applyTheme(t);
    writeSettings({ theme: t });
    var cep = global.__adobe_cep__;
    if (cep) {
      try {
        var env = JSON.parse(cep.getHostEnvironment());
        cep.dispatchEvent({ type: THEME_EVENT, scope: 'APPLICATION', appId: env.appId, extensionId: '', data: t });
      } catch (e) { /* ok */ }
    }
  }

  function initTheme() {
    var t = readSettings().theme;
    if (!t) { try { t = global.localStorage.getItem('orbi.theme'); } catch (e) { /* ok */ } }
    applyTheme(t);
    var cep = global.__adobe_cep__;
    if (cep) {
      try { cep.addEventListener(THEME_EVENT, function (ev) { applyTheme(ev && ev.data); }); } catch (e) { /* ok */ }
    }
    // Fallback: ao voltar o foco, relê o arquivo (outro painel pode ter trocado).
    global.addEventListener('focus', function () { var s = readSettings().theme; if (s) applyTheme(s); });
  }

  /* ---------------- Cabeçalho e créditos ---------------- */
  var MARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="6.2" fill="currentColor"/>' +
    '<ellipse cx="16" cy="16" rx="13.2" ry="5.6" transform="rotate(-28 16 16)" fill="none" stroke="currentColor" stroke-width="2.1"/>' +
    '<circle cx="26.6" cy="9.4" r="2.6" fill="currentColor" stroke="var(--neo-bg)" stroke-width="1.6"/></svg>';

  function chrome() {
    var b = document.body;
    var header = document.createElement('header');
    var sw = THEMES.map(function (t) {
      return '<button type="button" data-theme="' + t.id + '" title="Tema ' + t.label + '" aria-label="Tema ' + t.label + '">' + ORBI.icon(t.icon) + '</button>';
    }).join('');
    header.innerHTML =
      '<span class="mark">' + MARK + '</span>' +
      '<span class="titles"><span class="brand">Orbi Plugin Tools</span><h1>' + (b.getAttribute('data-title') || '') + '</h1></span>' +
      '<span class="tools"><span class="host" id="host" title="App conectado">…</span>' +
      '<span class="theme-switch" role="group" aria-label="Tema">' + sw + '</span></span>';
    b.insertBefore(header, b.firstChild);
    var btns = header.querySelectorAll('.theme-switch button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () { setTheme(this.getAttribute('data-theme')); });
    }
    var footer = document.createElement('footer');
    footer.className = 'credits';
    footer.innerHTML =
      '<img class="draft on-dark" src="shared/img/draft-logo-white.png" alt="Draft Creative Studio">' +
      '<img class="draft on-light" src="shared/img/draft-logo-dark.png" alt="Draft Creative Studio">' +
      '<div class="sig">Draft Creative Studio Ltda<small>Creative Design &amp; Software Development</small><small>Daniel Rodrigues · Orbi Plugin Tools v' + (ORBI.VERSION || '') + '</small></div>';
    b.appendChild(footer);
    ORBI.renderIcons();
  }

  /** Inicialização padrão de um painel. */
  function boot(onReady) {
    document.addEventListener('DOMContentLoaded', function () {
      chrome();
      initTheme();
      document.body.classList.add(ORBI.host.isPremiere ? 'is-ppro' : (ORBI.host.isAfterEffects ? 'is-ae' : 'is-ppro'));
      var badge = $('#host');
      if (badge) badge.textContent = ORBI.host.isPremiere ? 'Premiere' : (ORBI.host.isAfterEffects ? 'After Effects' : 'Navegador');
      ORBI.host.load().then(function () {
        document.body.classList.add('ready');
        status('Pronto.', 'ok');
        onReady && onReady();
      }, function (e) { status(e.message, 'error'); });
    });
  }

  ORBI.theme = { list: THEMES, set: setTheme, apply: applyTheme };
  ORBI.settings = { read: readSettings, write: writeSettings };
  ORBI.ui = { $: $, status: status, busy: busy, task: task, bindSlider: bindSlider, fmtTime: fmtTime, boot: boot };
})(window);
