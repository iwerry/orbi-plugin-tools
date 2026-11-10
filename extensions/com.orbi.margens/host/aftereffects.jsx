/*
 * ORBI Margens — host After Effects (camada-guia: aparece no preview, não renderiza).
 */
ORBI.margens = ORBI.margens || {};
ORBI.margens.PREFIX = 'orbi-guide-';
ORBI.margens.FOLDER = 'Orbi Guias';

ORBI.margens.frameSize = function () {
  var c = ORBI.ae.activeComp();
  return { width: c.width, height: c.height };
};

ORBI.margens.folder = function () {
  for (var i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    if (it instanceof FolderItem && it.name === ORBI.margens.FOLDER) return it;
  }
  return app.project.items.addFolder(ORBI.margens.FOLDER);
};

ORBI.margens.addGuide = function (a) {
  var comp = ORBI.ae.activeComp();
  app.beginUndoGroup('ORBI Margens');
  try {
    var f = new File(a.file);
    if (!f.exists) ORBI.fail('Arquivo da guia não encontrado: ' + a.file);
    var footage = null;
    for (var i = 1; i <= app.project.numItems; i++) {
      var it = app.project.item(i);
      if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) { footage = it; break; }
    }
    if (!footage) {
      footage = app.project.importFile(new ImportOptions(f));
      footage.parentFolder = ORBI.margens.folder();
    }
    var L = comp.layers.add(footage);
    L.name = 'Orbi Guia · ' + a.label;
    L.guideLayer = true;
    L.inPoint = 0;
    L.outPoint = comp.duration;
    L.locked = true;
  } finally {
    app.endUndoGroup();
  }
  return {};
};

ORBI.margens.removeGuides = function () {
  var comp = ORBI.ae.activeComp();
  var n = 0;
  app.beginUndoGroup('ORBI Margens: remover');
  try {
    for (var i = comp.numLayers; i >= 1; i--) {
      var L = comp.layer(i);
      if (L.source && L.source.name && L.source.name.indexOf(ORBI.margens.PREFIX) === 0) {
        L.locked = false;
        L.remove();
        n++;
      }
    }
  } finally {
    app.endUndoGroup();
  }
  return { count: n };
};
