/*
 * Titles/Cinematic — títulos de abertura, cada um com uma técnica própria.
 * Orbi Plugin Tools · Draft Creative Studio Ltda
 */
(function () {
  var CAT = 'Titles/Cinematic';
  var OPT = { dur: 5, inDur: 1.6, outDur: 0.8, thumb: 0.5 };
  var LIME = '#bce64a', GOLD = '#e8c27a';
  var CY = M.H / 2;

  function title(comp, o) {
    // A posição do texto é a linha de base: desce ~1/3 do corpo para centralizar visualmente.
    o.y = (o.y === undefined ? CY : o.y) + (o.size || 72) * 0.35;
    var L = M.text(comp, o);
    return L;
  }

  function exposeOne(comp, L, color) {
    var p = M.textProps(L);
    M.expose(comp, [[p.text, 'Text'], [color, 'Text Color'], [p.position, 'Position'], [p.scale, 'Scale']]);
  }

  /** Letras se afastam devagar, saindo do desfoque (abertura elegante). */
  M.add(CAT, 'Cinematic Spread', function (comp) {
    var L = title(comp, { text: 'BEYOND THE HORIZON', font: 'Montserrat-Light', size: 96, caps: true, tracking: 0 });
    var color = M.textColor(L, '#ffffff');
    var a = M.animator(L, 'Spread', 'range');
    a.props.addProperty('ADBE Text Tracking Amount').expression = 'ease(time, 0, 1.6, 0, 16) + time * 1.2;';
    a.props.addProperty('ADBE Text Blur').expression = 'var b = ease(time, 0, 1.1, 24, 0); [b, b];';
    M.fadeOut(L, 'ease(time, 0, 0.9, 0, 100)', 0.8);
    exposeOne(comp, L, color);
  }, OPT);

  /** Cada letra entra em foco numa ordem aleatória. */
  M.add(CAT, 'Cinematic Focus', function (comp) {
    var L = title(comp, { text: 'PARADOX', font: 'Montserrat-SemiBold', size: 120, caps: true, tracking: 320 });
    var color = M.textColor(L, '#dfe9f2');
    var a = M.animator(L, 'Focus', 'expr', 1);
    a.props.addProperty('ADBE Text Opacity').setValue(0);
    a.props.addProperty('ADBE Text Blur').setValue([40, 40]);
    a.selector.property('ADBE Text Expressible Amount').expression =
      'seedRandom(textIndex, true); var s = random(0, 0.9); var k = ease(time, s, s + 0.55, 100, 0); [k, k, k];';
    M.fadeOut(L, '100', 0.8);
    exposeOne(comp, L, color);
  }, OPT);

  /** Um brilho de luz atravessa o título. */
  M.add(CAT, 'Cinematic Light Sweep', function (comp) {
    var L = title(comp, { text: 'GOLDEN HOUR', font: 'Montserrat-Black', size: 140, caps: true, tracking: 40 });
    var color = M.textColor(L, GOLD);
    var fx = M.effect(L, 'CC Light Sweep', 'Light Sweep');
    fx.property(1).expression = 'var r = sourceRectAtTime(time, false); [linear(time, 0.4, 1.8, r.left - 300, r.left + r.width + 300), r.top + r.height / 2];';
    L.property('ADBE Transform Group').property('ADBE Scale').expression = 'value * ease(time, 0, 1.6, 108, 100) / 100;';
    M.fadeOut(L, 'ease(time, 0, 0.6, 0, 100)', 0.8);
    exposeOne(comp, L, color);
  }, OPT);

  /** As letras sobem em onda, da esquerda para a direita. */
  M.add(CAT, 'Cinematic Rise', function (comp) {
    var L = title(comp, { text: 'RISE ABOVE', font: 'Anton-Regular', size: 170, caps: true, tracking: 60 });
    var color = M.textColor(L, '#ffffff');
    var a = M.animator(L, 'Rise', 'expr', 1);
    a.props.addProperty('ADBE Text Position 3D').setValue([0, 120, 0]);
    a.props.addProperty('ADBE Text Opacity').setValue(0);
    a.props.addProperty('ADBE Text Scale 3D').setValue([100, 160, 100]);
    a.selector.property('ADBE Text Expressible Amount').expression =
      'var s = (textIndex - 1) / Math.max(1, textTotal) * 0.7; var k = ease(time, s, s + 0.45, 100, 0); [k, k, k];';
    M.fadeOut(L, '100', 0.6);
    exposeOne(comp, L, color);
  }, OPT);

  /** Letras piscam como lâmpada antes de acender de vez. */
  M.add(CAT, 'Cinematic Flicker', function (comp) {
    var L = title(comp, { text: 'AFTER DARK', font: 'BebasNeue-Regular', size: 190, caps: true, tracking: 220 });
    var color = M.textColor(L, '#f2f2f2');
    M.effect(L, 'ADBE Glo2', 'Glow');
    var a = M.animator(L, 'Flicker', 'expr', 1);
    a.props.addProperty('ADBE Text Opacity').setValue(0);
    a.selector.property('ADBE Text Expressible Amount').expression =
      'seedRandom(textIndex, true); var s = random(0.15, 1.1); var k = 0;\n' +
      'if (time < s) k = 100;\n' +
      'else if (time < s + 0.35) { seedRandom(textIndex * 97 + Math.floor(time * 24), true); k = random() > 0.45 ? 0 : 100; }\n' +
      '[k, k, k];';
    M.fadeOut(L, '100', 0.5);
    exposeOne(comp, L, color);
  }, OPT);

  /** Título em dois níveis: chamada pequena em destaque + título grande. */
  M.add(CAT, 'Cinematic Two Tier', function (comp) {
    var K = title(comp, { name: 'Kicker', text: 'THE', font: 'Montserrat-SemiBold', size: 38, caps: true, tracking: 600, y: CY - 100, color: LIME });
    var T = title(comp, { name: 'Title', text: 'NEVERENDING STORY', font: 'Montserrat-ExtraBold', size: 118, caps: true, tracking: 20 });
    var kc = M.textColor(K, LIME, 'Accent Color');
    var tc = M.textColor(T, '#e8f4ff');
    K.property('ADBE Transform Group').property('ADBE Position').expression = 'value + [0, ease(time, 0.5, 1.3, -40, 0)];';
    M.fadeOut(K, 'ease(time, 0.5, 1.2, 0, 100)', 0.7);
    var a = M.animator(T, 'Reveal', 'expr', 3);
    a.props.addProperty('ADBE Text Position 3D').setValue([0, 60, 0]);
    a.props.addProperty('ADBE Text Opacity').setValue(0);
    a.selector.property('ADBE Text Expressible Amount').expression =
      'var s = (textIndex - 1) * 0.18; var k = ease(time, s, s + 0.6, 100, 0); [k, k, k];';
    M.fadeOut(T, '100', 0.7);
    var pk = M.textProps(K), pt = M.textProps(T);
    M.expose(comp, [[pk.text, 'Kicker'], [pt.text, 'Title'], [kc, 'Accent Color'], [tc, 'Text Color'], [pt.position, 'Position'], [pt.scale, 'Scale']]);
  }, OPT);

  /** O título vem de muito perto, desfocado, e para no lugar. */
  M.add(CAT, 'Cinematic Zoom Through', function (comp) {
    comp.motionBlur = true;
    var L = title(comp, { text: 'IMPACT', font: 'Montserrat-Black', size: 180, caps: true, tracking: 80 });
    L.motionBlur = true;
    var color = M.textColor(L, '#ffffff');
    L.property('ADBE Transform Group').property('ADBE Scale').expression =
      'var k = ease(time, 0, 0.9, 420, 100) - ease(time, thisComp.duration - 0.8, thisComp.duration, 0, 20); value * k / 100;';
    var a = M.animator(L, 'Blur', 'range');
    a.props.addProperty('ADBE Text Blur').expression = 'var b = ease(time, 0, 0.8, 50, 0); [b, b];';
    M.fadeOut(L, 'ease(time, 0, 0.35, 0, 100)', 0.6);
    exposeOne(comp, L, color);
  }, OPT);

  /** Crédito clássico com serifa: "Created by" + nome. */
  M.add(CAT, 'Cinematic Serif Credit', function (comp) {
    var K = title(comp, { name: 'Role', text: 'Created by', font: 'Georgia-Italic', size: 46, y: CY - 95, color: GOLD });
    var T = title(comp, { name: 'Name', text: 'Your Name Here', font: 'Georgia', size: 104, tracking: 30 });
    var kc = M.textColor(K, GOLD, 'Accent Color');
    var tc = M.textColor(T, '#ffffff');
    K.property('ADBE Transform Group').property('ADBE Position').expression = 'value + [ease(time, 0, 1.0, -30, 0), 0];';
    M.fadeOut(K, 'ease(time, 0, 0.9, 0, 100)', 0.8);
    var a = M.animator(T, 'Letters', 'expr', 1);
    a.props.addProperty('ADBE Text Opacity').setValue(0);
    a.props.addProperty('ADBE Text Position 3D').setValue([24, 0, 0]);
    a.selector.property('ADBE Text Expressible Amount').expression =
      'var s = 0.3 + (textIndex - 1) / Math.max(1, textTotal) * 0.8; var k = ease(time, s, s + 0.4, 100, 0); [k, k, k];';
    M.fadeOut(T, '100', 0.8);
    var pk = M.textProps(K), pt = M.textProps(T);
    M.expose(comp, [[pk.text, 'Role'], [pt.text, 'Name'], [kc, 'Accent Color'], [tc, 'Text Color'], [pt.position, 'Position'], [pt.scale, 'Scale']]);
  }, OPT);
})();
