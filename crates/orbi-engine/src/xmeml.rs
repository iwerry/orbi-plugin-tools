//! Gerador de XML Final Cut Pro 7 (xmeml v4), que o Premiere importa como nova sequência.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt::Write;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Rate {
    /// Base de tempo inteira (24, 25, 30, 60...).
    pub timebase: u32,
    /// true para 23.976 / 29.97 / 59.94.
    pub ntsc: bool,
}
impl Default for Rate {
    fn default() -> Self {
        Self { timebase: 30, ntsc: true }
    }
}
impl Rate {
    pub fn from_fps(fps: f64) -> Self {
        let r = fps.round();
        let ntsc = (fps - r).abs() > 0.01;
        Rate { timebase: r as u32, ntsc }
    }
    pub fn fps(&self) -> f64 {
        if self.ntsc {
            self.timebase as f64 * 1000.0 / 1001.0
        } else {
            self.timebase as f64
        }
    }
    pub fn frames(&self, sec: f64) -> i64 {
        (sec * self.fps()).round() as i64
    }
    fn xml(&self) -> String {
        format!(
            "<rate><timebase>{}</timebase><ntsc>{}</ntsc></rate>",
            self.timebase,
            if self.ntsc { "TRUE" } else { "FALSE" }
        )
    }
}

#[derive(Debug, Clone)]
pub struct XClip {
    pub path: String,
    pub name: String,
    pub src_in: f64,
    pub src_out: f64,
    pub seq_start: f64,
    pub has_video: bool,
    pub audio_channels: u32,
    pub media_duration: Option<f64>,
    /// Escala do vídeo (%), via efeito Basic Motion. None = 100%.
    pub scale: Option<f64>,
    /// Faixa de áudio (pode ser maior que a do vídeo: J/L-cut).
    pub audio_src_in: f64,
    pub audio_src_out: f64,
    pub audio_seq_start: f64,
    /// Par de faixas de áudio: 0 = A1/A2, 1 = A3/A4 (para sobrepor J/L-cuts).
    pub audio_group: u32,
}

impl XClip {
    /// Clipe simples (áudio igual ao vídeo, sem zoom).
    pub fn simple(path: &str, name: &str, src_in: f64, src_out: f64, seq_start: f64, channels: u32, media_duration: Option<f64>) -> XClip {
        XClip {
            path: path.into(),
            name: name.into(),
            src_in,
            src_out,
            seq_start,
            has_video: true,
            audio_channels: channels,
            media_duration,
            scale: None,
            audio_src_in: src_in,
            audio_src_out: src_out,
            audio_seq_start: seq_start,
            audio_group: 0,
        }
    }
}

#[derive(Debug, Clone)]
pub struct XSequence {
    pub name: String,
    pub rate: Rate,
    pub width: u32,
    pub height: u32,
    pub clips: Vec<XClip>,
}

pub fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&apos;")
}

/// Converte caminho local em `file://localhost/...` com escape de URL.
pub fn path_url(p: &str) -> String {
    let p = p.replace('\\', "/");
    let mut out = String::from("file://localhost");
    if !p.starts_with('/') {
        out.push('/');
    }
    for b in p.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => out.push(b as char),
            b':' => out.push_str("%3a"),
            _ => {
                let _ = write!(out, "%{:02X}", b);
            }
        }
    }
    out
}

