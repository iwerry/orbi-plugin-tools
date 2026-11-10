/*
 * ORBI Margens — host Premiere Pro.
 */
ORBI.margens = ORBI.margens || {};
ORBI.margens.PREFIX = 'orbi-guide-';
ORBI.margens.BIN = 'Orbi Guias';

ORBI.margens.frameSize = function () {
  var info = ORBI.ppro.seqInfo(ORBI.ppro.activeSequence());
  return { width: info.width, height: info.height };
};

ORBI.margens.bin = function () {
  var root = app.project.rootItem;
  for (var i = 0; i < root.children.numItems; i++) {
    var c = root.children[i];
    if (c.type === ProjectItemType.BIN && c.name === ORBI.margens.BIN) return c;
  }
  var b = root.createBin(ORBI.margens.BIN);
  if (b) return b;
  for (var j = 0; j < root.children.numItems; j++) if (root.children[j].name === ORBI.margens.BIN) return root.children[j];
  return root;
};

ORBI.margens.findItem = function (bin, fileName) {
  for (var i = 0; i < bin.children.numItems; i++) {
    var c = bin.children[i];
    var p = c.getMediaPath ? c.getMediaPath() : '';
    if (c.name === fileName || (p && ORBI.slash(p).split('/').pop() === fileName)) return c;
  }
  return null;
};

ORBI.margens.addGuide = function (a) {
  var seq = ORBI.ppro.activeSequence();
  var fileName = ORBI.slash(a.file).split('/').pop();
  var bin = ORBI.margens.bin();
  var item = ORBI.margens.findItem(bin, fileName);
  if (!item) {
    app.project.importFiles([a.file], true, bin, false);
    item = ORBI.margens.findItem(bin, fileName);
  }
  if (!item) ORBI.fail('Não consegui importar a guia: ' + a.file);

  // Faixa de vídeo mais alta; cria uma nova se estiver ocupada.
  var top = seq.videoTracks[seq.videoTracks.numTracks - 1];
  if (top.clips.numItems > 0) {
    try {
      app.enableQE();
      qe.project.getActiveSequence().addTracks(1, seq.videoTracks.numTracks, 0);
    } catch (e) { /* QE indisponível */ }
    top = seq.videoTracks[seq.videoTracks.numTracks - 1];
    if (top.clips.numItems > 0) ORBI.fail('Crie uma faixa de vídeo vazia acima de todas e tente de novo.');
  }
  top.overwriteClip(item, 0);
  var info = ORBI.ppro.seqInfo(seq);
  var clip = top.clips[top.clips.numItems - 1];
  if (clip && info.end > 0) {
    try { clip.end = ORBI.ppro.time(info.end); } catch (e2) { /* duração padrão de still */ }
  }
  try { top.setLocked(1); } catch (e3) { /* ok */ }
  return {};
};

ORBI.margens.removeGuides = function () {
  var seq = ORBI.ppro.activeSequence();
  var n = 0;
  for (var t = 0; t < seq.videoTracks.numTracks; t++) {
    var tr = seq.videoTracks[t];
    var wasLocked = false;
    try { wasLocked = tr.isLocked(); if (wasLocked) tr.setLocked(0); } catch (e) { /* ok */ }
    for (var i = tr.clips.numItems - 1; i >= 0; i--) {
      var c = tr.clips[i];
      if (c.projectItem && c.projectItem.name.indexOf(ORBI.margens.PREFIX) === 0) { c.remove(false, false); n++; }
    }
    try { if (wasLocked) tr.setLocked(1); } catch (e2) { /* ok */ }
  }
  return { count: n };
};
