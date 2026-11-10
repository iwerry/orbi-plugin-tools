/*
 * Orbi Plugin Tools — cliente do motor nativo orbi-engine (Rust).
 * Usa o Node.js embutido no CEP (--enable-nodejs) para rodar o binário.
 */
(function (global) {
  'use strict';
  var ORBI = global.ORBI = global.ORBI || {};
  var req = global.cep_node ? global.cep_node.require : (typeof global.require === 'function' ? global.require : null);

  function node(mod) {
    if (!req) throw new Error('Node.js indisponível no painel (verifique --enable-nodejs no manifest).');
    return req(mod);
  }

  function candidates() {
    var path = node('path');
    var proc = global.cep_node ? global.cep_node.process : global.process;
    var isWin = proc.platform === 'win32';
    var exe = isWin ? 'orbi-engine.exe' : 'orbi-engine';
    var list = [];
    try { var o = global.localStorage.getItem('orbi.enginePath'); if (o) list.push(o); } catch (e) { /* sem storage */ }
    if (proc.env.ORBI_ENGINE) list.push(proc.env.ORBI_ENGINE);
    if (isWin) {
      list.push(path.join(proc.env.ProgramFiles || 'C:\\Program Files', 'Orbi Plugin Tools', 'bin', exe));
    } else {
      list.push('/Library/Application Support/Orbi Plugin Tools/bin/' + exe);
    }
    // Desenvolvimento: binário dentro da própria extensão.
    list.push(path.join(ORBI.host.extensionPath(), 'bin', exe));
    return list;
  }

  var cached = null;
  function enginePath() {
    if (cached) return cached;
    var fs = node('fs');
    var list = candidates();
    for (var i = 0; i < list.length; i++) {
      try { if (fs.existsSync(list[i])) { cached = list[i]; return cached; } } catch (e) { /* ignora */ }
    }
    throw new Error('orbi-engine não encontrado. Procurado em:\n' + list.join('\n') + '\nReinstale o Orbi Plugin Tools.');
  }

  /** Pasta temporária do ORBI. */
  function tempDir() {
    var os = node('os'), path = node('path'), fs = node('fs');
    var d = path.join(os.tmpdir(), 'orbi');
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    return d;
  }

  function tempFile(prefix, ext) {
    var path = node('path');
    return path.join(tempDir(), prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + ext);
  }

  /** Executa `orbi-engine <args...>` e devolve o JSON de resposta. */
  function run(args, opts) {
    opts = opts || {};
    var cp = node('child_process');
    var exe = enginePath();
    return new Promise(function (resolve, reject) {
      cp.execFile(exe, args, { maxBuffer: 256 * 1024 * 1024, windowsHide: true, timeout: opts.timeout || 0 },
        function (err, stdout, stderr) {
          var txt = String(stdout || '').trim();
          var line = txt.split(/\r?\n/).pop();
          var r = null;
          try { r = JSON.parse(line); } catch (e) { /* trata abaixo */ }
          if (r && r.ok) return resolve(r);
          if (r && r.error) return reject(new Error(r.error));
          reject(new Error((err && err.message) || stderr || 'orbi-engine falhou'));
        });
    });
  }

  /** Grava um pedido em JSON temporário e chama `orbi-engine <cmd> <arquivo>`. */
  function request(cmd, payload) {
    var fs = node('fs');
    var f = tempFile(cmd, '.json');
    fs.writeFileSync(f, JSON.stringify(payload), 'utf8');
    return run([cmd, f]).then(function (r) {
      try { fs.unlinkSync(f); } catch (e) { /* ok */ }
      return r;
    });
  }

  ORBI.engine = {
    path: enginePath,
    run: run,
    request: request,
    tempFile: tempFile,
    tempDir: tempDir,
    version: function () { return run(['version']); }
  };
})(window);
