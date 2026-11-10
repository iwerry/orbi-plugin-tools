/*
 * Orbi LUT Library — host After Effects: aplica uma LUT pelo efeito nativo Cor de Lumetri (Look).
 * Draft Creative Studio Ltda · Daniel Rodrigues
 *
 * Como funciona (medido no AE 2026 / 26.5):
 * - O ExtendScript não consegue apontar um arquivo para o Lumetri, nem para o "Aplicar LUT de cor"
 *   (abre um seletor de arquivo) nem para o "LUT Transform" (não pode ser adicionado por script).
 * - O menu "Look" do Lumetri lista 4 itens fixos ("Nenhum", "Procurar..." e separadores) e depois
 *   todas as LUTs das pastas Creative (a do AE e a do usuário) em ordem alfabética.
 * - Então o painel copia a .cube para %APPDATA%\Adobe\Common\LUTs\Creative e aqui calculamos a posição.
 *   O menu só é montado quando o AE abre: LUT nova exige reiniciar o AE uma vez.
 */
ORBI.luts = ORBI.luts || {};
ORBI.luts.LUMETRI = 'ADBE Lumetri';
ORBI.luts.LOOK = 'ADBE Lumetri-0025';
ORBI.luts.INTENSITY = 'ADBE Lumetri-0026';
ORBI.luts.FIXED = 4;
ORBI.luts.EXT = /\.(cube|itx|look|3dl)$/i;
ORBI.luts.TAG = 'orbi:lut';

ORBI.luts.folders = function () {
  return [
    new Folder(Folder.appPackage.fsName + '/Lumetri/LUTs/Creative'),
    new Folder(Folder.userData.fsName + '/Adobe/Common/LUTs/Creative')
  ];
};

/** Nomes (sem extensão) na ordem do menu Look. */
ORBI.luts.menuNames = function () {
  var names = [];
  var dirs = ORBI.luts.folders();
  for (var d = 0; d < dirs.length; d++) {
    if (!dirs[d].exists) continue;
    var files = dirs[d].getFiles();
    for (var i = 0; i < files.length; i++) {
      if (!(files[i] instanceof File)) continue;
      var n = decodeURI(files[i].name);
      if (ORBI.luts.EXT.test(n)) names.push(n.replace(/\.[^.]+$/, ''));
    }
  }
  names.sort(function (a, b) {
    var x = a.toLowerCase(), y = b.toLowerCase();
    return x < y ? -1 : (x > y ? 1 : 0);
  });
  return names;
};

/** Camadas que recebem a LUT: as selecionadas, ou uma camada de ajuste nova no topo. */
ORBI.luts.targets = function (comp, name) {
  var out = [];
  var sel = comp.selectedLayers;
  for (var i = 0; i < sel.length; i++) {
    if (sel[i].property('ADBE Effect Parade') && sel[i].property('ADBE Effect Parade').canAddProperty(ORBI.luts.LUMETRI)) out.push(sel[i]);
  }
  if (out.length) return { layers: out, created: false };
  var adj = comp.layers.addSolid([1, 1, 1], 'Orbi LUT · ' + name, comp.width, comp.height, comp.pixelAspect, comp.duration);
  adj.adjustmentLayer = true;
  adj.comment = ORBI.luts.TAG;
  return { layers: [adj], created: true };
};

/**
 * a.name: nome da LUT sem extensão (como ficou na pasta Creative do usuário)
 * a.intensity: 0–100 (opcional, padrão 100)
 */
