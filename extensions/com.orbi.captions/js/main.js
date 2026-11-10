/*
 * Orbi Legendas dinâmicas — SRT/VTT → blocos curtos estilo CapCut.
 * Premiere: faixa de legendas. After Effects: camadas de texto com "pop".
 * Draft Creative Studio Ltda · Daniel Rodrigues
 */
(function () {
  'use strict';
  var ui = ORBI.ui, $ = ui.$, host = ORBI.host;
  // Estilos prontos: tamanho relativo ao slider, cores e contorno.
  var LOOKS = {
    classico: { size: 1, color: '#ffffff', accent: '#bce64a', alt: true, stroke: 9, font: 'Manrope-ExtraBold' },
    neon: { size: 1.1, color: '#ffffff', accent: '#bce64a', alt: false, stroke: 14, font: 'Manrope-ExtraBold' },
    cinema: { size: 0.8, color: '#f5f5f5', accent: '#f5f5f5', alt: false, stroke: 0, font: 'DMSans-Bold' }
  };
  var file = null;
  try { file = localStorage.getItem('orbi.captions.file'); } catch (e) { /* ok */ }

  var words = ui.bindSlider('words', function (v) { return v === 1 ? 'palavra a palavra' : v; });
  var size = ui.bindSlider('size', function (v) { return v + ' px'; });
  var ypos = ui.bindSlider('ypos', function (v) { return v + '%'; });

  function showFile() { $('#fileName').textContent = file ? file.replace(/^.*[\\/]/, '') : 'Nenhum arquivo escolhido.'; }

  function pick() {
    var fs = window.cep && window.cep.fs;
    if (!fs || !fs.showOpenDialogEx) throw new Error('Seletor de arquivos indisponível nesta versão do CEP.');
    var r = fs.showOpenDialogEx(false, false, 'Escolha a legenda (SRT ou VTT)', file || '', ['srt', 'vtt']);
    if (r && r.data && r.data.length) {
      file = r.data[0];
      try { localStorage.setItem('orbi.captions.file', file); } catch (e) { /* ok */ }
      showFile();
      return 'Arquivo escolhido.';
    }
    return '';
  }

  function params() {
    return { maxWords: words(), maxChars: words() === 1 ? 40 : 6 * words() + 4, minDur: 0.25, uppercase: $('#upper').checked, stripPunct: $('#strip').checked };
  }

  function apply() {
    if (!file) throw new Error('Escolha primeiro o arquivo SRT/VTT.');
    var out = ORBI.engine.tempFile('legendas-orbi', '.srt');
    return ORBI.engine.run(['captions', file, '--params', JSON.stringify(params()), '--srt-out', out]).then(function (r) {
      $('#sCues').textContent = r.cues;
      $('#sChunks').textContent = r.chunks.length;
      $('#sWords').textContent = r.chunks.reduce(function (n, c) { return n + c.text.split(' ').length; }, 0);
      if (host.isPremiere) {
        return host.call('captions.importSrt', { file: r.srt }).then(function (h) {
          return h.track ? r.chunks.length + ' blocos criados como faixa de legendas.'
            : 'SRT importado no projeto (' + h.item + '). Arraste-o para a sequência para criar as legendas.';
        });
      }
      var look = LOOKS[$('#look').value] || LOOKS.classico;
      var style = { size: size() * look.size, y: ypos(), anim: $('#anim').value, alternate: look.alt, color: look.color, accent: look.accent, stroke: look.stroke, font: look.font };
      return host.call('captions.create', { chunks: r.chunks, style: style }).then(function (h) { return h.count + ' camada(s) de legenda criadas.'; });
    });
  }

  showFile();
  ui.boot(function () {
    $('#btnPick').addEventListener('click', function () { ui.task('Abrindo…', pick); });
    $('#btnApply').addEventListener('click', function () { ui.task('Criando legendas…', apply); });
    $('#btnClear').addEventListener('click', function () {
      ui.task('Removendo…', function () { return host.call('captions.clear', {}).then(function (h) { return h.count + ' legenda(s) removida(s).'; }); });
    });
  });
})();
