//! Orbi Plugin Tools — instalador/desinstalador em um único executável.
//! Draft Creative Studio Ltda · Desenvolvido por Daniel Rodrigues
//!
//! Uso:
//!   Orbi-Plugin-Tools-Setup.exe                instala (pede para fechar Premiere/AE)
//!   Orbi-Plugin-Tools-Setup.exe --uninstall    remove tudo que foi instalado
//!   Orbi-Plugin-Tools-Setup.exe --silent       sem perguntas (falha se os apps estiverem abertos)
//!   Orbi-Plugin-Tools-Setup.exe --no-debug-mode  não grava PlayerDebugMode (extensões assinadas)
//!   Orbi-Plugin-Tools-Setup.exe --list         mostra o conteúdo embutido
//!   Orbi-Plugin-Tools-Setup.exe --root <dir>   instala numa pasta de teste (sem registro/processos)

use anyhow::{bail, Context, Result};
use include_dir::{include_dir, Dir, DirEntry};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};
use std::process::Command;

static DIST: Dir = include_dir!("$CARGO_MANIFEST_DIR/../../dist");

const PRODUCT: &str = "Orbi Plugin Tools";
const VENDOR: &str = "Draft Creative Studio Ltda";
const AUTHOR: &str = "Daniel Rodrigues";
const VERSION: &str = env!("CARGO_PKG_VERSION");
const UNINSTALL_KEY: &str = r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\OrbiPluginTools";
/// Instalação antiga (v0.1, "FDCS Studio Tools") que é migrada automaticamente.
const LEGACY_UNINSTALL_KEY: &str = r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\FDCSStudioTools";
const LEGACY_EXT_PREFIX: &str = "com.fdcs.";
const LEGACY_APP_DIR: &str = "FDCS Studio";
/// Versões do CEP (CSXS) cobertas pelo PlayerDebugMode: CEP 9 a 14.
const CSXS_VERSIONS: std::ops::RangeInclusive<u32> = 9..=14;
/// Processos que travam arquivos das extensões.
const BLOCKING: &[(&str, &str)] = &[
    ("Adobe Premiere Pro.exe", "Adobe Premiere Pro"),
    ("Adobe Premiere Pro (Beta).exe", "Adobe Premiere Pro (Beta)"),
    ("Adobe Premiere.exe", "Adobe Premiere"),
    ("AfterFX.exe", "Adobe After Effects"),
    ("AfterFX (Beta).exe", "Adobe After Effects (Beta)"),
];

const HELP: &str = "  --uninstall      remove tudo que foi instalado
  --silent         sem perguntas (falha se Premiere/AE estiverem abertos)
  --no-debug-mode  não grava PlayerDebugMode (para extensões assinadas)
  --list           mostra o conteúdo embutido
  --root <pasta>   instala numa pasta de teste (sem registro/processos)";

#[derive(Default)]
struct Opts {
    uninstall: bool,
    silent: bool,
    debug_mode: bool,
    list: bool,
    root: Option<PathBuf>,
}

fn parse_args() -> Result<Opts> {
    let mut o = Opts { debug_mode: true, ..Default::default() };
    let mut it = std::env::args().skip(1);
    while let Some(a) = it.next() {
        match a.as_str() {
            "--uninstall" | "/uninstall" => o.uninstall = true,
            "--silent" | "/S" | "/silent" => o.silent = true,
            "--no-debug-mode" => o.debug_mode = false,
            "--list" => o.list = true,
            "--root" => o.root = Some(PathBuf::from(it.next().context("--root precisa de uma pasta")?)),
            "-h" | "--help" => {
                println!("{HELP}");
                std::process::exit(0);
            }
            other => bail!("opção desconhecida: {other}"),
        }
    }
    Ok(o)
}

/// Onde cada coisa vai morar.
struct Layout {
    /// Pasta das extensões CEP (todas as versões do Premiere/AE leem daqui).
    cep: PathBuf,
    /// Pasta do produto (motor, desinstalador, registro da instalação).
    app: PathBuf,
    /// true = instalação real no Windows (registro + processos).
    system: bool,
}

