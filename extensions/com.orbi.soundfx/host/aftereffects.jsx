/*
 * Orbi AutoSoundFX — host After Effects.
 * Draft Creative Studio Ltda · Daniel Rodrigues
 */
ORBI.soundfx = ORBI.soundfx || {};
ORBI.soundfx.PREFIX = 'orbi-sfx-';
ORBI.soundfx.FOLDER = 'Orbi SFX';

/** Cortes = pontos de entrada das camadas selecionadas; marcadores = da camada selecionada e da comp. */
ORBI.soundfx.getPoints = function (a) {
  var comp = ORBI.ae.activeComp();
  var sel = comp.selectedLayers;
  var pts = [];
  if (a.source === 'markers') {
    for (var i = 0; i < sel.length; i++) {
      var mp = sel[i].property('ADBE Marker');
      for (var k = 1; k <= mp.numKeys; k++) pts.push(mp.keyTime(k));
    }
    if (comp.markerProperty) for (var c = 1; c <= comp.markerProperty.numKeys; c++) pts.push(comp.markerProperty.keyTime(c));
  } else {
    if (sel.length < 2) ORBI.fail('Selecione as camadas cortadas (ex.: os trechos ✂ do Autocut).');
    for (var j = 0; j < sel.length; j++) pts.push(sel[j].inPoint);
    pts.sort(function (x, y) { return x - y; });
    pts.shift(); // o primeiro trecho não é um corte
  }
  pts.sort(function (x, y) { return x - y; });
  return { points: pts, end: comp.duration, audioTracks: 0 };
};

ORBI.soundfx.folder = function () {
  for (var i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    if (it instanceof FolderItem && it.name === ORBI.soundfx.FOLDER) return it;
  }
  return app.project.items.addFolder(ORBI.soundfx.FOLDER);
};

ORBI.soundfx.footage = function (file) {
  var f = new File(file);
  for (var i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) return it;
  }
  var fo = app.project.importFile(new ImportOptions(f));
  fo.parentFolder = ORBI.soundfx.folder();
  return fo;
};

ORBI.soundfx.place = function (a) {
  var comp = ORBI.ae.activeComp();
  app.beginUndoGroup('Orbi AutoSoundFX');
  var placed = 0;
  try {
    for (var i = 0; i < a.items.length; i++) {
      var it = a.items[i];
      var L = comp.layers.add(ORBI.soundfx.footage(it.file));
      L.startTime = it.time;
      L.moveToEnd();
      L.name = 'Orbi SFX · ' + it.label;
      L.label = 11; // laranja (áudio)
      placed++;
    }
  } finally {
    app.endUndoGroup();
  }
  return { placed: placed, skipped: 0, track: 'camadas' };
};

ORBI.soundfx.clear = function () {
  var comp = ORBI.ae.activeComp();
  var n = 0;
  app.beginUndoGroup('Orbi AutoSoundFX: remover');
  try {
    for (var i = comp.numLayers; i >= 1; i--) {
      var L = comp.layer(i);
      if (L.source && L.source.name && L.source.name.indexOf(ORBI.soundfx.PREFIX) === 0) { L.remove(); n++; }
    }
  } finally {
    app.endUndoGroup();
  }
  return { count: n };
};
