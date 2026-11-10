//! Detecção de silêncio por envelope RMS em dBFS, com limiar automático
//! (piso de ruído x nível de fala), histerese e margens.

use crate::audio::Mono;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SilenceParams {
    /// Limiar em dBFS. `None` = automático.
    pub threshold_db: Option<f32>,
    /// Sensibilidade do automático, 0..1 (posição entre o piso e a fala). Padrão 0.35.
    pub auto_bias: f32,
    /// Duração mínima de um silêncio para ser cortado (ms).
    pub min_silence_ms: f64,
    /// Margem mantida antes de cada trecho de fala (ms).
    pub pad_before_ms: f64,
    /// Margem mantida depois de cada trecho de fala (ms).
    pub pad_after_ms: f64,
    /// Trechos de fala menores que isso são considerados ruído (ms).
    pub min_keep_ms: f64,
    /// Janela de análise (ms).
    pub window_ms: f64,
}

impl Default for SilenceParams {
    fn default() -> Self {
        Self {
            threshold_db: None,
            auto_bias: 0.35,
            min_silence_ms: 350.0,
            pad_before_ms: 120.0,
            pad_after_ms: 180.0,
            min_keep_ms: 120.0,
            window_ms: 10.0,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Range {
    pub start: f64,
    pub end: f64,
}

impl Range {
    /// Arredonda para 0,1 ms (JSON mais limpo, sem perda prática).
    pub fn rounded(self) -> Range {
        let f = |v: f64| (v * 10000.0).round() / 10000.0;
        Range { start: f(self.start), end: f(self.end) }
    }
    pub fn len(&self) -> f64 {
        self.end - self.start
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SilenceResult {
    pub threshold_db: f32,
    pub noise_floor_db: f32,
    pub speech_db: f32,
    /// Trechos a manter (tempo de origem, s).
    pub keep: Vec<Range>,
    /// Trechos removidos (tempo de origem, s).
    pub silent: Vec<Range>,
    pub duration: f64,
}

/// Envelope em dBFS, uma entrada por janela.
pub fn envelope_db(m: &Mono, window_ms: f64) -> Vec<f32> {
    let w = ((m.sample_rate as f64 * window_ms / 1000.0).round() as usize).max(1);
    m.samples
        .chunks(w)
        .map(|c| {
            let e = c.iter().map(|s| s * s).sum::<f32>() / c.len() as f32;
            10.0 * (e.max(1e-12)).log10()
        })
        .collect()
}

fn percentile(v: &[f32], p: f32) -> f32 {
    if v.is_empty() {
        return -120.0;
    }
    let mut s: Vec<f32> = v.to_vec();
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let i = ((s.len() - 1) as f32 * p).round() as usize;
    s[i]
}

pub fn detect(m: &Mono, p: &SilenceParams) -> SilenceResult {
    let env = envelope_db(m, p.window_ms);
    let win = p.window_ms / 1000.0;
    let duration = m.duration();
    let floor = percentile(&env, 0.10).max(-100.0);
    let speech = percentile(&env, 0.90);
    let thr = p.threshold_db.unwrap_or_else(|| {
        let t = floor + (speech - floor) * p.auto_bias.clamp(0.05, 0.95);
        // nunca abaixo de -60 dB nem colado na fala
        t.clamp(-60.0, speech - 3.0)
    });
    // Histerese: entra em fala acima de thr, sai abaixo de thr-3 dB.
    let hyst = 3.0;
    let mut voiced = vec![false; env.len()];
    let mut on = false;
    for (i, &d) in env.iter().enumerate() {
        if on {
            if d < thr - hyst {
                on = false;
            }
        } else if d >= thr {
            on = true;
        }
        voiced[i] = on;
    }
    // Trechos de fala brutos.
    let mut speech_ranges: Vec<Range> = Vec::new();
    let mut i = 0;
    while i < voiced.len() {
        if voiced[i] {
            let s = i;
            while i < voiced.len() && voiced[i] {
                i += 1;
            }
            speech_ranges.push(Range { start: s as f64 * win, end: (i as f64 * win).min(duration) });
        } else {
            i += 1;
        }
    }
    // Remove "falas" curtas demais (estalos).
    speech_ranges.retain(|r| r.len() * 1000.0 >= p.min_keep_ms);
    // Aplica margens e funde.
    let mut keep: Vec<Range> = Vec::new();
    for r in speech_ranges {
        let k = Range {
            start: (r.start - p.pad_before_ms / 1000.0).max(0.0),
            end: (r.end + p.pad_after_ms / 1000.0).min(duration),
        };
        if let Some(last) = keep.last_mut() {
            // Junta se o buraco entre eles for menor que o silêncio mínimo.
            if k.start - last.end < p.min_silence_ms / 1000.0 {
                last.end = last.end.max(k.end);
                continue;
            }
        }
        keep.push(k);
    }
    // Buracos no começo/fim menores que o mínimo também ficam.
    if let Some(first) = keep.first_mut() {
        if first.start < p.min_silence_ms / 1000.0 {
            first.start = 0.0;
        }
    }
    if let Some(last) = keep.last_mut() {
        if duration - last.end < p.min_silence_ms / 1000.0 {
            last.end = duration;
        }
    }
    let silent = complement(&keep, duration);
    let off = m.start;
    let shift = |v: Vec<Range>| v.into_iter().map(|r| Range { start: r.start + off, end: r.end + off }.rounded()).collect();
    SilenceResult {
        threshold_db: thr,
        noise_floor_db: floor,
        speech_db: speech,
        keep: shift(keep),
        silent: shift(silent),
        duration,
    }
}

pub fn complement(keep: &[Range], duration: f64) -> Vec<Range> {
    let mut out = Vec::new();
    let mut t = 0.0;
    for k in keep {
        if k.start > t + 1e-6 {
            out.push(Range { start: t, end: k.start });
        }
        t = k.end;
    }
    if duration > t + 1e-6 {
        out.push(Range { start: t, end: duration });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tone(sec: f64, sr: u32, amp: f32) -> Vec<f32> {
        (0..(sec * sr as f64) as usize)
            .map(|i| amp * (i as f32 * 2.0 * std::f32::consts::PI * 220.0 / sr as f32).sin())
            .collect()
    }
    fn noise(sec: f64, sr: u32, amp: f32) -> Vec<f32> {
        let mut x: u32 = 12345;
        (0..(sec * sr as f64) as usize)
            .map(|_| {
                x ^= x << 13;
                x ^= x >> 17;
                x ^= x << 5;
                amp * ((x as f32 / u32::MAX as f32) * 2.0 - 1.0)
            })
            .collect()
    }

    #[test]
    fn finds_speech_and_gaps() {
        let sr = 16000;
        let mut s = noise(1.0, sr, 0.001);
        s.extend(tone(2.0, sr, 0.5));
        s.extend(noise(1.5, sr, 0.001));
        s.extend(tone(1.0, sr, 0.5));
        s.extend(noise(1.0, sr, 0.001));
        let m = Mono { samples: s, sample_rate: sr, start: 10.0 };
        let r = detect(&m, &SilenceParams::default());
        assert_eq!(r.keep.len(), 2, "{:?}", r.keep);
        assert!((r.keep[0].start - (10.0 + 1.0 - 0.12)).abs() < 0.03, "{:?}", r.keep[0]);
        assert!((r.keep[1].end - (10.0 + 5.5 + 0.18)).abs() < 0.03, "{:?}", r.keep[1]);
        assert_eq!(r.silent.len(), 3);
    }

    #[test]
    fn short_gap_is_merged() {
        let sr = 16000;
        let mut s = tone(1.0, sr, 0.5);
        s.extend(noise(0.2, sr, 0.001));
        s.extend(tone(1.0, sr, 0.5));
        let m = Mono { samples: s, sample_rate: sr, start: 0.0 };
        let r = detect(&m, &SilenceParams::default());
        assert_eq!(r.keep.len(), 1);
        assert!(r.silent.is_empty());
    }
}
