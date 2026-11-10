/*
 * Orbi AutoSoundFX — host Premiere Pro.
 * Draft Creative Studio Ltda · Daniel Rodrigues
 */
ORBI.soundfx = ORBI.soundfx || {};
ORBI.soundfx.PREFIX = 'orbi-sfx-';
ORBI.soundfx.BIN = 'Orbi SFX';

/** Pontos de corte (inícios de clipe numa faixa de vídeo) ou marcadores da sequência. */
ORBI.soundfx.getPoints = function (a) {
  var seq = ORBI.ppro.activeSequence();
  var info = ORBI.ppro.seqInfo(seq);
  var pts = [];
  if (a.source === 'markers') {
    var m = seq.markers.getFirstMarker();
    while (m) { pts.push(m.start.seconds); m = seq.markers.getNextMarker(m); }
  } else {
    var tr = seq.videoTracks[a.track || 0];
    if (!tr) ORBI.fail('A sequência não tem a faixa V' + ((a.track || 0) + 1) + '.');
    for (var i = 0; i < tr.clips.numItems; i++) {
      var s = tr.clips[i].start.seconds;
      if (s > 0.001) pts.push(s);
    }
  }
  pts.sort(function (x, y) { return x - y; });
  return { points: pts, end: info.end, audioTracks: seq.audioTracks.numTracks };
};

ORBI.soundfx.bin = function () {
  var root = app.project.rootItem;
  for (var i = 0; i < root.children.numItems; i++) {
    var c = root.children[i];
    if (c.type === ProjectItemType.BIN && c.name === ORBI.soundfx.BIN) return c;
  }
  var b = root.createBin(ORBI.soundfx.BIN);
  if (b) return b;
  for (var j = 0; j < root.children.numItems; j++) if (root.children[j].name === ORBI.soundfx.BIN) return root.children[j];
  return root;
};

ORBI.soundfx.item = function (bin, file) {
  var name = ORBI.slash(file).split('/').pop();
  for (var i = 0; i < bin.children.numItems; i++) {
    var c = bin.children[i];
    if (c.name === name) return c;
  }
  app.project.importFiles([file], true, bin, false);
  for (var k = 0; k < bin.children.numItems; k++) if (bin.children[k].name === name) return bin.children[k];
  ORBI.fail('Não consegui importar ' + name);
};

/** Algum clipe da faixa encosta em [s, e)? (evita sobrescrever áudio existente) */
ORBI.soundfx.busy = function (track, s, e) {
  for (var i = 0; i < track.clips.numItems; i++) {
    var c = track.clips[i];
    if (c.start.seconds < e - 0.001 && c.end.seconds > s + 0.001) return true;
  }
  return false;
};

/** items: [{file, time, duration}] — time já com o pico alinhado. */
ORBI.soundfx.place = function (a) {
  var seq = ORBI.ppro.activeSequence();
  var tIdx = a.audioTrack;
  if (tIdx >= seq.audioTracks.numTracks) {
    try { app.enableQE(); qe.project.getActiveSequence().addTracks(0, 0, tIdx - seq.audioTracks.numTracks + 1); } catch (e) { /* QE indisponível */ }
  }
  var track = seq.audioTracks[tIdx];
  if (!track) ORBI.fail('Crie a faixa A' + (tIdx + 1) + ' (ou escolha outra) e tente de novo.');
  var bin = ORBI.soundfx.bin();
  var placed = 0, skipped = 0;
  for (var i = 0; i < a.items.length; i++) {
    var it = a.items[i];
    var s = Math.max(0, it.time);
    if (ORBI.soundfx.busy(track, s, s + it.duration)) { skipped++; continue; }
    track.overwriteClip(ORBI.soundfx.item(bin, it.file), s);
    placed++;
  }
  return { placed: placed, skipped: skipped, track: 'A' + (tIdx + 1) };
};

ORBI.soundfx.clear = function () {
  var seq = ORBI.ppro.activeSequence();
  var n = 0;
  for (var t = 0; t < seq.audioTracks.numTracks; t++) {
    var tr = seq.audioTracks[t];
    for (var i = tr.clips.numItems - 1; i >= 0; i--) {
      var c = tr.clips[i];
      if (c.projectItem && c.projectItem.name.indexOf(ORBI.soundfx.PREFIX) === 0) { c.remove(false, false); n++; }
    }
  }
  return { count: n };
};
