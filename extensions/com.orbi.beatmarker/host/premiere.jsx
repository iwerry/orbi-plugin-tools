/*
 * ORBI BeatMarker — host Premiere Pro.
 */
ORBI.beatmarker = ORBI.beatmarker || {};

/** Primeiro clipe de áudio selecionado (ou, sem seleção, o que está sob a agulha em A1..An). */
ORBI.beatmarker.getSource = function () {
  var seq = ORBI.ppro.activeSequence();
  var ph = seq.getPlayerPosition().seconds;
  var pick = null, under = null;
  for (var t = 0; t < seq.audioTracks.numTracks && !pick; t++) {
    var clips = seq.audioTracks[t].clips;
    for (var i = 0; i < clips.numItems; i++) {
      var c = clips[i];
      if (!c.projectItem || !c.projectItem.getMediaPath()) continue;
      if (c.isSelected()) { pick = c; break; }
      if (!under && c.start.seconds <= ph && c.end.seconds > ph) under = c;
    }
  }
  pick = pick || under;
  if (!pick) ORBI.fail('Selecione o clipe de música na timeline (ou posicione a agulha sobre ele).');
  var speed = 1;
  try { speed = pick.getSpeed(); } catch (e) { /* ok */ }
  return {
    path: pick.projectItem.getMediaPath(),
    name: pick.name,
    inPoint: pick.inPoint.seconds,
    outPoint: pick.outPoint.seconds,
    start: pick.start.seconds,
    speed: speed || 1,
    layer: 0
  };
};

ORBI.beatmarker.addMarkers = function (a) {
  var seq = ORBI.ppro.activeSequence();
  var items = [];
  for (var i = 0; i < a.times.length; i++) items.push({ start: a.times[i], end: 0, name: 'Beat ' + (i + 1) });
  return { count: ORBI.ppro.addMarkers(seq, items, 'Beat', a.tag, 3) };
};

ORBI.beatmarker.clearMarkers = function (a) {
  return { count: ORBI.ppro.clearMarkers(ORBI.ppro.activeSequence(), a.tag) };
};
