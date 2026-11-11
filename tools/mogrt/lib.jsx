/*
 * Biblioteca do gerador de .mogrt (After Effects → Premiere).
 * Cada preset é { name, category, build(comp) } e vira "<category>/<name>.mogrt".
 * Orbi Plugin Tools · Draft Creative Studio Ltda · Daniel Rodrigues
 *
 * Convenções:
 * - Comp 1920x1080, 30 fps, 3 s. Regiões protegidas no início e no fim (tempo responsivo no Premiere).
 * - Controles expostos em inglês: Text, Text Color, Highlight Color, Box Color, Position, Scale.
 * - Animações por expressão usando `value`, então Position/Scale continuam editáveis no Premiere.
 */
var M = {
  W: 1920, H: 1080, FPS: 30, DUR: 3, IN: 0.45, OUT: 0.2,
  presets: []
};

/**
 * Registra um preset. category pode ter subpastas ("Titles/Cinematic").
 * opts: { dur: segundos (padrão 3), inDur, outDur (regiões protegidas), protect: false (estica tudo), thumb: 0–1 }
 */
M.add = function (category, name, build, opts) {
  M.presets.push({ category: category, name: name, build: build, opts: opts || {} });
};

/** Cria a pasta e as intermediárias. */
M.mkdirs = function (path) {
  var parts = path.replace(/\\/g, '/').split('/');
  var cur = parts[0];
  for (var i = 1; i < parts.length; i++) {
    cur += '/' + parts[i];
    var f = new Folder(cur);
    if (!f.exists) f.create();
  }
  return new Folder(path);
};

M.rgb = function (hex) {
  return [parseInt(hex.substr(1, 2), 16) / 255, parseInt(hex.substr(3, 2), 16) / 255, parseInt(hex.substr(5, 2), 16) / 255];
};

/** Camada de texto centralizada. o: {text, font, size, color, stroke, strokeColor, caps, tracking, leading} */
M.text = function (comp, o) {
  var L = comp.layers.addText(o.text || 'YOUR TEXT HERE');
  L.name = o.name || 'Text';
  var tp = L.property('ADBE Text Properties').property('ADBE Text Document');
  var td = tp.value;
  try { td.font = o.font || 'Montserrat-Bold'; } catch (e) { /* fonte ausente */ }
  td.fontSize = o.size || 72;
  td.fillColor = M.rgb(o.color || '#ffffff');
  td.applyFill = true;
  td.applyStroke = (o.stroke || 0) > 0;
  if (td.applyStroke) {
    td.strokeColor = M.rgb(o.strokeColor || '#000000');
    td.strokeWidth = o.stroke;
    td.strokeOverFill = false;
  }
  td.justification = o.justify === 'left' ? ParagraphJustification.LEFT_JUSTIFY : ParagraphJustification.CENTER_JUSTIFY;
  if (o.leading) { td.autoLeading = false; td.leading = o.leading; }
  if (o.caps) {
    // AE 24+: allCaps é somente leitura; o caminho é fontCapsOption.
    try { td.fontCapsOption = FontCapsOption.FONT_ALL_CAPS; } catch (e) { try { td.allCaps = true; } catch (e2) { /* sem caixa alta */ } }
  }
  if (o.tracking !== undefined) td.tracking = o.tracking;
  tp.setValue(td);
  L.property('ADBE Transform Group').property('ADBE Position').setValue([o.x !== undefined ? o.x : M.W / 2, o.y !== undefined ? o.y : M.H * 0.82]);
  return L;
};

M.effect = function (layer, match, name) {
  var fx = layer.property('ADBE Effect Parade').addProperty(match);
  if (name) fx.name = name;
  return fx;
};

/**
 * Controle de cor (Color Control) com nome em inglês.
 * Devolve um "endereço" {layer, fx}: adicionar outro efeito invalida referências antigas no AE,
 * então a propriedade só é buscada na hora de expor (M.resolve).
 */
M.colorCtrl = function (layer, name, hex) {
  var fx = M.effect(layer, 'ADBE Color Control', name);
  fx.property(1).setValue(M.rgb(hex));
  return { layer: layer, fx: name };
};

M.resolve = function (r) {
  if (!r) return null;
  if (r.fx) return r.layer.property('ADBE Effect Parade').property(r.fx).property(1);
  if (r.kind === 'text') return r.layer.property('ADBE Text Properties').property('ADBE Text Document');
  if (r.kind === 'position') return r.layer.property('ADBE Transform Group').property('ADBE Position');
  if (r.kind === 'scale') return r.layer.property('ADBE Transform Group').property('ADBE Scale');
  return r;
};

