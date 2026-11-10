/*
 * Orbi Plugin Tools — núcleo ExtendScript compartilhado (Premiere e After Effects).
 * Draft Creative Studio Ltda · Daniel Rodrigues
 *
 * Todas as extensões ORBI compartilham o mesmo motor ExtendScript do app,
 * então este arquivo é idempotente e tudo fica sob o namespace global ORBI.
 */
if (typeof ORBI === 'undefined') { ORBI = {}; }

ORBI.version = '0.2.0';

/** JSON.stringify mínimo (ExtendScript é ES3 e não tem JSON nativo). */
ORBI.json = function (v) {
  var t = typeof v;
  if (v === null || t === 'undefined') return 'null';
  if (t === 'number') return isFinite(v) ? String(v) : 'null';
  if (t === 'boolean') return v ? 'true' : 'false';
  if (t === 'string') {
    return '"' + v.replace(/[\\"\u0000-\u001f\u2028\u2029]/g, function (c) {
      var m = { '"': '\\"', '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t' };
      if (m[c]) return m[c];
      var h = c.charCodeAt(0).toString(16);
      return '\\u' + ('0000' + h).slice(-4);
    }) + '"';
  }
  if (v instanceof Array) {
    var a = [];
    for (var i = 0; i < v.length; i++) a.push(ORBI.json(v[i]));
    return '[' + a.join(',') + ']';
  }
  if (t === 'object') {
    var o = [];
    for (var k in v) {
      if (v.hasOwnProperty(k) && typeof v[k] !== 'function') o.push(ORBI.json(String(k)) + ':' + ORBI.json(v[k]));
    }
    return '{' + o.join(',') + '}';
  }
  return 'null';
};

/** Resolve "autocut.getClips" dentro de ORBI[app] e executa com tratamento de erro. */
ORBI.run = function (path, args) {
  try {
    var parts = path.split('.');
    var obj = ORBI;
    for (var i = 0; i < parts.length; i++) {
      obj = obj[parts[i]];
      if (obj === undefined) throw new Error('Função não encontrada: ORBI.' + path);
    }
    var r = obj(args || {});
    if (r === undefined || r === null) r = {};
    r.ok = true;
    return ORBI.json(r);
  } catch (e) {
    return ORBI.json({ ok: false, error: String(e.message || e) + (e.line ? ' (linha ' + e.line + ')' : '') });
  }
};

ORBI.fail = function (msg) { throw new Error(msg); };

/** Caminho com barras normais. */
ORBI.slash = function (p) { return String(p).replace(/\\/g, '/'); };

/* ---------- Premiere Pro ---------- */
ORBI.ppro = ORBI.ppro || {};
ORBI.ppro.TICKS = 254016000000;

ORBI.ppro.activeSequence = function () {
  var seq = app.project.activeSequence;
  if (!seq) ORBI.fail('Abra uma sequência na timeline.');
  return seq;
};

ORBI.ppro.seqInfo = function (seq) {
  var s = seq.getSettings();
  var fps = 1 / s.videoFrameRate.seconds;
  return {
    name: seq.name,
    fps: fps,
    width: s.videoFrameWidth,
    height: s.videoFrameHeight,
    end: parseFloat(seq.end) / ORBI.ppro.TICKS,
    playhead: seq.getPlayerPosition().seconds
  };
};

ORBI.ppro.time = function (sec) { var t = new Time(); t.seconds = sec; return t; };

/** Procura um clipe de vídeo do mesmo item de projeto começando no mesmo instante. */
ORBI.ppro.hasLinkedVideo = function (seq, projectItem, startSec) {
  for (var t = 0; t < seq.videoTracks.numTracks; t++) {
    var clips = seq.videoTracks[t].clips;
    for (var i = 0; i < clips.numItems; i++) {
      var c = clips[i];
      if (c.projectItem && c.projectItem.nodeId === projectItem.nodeId && Math.abs(c.start.seconds - startSec) < 0.01) return true;
    }
  }
  return false;
};

/** Cria marcadores de sequência. ranges: [{start,end}] ou números. */
ORBI.ppro.addMarkers = function (seq, items, name, tag, colorIndex) {
  var n = 0;
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var start = typeof it === 'number' ? it : it.start;
    var m = seq.markers.createMarker(start);
    m.name = it.name || name;
    m.comments = tag;
    if (typeof it !== 'number' && it.end > it.start) m.end = it.end;
    try { m.setColorByIndex(colorIndex); } catch (e) { /* versões antigas */ }
    n++;
  }
  return n;
};

/** Remove marcadores cujo comentário seja `tag`. */
ORBI.ppro.clearMarkers = function (seq, tag) {
  var n = 0;
  var m = seq.markers.getFirstMarker();
  while (m) {
    var next = seq.markers.getNextMarker(m);
    if (m.comments === tag) { seq.markers.deleteMarker(m); n++; }
    m = next;
  }
  return n;
};

/* ---------- After Effects ---------- */
ORBI.ae = ORBI.ae || {};

ORBI.ae.activeComp = function () {
  var c = app.project.activeItem;
  if (!c || !(c instanceof CompItem)) ORBI.fail('Abra uma composição.');
  return c;
};

ORBI.ae.layerSource = function (layer) {
  if (!layer.source || !layer.source.file) return null;
  return layer.source.file.fsName;
};

/** Tempo de origem (s) de uma camada para um tempo de composição. */
ORBI.ae.toSource = function (layer, compTime) {
  return (compTime - layer.startTime) / (layer.stretch / 100);
};

ORBI.ae.addLayerMarkers = function (layer, items, name, tag) {
  var prop = layer.property('ADBE Marker');
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var start = typeof it === 'number' ? it : it.start;
    var mv = new MarkerValue(it.name || name);
    mv.comment = tag;
    if (typeof it !== 'number' && it.end > it.start) mv.duration = it.end - it.start;
    prop.setValueAtTime(start, mv);
  }
  return items.length;
};

ORBI.ae.clearLayerMarkers = function (layer, tag) {
  var prop = layer.property('ADBE Marker');
  var n = 0;
  for (var k = prop.numKeys; k >= 1; k--) {
    if (prop.keyValue(k).comment === tag) { prop.removeKey(k); n++; }
  }
  return n;
};
