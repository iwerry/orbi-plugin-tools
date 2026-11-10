//! Sintetizador de efeitos sonoros próprios (sem bibliotecas de terceiros, sem
//! licença a pagar): whoosh, swish, pop, click, impact e riser, cada um com
//! variações. Cada som informa o instante do pico, para o host alinhar o pico
//! exatamente no corte ou no marcador.

use anyhow::Result;
use serde::Serialize;
use std::f32::consts::PI;
use std::path::Path;

pub const SR: u32 = 48_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Whoosh,
    Swish,
    Pop,
    Click,
    Impact,
    Riser,
}

impl Kind {
    pub const ALL: [Kind; 6] = [Kind::Whoosh, Kind::Swish, Kind::Pop, Kind::Click, Kind::Impact, Kind::Riser];
    pub fn id(self) -> &'static str {
        match self {
            Kind::Whoosh => "whoosh",
            Kind::Swish => "swish",
            Kind::Pop => "pop",
            Kind::Click => "click",
            Kind::Impact => "impact",
            Kind::Riser => "riser",
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            Kind::Whoosh => "Whoosh",
            Kind::Swish => "Swish",
            Kind::Pop => "Pop",
            Kind::Click => "Click",
            Kind::Impact => "Impacto",
            Kind::Riser => "Riser",
        }
    }
    pub fn parse(s: &str) -> Option<Kind> {
        Kind::ALL.iter().copied().find(|k| k.id() == s)
    }
}

/// Som sintetizado (estéreo intercalado L/R).
pub struct Sound {
    pub samples: Vec<f32>,
    /// Instante do pico (s): é ele que cai no corte/marcador.
    pub peak: f64,
}

impl Sound {
    pub fn duration(&self) -> f64 {
        self.samples.len() as f64 / 2.0 / SR as f64
    }
}

/// Gerador pseudoaleatório determinístico (xorshift32).
struct Rng(u32);
impl Rng {
    fn new(seed: u32) -> Rng {
        Rng(seed.wrapping_mul(2_654_435_761).max(1))
    }
    fn next(&mut self) -> f32 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        (x as f32 / u32::MAX as f32) * 2.0 - 1.0
    }
    /// Variação ±amt (ex.: 0.1 = ±10%).
    fn jitter(&mut self, amt: f32) -> f32 {
        1.0 + self.next() * amt
    }
}

/// Filtro de estado variável (Chamberlin): passa-banda/passa-baixa/passa-alta.
struct Svf {
    low: f32,
    band: f32,
}
impl Svf {
    fn new() -> Svf {
        Svf { low: 0.0, band: 0.0 }
    }
    /// Retorna (low, band, high).
    fn tick(&mut self, x: f32, cutoff: f32, q: f32) -> (f32, f32, f32) {
        let f = (2.0 * (PI * (cutoff / SR as f32).min(0.24)).sin()).min(1.6);
        let damp = (1.0 / q).clamp(0.05, 2.0);
        self.low += f * self.band;
        let high = x - self.low - damp * self.band;
        self.band += f * high;
        (self.low, self.band, high)
    }
}

fn n(sec: f32) -> usize {
    (sec * SR as f32) as usize
}

/// Envelope assimétrico: sobe até `peak_at` (0..1) e desce.
fn env_rise_fall(t: f32, peak_at: f32, curve: f32) -> f32 {
    let v = if t < peak_at { t / peak_at } else { (1.0 - t) / (1.0 - peak_at) };
    v.clamp(0.0, 1.0).powf(curve)
}

fn stereo(mono: &[f32], pan: impl Fn(f32) -> f32) -> Vec<f32> {
    let len = mono.len().max(1) as f32;
    let mut out = Vec::with_capacity(mono.len() * 2);
    for (i, &s) in mono.iter().enumerate() {
        let p = pan(i as f32 / len).clamp(-1.0, 1.0); // -1 esquerda .. 1 direita
        let a = (p + 1.0) * PI / 4.0;
        out.push(s * a.cos());
        out.push(s * a.sin());
    }
    out
}

/// Normaliza o pico para `db` dBFS e aplica fade-out curto anti-clique.
fn finish(mut s: Vec<f32>, db: f32) -> Vec<f32> {
    let peak = s.iter().fold(0f32, |m, v| m.max(v.abs())).max(1e-9);
    let g = 10f32.powf(db / 20.0) / peak;
    let fade = n(0.004) * 2;
    let len = s.len();
    for (i, v) in s.iter_mut().enumerate() {
        *v *= g;
        if i + fade > len {
            *v *= (len - i) as f32 / fade as f32;
        }
    }
    s
}