/** Animador de texto. kind: 'range' (tudo) ou 'expr' (seletor por expressão). basedOn: 1 chars, 3 words. */
M.animator = function (layer, name, kind, basedOn) {
  var anims = layer.property('ADBE Text Properties').property('ADBE Text Animators');
  var a = anims.addProperty('ADBE Text Animator');
  a.name = name;
  var sel = a.property('ADBE Text Selectors').addProperty(kind === 'expr' ? 'ADBE Text Expressible Selector' : 'ADBE Text Selector');
  if (kind === 'expr' && basedOn) sel.property('ADBE Text Range Type2').setValue(basedOn);
  return { animator: a, props: a.property('ADBE Text Animator Properties'), selector: sel };
};

/** Cor do texto controlada por "Text Color" (animador por cima de tudo, sem Fill que apagaria destaques). */
M.textColor = function (layer, hex, label) {
  var c = M.colorCtrl(layer, label || 'Text Color', hex);
  var a = M.animator(layer, 'Base Color', 'range');
  a.props.addProperty('ADBE Text Fill Color').expression = 'effect("' + (label || 'Text Color') + '")(1)';
  return c;
};

/** Agrupamento do ponto de ancoragem por palavra (escala/pop por palavra). */
M.anchorByWord = function (layer) {
  try { layer.property('ADBE Text Properties').property('ADBE Text More Options').property('ADBE Text Anchor Point Option').setValue(2); } catch (e) { /* versões antigas */ }
};

/** Progresso das palavras: índice ativo (0-based) ao longo da parte "falada" do bloco. */
M.WORD_JS = 'var n = textTotal; var t0 = 0.05; var t1 = thisComp.duration - ' + M.OUT + '; ' +
  'var step = (t1 - t0) / Math.max(1, n); var s = t0 + (textIndex - 1) * step; ';

M.shadow = function (layer, opacity, distance, softness) {
  var fx = M.effect(layer, 'ADBE Drop Shadow', 'Shadow');
  try { fx.property('ADBE Drop Shadow-0002').setValue(opacity === undefined ? 180 : opacity); } catch (e) { /* ok */ }
  try { fx.property('ADBE Drop Shadow-0004').setValue(distance === undefined ? 6 : distance); } catch (e) { /* ok */ }
  try { fx.property('ADBE Drop Shadow-0005').setValue(softness === undefined ? 14 : softness); } catch (e) { /* ok */ }
  return fx;
};

/** Caixa atrás do texto (segue o tamanho do texto). */
M.box = function (comp, textLayer, hex, padX, padY, roundness, label) {
  var S = comp.layers.addShape();
  S.name = 'Box';
  var grp = S.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
  var vec = grp.property('ADBE Vectors Group');
  vec.addProperty('ADBE Vector Shape - Rect');
  vec.addProperty('ADBE Vector Graphic - Fill');
  // Busca de novo: adicionar o Fill invalida a referência ao retângulo.
  var rect = vec.property(1), fill = vec.property(2);
  var ctrl = M.colorCtrl(textLayer, label || 'Box Color', hex);
  fill.property('ADBE Vector Fill Color').expression = 'thisComp.layer("Text").effect("' + (label || 'Box Color') + '")(1)';
  var r = 'var t = thisComp.layer("Text"); var b = t.sourceRectAtTime(time, false); ';
  rect.property('ADBE Vector Rect Size').expression = r + '[b.width + ' + (padX * 2) + ', b.height + ' + (padY * 2) + ']';
  rect.property('ADBE Vector Rect Position').expression = r + '[b.left + b.width / 2, b.top + b.height / 2]';
  rect.property('ADBE Vector Rect Roundness').setValue(roundness || 0);
  S.parent = textLayer;
  S.property('ADBE Transform Group').property('ADBE Position').setValue([0, 0]);
  S.property('ADBE Transform Group').property('ADBE Opacity').expression = 'thisComp.layer("Text").transform.opacity';
  S.moveAfter(textLayer);
  return ctrl;
};

/**
 * Forma que acompanha um texto (caixa, contorno, linha). Fica abaixo do texto e herda posição/escala dele.
 * o: { text: 'Text' (nome da camada de texto), fill: '#hex' | null, stroke: '#hex' | null, strokeW,
 *      padX, padY, round, colorName: controle de cor (no texto), trim: expressão 0–100 do traçado,
 *      size: expressão [w,h] (padrão: tamanho do texto + margens), pos: expressão [x,y], name, opacity: false }
 */
