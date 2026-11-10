/*
 * ORBI Margens — guias de safe-area para Reels, Shorts e TikTok.
 */
(function () {
  'use strict';
  var ui = ORBI.ui, $ = ui.$, host = ORBI.host;

  function profile() { return document.querySelector('input[name=profile]:checked').value; }

  function guidesDir() {
    var path = cep_node.require('path');
    return path.join(ORBI.engine.tempDir(), 'guides');
  }

  function add() {
    var id = profile();
    return host.call('margens.frameSize', {}).then(function (sz) {
      var args = ['guides', '--out-dir', guidesDir(), '--width', String(sz.width), '--height', String(sz.height), '--only', id];
      return ORBI.engine.run(args).then(function (r) {
        if (!r.files.length) throw new Error('Perfil desconhecido: ' + id);
        var f = r.files[0];
        return host.call('margens.addGuide', { file: f.file, label: f.label }).then(function () {
          var warn = (sz.height <= sz.width) ? '\nAtenção: a ' + (host.isPremiere ? 'sequência' : 'comp') + ' não é vertical (9:16).' : '';
          return 'Guia ' + f.label + ' adicionada (' + sz.width + '×' + sz.height + ').' + warn;
        });
      });
    });
  }

  ui.boot(function () {
    document.body.classList.add(host.isPremiere ? 'is-ppro' : 'is-ae');
    $('#btnAdd').addEventListener('click', function () { ui.task('Gerando guia…', add); });
    $('#btnRemove').addEventListener('click', function () {
      ui.task('Removendo…', function () {
        return host.call('margens.removeGuides', {}).then(function (h) { return h.count + ' guia(s) removida(s).'; });
      });
    });
  });
})();