fn peak_time(stereo: &[f32]) -> f64 {
    let mut best = (0usize, 0f32);
    // Pico de energia em janelas de 5 ms (mais estável que a amostra máxima).
    let w = n(0.005) * 2;
    for (k, c) in stereo.chunks(w).enumerate() {
        let e: f32 = c.iter().map(|v| v * v).sum();
        if e > best.1 {
            best = (k, e);
        }
    }
    (best.0 * w) as f64 / 2.0 / SR as f64 + 0.0025
}

pub fn synth(kind: Kind, variant: u32) -> Sound {
    let mut r = Rng::new(variant.wrapping_add(kind as u32 * 7919) + 1);
    let samples = match kind {
        Kind::Whoosh => {
            let dur = 0.9 * r.jitter(0.12);
            let (f0, f1, f2) = (280.0 * r.jitter(0.2), 2600.0 * r.jitter(0.25), 520.0 * r.jitter(0.2));
            let peak_at = 0.58 * r.jitter(0.06);
            let len = n(dur);
            let mut svf = Svf::new();
            let mut svf2 = Svf::new();
            let mut m = Vec::with_capacity(len);
            for i in 0..len {
                let t = i as f32 / len as f32;
                let cut = if t < peak_at { f0 + (f1 - f0) * (t / peak_at).powf(1.6) } else { f1 + (f2 - f1) * ((t - peak_at) / (1.0 - peak_at)).powf(0.7) };
                let x = r.next();
                let (_, b, _) = svf.tick(x, cut, 2.2);
                let (_, b2, _) = svf2.tick(b, cut * 1.5, 1.4);
                m.push((b * 0.7 + b2 * 0.5) * env_rise_fall(t, peak_at, 1.8));
            }
            let dir = if variant % 2 == 0 { 1.0 } else { -1.0 };
            finish(stereo(&m, |t| dir * (t * 2.0 - 1.0) * 0.8), -6.0)
        }
        Kind::Swish => {
            let dur = 0.34 * r.jitter(0.15);
            let (f0, f1) = (1400.0 * r.jitter(0.2), 7000.0 * r.jitter(0.15));
            let len = n(dur);
            let mut svf = Svf::new();
            let mut m = Vec::with_capacity(len);
            for i in 0..len {
                let t = i as f32 / len as f32;
                let cut = f0 + (f1 - f0) * (1.0 - (1.0 - t).powi(2));
                let (_, b, h) = svf.tick(r.next(), cut, 1.8);
                m.push((b * 0.8 + h * 0.25) * env_rise_fall(t, 0.62, 2.2));
            }
            let dir = if variant % 2 == 0 { -1.0 } else { 1.0 };
            finish(stereo(&m, |t| dir * (t * 1.6 - 0.8)), -7.0)
        }
        Kind::Pop => {
            let dur = 0.13 * r.jitter(0.15);
            let (fa, fb) = (900.0 * r.jitter(0.25), 170.0 * r.jitter(0.2));
            let len = n(dur);
            let mut ph = 0f32;
            let mut m = Vec::with_capacity(len);
            for i in 0..len {
                let ts = i as f32 / SR as f32;
                let f = fb + (fa - fb) * (-ts * 60.0).exp();
                ph += 2.0 * PI * f / SR as f32;
                let attack = (ts / 0.0015).min(1.0);
                m.push(ph.sin() * attack * (-ts * 38.0).exp());
            }
            finish(stereo(&m, |_| 0.0), -5.0)
        }
        Kind::Click => {
            let dur = 0.045;
            let f = 2100.0 * r.jitter(0.2);
            let len = n(dur);
            let mut svf = Svf::new();
            let mut m = Vec::with_capacity(len);
            for i in 0..len {
                let ts = i as f32 / SR as f32;
                let (_, _, h) = svf.tick(r.next(), 3000.0, 0.8);
                let tone = (2.0 * PI * f * ts).sin();
                m.push((h * 0.6 + tone * 0.5) * (-ts * 140.0).exp());
            }
            finish(stereo(&m, |_| 0.0), -8.0)
        }
        Kind::Impact => {
            let dur = 1.4 * r.jitter(0.1);
            let (fa, fb) = (95.0 * r.jitter(0.15), 38.0 * r.jitter(0.1));
            let len = n(dur);
            let mut ph = 0f32;
            let mut svf = Svf::new();
            let mut m = Vec::with_capacity(len);
            for i in 0..len {
                let ts = i as f32 / SR as f32;
                let f = fb + (fa - fb) * (-ts * 9.0).exp();
                ph += 2.0 * PI * f / SR as f32;
                let body = ph.sin() * (-ts * 3.2).exp();
                let (lo, _, _) = svf.tick(r.next(), 900.0 * (-ts * 4.0).exp() + 120.0, 0.9);
                let transient = r.next() * (-ts * 90.0).exp() * 0.6;
                let attack = (ts / 0.002).min(1.0);
                m.push((body * 0.9 + lo * 0.8 * (-ts * 2.5).exp() + transient) * attack);
            }
            finish(stereo(&m, |_| 0.0), -4.0)
        }
        Kind::Riser => {
            let dur = 1.6 * r.jitter(0.12);
            let (f0, f1) = (220.0 * r.jitter(0.2), 5200.0 * r.jitter(0.2));
            let len = n(dur);
            let mut svf = Svf::new();
            let mut ph = 0f32;
            let mut m = Vec::with_capacity(len);
            for i in 0..len {
                let t = i as f32 / len as f32;
                let cut = f0 * (f1 / f0).powf(t.powf(1.3));
                let (_, b, _) = svf.tick(r.next(), cut, 3.0);
                let tf = 180.0 * (6.0f32).powf(t.powf(1.5));
                ph += 2.0 * PI * tf / SR as f32;
                let amp = t.powf(2.2) * (1.0 - ((t - 0.985).max(0.0) / 0.015)).max(0.0);
                m.push((b * 0.8 + ph.sin() * 0.25) * amp);
            }
            finish(stereo(&m, |t| (t * 12.0).sin() * 0.25 * t), -6.0)
        }
    };
    let peak = peak_time(&samples);
    Sound { samples, peak }
}

