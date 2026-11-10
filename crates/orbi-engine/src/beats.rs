//! Detecção de beats: força de onset por fluxo espectral, BPM por autocorrelação
//! e rastreamento por programação dinâmica (Ellis, 2007).

use crate::audio::Mono;
use rustfft::{num_complex::Complex, FftPlanner};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct BeatParams {
    pub min_bpm: f64,
    pub max_bpm: f64,
    /// BPM fixo (pula a estimativa).
    pub bpm: Option<f64>,
    /// Quão rígido é o tempo (maior = mais regular). Padrão 100.
    pub tightness: f64,
    /// Marcar só a cada N beats (1 = todos, 2 = metade, 4 = compasso).
    pub every: usize,
    /// Deslocamento em beats aplicado ao "every" (0..every-1).
    pub phase: usize,
}

impl Default for BeatParams {
    fn default() -> Self {
        Self { min_bpm: 60.0, max_bpm: 200.0, bpm: None, tightness: 100.0, every: 1, phase: 0 }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BeatResult {
    pub bpm: f64,
    /// Tempos (s, no arquivo de origem) de todos os beats.
    pub beats: Vec<f64>,
    /// Beats depois de aplicar every/phase.
    pub marked: Vec<f64>,
    /// Estimativa de tempos fortes (1 de cada 4).
    pub downbeats: Vec<f64>,
}

const N_FFT: usize = 1024;
const HOP: usize = 256;

/// Força de onset (uma amostra por hop).
pub fn onset_envelope(m: &Mono) -> (Vec<f32>, f64) {
    let hop_rate = m.sample_rate as f64 / HOP as f64;
    if m.samples.len() < N_FFT {
        return (vec![], hop_rate);
    }
    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(N_FFT);
    let window: Vec<f32> = (0..N_FFT)
        .map(|i| 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / N_FFT as f32).cos())
        .collect();
    let n_frames = (m.samples.len() - N_FFT) / HOP + 1;
    let mut prev = vec![0f32; N_FFT / 2];
    let mut env = Vec::with_capacity(n_frames);
    let mut buf = vec![Complex::new(0f32, 0f32); N_FFT];
    for f in 0..n_frames {
        let o = f * HOP;
        for i in 0..N_FFT {
            buf[i] = Complex::new(m.samples[o + i] * window[i], 0.0);
        }
        fft.process(&mut buf);
        let mut flux = 0f32;
        for k in 0..N_FFT / 2 {
            let mag = (1.0 + 1000.0 * buf[k].norm()).ln();
            let d = mag - prev[k];
            if d > 0.0 {
                flux += d;
            }
            prev[k] = mag;
        }
        env.push(flux);
    }
    // Remove tendência (média móvel de ~0.5 s) e normaliza.
    let w = (hop_rate * 0.5) as usize;
    let mut out = vec![0f32; env.len()];
    let mut sum = 0f32;
    for i in 0..env.len() {
        sum += env[i];
        if i > w {
            sum -= env[i - w - 1];
        }
        let n = (i.min(w) + 1) as f32;
        out[i] = (env[i] - sum / n).max(0.0);
    }
    let sd = (out.iter().map(|x| x * x).sum::<f32>() / out.len().max(1) as f32).sqrt().max(1e-9);
    for x in out.iter_mut() {
        *x /= sd;
    }
    (out, hop_rate)
}

fn estimate_period(env: &[f32], hop_rate: f64, p: &BeatParams) -> f64 {
    let min_lag = (60.0 / p.max_bpm * hop_rate).floor().max(1.0) as usize;
    let max_lag = ((60.0 / p.min_bpm * hop_rate).ceil() as usize).min(env.len().saturating_sub(1)).max(min_lag + 1);
    let mut best = (min_lag, f64::MIN);
    for lag in min_lag..=max_lag {
        let mut ac = 0f64;
        for i in lag..env.len() {
            ac += (env[i] * env[i - lag]) as f64;
        }
        ac /= (env.len() - lag) as f64;
        // Peso log-gaussiano em torno de 120 BPM (preferência perceptual).
        let bpm = 60.0 * hop_rate / lag as f64;
        let wgt = (-0.5 * ((bpm / 120.0).log2() / 1.0).powi(2)).exp();
        let score = ac * wgt;
        if score > best.1 {
            best = (lag, score);
        }
    }
    // Refinamento parabólico do lag.
    let lag = best.0;
    if lag > min_lag && lag < max_lag {
        let acf = |l: usize| -> f64 {
            (l..env.len()).map(|i| (env[i] * env[i - l]) as f64).sum::<f64>() / (env.len() - l) as f64
        };
        let (a, b, c) = (acf(lag - 1), acf(lag), acf(lag + 1));
        let den = a - 2.0 * b + c;
        if den.abs() > 1e-12 {
            return lag as f64 + 0.5 * (a - c) / den;
        }
    }
    lag as f64
}

pub fn detect(m: &Mono, p: &BeatParams) -> BeatResult {
    let (env, hop_rate) = onset_envelope(m);
    if env.len() < 16 {
        return BeatResult { bpm: 0.0, beats: vec![], marked: vec![], downbeats: vec![] };
    }
    let period = match p.bpm {
        Some(b) if b > 0.0 => 60.0 * hop_rate / b,
        _ => estimate_period(&env, hop_rate, p),
    };
    let bpm = 60.0 * hop_rate / period;

    // Programação dinâmica.
    let n = env.len();
    let mut score = vec![0f64; n];
    let mut back = vec![usize::MAX; n];
    let lo = (period * 0.5).round() as usize;
    let hi = (period * 2.0).round() as usize;
    for i in 0..n {
        let mut best = 0f64;
        let mut arg = usize::MAX;
        if i >= lo {
            let from = i.saturating_sub(hi);
            for j in from..=(i - lo) {
                let d = (i - j) as f64;
                let pen = -p.tightness * (d / period).ln().powi(2);
                let s = score[j] + pen;
                if arg == usize::MAX || s > best {
                    best = s;
                    arg = j;
                }
            }
        }
        score[i] = env[i] as f64 + if arg == usize::MAX { 0.0 } else { best };
        back[i] = arg;
    }
    // Melhor fim dentro do último período.
    let tail = n.saturating_sub(period.ceil() as usize);
    let mut end = tail;
    for i in tail..n {
        if score[i] > score[end] {
            end = i;
        }
    }
    let mut idx = vec![end];
    while let Some(&last) = idx.last() {
        let b = back[last];
        if b == usize::MAX {
            break;
        }
        idx.push(b);
    }
    idx.reverse();
    // Descarta beats iniciais em silêncio absoluto.
    let thr = 0.1f32;
    while idx.len() > 1 && env[idx[0]] < thr && env[idx[1]] < thr {
        idx.remove(0);
    }
    let lat = (N_FFT as f64 / 2.0) / m.sample_rate as f64; // centro da janela
    let beats: Vec<f64> = idx.iter().map(|&i| m.start + i as f64 / hop_rate + lat).collect();

    // Tempo forte: fase (0..3) com maior energia de onset.
    let mut best_phase = 0;
    let mut best_e = f32::MIN;
    for ph in 0..4 {
        let e: f32 = idx.iter().skip(ph).step_by(4).map(|&i| env[i]).sum();
        if e > best_e {
            best_e = e;
            best_phase = ph;
        }
    }
    let downbeats = beats.iter().skip(best_phase).step_by(4).copied().collect();
    let every = p.every.max(1);
    let marked = beats.iter().skip(p.phase % every).step_by(every).copied().collect();
    BeatResult { bpm: (bpm * 100.0).round() / 100.0, beats, marked, downbeats }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn click_track_120bpm() {
        let sr = 22050u32;
        let secs = 12.0;
        let mut s = vec![0f32; (secs * sr as f64) as usize];
        let period = 0.5; // 120 BPM
        let mut t = 0.25;
        while t < secs - 0.1 {
            let i0 = (t * sr as f64) as usize;
            for k in 0..400 {
                let decay = (-(k as f32) / 60.0).exp();
                s[i0 + k] += 0.8 * decay * ((k as f32 * 0.9).sin());
            }
            t += period;
        }
        let m = Mono { samples: s, sample_rate: sr, start: 0.0 };
        let r = detect(&m, &BeatParams::default());
        assert!((r.bpm - 120.0).abs() < 2.0, "bpm {}", r.bpm);
        // Beats alinhados a ~0.25 + k*0.5 (tolerância 40 ms).
        let errs: Vec<f64> = r.beats.iter().map(|b| ((b - 0.25) / 0.5 - ((b - 0.25) / 0.5).round()).abs() * 0.5).collect();
        let bad = errs.iter().filter(|e| **e > 0.04).count();
        assert!(bad <= 1, "beats {:?}", r.beats);
        assert!(r.beats.len() >= 20);
    }
}
