/*
 * Pacotes de legenda: Captions Basic e Captions Dynamic.
 * Orbi Plugin Tools · Draft Creative Studio Ltda
 */
(function () {
  var BASIC = 'Captions/Basic';
  var DYN = 'Captions/Dynamic';
  var LIME = '#bce64a', YELLOW = '#ffd400';

  /** Legenda simples: cor fixa + contorno/sombra, fade curto. */
  function basic(name, o) {
    M.add(BASIC, name, function (comp) {
      var L = M.text(comp, { text: 'Your caption here', font: o.font || 'Montserrat-Bold', size: o.size || 64,
        color: o.color, stroke: o.stroke || 0, strokeColor: o.strokeColor });
      var color = M.textColor(L, o.color);
      if (o.shadow) M.shadow(L, o.shadowOpacity, o.shadowDistance, o.shadowSoftness);
      var box = o.box ? M.box(comp, L, o.box, 28, 14, o.round || 10) : null;
      M.anim(L, 'fade');
      var p = M.textProps(L);
      M.expose(comp, [[p.text, 'Text'], [color, 'Text Color'], box ? [box, 'Box Color'] : null, [p.position, 'Position'], [p.scale, 'Scale']]);
    });
  }

  basic('Caption White', { color: '#ffffff', stroke: 6 });
  basic('Caption Black', { color: '#111111', stroke: 6, strokeColor: '#ffffff' });
  basic('Caption Yellow', { color: YELLOW, stroke: 6 });
  basic('Caption Gray', { color: '#d0d0d0', shadow: true, shadowOpacity: 160 });
  basic('Caption White Shadow', { color: '#ffffff', shadow: true, shadowOpacity: 200, shadowDistance: 5, shadowSoftness: 10 });
  basic('Caption Yellow Shadow', { color: YELLOW, shadow: true, shadowOpacity: 200, shadowDistance: 5, shadowSoftness: 10 });
  basic('Caption Box Black', { color: '#ffffff', box: '#000000' });
  basic('Caption Box White', { color: '#111111', box: '#ffffff' });

  /* ---------------- dinâmicas ---------------- */

  function dynText(comp, o) {
    var L = M.text(comp, { text: 'THIS IS HOW IT WORKS', font: o.font || 'Montserrat-ExtraBold', size: o.size || 84,
      color: o.color || '#ffffff', stroke: o.stroke === undefined ? 8 : o.stroke, caps: true });
    M.anchorByWord(L);
    return L;
  }

  /** Bloco inteiro animado (pop, bounce, slide, zoom). */
  function block(name, kind, o) {
    M.add(DYN, name, function (comp) {
      var L = dynText(comp, o || {});
      var color = M.textColor(L, (o && o.color) || '#ffffff');
      if (o && o.glow) M.effect(L, 'ADBE Glo2', 'Glow');
      var box = o && o.box ? M.box(comp, L, o.box, 30, 14, 14) : null;
      M.anim(L, kind);
      var p = M.textProps(L);
      M.expose(comp, [[p.text, 'Text'], [color, 'Text Color'], box ? [box, 'Box Color'] : null, [p.position, 'Position'], [p.scale, 'Scale']]);
    });
  }

  block('Caption Pop', 'pop');
  block('Caption Bounce', 'bounce');
  block('Caption Glow', 'pop', { color: LIME, glow: true, stroke: 0 });
  block('Caption Highlight Box', 'pop', { color: '#111111', box: LIME, stroke: 0 });

  /** Palavra falada em destaque (cor). */
  M.add(DYN, 'Caption Word Highlight', function (comp) {
    var L = dynText(comp, {});
    var color = M.textColor(L, '#ffffff');
    var hi = M.colorCtrl(L, 'Highlight Color', LIME);
    var a = M.animator(L, 'Highlight', 'expr', 3);
    a.props.addProperty('ADBE Text Fill Color').expression = 'effect("Highlight Color")(1)';
    a.props.addProperty('ADBE Text Scale 3D').setValue([112, 112, 100]);
    a.selector.property('ADBE Text Expressible Amount').expression = M.WORD_JS + '(time >= s && time < s + step) ? [100, 100, 100] : [0, 0, 0];';
    M.anim(L, 'pop');
    var p = M.textProps(L);
    M.expose(comp, [[p.text, 'Text'], [color, 'Text Color'], [hi, 'Highlight Color'], [p.position, 'Position'], [p.scale, 'Scale']]);
  });

  /** Karaokê: palavras ainda não ditas ficam apagadas. */
  M.add(DYN, 'Caption Karaoke', function (comp) {
    var L = dynText(comp, {});
    var color = M.textColor(L, '#ffffff');
    var dim = M.colorCtrl(L, 'Upcoming Color', '#7a7a7a');
    var a = M.animator(L, 'Upcoming', 'expr', 3);
    a.props.addProperty('ADBE Text Fill Color').expression = 'effect("Upcoming Color")(1)';
    a.selector.property('ADBE Text Expressible Amount').expression = M.WORD_JS + 'time < s ? [100, 100, 100] : [0, 0, 0];';
    M.anim(L, 'fade');
    var p = M.textProps(L);
    M.expose(comp, [[p.text, 'Text'], [color, 'Text Color'], [dim, 'Upcoming Color'], [p.position, 'Position'], [p.scale, 'Scale']]);
  });

  /** Cada palavra entra com pop, na sequência. */
  M.add(DYN, 'Caption Word Pop', function (comp) {
    var L = dynText(comp, {});
    var color = M.textColor(L, '#ffffff');
    var a = M.animator(L, 'Word In', 'expr', 3);
    a.props.addProperty('ADBE Text Opacity').setValue(0);
    a.props.addProperty('ADBE Text Scale 3D').setValue([40, 40, 100]);
    a.selector.property('ADBE Text Expressible Amount').expression = M.WORD_JS +
      'var k = time < s ? 100 : ease(time, s, s + 0.14, 100, 0); [k, k, k];';
    M.anim(L, 'none');
    var p = M.textProps(L);
    M.expose(comp, [[p.text, 'Text'], [color, 'Text Color'], [p.position, 'Position'], [p.scale, 'Scale']]);
  });

  /** Máquina de escrever (letra a letra, na primeira metade do bloco). */
  M.add(DYN, 'Caption Typewriter', function (comp) {
    var L = dynText(comp, { font: 'Inter-Bold', stroke: 6 });
    var color = M.textColor(L, '#ffffff');
    var a = M.animator(L, 'Type', 'expr', 1);
    a.props.addProperty('ADBE Text Opacity').setValue(0);
    a.selector.property('ADBE Text Expressible Amount').expression =
      'var p = clamp(time / Math.max(0.3, (thisComp.duration - 0.2) * 0.5), 0, 1); var k = textIndex > p * textTotal ? 100 : 0; [k, k, k];';
    M.anim(L, 'none');
    var p = M.textProps(L);
    M.expose(comp, [[p.text, 'Text'], [color, 'Text Color'], [p.position, 'Position'], [p.scale, 'Scale']]);
  });
})();
