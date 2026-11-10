/*
 * ORBI BeatMarker — host After Effects.
 */
ORBI.beatmarker = ORBI.beatmarker || {};

ORBI.beatmarker.getSource = function () {
  var comp = ORBI.ae.activeComp();
  var sel = comp.selectedLayers;
  var L = null;
  for (var i = 0; i < sel.length; i++) if (sel[i].hasAudio && ORBI.ae.layerSource(sel[i])) { L = sel[i]; break; }
  if (!L) ORBI.fail('Selecione a camada de música (arquivo de áudio ou vídeo com áudio).');
  return {
    path: ORBI.ae.layerSource(L),
    name: L.name,
    inPoint: ORBI.ae.toSource(L, L.inPoint),
    outPoint: ORBI.ae.toSource(L, L.outPoint),
    start: L.inPoint,
    speed: 100 / L.stretch,
    layer: L.index
  };
};

ORBI.beatmarker.addMarkers = function (a) {
  var comp = ORBI.ae.activeComp();
  app.beginUndoGroup('ORBI BeatMarker');
  try {
    var items = [];
    for (var i = 0; i < a.times.length; i++) items.push({ start: a.times[i], end: 0, name: 'Beat ' + (i + 1) });
    if (a.target === 'comp') {
      if (!comp.markerProperty) ORBI.fail('Marcadores de composição exigem After Effects 2023 ou mais novo.');
      for (var k = 0; k < items.length; k++) {
        var mv = new MarkerValue(items[k].name);
        mv.comment = a.tag;
        comp.markerProperty.setValueAtTime(items[k].start, mv);
      }
      return { count: items.length };
    }
    return { count: ORBI.ae.addLayerMarkers(comp.layer(a.layer), items, 'Beat', a.tag) };
  } finally {
    app.endUndoGroup();
  }
};

ORBI.beatmarker.clearMarkers = function (a) {
  var comp = ORBI.ae.activeComp();
  var n = 0;
  app.beginUndoGroup('ORBI BeatMarker: limpar');
  try {
    for (var i = 1; i <= comp.numLayers; i++) n += ORBI.ae.clearLayerMarkers(comp.layer(i), a.tag);
    var mp = comp.markerProperty;
    if (mp) for (var k = mp.numKeys; k >= 1; k--) if (mp.keyValue(k).comment === a.tag) { mp.removeKey(k); n++; }
  } finally {
    app.endUndoGroup();
  }
  return { count: n };
};
