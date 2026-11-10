//! Parser de LUT .cube (Adobe/Resolve) 1D e 3D, com interpolação trilinear para preview.

use anyhow::{anyhow, bail, Result};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CubeInfo {
    pub title: Option<String>,
    pub kind: &'static str,
    pub size: usize,
    pub domain_min: [f32; 3],
    pub domain_max: [f32; 3],
}

#[derive(Debug, Clone)]
pub struct Cube {
    pub info: CubeInfo,
    /// RGB; para 3D, índice = r + g*N + b*N*N (R varia mais rápido).
    pub table: Vec<[f32; 3]>,
}

pub fn parse(text: &str) -> Result<Cube> {
    let mut title = None;
    let mut size3 = 0usize;
    let mut size1 = 0usize;
    let mut dmin = [0f32; 3];
    let mut dmax = [1f32; 3];
    let mut table = Vec::new();
    for (ln, raw) in text.lines().enumerate() {
        let line = raw.split('#').next().unwrap_or("").trim();
        if line.is_empty() {
            continue;
        }
        let mut it = line.split_whitespace();
        let head = it.next().unwrap();
        let nums = |it: std::str::SplitWhitespace| -> Result<[f32; 3]> {
            let v: Vec<f32> = it.map(|x| x.parse::<f32>()).collect::<Result<_, _>>().map_err(|e| anyhow!("linha {}: {e}", ln + 1))?;
            if v.len() != 3 {
                bail!("linha {}: esperado 3 valores", ln + 1);
            }
            Ok([v[0], v[1], v[2]])
        };
        match head.to_ascii_uppercase().as_str() {
            "TITLE" => title = Some(line[5..].trim().trim_matches('"').to_string()),
            "LUT_3D_SIZE" => size3 = it.next().ok_or_else(|| anyhow!("LUT_3D_SIZE vazio"))?.parse()?,
            "LUT_1D_SIZE" => size1 = it.next().ok_or_else(|| anyhow!("LUT_1D_SIZE vazio"))?.parse()?,
            "DOMAIN_MIN" => dmin = nums(it)?,
            "DOMAIN_MAX" => dmax = nums(it)?,
            "LUT_3D_INPUT_RANGE" | "LUT_1D_INPUT_RANGE" => {
                let a: f32 = it.next().unwrap_or("0").parse()?;
                let b: f32 = it.next().unwrap_or("1").parse()?;
                dmin = [a; 3];
                dmax = [b; 3];
            }
            _ if head.parse::<f32>().is_ok() => {
                table.push(nums(line.split_whitespace())?);
            }
            _ => {} // palavra-chave desconhecida: ignora
        }
    }
    let (kind, size, expected) = if size3 > 0 {
        ("3d", size3, size3 * size3 * size3)
    } else if size1 > 0 {
        ("1d", size1, size1)
    } else {
        bail!("sem LUT_3D_SIZE/LUT_1D_SIZE");
    };
    if size < 2 || size > 256 {
        bail!("tamanho inválido {size}");
    }
    if table.len() != expected {
        bail!("esperado {expected} entradas, encontrado {}", table.len());
    }
    Ok(Cube { info: CubeInfo { title, kind, size, domain_min: dmin, domain_max: dmax }, table })
}

impl Cube {
    pub fn apply(&self, rgb: [f32; 3]) -> [f32; 3] {
        let n = self.info.size;
        let norm = |i: usize| {
            ((rgb[i] - self.info.domain_min[i]) / (self.info.domain_max[i] - self.info.domain_min[i]).max(1e-9)).clamp(0.0, 1.0)
                * (n - 1) as f32
        };
        if self.info.kind == "1d" {
            let mut out = [0f32; 3];
            for c in 0..3 {
                let x = norm(c);
                let i0 = x.floor() as usize;
                let i1 = (i0 + 1).min(n - 1);
                let f = x - i0 as f32;
                out[c] = self.table[i0][c] * (1.0 - f) + self.table[i1][c] * f;
            }
            return out;
        }
        let (x, y, z) = (norm(0), norm(1), norm(2));
        let (x0, y0, z0) = (x.floor() as usize, y.floor() as usize, z.floor() as usize);
        let (x1, y1, z1) = ((x0 + 1).min(n - 1), (y0 + 1).min(n - 1), (z0 + 1).min(n - 1));
        let (fx, fy, fz) = (x - x0 as f32, y - y0 as f32, z - z0 as f32);
        let at = |r: usize, g: usize, b: usize| self.table[r + g * n + b * n * n];
        let mut out = [0f32; 3];
        for c in 0..3 {
            let c00 = at(x0, y0, z0)[c] * (1.0 - fx) + at(x1, y0, z0)[c] * fx;
            let c10 = at(x0, y1, z0)[c] * (1.0 - fx) + at(x1, y1, z0)[c] * fx;
            let c01 = at(x0, y0, z1)[c] * (1.0 - fx) + at(x1, y0, z1)[c] * fx;
            let c11 = at(x0, y1, z1)[c] * (1.0 - fx) + at(x1, y1, z1)[c] * fx;
            let c0 = c00 * (1.0 - fy) + c10 * fy;
            let c1 = c01 * (1.0 - fy) + c11 * fy;
            out[c] = c0 * (1.0 - fz) + c1 * fz;
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn identity(n: usize) -> String {
        let mut s = format!("TITLE \"id\"\nLUT_3D_SIZE {n}\n");
        for b in 0..n {
            for g in 0..n {
                for r in 0..n {
                    let f = |v: usize| v as f32 / (n - 1) as f32;
                    s += &format!("{} {} {}\n", f(r), f(g), f(b));
                }
            }
        }
        s
    }

    #[test]
    fn identity_lut() {
        let c = parse(&identity(17)).unwrap();
        assert_eq!(c.info.title.as_deref(), Some("id"));
        let o = c.apply([0.3, 0.6, 0.9]);
        for (a, b) in o.iter().zip([0.3, 0.6, 0.9]) {
            assert!((a - b).abs() < 1e-4);
        }
    }

    #[test]
    fn rejects_short() {
        assert!(parse("LUT_3D_SIZE 2\n0 0 0\n").is_err());
    }
}