M.shape = function (comp, o) {
  var tl = o.text || 'Text';
  var T = comp.layer(tl);
  var S = comp.layers.addShape();
  S.name = o.name || 'Shape';
  var grp = S.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
  var vec = grp.property('ADBE Vectors Group');
  vec.addProperty('ADBE Vector Shape - Rect');
  if (o.fill) vec.addProperty('ADBE Vector Graphic - Fill');
  if (o.stroke) vec.addProperty('ADBE Vector Graphic - Stroke');
  if (o.trim) vec.addProperty('ADBE Vector Filter - Trim');
  // Busca de novo: cada addProperty invalida as referências anteriores do grupo.
  var rect = vec.property(1);
  var r = 'var t = thisComp.layer("' + tl + '"); var b = t.sourceRectAtTime(time, false); ';
  rect.property('ADBE Vector Rect Size').expression = o.size ? r + o.size : r + '[b.width + ' + (2 * (o.padX || 0)) + ', b.height + ' + (2 * (o.padY || 0)) + ']';
  rect.property('ADBE Vector Rect Position').expression = o.pos ? r + o.pos : r + '[b.left + b.width / 2, b.top + b.height / 2]';
  rect.property('ADBE Vector Rect Roundness').setValue(o.round || 0);
  var ctrl = o.colorName ? M.colorCtrl(T, o.colorName, o.fill || o.stroke) : null;
  var colorExpr = o.colorName ? 'thisComp.layer("' + tl + '").effect("' + o.colorName + '")(1)' : null;
  var k = 2;
  if (o.fill) {
    var f = vec.property(k++);
    if (colorExpr) f.property('ADBE Vector Fill Color').expression = colorExpr; else f.property('ADBE Vector Fill Color').setValue(M.rgb(o.fill));
  }
  if (o.stroke) {
    var s = vec.property(k++);
    s.property('ADBE Vector Stroke Width').setValue(o.strokeW || 4);
    if (colorExpr && !o.fill) s.property('ADBE Vector Stroke Color').expression = colorExpr; else s.property('ADBE Vector Stroke Color').setValue(M.rgb(o.stroke));
  }
  if (o.trim) vec.property(k++).property('ADBE Vector Trim End').expression = o.trim;
  S.parent = T;
  S.property('ADBE Transform Group').property('ADBE Position').setValue([0, 0]);
  if (o.opacity !== false) S.property('ADBE Transform Group').property('ADBE Opacity').expression = 'thisComp.layer("' + tl + '").transform.opacity';
  S.moveAfter(T);
  return ctrl;
};

/* ---------- animações do bloco inteiro (transform) ---------- */
M.OUT_FADE = 'Math.min(o, linear(time, thisComp.duration - 0.12, thisComp.duration, 100, 0))';

M.anim = function (layer, kind) {
  var tr = layer.property('ADBE Transform Group');
  var sc = tr.property('ADBE Scale'), op = tr.property('ADBE Opacity'), ps = tr.property('ADBE Position');
  if (kind === 'pop') {
    sc.expression = 'var t = time; var k = t < 0.09 ? ease(t, 0, 0.09, 60, 112) : ease(t, 0.09, 0.2, 112, 100); value * k / 100;';
  } else if (kind === 'bounce') {
    sc.expression = 'var t = time; var k = t < 0.12 ? ease(t, 0, 0.12, 0, 120) : (t < 0.24 ? ease(t, 0.12, 0.24, 120, 92) : ease(t, 0.24, 0.34, 92, 100)); value * k / 100;';
  } else if (kind === 'slide') {
    ps.expression = 'value + [0, ease(time, 0, 0.3, 60, 0)];';
  } else if (kind === 'zoom') {
    sc.expression = 'value * ease(time, 0, 0.4, 135, 100) / 100;';
  }
  var inOp = (kind === 'none') ? '100' : (kind === 'pop' || kind === 'bounce' ? 'ease(time, 0, 0.06, 0, 100)' : 'ease(time, 0, 0.2, 0, 100)');
  op.expression = 'var o = ' + inOp + '; ' + M.OUT_FADE + ';';
};

/* ---------- montagem e exportação ---------- */
M.protect = function (comp, dur, inDur, outDur) {
  var m1 = new MarkerValue('In');
  m1.duration = inDur;
  m1.protectedRegion = true;
  comp.markerProperty.setValueAtTime(0, m1);
  var m2 = new MarkerValue('Out');
  m2.duration = outDur;
  m2.protectedRegion = true;
  comp.markerProperty.setValueAtTime(dur - outDur, m2);
};

/** Expõe propriedades no Gráficos essenciais. list: [[prop, 'Nome'], ...] */
M.expose = function (comp, list) {
  comp.openInEssentialGraphics();
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i][0]) M.resolve(list[i][0]).addToMotionGraphicsTemplateAs(comp, list[i][1]);
  }
};

