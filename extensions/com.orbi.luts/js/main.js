/*
 * Orbi LUT Library — LUTs da Adobe (AE, Premiere, Photoshop) + as suas, aplicadas pelo Lumetri no After Effects.
 * Draft Creative Studio Ltda · Daniel Rodrigues
 *
 * Fontes:
 * - "Adobe": grupos devolvidos pelo host (ORBI.luts.adobe). Criativas e a biblioteca do usuário aplicam na hora.
 * - "Minha pasta": qualquer pasta, validada pelo motor (orbi-engine luts).
 * LUT que ainda não está no menu Look é copiada para %APPDATA%\Adobe\Common\LUTs\Creative
 * e o After Effects precisa ser reiniciado uma vez (ver host/aftereffects.jsx).
 */
(function () {
  'use strict';
  var ui = ORBI.ui, $ = ui.$;
  var LUT_TYPES = ['cube', '3dl', 'look', 'itx'];
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ok */ } }
  };
  var folder = store.get('orbi.luts.folder');
  var source = store.get('orbi.luts.source') || 'adobe';
  var lists = { adobe: [], folder: [] };
  var chosen = null;
  var intensity = null;

  function node(m) {
    var r = window.cep_node ? window.cep_node.require : (typeof window.require === 'function' ? window.require : null);
    if (!r) throw new Error('Node.js indisponível no painel.');
    return r(m);
  }

  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /* ---------------- biblioteca do Lumetri ---------------- */

  /** Pasta Creative do usuário, que o Lumetri lê ao abrir o After Effects. */
  function libraryDir() {
    return node('path').join(ORBI.host.userDataPath(), 'Adobe', 'Common', 'LUTs', 'Creative');
  }

  /**
   * Garante a LUT na biblioteca do Lumetri. Devolve { name, fresh } — fresh = acabou de ser copiada
   * (o After Effects só enxerga depois de reiniciar). Arquivo diferente com o mesmo nome não é sobrescrito.
   */
  function ensureInLibrary(src) {
    var fs = node('fs'), path = node('path');
    var dir = libraryDir();
    fs.mkdirSync(dir, { recursive: true });
    var data = fs.readFileSync(src);
    var ext = path.extname(src);
    var base = path.basename(src, ext);
    var names = [base, base + ' (Orbi)'];
    for (var i = 0; i < names.length; i++) {
      var dest = path.join(dir, names[i] + ext.toLowerCase());
      if (fs.existsSync(dest)) {
        if (fs.readFileSync(dest).equals(data)) return { name: names[i], fresh: false };
        continue;
      }
      fs.writeFileSync(dest, data);
      return { name: names[i], fresh: true };
    }
    throw new Error('Já existem LUTs diferentes chamadas "' + base + '" na biblioteca do Lumetri (' + dir + '). Renomeie o arquivo.');
  }

  /* ---------------- lista ---------------- */

  function render() {
    var box = $('#list');
    var q = norm($('#search').value.trim());
    var list = lists[source];
    box.innerHTML = '';
    var group = null, shown = 0;
    list.forEach(function (e) {
      if (q && norm(e.name).indexOf(q) < 0) return;
      if (e.group && e.group !== group) {
        group = e.group;
        var h = document.createElement('div');
        h.className = 'lut-group';
        h.textContent = group;
        box.appendChild(h);
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lut-item' + (e.ok ? '' : ' bad') + (chosen === e ? ' on' : '');
      b.textContent = e.name;
      var tag = document.createElement('span');
      tag.textContent = e.ok ? (e.tag || '') + (e.instant ? '' : ' ↻') : 'erro';
      tag.title = e.instant ? 'Aplica na hora' : 'No primeiro uso entra na sua biblioteca e pede reiniciar o After Effects';
      b.appendChild(tag);
      b.addEventListener('click', function () { choose(e); });
      box.appendChild(b);
      shown++;
    });
    if (!shown) {
      $('#detail').textContent = list.length ? 'Nenhuma LUT com esse nome.' :
        (source === 'folder' ? (folder ? 'Nenhum arquivo .cube nesta pasta.' : '') : 'Nenhuma LUT encontrada.');
    }
  }

  function choose(e) {
    chosen = e.ok ? e : null;
    $('#chosen').textContent = chosen ? chosen.name + (chosen.instant ? '' : '  (1º uso: reiniciar o After Effects)') : 'Esta LUT tem erro e não pode ser aplicada.';
    $('#detail').textContent = e.ok ? e.path + (e.detail ? '  ·  ' + e.detail : '') : e.name + ': ' + e.error;
    $('#btnApply').disabled = !chosen;
    render();
  }

  function setSource(s) {
    source = ORBI.host.isAfterEffects ? s : 'folder';
    store.set('orbi.luts.source', source);
    document.body.setAttribute('data-src', source);
    var tabs = document.querySelectorAll('.tabs .chip');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].getAttribute('data-src') === source);
    $('#detail').textContent = '';
    render();
  }

  function loadAdobe() {
    return ORBI.host.call('luts.adobe', {}).then(function (r) {
      var out = [];
      r.groups.forEach(function (g) {
        g.items.forEach(function (it) {
          out.push({ name: it.name, path: it.path, ok: true, group: g.label + ' · ' + g.items.length, instant: g.instant, tag: '' });
        });
      });
      lists.adobe = out;
      chosen = null;
      $('#btnApply').disabled = true;
      $('#chosen').textContent = 'Toque numa LUT da lista.';
      render();
      return out.length + ' LUTs da Adobe e suas.';
    });
  }

  function loadFolder() {
    if (!folder) throw new Error('Escolha primeiro a pasta de LUTs.');
    return ORBI.engine.run(['luts', folder]).then(function (r) {
      var list = r.result || [];
      lists.folder = list.map(function (e) {
        return {
          name: e.ok ? e.file.replace(/\.cube$/i, '') : e.file, path: e.path, ok: e.ok, error: e.error,
          instant: false, tag: e.ok ? e.kind.toUpperCase() + ' ' + e.size : '', detail: e.title || ''
        };
      });
      var ok = list.filter(function (e) { return e.ok; }).length;
      $('#sOk').textContent = ok;
      $('#sBad').textContent = list.length - ok;
      chosen = null;
      render();
      return list.length + ' arquivo(s) lidos.';
    });
  }

  /* ---------------- ações ---------------- */

  function pick() {
    var fs = window.cep && window.cep.fs;
    if (!fs || !fs.showOpenDialogEx) throw new Error('Seletor de pasta indisponível nesta versão do CEP.');
    var r = fs.showOpenDialogEx(false, true, 'Escolha a pasta de LUTs', folder || '', []);
    if (r && r.data && r.data.length) {
      folder = r.data[0];
      store.set('orbi.luts.folder', folder);
      $('#folder').textContent = folder;
      return loadFolder();
    }
    return '';
  }

  /** Adiciona arquivos de LUT de qualquer lugar à biblioteca do Lumetri. */
  function add() {
    var fs = window.cep && window.cep.fs;
    if (!fs || !fs.showOpenDialogEx) throw new Error('Seletor de arquivos indisponível nesta versão do CEP.');
    var r = fs.showOpenDialogEx(true, false, 'Escolha as LUTs para adicionar', folder || '', LUT_TYPES);
    if (!r || !r.data || !r.data.length) return '';
    var fresh = 0, already = 0;
    r.data.forEach(function (p) {
      if (!/\.(cube|3dl|look|itx)$/i.test(p)) return;
      if (ensureInLibrary(p).fresh) fresh++; else already++;
    });
    return loadAdobe().then(function () {
      if (!fresh && !already) return 'Nenhum arquivo de LUT (.cube, .3dl, .look, .itx) escolhido.';
      return (fresh ? fresh + ' LUT(s) adicionada(s) à sua biblioteca. Feche e abra o After Effects uma vez para usá-las.' : '') +
        (already ? (fresh ? ' ' : '') + already + ' já estava(m) na biblioteca.' : '');
    });
  }

  function apply() {
    if (!chosen) throw new Error('Toque numa LUT da lista primeiro.');
    var name = chosen.name;
    if (!chosen.instant) {
      var lib = ensureInLibrary(chosen.path);
      if (lib.fresh) {
        return loadAdobe().then(function () {
          return 'LUT "' + lib.name + '" adicionada à sua biblioteca do Lumetri. Feche e abra o After Effects uma vez e aplique de novo.';
        });
      }
      name = lib.name;
    }
    return ORBI.host.call('luts.apply', { name: name, intensity: intensity() }).then(function (r) {
      return 'LUT aplicada em ' + r.count + (r.adjustment ? ' camada de ajuste nova.' : ' camada(s) selecionada(s).');
    });
  }

  function run(label, fn) {
    return ui.task(label, fn).then(function () { $('#btnApply').disabled = !chosen; });
  }

  $('#folder').textContent = folder || 'Nenhuma pasta escolhida.';
  ui.boot(function () {
    intensity = ui.bindSlider('intensity', function (v) { return v + '%'; });
    var tabs = document.querySelectorAll('.tabs .chip');
    for (var i = 0; i < tabs.length; i++) tabs[i].addEventListener('click', function () { setSource(this.getAttribute('data-src')); });
    $('#search').addEventListener('input', render);
    $('#btnPick').addEventListener('click', function () { run('Abrindo…', pick); });
    $('#btnAdd').addEventListener('click', function () { run('Adicionando…', add); });
    $('#btnApply').addEventListener('click', function () { run('Aplicando LUT…', apply); });
    setSource(source);
    $('#btnApply').disabled = true;
    if (ORBI.host.isAfterEffects) run('Lendo LUTs da Adobe…', loadAdobe);
    if (folder) run('Lendo LUTs…', loadFolder);
  });
})();
