//! Biblioteca de LUTs: varre uma pasta, valida cada .cube e devolve um catálogo em JSON.
//! Arquivos inválidos não derrubam a varredura: aparecem com `ok: false` e o motivo.

use crate::cube::{self, CubeInfo};
use anyhow::{Context, Result};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LutEntry {
    pub file: String,
    pub path: PathBuf,
    pub ok: bool,
    pub error: Option<String>,
    #[serde(flatten)]
    pub info: Option<CubeInfo>,
}

/// Lista os .cube de uma pasta (não recursiva), em ordem alfabética.
pub fn scan(dir: &Path) -> Result<Vec<LutEntry>> {
    let mut paths: Vec<PathBuf> = std::fs::read_dir(dir)
        .with_context(|| format!("não consegui ler a pasta {}", dir.display()))?
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_file() && p.extension().map(|x| x.eq_ignore_ascii_case("cube")).unwrap_or(false))
        .collect();
    paths.sort();
    Ok(paths.into_iter().map(|p| entry(&p)).collect())
}

fn entry(path: &Path) -> LutEntry {
    let file = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let parsed = std::fs::read_to_string(path)
        .map_err(anyhow::Error::from)
        .and_then(|t| cube::parse(&t));
    match parsed {
        Ok(c) => LutEntry { file, path: path.to_path_buf(), ok: true, error: None, info: Some(c.info) },
        Err(e) => LutEntry { file, path: path.to_path_buf(), ok: false, error: Some(format!("{e:#}")), info: None },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// LUT 3D 2x2x2 identidade (R varia mais rápido).
    const ID2: &str = "TITLE \"ident\"\nLUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n";

    #[test]
    fn scans_valid_and_invalid_cubes() {
        let dir = std::env::temp_dir().join(format!("orbi-lut-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("b-ident.CUBE"), ID2).unwrap();
        std::fs::write(dir.join("a-quebrada.cube"), "LUT_3D_SIZE 2\n0 0 0\n").unwrap();
        std::fs::write(dir.join("ignorar.txt"), "x").unwrap();

        let list = scan(&dir).unwrap();
        assert_eq!(list.len(), 2, "só os .cube entram");
        assert_eq!(list[0].file, "a-quebrada.cube");
        assert!(!list[0].ok && list[0].error.is_some() && list[0].info.is_none());
        assert_eq!(list[1].file, "b-ident.CUBE");
        assert!(list[1].ok);
        let info = list[1].info.as_ref().unwrap();
        assert_eq!(info.size, 2);
        assert_eq!(info.kind, "3d");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