/// WAV PCM 16 bits estéreo.
pub fn write_wav(path: &Path, s: &[f32]) -> Result<()> {
    use std::io::Write;
    let mut f = std::io::BufWriter::new(std::fs::File::create(path)?);
    let data_len = (s.len() * 2) as u32;
    f.write_all(b"RIFF")?;
    f.write_all(&(36 + data_len).to_le_bytes())?;
    f.write_all(b"WAVEfmt ")?;
    f.write_all(&16u32.to_le_bytes())?;
    f.write_all(&1u16.to_le_bytes())?;
    f.write_all(&2u16.to_le_bytes())?;
    f.write_all(&SR.to_le_bytes())?;
    f.write_all(&(SR * 4).to_le_bytes())?;
    f.write_all(&4u16.to_le_bytes())?;
    f.write_all(&16u16.to_le_bytes())?;
    f.write_all(b"data")?;
    f.write_all(&data_len.to_le_bytes())?;
    for v in s {
        f.write_all(&((v.clamp(-1.0, 1.0) * 32767.0) as i16).to_le_bytes())?;
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackItem {
    pub kind: Kind,
    pub label: &'static str,
    pub variant: u32,
    pub file: String,
    pub duration: f64,
    pub peak: f64,
}

/// Gera o pacote de SFX (todas as categorias × `variants`) em `dir`.
pub fn pack(dir: &Path, kinds: &[Kind], variants: u32) -> Result<Vec<PackItem>> {
    std::fs::create_dir_all(dir)?;
    let mut out = Vec::new();
    for &k in kinds {
        for v in 1..=variants.max(1) {
            let s = synth(k, v);
            let f = dir.join(format!("orbi-sfx-{}-{}.wav", k.id(), v));
            write_wav(&f, &s.samples)?;
            let r4 = |x: f64| (x * 10000.0).round() / 10000.0;
            out.push(PackItem { kind: k, label: k.label(), variant: v, file: f.display().to_string(), duration: r4(s.duration()), peak: r4(s.peak) });
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_kinds_sane() {
        for k in Kind::ALL {
            for v in 1..=3 {
                let s = synth(k, v);
                assert!(s.samples.len() > 1000, "{k:?} curto");
                assert!(s.samples.iter().all(|x| x.is_finite() && x.abs() <= 1.0), "{k:?} fora da faixa");
                let mx = s.samples.iter().fold(0f32, |m, x| m.max(x.abs()));
                assert!(mx > 0.2, "{k:?} silencioso ({mx})");
                assert!(s.peak >= 0.0 && s.peak <= s.duration() + 0.01);
            }
        }
    }

    #[test]
    fn peaks_where_expected() {
        // Pop e click explodem no início; riser cresce até o fim; whoosh no meio.
        assert!(synth(Kind::Pop, 1).peak < 0.03);
        assert!(synth(Kind::Click, 1).peak < 0.02);
        let r = synth(Kind::Riser, 1);
        assert!(r.peak > r.duration() * 0.75, "riser pico {} de {}", r.peak, r.duration());
        let w = synth(Kind::Whoosh, 1);
        assert!(w.peak > w.duration() * 0.3 && w.peak < w.duration() * 0.85, "whoosh pico {}", w.peak);
    }

    #[test]
    fn variants_differ_and_are_deterministic() {
        let a = synth(Kind::Whoosh, 1).samples;
        let b = synth(Kind::Whoosh, 2).samples;
        assert_ne!(a.len(), b.len());
        assert_eq!(a, synth(Kind::Whoosh, 1).samples);
    }
}
