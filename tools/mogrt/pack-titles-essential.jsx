/*
 * Titles/Essential, Titles/Scale e Lower Thirds.
 * Orbi Plugin Tools · Draft Creative Studio Ltda
 */
(function () {
  var LIME = '#bce64a';
  var CY = M.H / 2;
  var OPT = { dur: 5, inDur: 1.2, outDur: 0.6, thumb: 0.45 };

  function T(comp, o) {
    o.y = (o.y === undefined ? CY : o.y) + (o.size || 72) * 0.35;
    return M.text(comp, o);
  }
  function E(comp, list) { M.expose(comp, list); }
  /** Some no fim (todas as camadas de texto do preset usam). */
  function out(L, inExpr) { M.fadeOut(L, inExpr || '100', 0.5); }

  /* =================== Essential Typography =================== */
  var ES = 'Titles/Essential';

  M.add(ES, 'Outline Box Title', function (comp) {
    var t = T(comp, { text: 'MOTION DESIGN', font: 'Montserrat-ExtraBold', size: 76, caps: true, tracking: 40 });
    var s = T(comp, { name: 'Subtitle', text: 'WITHOUT LIMITS', font: 'Montserrat-SemiBold', size: 26, caps: true, tracking: 420, y: CY + 92, color: LIME });
    var c = M.textColor(t, '#ffffff');
    var acc = M.shape(comp, { text: 'Text', name: 'Outline', stroke: LIME, strokeW: 5, padX: 40, padY: 26, colorName: 'Accent Color', trim: 'ease(time, 0, 0.8, 0, 100);', opacity: false });
    out(t, 'ease(time, 0.35, 0.8, 0, 100)');
    M.fadeOut(comp.layer('Outline'), '100', 0.5);
    out(s, 'ease(time, 0.6, 1.0, 0, 100)');
    s.property('ADBE Transform Group').property('ADBE Position').expression = 'value + [0, ease(time, 0.6, 1.0, 20, 0)];';
    var p = M.textProps(t), ps = M.textProps(s);
    E(comp, [[p.text, 'Text'], [ps.text, 'Subtitle'], [c, 'Text Color'], [acc, 'Accent Color'], [p.position, 'Position'], [p.scale, 'Scale']]);
  }, OPT);

  M.add(ES, 'Underline Title', function (comp) {
    var t = T(comp, { text: 'Clean and simple', font: 'Montserrat-Bold', size: 84 });
    var c = M.textColor(t, '#ffffff');
    var a = M.animator(t, 'Words', 'expr', 3);
    a.props.addProperty('ADBE Text Position 3D').setValue([0, 40, 0]);
    a.props.addProperty('ADBE Text Opacity').setValue(0);
    a.selector.property('ADBE Text Expressible Amount').expression = 'var s = (textIndex - 1) * 0.12; var k = ease(time, s, s + 0.4, 100, 0); [k, k, k];';
    var acc = M.shape(comp, { text: 'Text', name: 'Line', fill: LIME, colorName: 'Accent Color',
      size: '[ease(time, 0.3, 1.0, 0, b.width), 8];', pos: '[b.left + b.width / 2, b.top + b.height + 26];' });
    out(t);
    var p = M.textProps(t);
    E(comp, [[p.text, 'Text'], [c, 'Text Color'], [acc, 'Accent Color'], [p.position, 'Position'], [p.scale, 'Scale']]);
  }, OPT);

  M.add(ES, 'Side Bar Title', function (comp) {
    var t = T(comp, { text: 'Stay curious,\rkeep creating', font: 'Montserrat-Bold', size: 68, justify: 'left', x: 720, y: CY - 50, leading: 78 });
    var c = M.textColor(t, '#ffffff');
    var a = M.animator(t, 'Lines', 'expr', 4);
    a.props.addProperty('ADBE Text Position 3D').setValue([-60, 0, 0]);
    a.props.addProperty('ADBE Text Opacity').setValue(0);
    a.selector.property('ADBE Text Expressible Amount').expression = 'var s = 0.25 + (textIndex - 1) * 0.15; var k = ease(time, s, s + 0.45, 100, 0); [k, k, k];';
    var acc = M.shape(comp, { text: 'Text', name: 'Bar', fill: LIME, colorName: 'Accent Color',
      size: '[8, ease(time, 0, 0.5, 0, b.height + 24)];', pos: '[b.left - 34, b.top + b.height / 2];' });
    out(t);
    var p = M.textProps(t);
    E(comp, [[p.text, 'Text'], [c, 'Text Color'], [acc, 'Accent Color'], [p.position, 'Position'], [p.scale, 'Scale']]);
  }, OPT);

  M.add(ES, 'Statement Lines', function (comp) {
    var t = T(comp, { text: 'IDEAS ARE CHEAP\rEXECUTION IS\rEVERYTHING', font: 'Montserrat-ExtraBold', size: 64, caps: true, justify: 'left', x: 640, y: CY - 70, leading: 74 });
    var c = M.textColor(t, '#ffffff');
    var hi = M.colorCtrl(t, 'Highlight Color', LIME);
    var h = M.animator(t, 'Highlight', 'expr', 4);
    h.props.addProperty('ADBE Text Fill Color').expression = 'effect("Highlight Color")(1)';
    h.selector.property('ADBE Text Expressible Amount').expression = 'var k = textIndex == textTotal ? 100 : 0; [k, k, k];';
    var a = M.animator(t, 'Lines', 'expr', 4);
    a.props.addProperty('ADBE Text Position 3D').setValue([-120, 0, 0]);
    a.props.addProperty('ADBE Text Opacity').setValue(0);
    a.selector.property('ADBE Text Expressible Amount').expression = 'var s = (textIndex - 1) * 0.22; var k = ease(time, s, s + 0.4, 100, 0); [k, k, k];';
    out(t);
    var p = M.textProps(t);
    E(comp, [[p.text, 'Text'], [c, 'Text Color'], [hi, 'Highlight Color'], [p.position, 'Position'], [p.scale, 'Scale']]);
  }, OPT);

  M.add(ES, 'Wipe Reveal Title', function (comp) {
    var t = T(comp, { text: 'BREAKING NEWS', font: 'Montserrat-Black', size: 88, caps: true, tracking: 30 });
    var c = M.textColor(t, '#ffffff');
    t.property('ADBE Transform Group').property('ADBE Opacity').expression =
      'var o = time < 0.45 ? 0 : 100; Math.min(o, ease(time, thisComp.duration - 0.5, thisComp.duration, 100, 0));';
    var acc = M.shape(comp, { text: 'Text', name: 'Wipe', fill: LIME, colorName: 'Accent Color', opacity: false,
      size: 'var p = time < 0.45 ? ease(time, 0, 0.45, 0, 1) : ease(time, 0.45, 0.9, 1, 0); [(b.width + 40) * p, b.height + 30];',
      pos: 'var p = time < 0.45 ? ease(time, 0, 0.45, 0, 1) : ease(time, 0.45, 0.9, 1, 0); var w = (b.width + 40) * p; var x0 = b.left - 20; [time < 0.45 ? x0 + w / 2 : x0 + (b.width + 40) - w / 2, b.top + b.height / 2];' });
    comp.layer('Wipe').moveBefore(t);
    var p = M.textProps(t);
    E(comp, [[p.text, 'Text'], [c, 'Text Color'], [acc, 'Accent Color'], [p.position, 'Position'], [p.scale, 'Scale']]);
  }, OPT);

  M.add(ES, 'Split Lines Title', function (comp) {
    var t = T(comp, { text: 'BIG\rIDEAS', font: 'Anton-Regular', size: 190, caps: true, leading: 180, y: CY - 90 });
    var c = M.textColor(t, '#ffffff');
    var a = M.animator(t, 'Left', 'expr', 4);
    a.props.addProperty('ADBE Text Position 3D').setValue([-700, 0, 0]);
    a.selector.property('ADBE Text Expressible Amount').expression = 'var k = textIndex == 1 ? ease(time, 0, 0.6, 100, 0) : 0; [k, k, k];';
    var b = M.animator(t, 'Right', 'expr', 4);
    b.props.addProperty('ADBE Text Position 3D').setValue([700, 0, 0]);
    b.selector.property('ADBE Text Expressible Amount').expression = 'var k = textIndex == 2 ? ease(time, 0.1, 0.7, 100, 0) : 0; [k, k, k];';
    t.motionBlur = true; comp.motionBlur = true;
    out(t);
    var p = M.textProps(t);
    E(comp, [[p.text, 'Text'], [c, 'Text Color'], [p.position, 'Position'], [p.scale, 'Scale']]);
  }, OPT);

  M.add(ES, 'Three Level Title', function (comp) {
    var k = T(comp, { name: 'Kicker', text: 'EPISODE 01', font: 'Montserrat-SemiBold', size: 28, caps: true, tracking: 480, y: CY - 100, color: LIME });
    var t = T(comp, { name: 'Title', text: 'The First Step', font: 'Montserrat-ExtraBold', size: 100 });
    var s = T(comp, { name: 'Subtitle', text: 'a story about beginnings', font: 'Montserrat-Medium', size: 34, y: CY + 95, color: '#bdbdbd' });
    var kc = M.textColor(k, LIME, 'Accent Color');
    var tc = M.textColor(t, '#ffffff');
    var arr = [[k, 0], [t, 0.15], [s, 0.35]];
    for (var i = 0; i < arr.length; i++) {
      var d = arr[i][1];
      arr[i][0].property('ADBE Transform Group').property('ADBE Position').expression = 'value + [0, ease(time, ' + d + ', ' + (d + 0.5) + ', 36, 0)];';
      out(arr[i][0], 'ease(time, ' + d + ', ' + (d + 0.5) + ', 0, 100)');
    }
    var pk = M.textProps(k), pt = M.textProps(t), ps = M.textProps(s);
    E(comp, [[pk.text, 'Kicker'], [pt.text, 'Title'], [ps.text, 'Subtitle'], [kc, 'Accent Color'], [tc, 'Text Color'], [pt.position, 'Position'], [pt.scale, 'Scale']]);
  }, OPT);

  /* =================== Scale Titles =================== */
  var SC = 'Titles/Scale';
  var POP = 'var t = time; var k = t < 0.18 ? ease(t, 0, 0.18, 0, 112) : ease(t, 0.18, 0.32, 112, 100); var r = thisComp.duration - time; if (r < 0.3) k = ease(r, 0, 0.3, 0, 100); value * k / 100;';

  function label(name, o) {
    M.add(SC, name, function (comp) {
      var t = T(comp, { text: o.text, font: o.font || 'Inter-Black', size: o.size || 64, caps: o.caps, justify: o.justify, x: o.x, y: o.y, leading: o.leading, color: '#111111' });
      var c = M.textColor(t, '#111111');
      if (o.shadow) M.shape(comp, { text: 'Text', name: 'Offset', fill: '#000000', padX: 34, padY: 22, round: o.round || 0,
        pos: '[b.left + b.width / 2 + 12, b.top + b.height / 2 + 12];', size: '[b.width + 68, b.height + 44];' });
      var box = M.shape(comp, { text: 'Text', name: 'Box', fill: o.box, stroke: o.outline ? '#111111' : null, strokeW: 5,
        padX: o.padX || 34, padY: o.padY || 22, round: o.round === undefined ? 18 : o.round, colorName: 'Box Color' });
      if (o.shadow) comp.layer('Offset').moveAfter(comp.layer('Box'));
      var tr = t.property('ADBE Transform Group');
      tr.property('ADBE Scale').expression = POP;
      if (o.rotate) tr.property('ADBE Rotate Z').setValue(o.rotate);
      var p = M.textProps(t);
      E(comp, [[p.text, 'Text'], [c, 'Text Color'], [box, 'Box Color'], [p.position, 'Position'], [p.scale, 'Scale']]);
    }, { dur: 4, inDur: 0.4, outDur: 0.35, thumb: 0.5 });
  }

  label('Scale Label', { text: 'MOTION DESIGN', caps: true, box: '#c9ecff' });
  label('Scale Note', { text: 'Write a short note here.\rTwo or three lines work best\rfor quick tips on screen.', font: 'Inter-SemiBold', size: 38,
    box: '#dcf7c8', justify: 'left', x: 700, y: CY - 50, leading: 50, padX: 40, padY: 30, round: 14 });
  label('Scale Sticker', { text: 'NEW!', caps: true, size: 96, box: '#fff0c2', rotate: -6, round: 22 });
  label('Scale Outline', { text: 'BOLD MOVE', caps: true, box: '#ffffff', outline: true, shadow: true, round: 0 });

  /* =================== Lower Thirds =================== */
  var LT = 'Lower Thirds';
  var LX = 160, LY = M.H - 230;
  var LOPT = { dur: 5, inDur: 0.9, outDur: 0.5, thumb: 0.5 };

  M.add(LT, 'Lower Third Clean', function (comp) {
    var n = M.text(comp, { name: 'Name', text: 'Jordan Silva', font: 'Montserrat-Bold', size: 58, justify: 'left', x: LX + 30, y: LY });
    var r = M.text(comp, { name: 'Role', text: 'Creative Director', font: 'Montserrat-Medium', size: 30, justify: 'left', x: LX + 30, y: LY + 50, color: '#cfcfcf' });
    var nc = M.textColor(n, '#ffffff');
    var acc = M.shape(comp, { text: 'Name', name: 'Bar', fill: LIME, colorName: 'Accent Color',
      size: '[7, ease(time, 0, 0.4, 0, 110)];', pos: '[b.left - 22, b.top + 46];' });
    n.property('ADBE Transform Group').property('ADBE Position').expression = 'value + [ease(time, 0.15, 0.6, -40, 0), 0];';
    r.property('ADBE Transform Group').property('ADBE Position').expression = 'value + [ease(time, 0.3, 0.75, -40, 0), 0];';
    out(n, 'ease(time, 0.15, 0.5, 0, 100)');
    out(r, 'ease(time, 0.3, 0.65, 0, 100)');
    var pn = M.textProps(n), pr = M.textProps(r);
    E(comp, [[pn.text, 'Name'], [pr.text, 'Role'], [nc, 'Text Color'], [acc, 'Accent Color']]);
  }, LOPT);

  M.add(LT, 'Lower Third Boxed', function (comp) {
    var n = M.text(comp, { name: 'Name', text: 'JORDAN SILVA', font: 'Montserrat-ExtraBold', size: 50, caps: true, justify: 'left', x: LX, y: LY });
    var r = M.text(comp, { name: 'Role', text: 'CREATIVE DIRECTOR', font: 'Montserrat-Bold', size: 26, caps: true, tracking: 160, justify: 'left', x: LX, y: LY + 58, color: '#111111' });
    var nc = M.textColor(n, '#ffffff');
    var W1 = 'var p = ease(time, 0, 0.45, 0, 1); ';
    var nb = M.shape(comp, { text: 'Name', name: 'Name Box', fill: '#111111', colorName: 'Box Color',
      size: W1 + '[(b.width + 44) * p, b.height + 28];', pos: W1 + '[b.left - 22 + (b.width + 44) * p / 2, b.top + b.height / 2];', opacity: false });
    var W2 = 'var p = ease(time, 0.2, 0.6, 0, 1); ';
    var rb = M.shape(comp, { text: 'Role', name: 'Role Box', fill: LIME, colorName: 'Accent Color',
      size: W2 + '[(b.width + 36) * p, b.height + 20];', pos: W2 + '[b.left - 18 + (b.width + 36) * p / 2, b.top + b.height / 2];', opacity: false });
    out(n, 'ease(time, 0.35, 0.6, 0, 100)');
    out(r, 'ease(time, 0.5, 0.75, 0, 100)');
    M.fadeOut(comp.layer('Name Box'), '100', 0.5);
    M.fadeOut(comp.layer('Role Box'), '100', 0.5);
    var pn = M.textProps(n), pr = M.textProps(r);
    E(comp, [[pn.text, 'Name'], [pr.text, 'Role'], [nc, 'Text Color'], [nb, 'Box Color'], [rb, 'Accent Color']]);
  }, LOPT);

  M.add(LT, 'Lower Third Line', function (comp) {
    var n = M.text(comp, { name: 'Name', text: 'Jordan Silva', font: 'Inter-SemiBold', size: 56, justify: 'left', x: LX, y: LY });
    var r = M.text(comp, { name: 'Role', text: 'Photographer · São Paulo', font: 'Inter-Regular', size: 30, justify: 'left', x: LX, y: LY + 64, color: '#d6d6d6' });
    var nc = M.textColor(n, '#ffffff');
    var acc = M.shape(comp, { text: 'Name', name: 'Line', fill: '#ffffff', colorName: 'Accent Color',
      size: '[ease(time, 0, 0.6, 0, Math.max(b.width, 360)), 3];', pos: 'var w = ease(time, 0, 0.6, 0, Math.max(b.width, 360)); [b.left + w / 2, b.top + b.height + 18];' });
    var a = M.animator(n, 'Letters', 'expr', 1);
    a.props.addProperty('ADBE Text Opacity').setValue(0);
    a.selector.property('ADBE Text Expressible Amount').expression = 'var s = 0.2 + (textIndex - 1) / Math.max(1, textTotal) * 0.5; var k = ease(time, s, s + 0.2, 100, 0); [k, k, k];';
    out(n);
    out(r, 'ease(time, 0.6, 0.9, 0, 100)');
    var pn = M.textProps(n), pr = M.textProps(r);
    E(comp, [[pn.text, 'Name'], [pr.text, 'Role'], [nc, 'Text Color'], [acc, 'Line Color']]);
  }, LOPT);

  M.add(LT, 'Credits Roll', function (comp) {
    var t = M.text(comp, { text: 'DIRECTED BY\rYour Name\r\rEDITED BY\rYour Name\r\rMUSIC\rYour Name\r\rTHANK YOU FOR WATCHING',
      font: 'Montserrat-SemiBold', size: 44, leading: 64, y: 0 });
    var c = M.textColor(t, '#ffffff');
    t.property('ADBE Transform Group').property('ADBE Position').expression =
      'var b = sourceRectAtTime(0, false); var y = linear(time, 0, thisComp.duration, thisComp.height - b.top + 20, -b.top - b.height - 20); [value[0], y];';
    var p = M.textProps(t);
    E(comp, [[p.text, 'Text'], [c, 'Text Color'], [p.scale, 'Scale']]);
  }, { dur: 12, protect: false, thumb: 0.4 });
})();
