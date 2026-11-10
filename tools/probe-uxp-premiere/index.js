// Sonda: lista o que a API UXP do Premiere expõe (legendas, transcrição, Lumetri/LUT, .mogrt).
// Não altera projeto nenhum. Grava o resultado em orbi-sonda.txt na pasta de dados do plugin,
// para o Claude Code ler direto. Draft Creative Studio Ltda · Daniel Rodrigues
(function () {
  var out = document.getElementById('out');
  var log = [];
  function say(s) { log.push(s); out.textContent = log.join('\n'); }
  var TOPICS = {
    'legenda/transcrição': /caption|transcri|speech|subtitle/i,
    'cor/LUT/Lumetri': /lumetri|lut|color|look|grade/i,
    'mogrt/gráficos': /mogrt|graphic|template|essential/i,
    'efeitos/componentes': /effect|component|filter|param/i
  };

  /** Propriedades e métodos, incluindo os da cadeia de protótipos (classes UXP). */
  function names(obj) {
    var r = [];
    var o = obj, depth = 0;
    while (o && o !== Object.prototype && depth < 5) {
      try { Object.getOwnPropertyNames(o).forEach(function (k) { if (k !== 'constructor' && r.indexOf(k) < 0) r.push(k); }); } catch (e) { /* ignora */ }
      try { o = Object.getPrototypeOf(o); } catch (e) { break; }
      depth++;
    }
    return r.sort();
  }

  function byTopic(label, list) {
    Object.keys(TOPICS).forEach(function (t) {
      var hit = list.filter(function (k) { return TOPICS[t].test(k); });
      say('  [' + t + '] ' + (hit.join(', ') || 'nenhum'));
    });
  }

  async function save() {
    try {
      var fs = require('uxp').storage.localFileSystem;
      var dir = await fs.getDataFolder();
      var f = await dir.createFile('orbi-sonda.txt', { overwrite: true });
      await f.write(log.join('\n'));
      say('Resultado gravado em: ' + f.nativePath);
    } catch (e) { say('Não consegui gravar o arquivo: ' + e); }
  }

  async function probe() {
    log = [];
    say('Orbi Sonda UXP · ' + new Date().toISOString());
    try { var h = require('uxp').host; say('Host: ' + h.name + ' ' + h.version + ' · UXP ' + require('uxp').versions.uxp); } catch (e) { say('Host: ? (' + e + ')'); }
    var ppro;
    try { ppro = require('premierepro'); } catch (e) { say('ERRO require(premierepro): ' + e); await save(); return; }
    var top = names(ppro);
    say('\n== Módulo premierepro: ' + top.length + ' itens');
    say(top.join(', '));
    byTopic('premierepro', top);

    // Classes com nome sugestivo: lista os métodos estáticos e do protótipo.
    say('\n== Classes de interesse');
    top.filter(function (k) { return /caption|transcri|lumetri|lut|color|mogrt|graphic|effect|component|track|clip|marker|sequenceeditor|action/i.test(k); })
      .forEach(function (k) {
        var c = ppro[k];
        if (!c) return;
        var st = names(c).filter(function (n) { return !/^(length|name|prototype|arguments|caller)$/.test(n); });
        var pr = c.prototype ? names(c.prototype) : [];
        say('- ' + k + ' | estáticos: ' + (st.join(', ') || '-') + ' | métodos: ' + (pr.join(', ') || '-'));
      });

    try {
      var proj = await ppro.Project.getActiveProject();
      say('\n== Projeto ativo: ' + (proj ? proj.name : 'nenhum'));
      if (proj) { say('Project: ' + names(proj).join(', ')); byTopic('Project', names(proj)); }
      var seq = proj && await proj.getActiveSequence();
      say('\n== Sequência ativa: ' + (seq ? seq.name : 'nenhuma (abra uma para ver mais)'));
      if (seq) {
        say('Sequence: ' + names(seq).join(', '));
        byTopic('Sequence', names(seq));
        try {
          var ct = seq.getCaptionTrackCount ? await seq.getCaptionTrackCount() : 'sem getCaptionTrackCount';
          say('Faixas de legenda: ' + ct);
        } catch (e) { say('Faixas de legenda: erro ' + e); }
        try {
          var vt = await seq.getVideoTrack(0);
          var items = vt ? await vt.getTrackItems(1, false) : [];
          say('V1: ' + (items ? items.length : 0) + ' clipe(s)');
          if (items && items.length) {
            var ti = items[0];
            say('TrackItem: ' + names(ti).join(', '));
            var chain = ti.getComponentChain ? await ti.getComponentChain() : null;
            if (chain) {
              say('ComponentChain: ' + names(chain).join(', '));
              var n = await chain.getComponentCount();
              for (var i = 0; i < n; i++) {
                var comp = await chain.getComponentAtIndex(i);
                var mn = comp.getMatchName ? await comp.getMatchName() : '?';
                var dn = comp.getDisplayName ? await comp.getDisplayName() : '?';
                say('  componente ' + i + ': ' + dn + ' | ' + mn);
              }
            }
          }
        } catch (e) { say('Clipes/efeitos: erro ' + e); }
      }
    } catch (e) { say('ERRO ao ler projeto/sequência: ' + e); }
    say('\n--- fim ---');
    await save();
  }

  document.getElementById('run').addEventListener('click', function () { probe(); });
  probe();
})();
