// Sonda: lista o que a API UXP do Premiere expõe sobre legendas e transcrição.
// Não altera projeto nenhum. Draft Creative Studio Ltda · Daniel Rodrigues
(function () {
  var out = document.getElementById('out');
  var log = [];
  function say(s) { log.push(s); out.textContent = log.join('\n'); }
  var PAT = /caption|transcri|speech|subtitle/i;

  function names(obj) {
    var r = [];
    try { for (var k in obj) r.push(k); } catch (e) { /* ignora */ }
    try { Object.getOwnPropertyNames(obj).forEach(function (k) { if (r.indexOf(k) < 0) r.push(k); }); } catch (e) { /* ignora */ }
    return r;
  }

  async function probe() {
    log = [];
    say('Versão do host: ' + (typeof require !== 'undefined' ? 'UXP ok' : 'sem require'));
    var ppro;
    try { ppro = require('premierepro'); } catch (e) { say('ERRO require(premierepro): ' + e); return; }
    var top = names(ppro).sort();
    say('Módulo premierepro: ' + top.length + ' itens');
    say('Itens com caption/transcri/speech: ' + (top.filter(function (k) { return PAT.test(k); }).join(', ') || 'nenhum'));
    try {
      var proj = await ppro.Project.getActiveProject();
      say('Projeto ativo: ' + (proj ? proj.name : 'nenhum'));
      var seq = proj && await proj.getActiveSequence();
      say('Sequência ativa: ' + (seq ? seq.name : 'nenhuma'));
      if (seq) {
        var sm = names(seq).filter(function (k) { return PAT.test(k); });
        say('Sequence com caption/transcri: ' + (sm.join(', ') || 'nenhum'));
        var all = names(seq).sort();
        say('Sequence (todos): ' + all.slice(0, 60).join(', '));
      }
    } catch (e) { say('ERRO ao ler projeto/sequência: ' + e); }
    say('--- fim ---');
  }

  document.getElementById('run').addEventListener('click', function () { probe(); });
  probe();
})();
