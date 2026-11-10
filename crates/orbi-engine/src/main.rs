use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use orbi_engine::*;
use serde_json::{json, Value};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "orbi-engine", version, about = "Motor Orbi Plugin Tools — saída sempre em JSON")]
struct Cli {
    /// Grava o JSON de resposta neste arquivo (além do stdout).
    #[arg(long, global = true)]
    out: Option<PathBuf>,
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Versão e capacidades.
    Version,
    /// Informações da trilha de áudio de uma mídia.
    Probe { path: PathBuf },
    /// Detecta silêncio num trecho de uma mídia.
    Silence {
        path: PathBuf,
        #[arg(long, default_value_t = 0.0)]
        start: f64,
        #[arg(long)]
        end: Option<f64>,
        /// JSON com SilenceParams (camelCase).
        #[arg(long)]
        params: Option<String>,
    },
    /// Autocut completo a partir de um pedido JSON (arquivo ou "-" para stdin).
    Autocut { request: String },
    /// Detecta beats/BPM.
    Beats {
        path: PathBuf,
        #[arg(long, default_value_t = 0.0)]
        start: f64,
        #[arg(long)]
        end: Option<f64>,
        #[arg(long)]
        params: Option<String>,
    },
    /// Valida/inspeciona uma LUT .cube; opcionalmente aplica a uma cor "r,g,b".
    Cube {
        path: PathBuf,
        #[arg(long)]
        sample: Option<String>,
    },
    /// Biblioteca de LUTs: lista e valida os .cube de uma pasta.
    Luts {
        dir: PathBuf,
    },
    /// Legendas dinâmicas: SRT/VTT → blocos curtos (+ SRT novo opcional).
    Captions {
        path: PathBuf,
        #[arg(long)]
        params: Option<String>,
        /// Grava o SRT em blocos neste caminho.
        #[arg(long)]
        srt_out: Option<PathBuf>,
    },
    /// Gera o pacote de efeitos sonoros próprios (WAV 48 kHz estéreo).
    SfxPack {
        #[arg(long)]
        out_dir: PathBuf,
        /// Categorias separadas por vírgula (padrão: todas).
        #[arg(long)]
        kinds: Option<String>,
        #[arg(long, default_value_t = 3)]
        variants: u32,
    },
    /// Gera PNGs de safe-area em um diretório.
    Guides {
        #[arg(long)]
        out_dir: PathBuf,
        /// JSON com lista de perfis (opcional).
        #[arg(long)]
        profiles: Option<PathBuf>,
        /// Resolução de saída (padrão: a do perfil).
        #[arg(long)]
        width: Option<u32>,
        #[arg(long)]
        height: Option<u32>,
        /// Gera só este perfil (reels, shorts, tiktok…).
        #[arg(long)]
        only: Option<String>,
    },
}

fn read_json_arg(s: &str) -> Result<String> {
    if s == "-" {
        let mut b = String::new();
        std::io::Read::read_to_string(&mut std::io::stdin(), &mut b)?;
        Ok(b)
    } else if s.trim_start().starts_with('{') {
        Ok(s.to_string())
    } else {
        std::fs::read_to_string(s).with_context(|| format!("lendo {s}"))
    }
}

fn run(cmd: Cmd) -> Result<Value> {
    Ok(match cmd {
        Cmd::Version => json!({
            "name": "orbi-engine",
            "version": VERSION,
            "vendor": "Draft Creative Studio Ltda",
            "commands": ["probe","silence","autocut","beats","cube","luts","guides","sfx-pack","captions"]
        }),
        Cmd::Probe { path } => serde_json::to_value(audio::probe(&path)?)?,
        Cmd::Silence { path, start, end, params } => {
            let p: silence::SilenceParams = match params {
                Some(s) => serde_json::from_str(&read_json_arg(&s)?)?,
                None => Default::default(),
            };
            let m = audio::decode_mono(&path, start, end, 16000)?;
            serde_json::to_value(silence::detect(&m, &p))?
        }
        Cmd::Autocut { request } => {
            let req: autocut::AutocutRequest = serde_json::from_str(&read_json_arg(&request)?)?;
            serde_json::to_value(autocut::run(&req)?)?
        }
        Cmd::Beats { path, start, end, params } => {
            let p: beats::BeatParams = match params {
                Some(s) => serde_json::from_str(&read_json_arg(&s)?)?,
                None => Default::default(),
            };
            let m = audio::decode_mono(&path, start, end, 22050)?;
            serde_json::to_value(beats::detect(&m, &p))?
        }
        Cmd::Cube { path, sample } => {
            let c = cube::parse(&std::fs::read_to_string(&path)?)?;
            let mut v = serde_json::to_value(&c.info)?;
            if let Some(s) = sample {
                let f: Vec<f32> = s.split(',').map(|x| x.trim().parse()).collect::<Result<_, _>>()?;
                if f.len() == 3 {
                    v["sample"] = json!(c.apply([f[0], f[1], f[2]]));
                }
            }
            v
        }
        Cmd::Luts { dir } => serde_json::to_value(library::scan(&dir)?)?,
        Cmd::Captions { path, params, srt_out } => {
            let p: captions::ChunkParams = match params {
                Some(s) => serde_json::from_str(&read_json_arg(&s)?)?,
                None => Default::default(),
            };
            let raw = std::fs::read(&path)?;
            let cues = captions::parse(&String::from_utf8_lossy(&raw))?;
            let chunks = captions::chunk(&cues, &p);
            if let Some(o) = &srt_out {
                std::fs::write(o, captions::to_srt(&chunks))?;
            }
            json!({ "cues": cues.len(), "chunks": chunks, "srt": srt_out.map(|p| p.display().to_string()) })
        }
        Cmd::SfxPack { out_dir, kinds, variants } => {
            let ks: Vec<sfx::Kind> = match kinds {
                Some(k) => k.split(',').filter_map(|x| sfx::Kind::parse(x.trim())).collect(),
                None => sfx::Kind::ALL.to_vec(),
            };
            json!({ "items": sfx::pack(&out_dir, &ks, variants)? })
        }
        Cmd::Guides { out_dir, profiles, width, height, only } => {
            let ps: Vec<guides::Profile> = match profiles {
                Some(p) => serde_json::from_str(&std::fs::read_to_string(p)?)?,
                None => guides::default_profiles(),
            };
            std::fs::create_dir_all(&out_dir)?;
            let mut files = vec![];
            for p in &ps {
                if only.as_deref().map(|o| o != p.id).unwrap_or(false) {
                    continue;
                }
                let p = match (width, height) {
                    (Some(w), Some(h)) => p.scaled(w, h),
                    _ => p.clone(),
                };
                let f = out_dir.join(format!("orbi-guide-{}-{}x{}.png", p.id, p.width, p.height));
                guides::render(&p, &f)?;
                files.push(json!({"id": p.id, "label": p.label, "file": f.display().to_string()}));
            }
            json!({ "files": files })
        }
    })
}

fn main() {
    let cli = Cli::parse();
    let out = cli.out.clone();
    let resp = match run(cli.cmd) {
        Ok(mut v) => {
            if let Value::Object(ref mut m) = v {
                m.insert("ok".into(), json!(true));
                v
            } else {
                json!({"ok": true, "result": v})
            }
        }
        Err(e) => json!({"ok": false, "error": format!("{e:#}")}),
    };
    let s = serde_json::to_string(&resp).unwrap();
    if let Some(o) = out {
        let _ = std::fs::write(o, &s);
    }
    println!("{s}");
    if resp["ok"] != json!(true) {
        std::process::exit(1);
    }
}