impl Layout {
    fn detect(root: &Option<PathBuf>) -> Result<Layout> {
        if let Some(r) = root {
            return Ok(Layout { cep: r.join("CEP/extensions"), app: r.join("Orbi Plugin Tools"), system: false });
        }
        if !cfg!(windows) {
            bail!("Este instalador é para Windows. Use --root <pasta> para testar em outro sistema.");
        }
        let env = |k: &str, d: &str| std::env::var_os(k).map(PathBuf::from).unwrap_or_else(|| PathBuf::from(d));
        let common86 = env("CommonProgramFiles(x86)", r"C:\Program Files (x86)\Common Files");
        let pf = env("ProgramFiles", r"C:\Program Files");
        Ok(Layout { cep: common86.join(r"Adobe\CEP\extensions"), app: pf.join("Orbi Plugin Tools"), system: true })
    }
    fn bin(&self) -> PathBuf {
        self.app.join("bin")
    }
    fn record(&self) -> PathBuf {
        self.app.join("install.json")
    }
}

#[derive(Serialize, Deserialize, Default)]
struct Record {
    product: String,
    version: String,
    extensions: Vec<PathBuf>,
    app_dir: PathBuf,
}

fn banner() {
    println!();
    println!("   ██████  ██████  ██████  ██");
    println!("  ██    ██ ██   ██ ██   ██ ██");
    println!("  ██    ██ ██████  ██████  ██");
    println!("  ██    ██ ██   ██ ██   ██ ██");
    println!("   ██████  ██   ██ ██████  ██   PLUGIN TOOLS");
    println!();
    println!("  {PRODUCT} {VERSION}");
    println!("  {VENDOR} · Creative Design & Software Development");
    println!("  {AUTHOR}");
    println!("  ─────────────────────────────────────────────────────────");
}

fn pause(silent: bool, msg: &str) {
    if silent {
        return;
    }
    print!("{msg}");
    let _ = std::io::stdout().flush();
    let _ = std::io::stdin().lock().read_line(&mut String::new());
}

/// Processos Adobe abertos (via tasklist, sem dependências extras).
fn running_apps() -> Vec<&'static str> {
    let out = match Command::new("tasklist").args(["/FO", "CSV", "/NH"]).output() {
        Ok(o) => String::from_utf8_lossy(&o.stdout).to_lowercase(),
        Err(_) => return vec![],
    };
    BLOCKING
        .iter()
        .filter(|(exe, _)| out.contains(&format!("\"{}\"", exe.to_lowercase())))
        .map(|(_, name)| *name)
        .collect()
}

fn wait_for_apps_closed(o: &Opts) -> Result<()> {
    loop {
        let open = running_apps();
        if open.is_empty() {
            return Ok(());
        }
        println!("\n  ⚠  Feche antes de continuar: {}", open.join(", "));
        if o.silent {
            bail!("aplicativos Adobe abertos — instalação cancelada");
        }
        print!("  Pressione Enter para tentar de novo (ou digite S para sair): ");
        std::io::stdout().flush()?;
        let mut l = String::new();
        std::io::stdin().lock().read_line(&mut l)?;
        if l.trim().eq_ignore_ascii_case("s") {
            bail!("instalação cancelada pelo usuário");
        }
    }
}

fn reg(args: &[&str]) -> Result<()> {
    let st = Command::new("reg").args(args).output().context("não consegui executar reg.exe")?;
    if !st.status.success() {
        bail!("reg {}: {}", args.join(" "), String::from_utf8_lossy(&st.stderr).trim());
    }
    Ok(())
}

fn reg_sz(key: &str, name: &str, val: &str) -> Result<()> {
    reg(&["add", key, "/v", name, "/t", "REG_SZ", "/d", val, "/f"])
}

/// Copia uma árvore embutida para o disco.
fn write_tree(d: &Dir, strip: &Path, dest: &Path, count: &mut usize) -> Result<()> {
    for e in d.entries() {
        match e {
            DirEntry::Dir(sub) => write_tree(sub, strip, dest, count)?,
            DirEntry::File(f) => {
                let rel = f.path().strip_prefix(strip).unwrap_or(f.path());
                let out = dest.join(rel);
                if let Some(p) = out.parent() {
                    std::fs::create_dir_all(p)?;
                }
                std::fs::write(&out, f.contents()).with_context(|| format!("gravando {}", out.display()))?;
                *count += 1;
            }
        }
    }
    Ok(())
}

fn extensions() -> Vec<&'static Dir<'static>> {
    DIST.get_dir("extensions").map(|d| d.dirs().collect()).unwrap_or_default()
}

fn engine_file() -> Option<&'static include_dir::File<'static>> {
    DIST.get_dir("bin").and_then(|b| b.files().find(|f| f.path().file_name().map(|n| n.to_string_lossy().starts_with("orbi-engine")).unwrap_or(false)))
}