pub fn build(seq: &XSequence) -> String {
    let r = &seq.rate;
    let rate = r.xml();
    // Arquivos únicos.
    let mut files: BTreeMap<String, (usize, f64, bool, u32)> = BTreeMap::new();
    for c in &seq.clips {
        let n = files.len() + 1;
        let e = files.entry(c.path.clone()).or_insert((n, 0.0, c.has_video, c.audio_channels));
        e.1 = e.1.max(c.media_duration.unwrap_or(c.src_out.max(c.audio_src_out)));
    }
    let mut defined = std::collections::HashSet::new();
    let file_xml = |path: &str, defined: &mut std::collections::HashSet<String>| -> String {
        let (id, dur, vid, ch) = files[path];
        if !defined.insert(path.to_string()) {
            return format!("<file id=\"file-{id}\"/>");
        }
        let mut s = format!(
            "<file id=\"file-{id}\"><name>{}</name><pathurl>{}</pathurl>{rate}<duration>{}</duration><media>",
            esc(&crate::autocut::file_name(path)),
            esc(&path_url(path)),
            r.frames(dur)
        );
        if vid {
            let _ = write!(
                s,
                "<video><samplecharacteristics>{rate}<width>{}</width><height>{}</height></samplecharacteristics></video>",
                seq.width, seq.height
            );
        }
        let _ = write!(
            s,
            "<audio><samplecharacteristics><depth>16</depth><samplerate>48000</samplerate></samplecharacteristics><channelcount>{}</channelcount></audio>",
            ch.max(1)
        );
        s.push_str("</media></file>");
        s
    };

    let n_ch = seq.clips.iter().map(|c| c.audio_channels.clamp(1, 2)).max().unwrap_or(1);
    let n_groups = seq.clips.iter().map(|c| c.audio_group + 1).max().unwrap_or(1);
    let mut vtrack = String::new();
    let mut atracks: Vec<String> = vec![String::new(); (n_ch * n_groups) as usize];
    let mut aindex: Vec<usize> = vec![0; atracks.len()];
    let mut cursor: i64 = 0;
    let mut vindex = 0usize;
    let mut total: i64 = 0;
    for (i, c) in seq.clips.iter().enumerate() {
        let k = i + 1;
        // Vídeo: encaixa no frame final do anterior quando a diferença é de arredondamento.
        let wanted = r.frames(c.seq_start);
        let start = if (wanted - cursor).abs() <= 1 { cursor } else { wanted };
        let len = r.frames(c.src_out - c.src_in);
        let end = start + len;
        cursor = end;
        let inf = r.frames(c.src_in);
        let outf = inf + len;
        // Áudio: mesma régua do vídeo, deslocada pelo J/L-cut.
        let lead = start - r.frames(c.audio_seq_start).min(start);
        let lag = (r.frames(c.audio_src_out) - r.frames(c.src_out)).max(0);
        let (astart, aend, ain, aout) = (start - lead, end + lag, inf - lead, outf + lag);
        total = total.max(aend).max(end);
        let mdur = r.frames(files[&c.path].1);
        let ch = c.audio_channels.clamp(1, 2);
        let tracks: Vec<usize> = (0..ch).map(|a| (c.audio_group * n_ch + a) as usize).collect();
        if c.has_video {
            vindex += 1;
        }
        for &t in &tracks {
            aindex[t] += 1;
        }
        let mut links = String::new();
        if c.has_video {
            let _ = write!(links, "<link><linkclipref>clipitem-v{k}</linkclipref><mediatype>video</mediatype><trackindex>1</trackindex><clipindex>{vindex}</clipindex></link>");
        }
        for &t in &tracks {
            let _ = write!(links, "<link><linkclipref>clipitem-a{}-{k}</linkclipref><mediatype>audio</mediatype><trackindex>{}</trackindex><clipindex>{}</clipindex><groupindex>1</groupindex></link>", t + 1, t + 1, aindex[t]);
        }
        let item = |id: &str, file: String, extra: &str, s: i64, e: i64, a: i64, b: i64| {
            format!(
                "<clipitem id=\"{id}\"><name>{}</name><enabled>TRUE</enabled><duration>{mdur}</duration>{rate}<start>{s}</start><end>{e}</end><in>{a}</in><out>{b}</out>{file}{extra}{links}</clipitem>",
                esc(&c.name)
            )
        };
        if c.has_video {
            let f = file_xml(&c.path, &mut defined);
            let fx = match c.scale {
                Some(sc) => format!(
                    "<filter><effect><name>Basic Motion</name><effectid>basic</effectid><effectcategory>motion</effectcategory><effecttype>motion</effecttype><mediatype>video</mediatype><parameter authoringApp=\"PremierePro\"><parameterid>scale</parameterid><name>Scale</name><valuemin>0</valuemin><valuemax>1000</valuemax><value>{sc}</value></parameter></effect></filter>"
                ),
                None => String::new(),
            };
            vtrack.push_str(&item(&format!("clipitem-v{k}"), f, &fx, start, end, inf, outf));
        }
        for (a, &t) in tracks.iter().enumerate() {
            let f = file_xml(&c.path, &mut defined);
            let st = format!("<sourcetrack><mediatype>audio</mediatype><trackindex>{}</trackindex></sourcetrack>", a + 1);
            atracks[t].push_str(&item(&format!("clipitem-a{}-{k}", t + 1), f, &st, astart, aend, ain, aout));
        }
    }
    let mut x = String::new();
    x.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE xmeml>\n<xmeml version=\"4\">");
    let _ = write!(
        x,
        "<sequence id=\"sequence-1\"><name>{}</name><duration>{total}</duration>{rate}<timecode>{rate}<string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode><media>",
        esc(&seq.name)
    );
    let _ = write!(
        x,
        "<video><format><samplecharacteristics>{rate}<width>{}</width><height>{}</height><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance></samplecharacteristics></format><track>{vtrack}</track></video>",
        seq.width, seq.height
    );
    x.push_str("<audio><numOutputChannels>2</numOutputChannels>");
    for t in atracks {
        let _ = write!(x, "<track>{t}</track>");
    }
    x.push_str("</audio></media></sequence></xmeml>\n");
    x
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_windows() {
        assert_eq!(path_url(r"C:\Vídeos\a b.mp4"), "file://localhost/C%3a/V%C3%ADdeos/a%20b.mp4");
        assert_eq!(path_url("/Users/x/a.mov"), "file://localhost/Users/x/a.mov");
    }

    #[test]
    fn frames_ntsc() {
        let r = Rate::from_fps(29.97);
        assert!(r.ntsc && r.timebase == 30);
        assert_eq!(r.frames(10.0), 300 - 0); // 299.7 -> 300
        assert_eq!(Rate::from_fps(25.0).frames(2.0), 50);
    }

    #[test]
    fn builds_linked_clips() {
        let seq = XSequence {
            name: "T & <x>".into(),
            rate: Rate { timebase: 25, ntsc: false },
            width: 1920,
            height: 1080,
            clips: vec![
                XClip::simple("C:/a.mp4", "a.mp4", 1.0, 3.0, 0.0, 2, Some(60.0)),
                XClip::simple("C:/a.mp4", "a.mp4", 5.0, 6.0, 2.0, 2, Some(60.0)),
            ],
        };
        let x = build(&seq);
        assert!(x.contains("<name>T &amp; &lt;x&gt;</name>"));
        assert_eq!(x.matches("<pathurl>").count(), 1, "arquivo definido uma vez");
        assert_eq!(x.matches("<clipitem ").count(), 6);
        assert!(x.contains("<start>50</start><end>75</end><in>125</in><out>150</out>"));
        assert!(x.contains("<duration>75</duration>"));
    }

    #[test]
    fn zoom_and_jcut_tracks() {
        let mut a = XClip::simple("C:/a.mp4", "a.mp4", 1.0, 3.0, 0.0, 2, Some(60.0));
        let mut b = XClip::simple("C:/a.mp4", "a.mp4", 5.0, 6.0, 2.0, 2, Some(60.0));
        b.scale = Some(115.0);
        // J-cut de 0,2 s no segundo trecho, no par de faixas A3/A4.
        b.audio_src_in = 4.8;
        b.audio_seq_start = 1.8;
        b.audio_group = 1;
        a.audio_group = 0;
        let x = build(&XSequence { name: "J".into(), rate: Rate { timebase: 25, ntsc: false }, width: 1080, height: 1920, clips: vec![a, b] });
        assert_eq!(x.matches("<track>").count(), 1 + 4, "V1 + A1..A4");
        assert!(x.contains("<value>115</value>"));
        // áudio do 2º trecho começa 5 frames antes do vídeo (50 → 45), in 125 → 120
        assert!(x.contains("<start>45</start><end>75</end><in>120</in><out>150</out>"), "{x}");
        assert!(x.contains("<start>50</start><end>75</end><in>125</in><out>150</out>"));
    }
}
