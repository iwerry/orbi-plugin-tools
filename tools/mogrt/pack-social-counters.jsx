/*
 * Social Media e Counters.
 * Orbi Plugin Tools · Draft Creative Studio Ltda
 *
 * Números editáveis entram como TEXTO (camadas "Target"/"Seconds" ocultas): no Premiere os sliders
 * do .mogrt vão só de 0 a 100. A expressão converte o texto em número.
 */
(function () {
  var LIME = '#bce64a', RED = '#ff3b4a';
  var CY = M.H / 2;
  var POP = 'var t = time; var k = t < 0.2 ? ease(t, 0, 0.2, 0, 115) : ease(t, 0.2, 0.36, 115, 100); var r = thisComp.duration - time; if (r < 0.3) k = ease(r, 0, 0.3, 0, 100); value * k / 100;';

  function T(comp, o) {
    o.y = (o.y === undefined ? CY : o.y) + (o.size || 72) * 0.35;
    return M.text(comp, o);
  }

  /** Camada de texto oculta que guarda um número editável no Premiere. */
  function numberField(comp, name, value) {
    var L = M.text(comp, { name: name, text: String(value), size: 20 });
    L.enabled = false;
    return { layer: L, kind: 'text' };
  }

  /** Grupo de forma (elipse ou retângulo) dentro de uma camada de forma. */
  function addEllipse(vec, size, pos) {
    var e = vec.addProperty('ADBE Vector Shape - Ellipse');
    e.property('ADBE Vector Ellipse Size').setValue(size);
    e.property('ADBE Vector Ellipse Position').setValue(pos);
  }

  /* =================== Social Media =================== */
  var SM = 'Social Media';
  var SOPT = { dur: 4, inDur: 0.6, outDur: 0.4, thumb: 0.55 };

  M.add(SM, 'Social Handle', function (comp) {
    var t = T(comp, { text: '@yourname', font: 'Inter-Bold', size: 58, x: M.W / 2 + 40, color: '#111111' });
    var c = M.textColor(t, '#111111');
    var box = M.shape(comp, { text: 'Text', name: 'Pill', fill: '#ffffff', colorName: 'Box Color', round: 60,
      size: '[b.width + 150, b.height + 44];', pos: '[b.left + b.width / 2 - 40, b.top + b.height / 2];' });
    var dot = M.shape(comp, { text: 'Text', name: 'Icon', fill: LIME, colorName: 'Accent Color', round: 40,
      size: '[b.height + 26, b.height + 26];', pos: '[b.left - 62, b.top + b.height / 2];' });
    t.property('ADBE Transform Group').property('ADBE Scale').expression = POP;
    var p = M.textProps(t);
    M.expose(comp, [[p.text, 'Handle'], [c, 'Text Color'], [box, 'Box Color'], [dot, 'Accent Color'], [p.position, 'Position'], [p.scale, 'Scale']]);
  }, SOPT);

  M.add(SM, 'Subscribe Button', function (comp) {
    var on = T(comp, { name: 'Button', text: 'SUBSCRIBE', font: 'Inter-Black', size: 56, caps: true, tracking: 40, color: '#ffffff' });
    var off = T(comp, { name: 'Done', text: 'SUBSCRIBED ✓', font: 'Inter-Black', size: 56, caps: true, tracking: 40, color: '#ffffff' });
    var SW = 1.7;
    on.property('ADBE Transform Group').property('ADBE Opacity').expression = 'time < ' + SW + ' ? 100 : 0;';
    off.property('ADBE Transform Group').property('ADBE Opacity').expression = 'var o = time < ' + SW + ' ? 0 : 100; Math.min(o, ease(time, thisComp.duration - 0.3, thisComp.duration, 100, 0));';
    var c1 = M.colorCtrl(on, 'Button Color', RED);
    var c2 = M.colorCtrl(on, 'Done Color', '#3a3a3a');
    var box = M.shape(comp, { text: 'Button', name: 'Box', fill: RED, round: 18, padX: 46, padY: 26, opacity: false });
    comp.layer('Box').property('ADBE Root Vectors Group').property(1).property('ADBE Vectors Group').property(2)
      .property('ADBE Vector Fill Color').expression = 'var t = thisComp.layer("Button"); time < ' + SW + ' ? t.effect("Button Color")(1) : t.effect("Done Color")(1);';
    comp.layer('Box').property('ADBE Transform Group').property('ADBE Opacity').expression = 'ease(time, thisComp.duration - 0.3, thisComp.duration, 100, 0);';
    // Pop na entrada + "clique" na troca
    var CLICK = 'var t = time; var k = t < 0.2 ? ease(t, 0, 0.2, 0, 112) : ease(t, 0.2, 0.36, 112, 100);' +
      ' if (t > ' + (SW - 0.12) + ' && t < ' + (SW + 0.25) + ') k = t < ' + SW + ' ? ease(t, ' + (SW - 0.12) + ', ' + SW + ', 100, 90) : ease(t, ' + SW + ', ' + (SW + 0.25) + ', 90, 100);' +
      ' value * k / 100;';
    on.property('ADBE Transform Group').property('ADBE Scale').expression = CLICK;
    off.parent = on;
    off.property('ADBE Transform Group').property('ADBE Position').setValue([0, 0]);
    var p1 = M.textProps(on), p2 = M.textProps(off);
    M.expose(comp, [[p1.text, 'Button Text'], [p2.text, 'Done Text'], [c1, 'Button Color'], [c2, 'Done Color'], [p1.position, 'Position'], [p1.scale, 'Scale']]);
  }, { dur: 4, inDur: 2.2, outDur: 0.4, thumb: 0.3 });

  M.add(SM, 'Like Burst', function (comp) {
    var S = comp.layers.addShape();
    S.name = 'Heart';
    var g = S.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
    var v = g.property('ADBE Vectors Group');
    // Coração: dois círculos + quadrado girado 45°
    addEllipse(v, [110, 110], [-38, -20]);
    addEllipse(v, [110, 110], [38, -20]);
    var sq = S.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
    var sv = sq.property('ADBE Vectors Group');
    sv.addProperty('ADBE Vector Shape - Rect').property('ADBE Vector Rect Size').setValue([110, 110]);
    sq.property('ADBE Vector Transform Group').property('ADBE Vector Rotation').setValue(45);
    sq.property('ADBE Vector Transform Group').property('ADBE Vector Position').setValue([0, 18]);
    var fill = S.property('ADBE Root Vectors Group').addProperty('ADBE Vector Graphic - Fill');
    var ctrl = M.colorCtrl(S, 'Heart Color', RED);
    S.property('ADBE Root Vectors Group').property(3).property('ADBE Vector Fill Color').expression = 'effect("Heart Color")(1)';
    S.property('ADBE Transform Group').property('ADBE Position').setValue([M.W / 2, CY]);
    S.property('ADBE Transform Group').property('ADBE Scale').expression =
      'var t = time; var k = t < 0.18 ? ease(t, 0, 0.18, 0, 125) : ease(t, 0.18, 0.4, 125, 100); var r = thisComp.duration - time; if (r < 0.3) k = ease(r, 0, 0.3, 0, 100); value * k / 100;';
    // Raios da explosão
    var B = comp.layers.addShape();
    B.name = 'Burst';
    for (var i = 0; i < 8; i++) {
      var rg = B.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
      rg.property('ADBE Vectors Group').addProperty('ADBE Vector Shape - Rect').property('ADBE Vector Rect Size').setValue([10, 34]);
      var tr = rg.property('ADBE Vector Transform Group');
      tr.property('ADBE Vector Rotation').setValue(i * 45);
      tr.property('ADBE Vector Position').expression = 'var a = degreesToRadians(' + (i * 45) + ' - 90); var d = ease(time, 0.12, 0.5, 70, 170); [Math.cos(a) * d, Math.sin(a) * d];';
    }
    B.property('ADBE Root Vectors Group').addProperty('ADBE Vector Graphic - Fill');
    B.property('ADBE Root Vectors Group').property(9).property('ADBE Vector Fill Color').expression = 'thisComp.layer("Heart").effect("Heart Color")(1)';
    B.property('ADBE Transform Group').property('ADBE Position').setValue([M.W / 2, CY]);
    B.property('ADBE Transform Group').property('ADBE Opacity').expression = 'time < 0.12 ? 0 : ease(time, 0.3, 0.55, 100, 0);';
    M.expose(comp, [[ctrl, 'Heart Color'], [{ layer: S, kind: 'position' }, 'Position'], [{ layer: S, kind: 'scale' }, 'Scale']]);
  }, { dur: 3, inDur: 0.6, outDur: 0.3, thumb: 0.17 });

  M.add(SM, 'Comment Bubble', function (comp) {
    var n = T(comp, { name: 'Name', text: 'maria.design', font: 'Inter-Bold', size: 34, justify: 'left', x: 700, y: CY - 40, color: '#111111' });
    var t = T(comp, { name: 'Comment', text: 'This edit is insane!', font: 'Inter-Medium', size: 44, justify: 'left', x: 700, y: CY + 20, color: '#111111' });
    var c = M.textColor(t, '#111111');
    var box = M.shape(comp, { text: 'Comment', name: 'Bubble', fill: '#ffffff', colorName: 'Box Color', round: 26,
      size: 'var n = thisComp.layer("Name").sourceRectAtTime(time, false); [Math.max(b.width, n.width) + 70, b.height + n.height + 70];',
      pos: 'var n = thisComp.layer("Name").sourceRectAtTime(time, false); var w = Math.max(b.width, n.width) + 70; [b.left - 35 + w / 2, b.top + b.height / 2 - (n.height + 26) / 2];' });
    // Com pai, a posição vira relativa ao comentário: nome 64 px acima, mesma margem esquerda.
    n.parent = t;
    n.property('ADBE Transform Group').property('ADBE Position').setValue([0, -64]);
    n.moveToBeginning(); // o balão fica logo abaixo do comentário e cobriria o nome
    t.property('ADBE Transform Group').property('ADBE Scale').expression = POP;
    var pt = M.textProps(t), pn = M.textProps(n);
    M.expose(comp, [[pn.text, 'Name'], [pt.text, 'Comment'], [c, 'Text Color'], [box, 'Box Color'], [pt.position, 'Position'], [pt.scale, 'Scale']]);
  }, SOPT);

  /* =================== Counters =================== */
  var CO = 'Counters';
  var COPT = { dur: 4, inDur: 2.2, outDur: 0.4, thumb: 0.8 };
  var NUM = 'function fmt(n, d) { var s = n.toFixed(d); var p = s.split("."); p[0] = p[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, " "); return p.join("."); }\n';

  M.add(CO, 'Number Count Up', function (comp) {
    var target = numberField(comp, 'Target', 38535);
    var pre = numberField(comp, 'Prefix', '$');
    var t = T(comp, { text: '0', font: 'Montserrat-ExtraBold', size: 150 });
    var lab = T(comp, { name: 'Label', text: 'TOTAL VIEWS', font: 'Montserrat-SemiBold', size: 34, caps: true, tracking: 400, y: CY + 115, color: LIME });
    var c = M.textColor(t, '#ffffff');
    t.property('ADBE Text Properties').property('ADBE Text Document').expression = NUM +
      'var end = parseFloat(String(thisComp.layer("Target").text.sourceText).replace(",", ".")) || 0;\n' +
      'var pre = String(thisComp.layer("Prefix").text.sourceText);\n' +
      'var d = (String(end).split(".")[1] || "").length;\n' +
      'pre + fmt(ease(time, 0.2, 2.0, 0, end), d);';
    t.property('ADBE Transform Group').property('ADBE Scale').expression = 'value * (time > 2.0 && time < 2.25 ? ease(time, 2.0, 2.25, 108, 100) : 100) / 100;';
    M.fadeOut(t, 'ease(time, 0, 0.3, 0, 100)', 0.4);
    M.fadeOut(lab, 'ease(time, 0.3, 0.7, 0, 100)', 0.4);
    var lc = M.textColor(lab, LIME, 'Accent Color');
    var pt = M.textProps(t), pl = M.textProps(lab);
    M.expose(comp, [[target, 'End Value'], [pre, 'Prefix'], [pl.text, 'Label'], [c, 'Text Color'], [lc, 'Accent Color'], [pt.position, 'Position'], [pt.scale, 'Scale']]);
  }, COPT);

  M.add(CO, 'Percentage Ring', function (comp) {
    var target = numberField(comp, 'Target', 76);
    var t = T(comp, { text: '0%', font: 'Montserrat-ExtraBold', size: 96 });
    var c = M.textColor(t, '#ffffff');
    t.property('ADBE Text Properties').property('ADBE Text Document').expression =
      'var end = parseFloat(thisComp.layer("Target").text.sourceText) || 0; Math.round(ease(time, 0.2, 2.0, 0, end)) + "%";';
    var R = comp.layers.addShape();
    R.name = 'Ring';
    var track = R.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
    var tv = track.property('ADBE Vectors Group');
    tv.addProperty('ADBE Vector Shape - Ellipse');
    tv.addProperty('ADBE Vector Graphic - Stroke');
    tv.property(1).property('ADBE Vector Ellipse Size').setValue([340, 340]);
    tv.property(2).property('ADBE Vector Stroke Width').setValue(22);
    tv.property(2).property('ADBE Vector Stroke Color').setValue([1, 1, 1]);
    tv.property(2).property('ADBE Vector Stroke Opacity').setValue(15);
    var arc = R.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
    var av = arc.property('ADBE Vectors Group');
    av.addProperty('ADBE Vector Shape - Ellipse');
    av.addProperty('ADBE Vector Graphic - Stroke');
    av.addProperty('ADBE Vector Filter - Trim');
    av.property(1).property('ADBE Vector Ellipse Size').setValue([340, 340]);
    av.property(2).property('ADBE Vector Stroke Width').setValue(22);
    av.property(2).property('ADBE Vector Stroke Line Cap').setValue(2);
    var acc = M.colorCtrl(R, 'Accent Color', LIME);
    av.property(2).property('ADBE Vector Stroke Color').expression = 'effect("Accent Color")(1)';
    av.property(3).property('ADBE Vector Trim End').expression = 'var end = parseFloat(thisComp.layer("Target").text.sourceText) || 0; ease(time, 0.2, 2.0, 0, Math.min(100, end));';
    R.property('ADBE Transform Group').property('ADBE Position').setValue([M.W / 2, CY]);
    R.property('ADBE Transform Group').property('ADBE Opacity').expression = 'thisComp.layer("Text").transform.opacity';
    M.fadeOut(t, 'ease(time, 0, 0.3, 0, 100)', 0.4);
    var pt = M.textProps(t);
    M.expose(comp, [[target, 'Percent'], [c, 'Text Color'], [acc, 'Accent Color'], [{ layer: R, kind: 'position' }, 'Position']]);
  }, COPT);

  M.add(CO, 'Progress Bar', function (comp) {
    var target = numberField(comp, 'Target', 64);
    var lab = M.text(comp, { name: 'Label', text: 'Loading the next level', font: 'Inter-SemiBold', size: 40, justify: 'left', x: 560, y: CY - 40 });
    var pct = M.text(comp, { name: 'Percent', text: '0%', font: 'Inter-Black', size: 40, justify: 'left', x: 1290, y: CY - 40 });
    var c = M.textColor(lab, '#ffffff');
    pct.property('ADBE Text Properties').property('ADBE Text Document').expression =
      'var end = parseFloat(thisComp.layer("Target").text.sourceText) || 0; Math.round(ease(time, 0.3, 2.0, 0, end)) + "%";';
    var trackC = M.shape(comp, { text: 'Label', name: 'Track', fill: '#ffffff', size: '[800, 18];', pos: '[400 - (b.left - b.left), 40];', round: 9 });
    var fillC = M.shape(comp, { text: 'Label', name: 'Fill', fill: LIME, colorName: 'Accent Color', round: 9,
      size: 'var end = parseFloat(thisComp.layer("Target").text.sourceText) || 0; [8 * ease(time, 0.3, 2.0, 0, Math.min(100, end)), 18];',
      pos: 'var end = parseFloat(thisComp.layer("Target").text.sourceText) || 0; var w = 8 * ease(time, 0.3, 2.0, 0, Math.min(100, end)); [w / 2, 40];' });
    comp.layer('Track').property('ADBE Root Vectors Group').property(1).property('ADBE Vectors Group').property(2).property('ADBE Vector Fill Opacity').setValue(15);
    comp.layer('Track').property('ADBE Root Vectors Group').property(1).property('ADBE Vectors Group').property(1).property('ADBE Vector Rect Position').expression = '[400, 40];';
    comp.layer('Fill').moveBefore(comp.layer('Track'));
    pct.parent = lab;
    M.fadeOut(lab, 'ease(time, 0, 0.3, 0, 100)', 0.4);
    var pl = M.textProps(lab);
    M.expose(comp, [[target, 'Percent'], [pl.text, 'Label'], [c, 'Text Color'], [fillC, 'Accent Color'], [pl.position, 'Position']]);
  }, COPT);

  M.add(CO, 'Countdown Timer', function (comp) {
    var secs = numberField(comp, 'Seconds', 10);
    var t = T(comp, { text: '00:10', font: 'Inter-Black', size: 170, tracking: 20 });
    var c = M.textColor(t, '#ffffff');
    t.property('ADBE Text Properties').property('ADBE Text Document').expression =
      'var s = parseFloat(thisComp.layer("Seconds").text.sourceText) || 0;\n' +
      'var left = Math.max(0, Math.ceil(s - time * s / thisComp.duration));\n' +
      'var m = Math.floor(left / 60), r = left % 60; (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;';
    var box = M.shape(comp, { text: 'Text', name: 'Box', fill: '#111111', colorName: 'Box Color', padX: 60, padY: 40, round: 34 });
    var p = M.textProps(t);
    M.expose(comp, [[secs, 'Seconds'], [c, 'Text Color'], [box, 'Box Color'], [p.position, 'Position'], [p.scale, 'Scale']]);
  }, { dur: 10, protect: false, thumb: 0.3 });
})();
