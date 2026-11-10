/*
 * ORBI Autocut — host Premiere Pro.
 * Draft Creative Studio Ltda · Daniel Rodrigues
 */
ORBI.autocut = ORBI.autocut || {};

/** Lista os clipes da faixa de áudio escolhida, com tempos em segundos. */
ORBI.autocut.getClips = function (a) {
  var seq = ORBI.ppro.activeSequence();
  var info = ORBI.ppro.seqInfo(seq);
  var track = seq.audioTracks[a.track || 0];
  if (!track) ORBI.fail('A sequência não tem a faixa A' + ((a.track || 0) + 1) + '.');
  var clips = [];
  for (var i = 0; i < track.clips.numItems; i++) {
    var c = track.clips[i];
    if (a.selectedOnly && !c.isSelected()) continue;
    var pi = c.projectItem;
    if (!pi) continue;
    var path = pi.getMediaPath();
    if (!path) continue;
    var speed = 1;
    try { speed = c.getSpeed(); } catch (e) { /* versões antigas */ }
    clips.push({
      path: path,
      name: c.name,
      inPoint: c.inPoint.seconds,
      outPoint: c.outPoint.seconds,
      start: c.start.seconds,
      hasVideo: ORBI.ppro.hasLinkedVideo(seq, pi, c.start.seconds),
      audioChannels: 2,
      speed: speed
    });
  }
  info.clips = clips;
  info.layers = [];
  return info;
};

/** Importa o XML gerado pelo motor e abre a nova sequência. */
ORBI.autocut.importXml = function (a) {
  var before = {};
  for (var i = 0; i < app.project.sequences.numSequences; i++) before[app.project.sequences[i].sequenceID] = true;
  var ok = app.project.importFiles([a.path], true, app.project.getInsertionBin(), false);
  if (!ok) ORBI.fail('O Premiere recusou o XML: ' + a.path);
  var created = null;
  for (var j = 0; j < app.project.sequences.numSequences; j++) {
    var s = app.project.sequences[j];
    if (!before[s.sequenceID]) created = s;
  }
  if (!created) ORBI.fail('XML importado, mas a nova sequência não foi encontrada.');
  try { created.name = a.name; } catch (e) { /* nome somente leitura em versões antigas */ }
  app.project.openSequence(created.sequenceID);
  return { sequence: created.name };
};

ORBI.autocut.addMarkers = function (a) {
  var seq = ORBI.ppro.activeSequence();
  return { count: ORBI.ppro.addMarkers(seq, a.ranges, 'Silêncio', a.tag, 1) };
};

ORBI.autocut.clearMarkers = function (a) {
  return { count: ORBI.ppro.clearMarkers(ORBI.ppro.activeSequence(), a.tag) };
};
