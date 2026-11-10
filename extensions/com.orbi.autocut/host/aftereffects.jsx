/*
 * ORBI Autocut — host After Effects.
 * Draft Creative Studio Ltda · Daniel Rodrigues
 */
ORBI.autocut = ORBI.autocut || {};

/** Usa a primeira camada selecionada com áudio como referência. */
ORBI.autocut.getClips = function (a) {
  var comp = ORBI.ae.activeComp();
  var sel = comp.selectedLayers;
  if (!sel.length) ORBI.fail('Selecione uma camada com áudio.');
  var guide = null;
  for (var i = 0; i < sel.length; i++) {
    if (sel[i].hasAudio && ORBI.ae.layerSource(sel[i])) { guide = sel[i]; break; }
  }
  if (!guide) ORBI.fail('Nenhuma camada selecionada tem áudio de arquivo (pré-comps não são suportadas ainda).');
  if (guide.stretch <= 0) ORBI.fail('Camadas com tempo invertido não são suportadas.');
  var layers = [guide.index];
  if (a.selectedOnly) {
    for (var k = 0; k < sel.length; k++) if (sel[k] !== guide) layers.push(sel[k].index);
  }
  return {
    name: comp.name,
    fps: comp.frameRate,
    width: comp.width,
    height: comp.height,
    end: comp.duration,
    layers: layers,
    clips: [{
      path: ORBI.ae.layerSource(guide),
      name: guide.name,
      inPoint: ORBI.ae.toSource(guide, guide.inPoint),
      outPoint: ORBI.ae.toSource(guide, guide.outPoint),
      start: guide.inPoint,
      hasVideo: guide.hasVideo,
      audioChannels: 2,
      speed: 100 / guide.stretch
    }]
  };
};

/**
 * Divide cada camada nos trechos (tempo de composição) e junta os trechos,
 * fechando os buracos. Suporta zoom de corte (HyperCut) e J/L-cut: neste caso
 * o áudio vira uma camada separada, estendida antes (J) ou depois (L).
 * As camadas originais ficam desativadas.
 */
ORBI.autocut.apply = function (a) {
  var comp = ORBI.ae.activeComp();
  var segs = a.segments;
  var frame = comp.frameDuration;
  var ref = (typeof a.refStart === 'number') ? a.refStart : (segs.length ? segs[0].start : 0);
  app.beginUndoGroup('Orbi Autocut');
  try {
    var made = 0, touched = 0;
    for (var li = 0; li < a.layers.length; li++) {
      var L = comp.layer(a.layers[li]);
      var any = false;
      for (var j = 0; j < segs.length; j++) {
        var g = segs[j];
        // Mesmo deslocamento para todas as camadas: mantém o sincronismo.
        var delta = g.start - (ref + g.packedStart);
        var s = Math.max(g.start, L.inPoint);
        var e = Math.min(g.end, L.outPoint);
        if (e - s < frame) continue;
        var splitAudio = L.hasAudio && L.hasVideo && (g.audioLead > 0 || g.audioLag > 0);
        var v = L.duplicate();
        v.inPoint = s;
        v.outPoint = e;
        v.startTime = v.startTime - delta;
        v.name = L.name + ' ✂ ' + (j + 1);
        if (g.scale && Math.abs(g.scale - 100) > 0.001 && L.hasVideo) {
          var sp = v.property('ADBE Transform Group').property('ADBE Scale');
          var cur = sp.value;
          var k = g.scale / 100;
          sp.setValue(cur.length === 3 ? [cur[0] * k, cur[1] * k, cur[2]] : [cur[0] * k, cur[1] * k]);
        }
        if (splitAudio) {
          v.audioEnabled = false;
          var au = L.duplicate();
          au.inPoint = Math.max(g.start - g.audioLead, L.inPoint);
          au.outPoint = Math.min(g.end + g.audioLag, L.outPoint);
          au.startTime = au.startTime - delta;
          au.enabled = false;
          au.audioEnabled = true;
          au.name = L.name + ' ♪ ' + (j + 1);
          au.shy = true;
        }
        made++;
        any = true;
      }
      if (any) {
        L.enabled = false;
        if (L.hasAudio) L.audioEnabled = false;
        L.shy = true;
        touched++;
      }
    }
  } finally {
    app.endUndoGroup();
  }
  return { segments: made, layers: touched };
};

ORBI.autocut.addMarkers = function (a) {
  var comp = ORBI.ae.activeComp();
  var n = 0;
  for (var i = 0; i < a.layers.length; i++) n += ORBI.ae.addLayerMarkers(comp.layer(a.layers[i]), a.ranges, 'Silêncio', a.tag);
  return { count: n };
};

ORBI.autocut.clearMarkers = function (a) {
  var comp = ORBI.ae.activeComp();
  var n = 0;
  for (var i = 1; i <= comp.numLayers; i++) n += ORBI.ae.clearLayerMarkers(comp.layer(i), a.tag);
  return { count: n };
};
