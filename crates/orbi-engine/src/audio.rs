//! Decodificação de áudio para mono f32, com reamostragem por média de blocos.
//! Suporta WAV, AIFF, MP3, AAC, MP4/MOV (isomp4), FLAC e OGG/Vorbis via symphonia.

use anyhow::{anyhow, Context, Result};
use std::fs::File;
use std::path::Path;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error as SymErr;
use symphonia::core::formats::{FormatOptions, SeekMode, SeekTo};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::core::units::Time;

/// Áudio mono já decodificado.
#[derive(Debug, Clone)]
pub struct Mono {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    /// Tempo (s, no arquivo de origem) da primeira amostra.
    pub start: f64,
}

impl Mono {
    pub fn duration(&self) -> f64 {
        self.samples.len() as f64 / self.sample_rate as f64
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ProbeInfo {
    pub path: String,
    pub sample_rate: u32,
    pub channels: usize,
    pub duration: Option<f64>,
    pub codec: String,
}

fn open(path: &Path) -> Result<symphonia::core::probe::ProbeResult> {
    let file = File::open(path).with_context(|| format!("não abriu {}", path.display()))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions { enable_gapless: true, ..Default::default() }, &MetadataOptions::default())
        .map_err(|e| anyhow!("formato não suportado ({}): {e}", path.display()))
}

pub fn probe(path: &Path) -> Result<ProbeInfo> {
    let probed = open(path)?;
    let track = probed
        .format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL && t.codec_params.sample_rate.is_some())
        .ok_or_else(|| anyhow!("sem trilha de áudio"))?;
    let p = &track.codec_params;
    let sr = p.sample_rate.unwrap_or(0);
    let duration = match (p.n_frames, p.time_base) {
        (Some(n), Some(tb)) => {
            let t = tb.calc_time(n);
            Some(t.seconds as f64 + t.frac)
        }
        (Some(n), None) if sr > 0 => Some(n as f64 / sr as f64),
        _ => None,
    };
    Ok(ProbeInfo {
        path: path.display().to_string(),
        sample_rate: sr,
        channels: p.channels.map(|c| c.count()).unwrap_or(0),
        duration,
        codec: symphonia::default::get_codecs().get_codec(p.codec).map(|d| d.short_name.to_string()).unwrap_or_else(|| format!("{:?}", p.codec)),
    })
}

/// Decodifica `[start, end)` segundos do arquivo como mono, reamostrado para
/// aproximadamente `target_rate` Hz (fator inteiro, média de blocos).
pub fn decode_mono(path: &Path, start: f64, end: Option<f64>, target_rate: u32) -> Result<Mono> {
    let mut probed = open(path)?;
    let format = &mut probed.format;
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL && t.codec_params.sample_rate.is_some())
        .ok_or_else(|| anyhow!("sem trilha de áudio em {}", path.display()))?
        .clone();
    let track_id = track.id;
    let src_rate = track.codec_params.sample_rate.unwrap();
    let factor = (src_rate / target_rate.max(1)).max(1) as usize;
    let out_rate = src_rate / factor as u32;

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| anyhow!("codec não suportado: {e}"))?;

    // Tenta buscar perto do início (economiza tempo em arquivos longos).
    let mut pos_samples: u64 = 0;
    if start > 0.5 {
        let t = (start - 0.25).max(0.0);
        if let Ok(seeked) = format.seek(
            SeekMode::Coarse,
            SeekTo::Time { time: Time::new(t.trunc() as u64, t.fract()), track_id: Some(track_id) },
        ) {
            let tb = track.codec_params.time_base;
            pos_samples = match tb {
                Some(tb) => {
                    let tt = tb.calc_time(seeked.actual_ts);
                    ((tt.seconds as f64 + tt.frac) * src_rate as f64) as u64
                }
                None => seeked.actual_ts,
            };
            decoder.reset();
        }
    }

    let start_sample = (start * src_rate as f64).round() as u64;
    let end_sample = end.map(|e| (e * src_rate as f64).round() as u64);

    let mut out = Vec::<f32>::new();
    let mut acc = 0.0f32;
    let mut acc_n = 0usize;
    let mut sbuf: Option<SampleBuffer<f32>> = None;

    'outer: loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(SymErr::IoError(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(SymErr::ResetRequired) => break,
            Err(e) => return Err(anyhow!("erro lendo pacote: {e}")),
        };
        if packet.track_id() != track_id {
            continue;
        }
        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(SymErr::DecodeError(_)) => continue,
            Err(e) => return Err(anyhow!("erro decodificando: {e}")),
        };
        let spec = *decoded.spec();
        let ch = spec.channels.count().max(1);
        let cap = decoded.capacity() as u64;
        if sbuf.as_ref().map(|b| b.capacity() < decoded.capacity() * ch).unwrap_or(true) {
            sbuf = Some(SampleBuffer::<f32>::new(cap, spec));
        }
        let buf = sbuf.as_mut().unwrap();
        buf.copy_interleaved_ref(decoded);
        for frame in buf.samples().chunks(ch) {
            let idx = pos_samples;
            pos_samples += 1;
            if idx < start_sample {
                continue;
            }
            if let Some(e) = end_sample {
                if idx >= e {
                    break 'outer;
                }
            }
            let m = frame.iter().sum::<f32>() / ch as f32;
            acc += m;
            acc_n += 1;
            if acc_n == factor {
                out.push(acc / factor as f32);
                acc = 0.0;
                acc_n = 0;
            }
        }
    }
    Ok(Mono { samples: out, sample_rate: out_rate, start })
}

/// Escreve WAV PCM16 mono (usado em testes e para pré-escuta).
pub fn write_wav_mono(path: &Path, samples: &[f32], sample_rate: u32) -> Result<()> {
    use std::io::Write;
    let mut f = std::io::BufWriter::new(File::create(path)?);
    let data_len = (samples.len() * 2) as u32;
    f.write_all(b"RIFF")?;
    f.write_all(&(36 + data_len).to_le_bytes())?;
    f.write_all(b"WAVEfmt ")?;
    f.write_all(&16u32.to_le_bytes())?;
    f.write_all(&1u16.to_le_bytes())?; // PCM
    f.write_all(&1u16.to_le_bytes())?; // mono
    f.write_all(&sample_rate.to_le_bytes())?;
    f.write_all(&(sample_rate * 2).to_le_bytes())?;
    f.write_all(&2u16.to_le_bytes())?;
    f.write_all(&16u16.to_le_bytes())?;
    f.write_all(b"data")?;
    f.write_all(&data_len.to_le_bytes())?;
    for s in samples {
        let v = (s.clamp(-1.0, 1.0) * 32767.0) as i16;
        f.write_all(&v.to_le_bytes())?;
    }
    Ok(())
}