/// Lê o install.json (aceita BOM UTF-8, caso o arquivo tenha sido editado à mão).
fn parse_record(b: &[u8]) -> Option<Record> {
    let b = b.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(b);
    serde_json::from_slice(b).ok()
}

/// Versão já instalada, se houver: pelo registro da instalação (install.json) ou pela chave do Windows.
fn previous_install(l: &Layout) -> Option<String> {
    if let Ok(b) = std::fs::read(l.record()) {
        return Some(match parse_record(&b) {
            Some(r) if !r.version.is_empty() => r.version,
            _ => "versão desconhecida".into(),
        });
    }
    if l.system && reg(&["query", UNINSTALL_KEY]).is_ok() {
        return Some("versão desconhecida".into());
    }
    None
}

/// Remove a instalação anterior por completo (extensões, motor, registro); mantém o PlayerDebugMode.
fn remove_previous(l: &Layout) -> Result<()> {
    remove_files(l, true)?;
    if l.system {
        let _ = reg(&["delete", UNINSTALL_KEY, "/f"]);
    }
    Ok(())
}

fn install(o: &Opts, l: &Layout) -> Result<()> {
    let exts = extensions();
    if exts.is_empty() {
        bail!("instalador sem conteúdo — gere com `node tools/build.mjs` e recompile");
    }
    if l.system {
        wait_for_apps_closed(o)?;
    }
    migrate_legacy(l);
    // Versão anterior (qualquer uma): desinstala por completo antes de copiar a nova.
    if let Some(v) = previous_install(l) {
        println!("  • Versão anterior encontrada ({v}). Desinstalando antes de instalar {VERSION}…");
        remove_previous(l)?;
        println!("  ✓ Versão anterior removida");
    }

    let mut rec = Record { product: PRODUCT.into(), version: VERSION.into(), app_dir: l.app.clone(), ..Default::default() };
    std::fs::create_dir_all(&l.cep).with_context(|| format!("criando {}", l.cep.display()))?;
    for d in &exts {
        let id = d.path().file_name().unwrap().to_string_lossy().to_string();
        let dest = l.cep.join(&id);
        if dest.exists() {
            std::fs::remove_dir_all(&dest).with_context(|| format!("removendo {}", dest.display()))?;
        }
        let mut n = 0;
        write_tree(d, d.path(), &dest, &mut n)?;
        if !dest.join("CSXS/manifest.xml").exists() {
            bail!("manifest.xml ausente em {}", dest.display());
        }
        println!("  ✓ {id}  ({n} arquivos)");
        rec.extensions.push(dest);
    }

    std::fs::create_dir_all(l.bin())?;
    match engine_file() {
        Some(f) => {
            let out = l.bin().join(f.path().file_name().unwrap());
            std::fs::write(&out, f.contents())?;
            println!("  ✓ Motor orbi-engine  → {}", out.display());
        }
        None => println!("  ⚠ Motor orbi-engine não embutido (os painéis vão avisar)."),
    }
    // O próprio instalador vira o desinstalador.
    let uninstaller = l.app.join("Desinstalar Orbi Plugin Tools.exe");
    if let Ok(me) = std::env::current_exe() {
        if me != uninstaller {
            std::fs::copy(&me, &uninstaller).context("copiando desinstalador")?;
        }
    }
    std::fs::write(l.record(), serde_json::to_vec_pretty(&rec)?)?;

    if l.system {
        if o.debug_mode {
            // Necessário enquanto as extensões não forem assinadas (ver ROADMAP).
            for v in CSXS_VERSIONS {
                reg_sz(&format!(r"HKCU\Software\Adobe\CSXS.{v}"), "PlayerDebugMode", "1")?;
            }
            println!("  ✓ PlayerDebugMode=1 (CSXS.9–14)");
        }
        let un = format!("\"{}\" --uninstall", uninstaller.display());
        reg_sz(UNINSTALL_KEY, "DisplayName", PRODUCT)?;
        reg_sz(UNINSTALL_KEY, "DisplayVersion", VERSION)?;
        reg_sz(UNINSTALL_KEY, "Publisher", VENDOR)?;
        reg_sz(UNINSTALL_KEY, "InstallLocation", &l.app.display().to_string())?;
        reg_sz(UNINSTALL_KEY, "DisplayIcon", &uninstaller.display().to_string())?;
        reg_sz(UNINSTALL_KEY, "UninstallString", &un)?;
        reg_sz(UNINSTALL_KEY, "QuietUninstallString", &format!("{un} --silent"))?;
        reg(&["add", UNINSTALL_KEY, "/v", "NoModify", "/t", "REG_DWORD", "/d", "1", "/f"])?;
        reg(&["add", UNINSTALL_KEY, "/v", "NoRepair", "/t", "REG_DWORD", "/d", "1", "/f"])?;
        println!("  ✓ Registrado em Aplicativos instalados");
    }
    println!("\n  Instalação concluída. Abra o Premiere ou o After Effects e use:");
    println!("  Janela › Extensões (legado) › Orbi · …\n");
    Ok(())
}

