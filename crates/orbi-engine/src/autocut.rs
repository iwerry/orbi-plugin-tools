//! Autocut: analisa os clipes da timeline, calcula os trechos a manter e monta
//! (a) regiões de silêncio em tempo de sequência e (b) uma nova sequência em XML FCP.

use crate::audio;
use crate::silence::{self, Range, SilenceParams};
use crate::xmeml::{self, Rate, XClip, XSequence};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipIn {
    /// Caminho da mídia.
    pub path: String,
    #[serde(default)]
    pub name: Option<String>,
    /// Ponto de entrada na mídia (s).
    pub in_point: f64,
    /// Ponto de saída na mídia (s).
    pub out_point: f64,
    /// Posição na sequência (s).
    pub start: f64,
    #[serde(default = "yes")]
    pub has_video: bool,
    #[serde(default = "two")]
    pub audio_channels: u32,
    /// Duração total da mídia (s), quando o host sabe.
    #[serde(default)]
    pub media_duration: Option<f64>,
    /// Velocidade do clipe (1.0 = 100%).
    #[serde(default = "one")]
    pub speed: f64,
}
fn yes() -> bool {
    true
}
fn two() -> u32 {
    2
}
fn one() -> f64 {
    1.0
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutocutRequest {
    pub clips: Vec<ClipIn>,
    #[serde(default)]
    pub params: SilenceParams,
    #[serde(default)]
    pub rate: Rate,
    #[serde(default = "w")]
    pub width: u32,
    #[serde(default = "h")]
    pub height: u32,
    #[serde(default)]
    pub sequence_name: Option<String>,
    /// Onde gravar o XML (opcional).
    #[serde(default)]
    pub xml_out: Option<String>,
    /// HyperCut: zoom de corte (punch-in) alternado entre os trechos.
    #[serde(default)]
    pub zoom: ZoomOpts,
    /// J-cut / L-cut: o áudio entra antes (J) ou sai depois (L) do vídeo.
    #[serde(default)]
    pub jl: JlOpts,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ZoomOpts {
    pub enabled: bool,
    /// Escala (%) dos trechos com zoom. Padrão 115.
    pub scale: f64,
    /// "alternate" (1 sim, 1 não) ou "every" (todos os trechos depois do 1º).
    pub pattern: String,
}
impl Default for ZoomOpts {
    fn default() -> Self {
        Self { enabled: false, scale: 115.0, pattern: "alternate".into() }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct JlOpts {
    /// "none", "j" (áudio antecipa o corte) ou "l" (áudio continua depois do corte).
    pub mode: String,
    /// Sobreposição máxima em ms.
    pub ms: f64,
}
impl Default for JlOpts {
    fn default() -> Self {
        Self { mode: "none".into(), ms: 250.0 }
    }
}

/// Trecho mantido, com tudo o que o host precisa para montar a edição.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SegmentOut {
    pub index: usize,
    /// Tempo original na sequência/comp (s).
    pub start: f64,
    pub end: f64,
    /// Início na edição compactada (s).
    pub packed_start: f64,
    /// Escala de vídeo (%): 100 = sem zoom.
    pub scale: f64,
    /// Quanto o áudio começa antes do vídeo (s, J-cut).
    pub audio_lead: f64,
    /// Quanto o áudio continua depois do vídeo (s, L-cut).
    pub audio_lag: f64,
}
fn w() -> u32 {
    1920
}
fn h() -> u32 {
    1080
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipReport {
    pub path: String,
    pub threshold_db: f32,
    pub noise_floor_db: f32,
    pub speech_db: f32,
    pub keep_source: Vec<Range>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutocutResult {
    /// Silêncios em tempo de sequência (s), ordenados.
    pub silent_sequence: Vec<Range>,
    /// Trechos mantidos em tempo de sequência (s).
    pub keep_sequence: Vec<Range>,
    pub original_duration: f64,
    pub new_duration: f64,
    pub removed_seconds: f64,
    pub cuts: usize,
    pub clips: Vec<ClipReport>,
    pub segments: Vec<SegmentOut>,
    pub xml_path: Option<String>,
}

struct Seg {
    clip: usize,
    src_in: f64,
    src_out: f64,
    speed: f64,
    orig_start: f64,
    orig_end: f64,
}

pub fn run(req: &AutocutRequest) -> Result<AutocutResult> {
    let mut reports = Vec::new();
    let mut silent_seq = Vec::new();
    let mut keep_seq = Vec::new();
    let mut xclips = Vec::new();
    let mut cursor = 0.0f64;
    let mut orig_end = 0.0f64;

    let mut clips = req.clips.clone();
    clips.sort_by(|a, b| a.start.partial_cmp(&b.start).unwrap());

    let mut segs: Vec<Seg> = Vec::new();
    for (ci, c) in clips.iter().enumerate() {
        let speed = if c.speed.abs() < 1e-6 { 1.0 } else { c.speed.abs() };
        let seq_len = (c.out_point - c.in_point) / speed;
        orig_end = orig_end.max(c.start + seq_len);
        let to_seq = |src: f64| c.start + (src - c.in_point) / speed;

        let analysed = audio::decode_mono(Path::new(&c.path), c.in_point, Some(c.out_point), 16000)
            .map(|m| silence::detect(&m, &req.params));
        let (keep_src, rep) = match analysed {
            Ok(r) => {
                let rep = ClipReport {
                    path: c.path.clone(),
                    threshold_db: r.threshold_db,
                    noise_floor_db: r.noise_floor_db,
                    speech_db: r.speech_db,
                    keep_source: r.keep.clone(),
                    error: None,
                };
                (r.keep, rep)
            }
            Err(e) => {
                // Sem áudio decodificável: mantém o clipe inteiro.
                let k = vec![Range { start: c.in_point, end: c.out_point }];
                let rep = ClipReport {
                    path: c.path.clone(),
                    threshold_db: 0.0,
                    noise_floor_db: 0.0,
                    speech_db: 0.0,
                    keep_source: k.clone(),
                    error: Some(e.to_string()),
                };
                (k, rep)
            }
        };
        // Silêncios em tempo de sequência (para o modo marcadores / corte na timeline).
        let local_keep: Vec<Range> =
            keep_src.iter().map(|r| Range { start: r.start - c.in_point, end: r.end - c.in_point }).collect();
        for s in silence::complement(&local_keep, c.out_point - c.in_point) {
            silent_seq.push(Range { start: to_seq(s.start + c.in_point), end: to_seq(s.end + c.in_point) }.rounded());
        }
        for k in &keep_src {
            keep_seq.push(Range { start: to_seq(k.start), end: to_seq(k.end) }.rounded());
            segs.push(Seg { clip: ci, src_in: k.start, src_out: k.end, speed, orig_start: to_seq(k.start), orig_end: to_seq(k.end) });
        }
        reports.push(rep);
    }
    silent_seq.sort_by(|a, b| a.start.partial_cmp(&b.start).unwrap());

    // Monta a edição compactada, com zoom (HyperCut) e J/L-cut.
    let lens: Vec<f64> = segs.iter().map(|g| (g.src_out - g.src_in) / g.speed).collect();
    let jl_max = (req.jl.ms / 1000.0).max(0.0);
    let mut segments = Vec::new();
    for (i, g) in segs.iter().enumerate() {
        let c = &clips[g.clip];
        let len = lens[i];
        let scale = if !req.zoom.enabled || i == 0 {
            100.0
        } else if req.zoom.pattern == "every" || i % 2 == 1 {
            req.zoom.scale
        } else {
            100.0
        };
        // J: o áudio começa antes, limitado pelo material disponível e pelo trecho anterior.
        let lead = if req.jl.mode == "j" && i > 0 {
            jl_max.min((g.src_in - c.in_point).max(0.0) / g.speed).min(lens[i - 1] * 0.5)
        } else {
            0.0
        };
        // L: o áudio continua depois, limitado pelo material e pelo próximo trecho.
        let lag = if req.jl.mode == "l" && i + 1 < segs.len() {
            jl_max.min((c.out_point - g.src_out).max(0.0) / g.speed).min(lens[i + 1] * 0.5)
        } else {
            0.0
        };
        let r4 = |v: f64| (v * 10000.0).round() / 10000.0;
        segments.push(SegmentOut {
            index: i,
            start: r4(g.orig_start),
            end: r4(g.orig_end),
            packed_start: r4(cursor),
            scale,
            audio_lead: r4(lead),
            audio_lag: r4(lag),
        });
        xclips.push(XClip {
            path: c.path.clone(),
            name: c.name.clone().unwrap_or_else(|| file_name(&c.path)),
            src_in: g.src_in,
            src_out: g.src_out,
            seq_start: cursor,
            has_video: c.has_video,
            audio_channels: c.audio_channels,
            media_duration: c.media_duration,
            scale: if (scale - 100.0).abs() > 1e-6 { Some(scale) } else { None },
            audio_src_in: g.src_in - lead * g.speed,
            audio_src_out: g.src_out + lag * g.speed,
            audio_seq_start: cursor - lead,
            audio_group: if req.jl.mode == "none" { 0 } else { (i % 2) as u32 },
        });
        cursor += len;
    }

    let mut xml_path = None;
    if let Some(out) = &req.xml_out {
        let seq = XSequence {
            name: req.sequence_name.clone().unwrap_or_else(|| "ORBI Autocut".into()),
            rate: req.rate.clone(),
            width: req.width,
            height: req.height,
            clips: xclips,
        };
        std::fs::write(out, xmeml::build(&seq))?;
        xml_path = Some(out.clone());
    }
    let removed: f64 = silent_seq.iter().map(|r| r.len()).sum();
    Ok(AutocutResult {
        cuts: silent_seq.len(),
        silent_sequence: silent_seq,
        keep_sequence: keep_seq,
        original_duration: orig_end,
        new_duration: (cursor * 1000.0).round() / 1000.0,
        removed_seconds: (removed * 1000.0).round() / 1000.0,
        clips: reports,
        segments,
        xml_path,
    })
}

pub fn file_name(p: &str) -> String {
    p.rsplit(['/', '\\']).next().unwrap_or(p).to_string()
}
