/*
 * Orbi Legendas — host Premiere Pro: importa o SRT em blocos e cria a faixa de legendas.
 * Draft Creative Studio Ltda · Daniel Rodrigues
 */
ORBI.captions = ORBI.captions || {};

ORBI.captions.importSrt = function (a) {
  var seq = ORBI.ppro.activeSequence();
  var root = app.project.rootItem;
  var name = ORBI.slash(a.file).split('/').pop();
  app.project.importFiles([a.file], true, root, false);
  var item = null;
  for (var i = root.children.numItems - 1; i >= 0; i--) if (root.children[i].name === name) { item = root.children[i]; break; }
  if (!item) ORBI.fail('Não consegui importar ' + name);
  var track = false;
  try {
    seq.createCaptionTrack(item, 0, Sequence.CAPTION_FORMAT_SUBTITLE);
    track = true;
  } catch (e) { /* versão sem createCaptionTrack: fica no projeto para arrastar */ }
  return { track: track, item: name };
};