/// Remove a v0.1 (FDCS Studio Tools): extensões com.fdcs.*, pasta do programa e registro.
fn migrate_legacy(l: &Layout) {
    let mut found = false;
    if let Ok(rd) = std::fs::read_dir(&l.cep) {
        for e in rd.flatten() {
            if e.file_name().to_string_lossy().starts_with(LEGACY_EXT_PREFIX) {
                if std::fs::remove_dir_all(e.path()).is_ok() {
                    println!("  ↻ migrado: removida extensão antiga {}", e.file_name().to_string_lossy());
                    found = true;
                }
            }
        }
    }
    if let Some(parent) = l.app.parent() {
        let old = parent.join(LEGACY_APP_DIR);
        if old.exists() && std::fs::remove_dir_all(&old).is_ok() {
            println!("  ↻ migrado: removida pasta antiga {}", old.display());
            found = true;
        }
    }
    if l.system && reg(&["delete", LEGACY_UNINSTALL_KEY, "/f"]).is_ok() {
        found = true;
    }
    if found {
        println!("  ✓ Versão anterior (FDCS Studio Tools) migrada para {PRODUCT}");
    }
}

fn remove_files(l: &Layout, all: bool) -> Result<()> {
    let rec: Record = std::fs::read(l.record()).ok().and_then(|b| parse_record(&b)).unwrap_or_default();
    let mut targets = rec.extensions;
    // Também limpa qualquer com.orbi.* que tenha ficado para trás.
    if let Ok(rd) = std::fs::read_dir(&l.cep) {
        for e in rd.flatten() {
            if e.file_name().to_string_lossy().starts_with("com.orbi.") && !targets.contains(&e.path()) {
                targets.push(e.path());
            }
        }
    }
    for t in targets {
        if t.exists() {
            std::fs::remove_dir_all(&t).with_context(|| format!("removendo {}", t.display()))?;
            println!("  ✗ {}", t.display());
        }
    }
    if all {
        let _ = std::fs::remove_dir_all(l.bin());
        let _ = std::fs::remove_file(l.record());
    }
    Ok(())
}

fn uninstall(o: &Opts, l: &Layout) -> Result<()> {
    if l.system {
        wait_for_apps_closed(o)?;
    }
    remove_files(l, true)?;
    if l.system {
        let _ = reg(&["delete", UNINSTALL_KEY, "/f"]);
        // O executável em uso não pode se apagar: agenda a remoção da pasta.
        let dir = l.app.display().to_string();
        let _ = Command::new("cmd")
            .args(["/C", &format!("ping 127.0.0.1 -n 3 > nul & rmdir /s /q \"{dir}\"")])
            .spawn();
    } else {
        let _ = std::fs::remove_dir_all(&l.app);
    }
    println!("\n  {PRODUCT} removido. (PlayerDebugMode foi mantido, pois outros plugins podem usá-lo.)\n");
    Ok(())
}

fn list() {
    println!("  Conteúdo embutido:");
    for d in extensions() {
        println!("   • {}", d.path().display());
    }
    match engine_file() {
        Some(f) => println!("   • {} ({} KB)", f.path().display(), f.contents().len() / 1024),
        None => println!("   • (motor ausente)"),
    }
}

fn run(o: &Opts) -> Result<()> {
    if o.list {
        list();
        return Ok(());
    }
    let l = Layout::detect(&o.root)?;
    if o.uninstall {
        uninstall(o, &l)
    } else {
        install(o, &l)
    }
}

fn main() {
    banner();
    let o = match parse_args() {
        Ok(o) => o,
        Err(e) => {
            eprintln!("  ✗ {e:#}\n{HELP}");
            std::process::exit(2);
        }
    };
    // Sem console interativo (ex.: --list, testes) não espera Enter.
    let quiet = o.silent || o.list || o.root.is_some();
    let code = match run(&o) {
        Ok(()) => 0,
        Err(e) => {
            eprintln!("\n  ✗ Erro: {e:#}\n");
            1
        }
    };
    pause(quiet, "  Pressione Enter para fechar…");
    std::process::exit(code);
}
