/*
 * Gera todos os .mogrt do catálogo em assets/mogrt/<categoria>/<nome>.mogrt.
 * Rodar com o After Effects aberto e o painel "Orbi · Ponte Dev":
 *   node tools/ae-eval.mjs tools/mogrt/build.jsx
 * Para gerar só alguns: defina ORBI_ONLY = 'Caption Pop' antes (ver tools/mogrt/README.md).
 */
(function () {
  var ROOT = 'D:/WWW/PluginAdobe';
  // Trabalha num projeto próprio: exportar .mogrt de um projeto salvo e alterado faz o AE perguntar
  // "O projeto precisa ser salvo primeiro". O projeto temporário é salvo antes de cada exportação.
  var BUILD = new File(Folder.temp.fsName + '/orbi-mogrt-build.aep');
  if (!(app.project.file && app.project.file.fsName === BUILD.fsName)) {
    if (!app.newProject()) return 'Cancelado: o After Effects não abriu um projeto novo (salve ou descarte o atual e rode de novo).';
    app.project.save(BUILD);
  }
  // Começa limpo: remove o que sobrou de rodadas anteriores.
  while (app.project.numItems) app.project.item(1).remove();
  $.evalFile(ROOT + '/tools/mogrt/lib.jsx');
  $.evalFile(ROOT + '/tools/mogrt/pack-captions.jsx');
  M.presets = [];
  $.evalFile(ROOT + '/tools/mogrt/pack-captions.jsx');
  $.evalFile(ROOT + '/tools/mogrt/pack-titles-cinematic.jsx');
  $.evalFile(ROOT + '/tools/mogrt/pack-titles-essential.jsx');
  $.evalFile(ROOT + '/tools/mogrt/pack-social-counters.jsx');
  return M.buildAll(ROOT + '/assets/mogrt', typeof ORBI_ONLY !== 'undefined' && ORBI_ONLY ? ORBI_ONLY : null);
})();
