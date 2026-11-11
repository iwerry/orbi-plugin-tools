/*
 * Orbi Plugin Tools — ponte com o app host (CEP).
 * Draft Creative Studio Ltda · Daniel Rodrigues
 *
 * Implementação própria sobre window.__adobe_cep__ (sem CSInterface.js).
 * Quando o adaptador UXP chegar, ele expõe esta mesma interface (ORBI.host).
 */
(function (global) {
  'use strict';
  var ORBI = global.ORBI = global.ORBI || {};
  ORBI.VERSION = '0.4.0';
  ORBI.VENDOR = 'Draft Creative Studio Ltda';
  ORBI.AUTHOR = 'Daniel Rodrigues';
  var cep = global.__adobe_cep__;

  function hostEnv() {
    if (!cep) return { appName: 'BROWSER', appVersion: '0', appSkinInfo: null };
    try { return JSON.parse(cep.getHostEnvironment()); } catch (e) { return { appName: 'UNKNOWN' }; }
  }

  function systemPath(kind) {
    if (!cep) return '';
    var p = decodeURI(cep.getSystemPath(kind));
    var isWin = (global.navigator && /Win/i.test(global.navigator.platform));
    return isWin ? p.replace(/^file:\/\/\//, '') : p.replace(/^file:\/\//, '');
  }

  /** Executa ExtendScript e devolve uma Promise com a string de retorno. */
  function evalRaw(script) {
    return new Promise(function (resolve, reject) {
      if (!cep) { reject(new Error('Fora do Premiere/After Effects (modo navegador).')); return; }
      cep.evalScript(script, function (res) {
        if (res === 'EvalScript error.') reject(new Error('Erro no ExtendScript ao executar: ' + script.slice(0, 120)));
        else resolve(res);
      });
    });
  }

  /** Chama ORBI.<caminho>(args) no host; o host devolve JSON {ok, ...}. */
  function call(fnPath, args) {
    // Tudo que n\u00e3o \u00e9 ASCII vira \uXXXX: o ExtendScript recebe o texto intacto em qualquer idioma
    // (acentos, CJK, \u00e1rabe, emojis), sem depender da codifica\u00e7\u00e3o do evalScript.
    var payload = JSON.stringify(args === undefined ? {} : args)
      .replace(/[\u007f-\uffff]/g, function (ch) { return '\\u' + ('000' + ch.charCodeAt(0).toString(16)).slice(-4); });
    var script = 'ORBI.run(' + JSON.stringify(fnPath) + ',' + payload + ')';
    return evalRaw(script).then(function (txt) {
      var r;
      try { r = JSON.parse(txt); } catch (e) { throw new Error('Resposta inválida do host: ' + txt); }
      if (!r.ok) throw new Error(r.error || 'Falha no host');
      return r;
    });
  }

  function jsxPath(p) { return p.replace(/\\/g, '/').replace(/"/g, '\\"'); }

  /** Carrega o JSX comum + o JSX do app atual (premiere.jsx ou aftereffects.jsx). */
  function loadHostScripts() {
    var ext = systemPath('extension');
    var app = ORBI.host.app;
    var file = app === 'PPRO' ? 'premiere.jsx' : (app === 'AEFT' ? 'aftereffects.jsx' : null);
    if (!file) return Promise.reject(new Error('App não suportado: ' + app));
    var common = jsxPath(ext + '/shared/host/orbi-common.jsx');
    var own = jsxPath(ext + '/host/' + file);
    return evalRaw('$.evalFile("' + common + '"); $.evalFile("' + own + '"); "loaded"');
  }

  function applyTheme() {
    var env = hostEnv();
    var skin = env.appSkinInfo;
    if (!skin || !skin.panelBackgroundColor) return;
    var c = skin.panelBackgroundColor.color;
    var root = document.documentElement;
    root.style.setProperty('--host-bg', 'rgb(' + Math.round(c.red) + ',' + Math.round(c.green) + ',' + Math.round(c.blue) + ')');
  }

  var env = hostEnv();
  ORBI.host = {
    app: env.appName,               // 'PPRO' | 'AEFT'
    isPremiere: env.appName === 'PPRO',
    isAfterEffects: env.appName === 'AEFT',
    version: env.appVersion,
    extensionPath: function () { return systemPath('extension'); },
    userDataPath: function () { return systemPath('userData'); },
    eval: evalRaw,
    call: call,
    load: loadHostScripts,
    applyTheme: applyTheme
  };

  if (cep) {
    try {
      cep.addEventListener('com.adobe.csxs.events.ThemeColorChanged', applyTheme);
    } catch (e) { /* versões antigas */ }
  }
})(window);
