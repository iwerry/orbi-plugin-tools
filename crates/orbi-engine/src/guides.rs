//! Guias de safe-area (Reels, Shorts, TikTok) geradas como PNG transparente.
//! As margens são aproximações das interfaces das plataformas; ajuste-as em
//! `profiles.json` quando as plataformas mudarem o layout.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub label: String,
    pub width: u32,
    pub height: u32,
    /// Margens inseguras em px (no tamanho de referência).
    pub top: u32,
    pub bottom: u32,
    pub left: u32,
    pub right: u32,
}

pub fn default_profiles() -> Vec<Profile> {
    let p = |id: &str, label: &str, t, b, l, r| Profile {
        id: id.into(),
        label: label.into(),
        width: 1080,
        height: 1920,
        top: t,
        bottom: b,
        left: l,
        right: r,
    };
    vec![
        p("reels", "Instagram Reels", 250, 670, 60, 120),
        p("shorts", "YouTube Shorts", 200, 520, 60, 190),
        p("tiktok", "TikTok", 160, 480, 60, 150),
    ]
}

impl Profile {
    /// Reescala as margens para outra resolução (ex.: 2160x3840).
    pub fn scaled(&self, width: u32, height: u32) -> Profile {
        let sx = width as f64 / self.width as f64;
        let sy = height as f64 / self.height as f64;
        let f = |v: u32, k: f64| (v as f64 * k).round() as u32;
        Profile {
            width,
            height,
            top: f(self.top, sy),
            bottom: f(self.bottom, sy),
            left: f(self.left, sx),
            right: f(self.right, sx),
            ..self.clone()
        }
    }
}

/// Desenha a guia: zonas inseguras em vermelho translúcido, contorno da área
/// segura e linhas de centro.
pub fn render(p: &Profile, out: &Path) -> Result<()> {
    let (w, h) = (p.width as usize, p.height as usize);
    let mut px = vec![0u8; w * h * 4];
    let set = |x: usize, y: usize, c: [u8; 4], px: &mut Vec<u8>| {
        let i = (y * w + x) * 4;
        px[i..i + 4].copy_from_slice(&c);
    };
    let unsafe_c = [230, 40, 60, 70];
    let line_c = [255, 255, 255, 200];
    let center_c = [0, 200, 255, 120];
    let (sl, sr, st, sb) = (p.left as usize, w - p.right as usize, p.top as usize, h - p.bottom as usize);
    for y in 0..h {
        for x in 0..w {
            let inside = x >= sl && x < sr && y >= st && y < sb;
            if !inside {
                set(x, y, unsafe_c, &mut px);
            }
            let border = inside && (x < sl + 3 || x >= sr - 3 || y < st + 3 || y >= sb - 3);
            if border {
                set(x, y, line_c, &mut px);
            }
            let center = (x as isize - (w / 2) as isize).abs() <= 1 || (y as isize - (h / 2) as isize).abs() <= 1;
            if center && inside && !border && (x / 12 + y / 12) % 2 == 0 {
                set(x, y, center_c, &mut px);
            }
        }
    }
    let file = std::fs::File::create(out)?;
    let mut enc = png::Encoder::new(std::io::BufWriter::new(file), p.width, p.height);
    enc.set_color(png::ColorType::Rgba);
    enc.set_depth(png::BitDepth::Eight);
    enc.write_header()?.write_image_data(&px)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scales_and_renders() {
        let p = default_profiles()[0].scaled(540, 960);
        assert_eq!((p.top, p.bottom), (125, 335));
        let f = std::env::temp_dir().join("orbi-guide-test.png");
        render(&p, &f).unwrap();
        let d = png::Decoder::new(std::io::BufReader::new(std::fs::File::open(&f).unwrap()));
        let r = d.read_info().unwrap();
        assert_eq!((r.info().width, r.info().height), (540, 960));
    }
}
