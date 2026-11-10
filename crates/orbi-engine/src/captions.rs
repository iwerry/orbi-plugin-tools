//! Legendas dinâmicas (estilo CapCut): lê SRT/VTT, estima o tempo de cada
//! palavra (proporcional ao tamanho) e reagrupa em blocos curtos (1–N palavras).

use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Cue {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ChunkParams {
    /// Máximo de palavras por bloco (1 = palavra por palavra).
    pub max_words: usize,
    /// Máximo de caracteres por bloco.
    pub max_chars: usize,
    /// Duração mínima de um bloco (s).
    pub min_dur: f64,
    pub uppercase: bool,
    /// Remove pontuação final (estilo redes sociais).
    pub strip_punct: bool,
}
impl Default for ChunkParams {
    fn default() -> Self {
        Self { max_words: 3, max_chars: 18, min_dur: 0.25, uppercase: true, strip_punct: true }
    }
}

fn parse_ts(s: &str) -> Option<f64> {
    let s = s.trim().replace(',', ".");
    let parts: Vec<&str> = s.split(':').collect();
    let (h, m, sec) = match parts.len() {
        3 => (parts[0].parse::<f64>().ok()?, parts[1].parse::<f64>().ok()?, parts[2].parse::<f64>().ok()?),
        2 => (0.0, parts[0].parse::<f64>().ok()?, parts[1].parse::<f64>().ok()?),
        _ => return None,
    };
    Some(h * 3600.0 + m * 60.0 + sec)
}

/// Lê SRT ou WebVTT.
pub fn parse(text: &str) -> Result<Vec<Cue>> {
    let text = text.trim_start_matches('\u{feff}').replace("\r\n", "\n");
    let mut cues = Vec::new();
    for block in text.split("\n\n") {
        let lines: Vec<&str> = block.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
        let Some(ti) = lines.iter().position(|l| l.contains("-->")) else { continue };
        let mut it = lines[ti].split("-->");
        let (Some(a), Some(b)) = (it.next(), it.next()) else { continue };
        let b = b.split_whitespace().next().unwrap_or("");
        let (Some(start), Some(end)) = (parse_ts(a), parse_ts(b)) else { continue };
        let body = lines[ti + 1..].join(" ");
        // remove tags <i>, <b>, <c.cor>, {\an8}
        let mut clean = String::new();
        let mut depth = 0;
        for ch in body.chars() {
            match ch {
                '<' | '{' => depth += 1,
                '>' | '}' => depth = (depth - 1).max(0),
                _ if depth == 0 => clean.push(ch),
                _ => {}
            }
        }
        let clean = clean.split_whitespace().collect::<Vec<_>>().join(" ");
        if !clean.is_empty() && end > start {
            cues.push(Cue { start, end, text: clean });
        }
    }
    if cues.is_empty() {
        bail!("nenhuma legenda encontrada (o arquivo é SRT/VTT?)");
    }
    Ok(cues)
}

/// Divide cada legenda em blocos curtos com tempo por palavra.
pub fn chunk(cues: &[Cue], p: &ChunkParams) -> Vec<Cue> {
    let mut out = Vec::new();
    for c in cues {
        let words: Vec<String> = c.text.split_whitespace().map(|w| w.to_string()).collect();
        if words.is_empty() {
            continue;
        }
        // Peso de cada palavra = letras + 2 (pausa curta entre palavras).
        let weights: Vec<f64> = words.iter().map(|w| w.chars().filter(|ch| ch.is_alphanumeric()).count() as f64 + 2.0).collect();
        let total: f64 = weights.iter().sum();
        let dur = c.end - c.start;
        let mut t = c.start;
        let times: Vec<(f64, f64)> = weights
            .iter()
            .map(|w| {
                let d = dur * w / total;
                let r = (t, t + d);
                t += d;
                r
            })
            .collect();
        let mut i = 0;
        while i < words.len() {
            let mut j = i;
            let mut chars = 0;
            while j < words.len() && j - i < p.max_words.max(1) {
                let add = words[j].chars().count() + if j > i { 1 } else { 0 };
                if j > i && chars + add > p.max_chars {
                    break;
                }
                chars += add;
                j += 1;
                // quebra natural depois de pontuação forte
                if words[j - 1].ends_with(['.', '!', '?', ',', ';', ':']) {
                    break;
                }
            }
            let mut text = words[i..j].join(" ");
            if p.strip_punct {
                text = text.trim_end_matches(['.', ',', ';', ':']).to_string();
            }
            if p.uppercase {
                text = text.to_uppercase();
            }
            out.push(Cue { start: times[i].0, end: times[j - 1].1, text });
            i = j;
        }
    }
    // duração mínima, sem invadir o próximo bloco
    for k in 0..out.len() {
        let next = out.get(k + 1).map(|n| n.start).unwrap_or(f64::MAX);
        if out[k].end - out[k].start < p.min_dur {
            out[k].end = (out[k].start + p.min_dur).min(next);
        }
        let r = |v: f64| (v * 1000.0).round() / 1000.0;
        out[k].start = r(out[k].start);
        out[k].end = r(out[k].end);
    }
    out
}

fn fmt_srt(t: f64) -> String {
    let ms = (t * 1000.0).round() as u64;
    format!("{:02}:{:02}:{:02},{:03}", ms / 3_600_000, ms / 60_000 % 60, ms / 1000 % 60, ms % 1000)
}

pub fn to_srt(cues: &[Cue]) -> String {
    let mut s = String::new();
    for (i, c) in cues.iter().enumerate() {
        s += &format!("{}\n{} --> {}\n{}\n\n", i + 1, fmt_srt(c.start), fmt_srt(c.end), c.text);
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    const SRT: &str = "1\n00:00:01,000 --> 00:00:04,000\n<i>Olá pessoal,</i> hoje vamos editar mais rápido.\n\n2\n00:00:05,000 --> 00:00:06,000\nBora!\n";

    #[test]
    fn parses_srt_and_vtt() {
        let c = parse(SRT).unwrap();
        assert_eq!(c.len(), 2);
        assert_eq!(c[0].text, "Olá pessoal, hoje vamos editar mais rápido.");
        let v = parse("WEBVTT\n\n00:01.500 --> 00:02.000 align:start\nTeste\n").unwrap();
        assert_eq!(v[0], Cue { start: 1.5, end: 2.0, text: "Teste".into() });
    }

    #[test]
    fn chunks_words() {
        let c = chunk(&parse(SRT).unwrap(), &ChunkParams::default());
        let texts: Vec<&str> = c.iter().map(|x| x.text.as_str()).collect();
        assert_eq!(texts, ["OLÁ PESSOAL", "HOJE VAMOS EDITAR", "MAIS RÁPIDO", "BORA!"]);
        assert!((c[0].start - 1.0).abs() < 1e-9);
        assert!((c[2].end - 4.0).abs() < 1e-6);
        for w in c.windows(2) {
            assert!(w[0].end <= w[1].start + 1e-9);
        }
        let one = chunk(&parse(SRT).unwrap(), &ChunkParams { max_words: 1, ..Default::default() });
        assert_eq!(one.len(), 8);
        assert!(to_srt(&one).starts_with("1\n00:00:01,000 --> "));
    }
}
