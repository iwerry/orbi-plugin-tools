/*
 * Orbi LUT Library — lista e valida as LUTs .cube de uma pasta (motor: orbi-engine luts).
 * Draft Creative Studio Ltda · Daniel Rodrigues
 */
(function () {
  'use strict';
  var ui = ORBI.ui, $ = ui.$;
  var folder = null;
  try { folder = localStorage.getItem('orbi.luts.folder'); } catch (e) { /* ok */ }

  function showFolder() {
    $('#folder').textContent = folder ? folder : 'Nenhuma pasta escolhida.';
  }

  function pick() {
    var fs = window.cep && window.cep.fs;
    if (!fs || !fs.showOpenDialogEx) throw new Error('Seletor de pasta indisponível nesta versão do CEP.');
    var r = fs.showOpenDialogEx(false, true, 'Escolha a pasta de LUTs', folder || '', []);
    if (r && r.data && r.data.length) {
      folder = r.data[0];
      try { localStorage.setItem('orbi.luts.folder', folder); } catch (e) { /* ok */ }
      showFolder();
      return load();
    }
    return '';
  }

  function show(entry) {
    var d = $('#detail');
    if (!entry.ok) { d.textContent = entry.file + ': ' + entry.error; return; }
    d.textContent = entry.path + '  ·  ' + entry.kind.toUpperCase() + ' ' + entry.size + (entry.title ? '  ·  ' + entry.title : '');
  }

  function render(list) {
    var box = $('#list');
    box.innerHTML = '';
    list.forEach(function (e) {
      var b = document.createElement('button');
      b.className = 'lut-item' + (e.ok ? '' : ' bad');
      b.textContent = e.ok ? e.file.replace(/\.cube$/i, '') : e.file;
      var tag = document.createElement('span');
      tag.textContent = e.ok ? e.kind.toUpperCase() + ' ' + e.size : 'erro';
      b.appendChild(tag);
      b.addEventListener('click', function () { show(e); });
      box.appendChild(b);
    });
  }

  function load() {
    if (!folder) throw new Error('Escolha primeiro a pasta de LUTs.');
    return ORBI.engine.run(['luts', folder]).then(function (r) {
      var list = r.result || [];
      var ok = list.filter(function (e) { return e.ok; }).length;
      $('#sOk').textContent = ok;
      $('#sBad').textContent = list.length - ok;
      render(list);
      $('#detail').textContent = list.length ? 'Toque numa LUT para ver os detalhes.' : 'Nenhum arquivo .cube nesta pasta.';
      return list.length + ' arquivo(s) lidos.';
    });
  }

  showFolder();
  ui.boot(function () {
    $('#btnPick').addEventListener('click', function () { ui.task('Abrindo…', pick); });
    if (folder) ui.task('Lendo LUTs…', load);
  });
})();