ORBI.luts.apply = function (a) {
  var comp = ORBI.ae.activeComp();
  var names = ORBI.luts.menuNames();
  var idx = -1;
  for (var i = 0; i < names.length; i++) if (names[i].toLowerCase() === String(a.name).toLowerCase()) { idx = i; break; }
  if (idx < 0) ORBI.fail('A LUT "' + a.name + '" não está na pasta de LUTs do Lumetri.');
  var pos = ORBI.luts.FIXED + 1 + idx;

  app.beginUndoGroup('Orbi LUT: ' + a.name);
  var applied = 0, created = false;
  try {
    var t = ORBI.luts.targets(comp, a.name);
    created = t.created;
    for (var k = 0; k < t.layers.length; k++) {
      var fx = t.layers[k].property('ADBE Effect Parade').addProperty(ORBI.luts.LUMETRI);
      var look = fx.property(ORBI.luts.LOOK);
      var expected = ORBI.luts.FIXED + names.length;
      var shown = look.maxValue;
      if (shown !== expected) {
        fx.remove();
        if (created) t.layers[k].remove();
        ORBI.fail('O Lumetri ainda não mostra esta LUT (menu com ' + shown + ' itens, esperado ' + expected + '). ' +
          'Se ela acabou de ser adicionada, feche e abra o After Effects uma vez e aplique de novo.');
      }
      look.setValue(pos);
      if (a.intensity !== undefined) fx.property(ORBI.luts.INTENSITY).setValue(Math.max(0, Math.min(200, Number(a.intensity))));
      fx.name = 'Orbi LUT · ' + a.name;
      applied++;
    }
  } finally {
    app.endUndoGroup();
  }
  return { count: applied, adjustment: created, position: pos };
};

/** Arquivos de LUT de uma pasta: [{name, path}] (nome sem extensão). */
ORBI.luts.scan = function (folder, prefer) {
  var out = [], seen = {};
  if (!folder.exists) return out;
  var files = folder.getFiles();
  // Mesma LUT em vários formatos (Photoshop): fica o primeiro da ordem de preferência.
  files.sort(function (a, b) {
    var rank = function (f) { var m = /\.([^.]+)$/.exec(f.name); var i = prefer ? prefer.indexOf(m ? m[1].toLowerCase() : '') : 0; return i < 0 ? 99 : i; };
    return rank(a) - rank(b);
  });
  for (var i = 0; i < files.length; i++) {
    if (!(files[i] instanceof File)) continue;
    var n = decodeURI(files[i].name);
    if (!ORBI.luts.EXT.test(n)) continue;
    var name = n.replace(/\.[^.]+$/, '');
    if (seen[name.toLowerCase()]) continue;
    seen[name.toLowerCase()] = true;
    out.push({ name: name, path: files[i].fsName });
  }
  out.sort(function (a, b) { var x = a.name.toLowerCase(), y = b.name.toLowerCase(); return x < y ? -1 : (x > y ? 1 : 0); });
  return out;
};

/** LUTs que já vêm com os apps Adobe, em grupos. instant = já estão no menu Look do Lumetri. */
ORBI.luts.adobe = function () {
  var base = Folder.appPackage.fsName + '/Lumetri/LUTs/';
  var groups = [
    { id: 'creative', label: 'Criativas (Adobe)', instant: true, items: ORBI.luts.scan(new Folder(base + 'Creative')) },
    { id: 'user', label: 'Minha biblioteca do Lumetri', instant: true, items: ORBI.luts.scan(ORBI.luts.folders()[1]) },
    { id: 'legacy', label: 'Clássicas (SpeedLooks)', instant: false, items: ORBI.luts.scan(new Folder(base + 'Legacy')) },
    { id: 'technical', label: 'Técnicas (câmeras)', instant: false, items: ORBI.luts.scan(new Folder(base + 'Technical')) }
  ];
  // appPackage = ...\Adobe\Adobe After Effects 2026\Support Files → sobe dois níveis até ...\Adobe
  var adobe = Folder.appPackage.parent.parent;
  var ps = adobe.exists ? adobe.getFiles('Adobe Photoshop*') : [];
  for (var i = ps.length - 1; i >= 0; i--) {
    var d = new Folder(ps[i].fsName + '/Presets/3DLUTs');
    if (d.exists) {
      groups.push({ id: 'photoshop', label: 'Photoshop (' + decodeURI(ps[i].name).replace('Adobe ', '') + ')', instant: false, items: ORBI.luts.scan(d, ['cube', '3dl', 'look']) });
      break;
    }
  }
  return { groups: groups };
};

/** Diz se a LUT já aparece no menu do Lumetri (sem mexer no projeto). */
ORBI.luts.status = function (a) {
  var names = ORBI.luts.menuNames();
  for (var i = 0; i < names.length; i++) if (names[i].toLowerCase() === String(a.name).toLowerCase()) return { inFolder: true, total: names.length };
  return { inFolder: false, total: names.length };
};