M.textProps = function (L) {
  return { text: { layer: L, kind: 'text' }, position: { layer: L, kind: 'position' }, scale: { layer: L, kind: 'scale' } };
};

/** Saída genérica (opacidade) para títulos: some nos últimos `out` segundos. */
M.fadeOut = function (layer, inExpr, out) {
  layer.property('ADBE Transform Group').property('ADBE Opacity').expression =
    'var o = ' + (inExpr || '100') + '; Math.min(o, ease(time, thisComp.duration - ' + (out || 0.5) + ', thisComp.duration, 100, 0));';
};

/** Controle deslizante com nome (endereço para M.expose). */
M.sliderCtrl = function (layer, name, value) {
  var fx = M.effect(layer, 'ADBE Slider Control', name);
  fx.property(1).setValue(value);
  return { layer: layer, fx: name };
};

/** Erros de expressão em todas as camadas da comp (o AE desliga expressões quebradas em silêncio). */
M.expressionErrors = function (comp) {
  var errs = [];
  function walk(p, path) {
    for (var i = 1; i <= p.numProperties; i++) {
      var q = p.property(i);
      if (q.propertyType === PropertyType.PROPERTY) {
        if (q.canSetExpression && q.expression && q.expressionError) errs.push(path + '/' + q.name + ': ' + q.expressionError);
      } else {
        walk(q, path + '/' + q.name);
      }
    }
  }
  for (var l = 1; l <= comp.numLayers; l++) walk(comp.layer(l), comp.layer(l).name);
  return errs;
};

M.buildAll = function (outRoot, only) {
  var report = [];
  var made = [];
  app.beginUndoGroup('Orbi: gerar mogrts');
  try {
    for (var i = 0; i < M.presets.length; i++) {
      var p = M.presets[i];
      if (only && p.name.indexOf(only) < 0 && p.category.indexOf(only) < 0) continue;
      var comp = null;
      try {
        var D = p.opts.dur || M.DUR;
        comp = app.project.items.addComp(p.name, M.W, M.H, 1, D, M.FPS);
        made.push(comp);
        if (p.opts.protect !== false) M.protect(comp, D, p.opts.inDur || M.IN, p.opts.outDur || M.OUT);
        p.build(comp);
        comp.motionGraphicsTemplateName = p.name;
        var dir = M.mkdirs(outRoot + '/' + p.category);
        var n = comp.motionGraphicsTemplateControllerCount;
        var errs = M.expressionErrors(comp);
        // Miniatura própria: o AE fotografa o quadro 0 (antes da animação entrar) e ignora o tempo de pôster.
        // Salvamos um quadro do meio, em 640x360, ANTES de exportar (a exportação invalida a comp);
        // build.ps1 troca o thumb.png dentro do .mogrt.
        var tdir = M.mkdirs(Folder.temp.fsName + '/orbi-mogrt-thumbs/' + p.category);
        var png = new File(tdir.fsName + '/' + p.name + '.png');
        if (png.exists) png.remove();
        comp.resolutionFactor = [3, 3];
        // Fundo só para a foto (como as miniaturas da Adobe); removido antes de exportar.
        var bg = comp.layers.addSolid([0.13, 0.13, 0.14], 'Thumb BG', M.W, M.H, 1, D);
        bg.moveToEnd();
        try { comp.saveFrameToPng(D * (p.opts.thumb || 0.6), png); } catch (e) { /* devolve um objeto assíncrono; o arquivo sai mesmo assim */ }
        for (var w = 0; w < 50 && !png.exists; w++) $.sleep(100);
        $.sleep(300);
        var bgSrc = bg.source;
        bg.remove();
        try { bgSrc.remove(); } catch (e) { /* ok */ }
        comp.resolutionFactor = [1, 1];
        if (app.project.file) app.project.save(); // sem isso o AE pergunta antes de exportar
        var ok = comp.exportAsMotionGraphicsTemplate(true, dir.fsName);
        report.push((ok ? 'ok   ' : 'FALHA') + ' ' + p.category + ' / ' + p.name + ' (' + n + ' controles)' +
          (errs.length ? '\n      EXPRESSÕES: ' + errs.join('\n      ') : ''));
      } catch (e) {
        report.push('ERRO ' + p.category + ' / ' + p.name + ': ' + e.message + ' (linha ' + e.line + ')');
      }
    }
  } finally {
    app.endUndoGroup();
  }
  // Limpa o projeto: remove as comps geradas.
  for (var k = made.length - 1; k >= 0; k--) { try { made[k].remove(); } catch (e) { /* já removida */ } }
  return report.join('\n');
};
