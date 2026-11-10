/*
 * Orbi Legendas — host After Effects: uma camada de texto por bloco, com estilo e animação escolhidos no painel.
 * Draft Creative Studio Ltda · Daniel Rodrigues
 */
ORBI.captions = ORBI.captions || {};
ORBI.captions.TAG = 'orbi:caption';

ORBI.captions.hex = function (h) {
  return [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255];
};

// Animações de entrada (0,3 s) e saída suave (0,12 s no fim do bloco).
ORBI.captions.animate = function (tr, t0, t1, kind, w, h, cx, cy) {
  var IN = 0.18, OUT = 0.12;
  var tail = (t1 - t0) > (IN + OUT + 0.1);
  var op = tr.property('ADBE Opacity');
  var pos = tr.property('ADBE Position');
  var sc = tr.property('ADBE Scale');
  if (kind === 'pop') {
    sc.setValueAtTime(t0, [70, 70]);
    sc.setValueAtTime(t0 + 0.08, [110, 110]);
    sc.setValueAtTime(t0 + 0.16, [100, 100]);
  } else if (kind === 'bounce') {
    sc.setValueAtTime(t0, [0, 0]);
    sc.setValueAtTime(t0 + 0.12, [120, 120]);
    sc.setValueAtTime(t0 + 0.24, [92, 92]);
    sc.setValueAtTime(t0 + 0.32, [100, 100]);
  } else if (kind === 'fade') {
    op.setValueAtTime(t0, 0);
    op.setValueAtTime(t0 + IN, 100);
  } else if (kind === 'subir') {
    op.setValueAtTime(t0, 0);
    op.setValueAtTime(t0 + IN, 100);
    pos.setValueAtTime(t0, [cx, cy + h * 0.06]);
    pos.setValueAtTime(t0 + 0.22, [cx, cy]);
  }
  if (tail && kind !== 'nenhuma') {
    op.setValueAtTime(t1 - OUT, 100);
    op.setValueAtTime(t1, 0);
  }
};

// Nome da camada = texto da legenda (qualquer idioma), numa linha só e com no máximo 60 caracteres.
ORBI.captions.layerName = function (text, i) {
  var s = String(text).replace(/[\r\n\t\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  var MAX = 60;
  if (s.length > MAX) {
    var cut = MAX - 1;
    var code = s.charCodeAt(cut - 1);
    if (code >= 0xD800 && code <= 0xDBFF) cut--; // não corta um emoji/caractere raro ao meio
    s = s.substr(0, cut) + '…';
  }
  return s || ('Orbi Legenda ' + (i + 1));
};

ORBI.captions.create = function (a) {
  var comp = ORBI.ae.activeComp();
  var st = a.style;
  app.beginUndoGroup('Orbi Legendas');
  var n = 0;
  var cx = comp.width / 2, cy = comp.height * st.y / 100;
  try {
    for (var i = 0; i < a.chunks.length; i++) {
      var c = a.chunks[i];
      if (c.start >= comp.duration) break;
      var L = comp.layers.addText(c.text);
      var tp = L.property('ADBE Text Properties').property('ADBE Text Document');
      var td = tp.value;
      td.fontSize = st.size;
      td.fillColor = ORBI.captions.hex(i % 2 && st.alternate ? st.accent : st.color);
      td.applyStroke = st.stroke > 0;
      td.strokeColor = [0, 0, 0];
      td.strokeWidth = st.stroke;
      td.strokeOverFill = false;
      td.justification = ParagraphJustification.CENTER_JUSTIFY;
      try { td.font = st.font; } catch (e) { /* fonte ausente: usa a padrão */ }
      tp.setValue(td);
      L.inPoint = c.start;
      L.outPoint = Math.min(c.end, comp.duration);
      var tr = L.property('ADBE Transform Group');
      tr.property('ADBE Position').setValue([cx, cy]);
      ORBI.captions.animate(tr, c.start, Math.min(c.end, comp.duration), st.anim, comp.width, comp.height, cx, cy);
      L.name = ORBI.captions.layerName(c.text, i);
      L.comment = ORBI.captions.TAG;
      n++;
    }
  } finally {
    app.endUndoGroup();
  }
  return { count: n };
};

ORBI.captions.clear = function () {
  var comp = ORBI.ae.activeComp();
  var n = 0;
  app.beginUndoGroup('Orbi Legendas: remover');
  try {
    for (var i = comp.numLayers; i >= 1; i--) if (comp.layer(i).comment === ORBI.captions.TAG) { comp.layer(i).remove(); n++; }
  } finally {
    app.endUndoGroup();
  }
  return { count: n };
};
