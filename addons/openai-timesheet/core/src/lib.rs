use base64::{engine::general_purpose::STANDARD, Engine};
use ditis_import_protocol::{read_limited, Document, Sheet, MAX_CELLS};
use image::{ImageFormat, ImageReader, Limits};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    io::Cursor,
    path::Path,
};

pub const MAX_SOURCE_BYTES: u64 = 24 * 1024 * 1024;
pub const MAX_SEND_BYTES: usize = 24 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub name: String,
    pub mime: String,
    pub data_url: String,
}

fn png(bytes: &[u8], format: ImageFormat) -> Result<Vec<u8>, String> {
    let mut reader = ImageReader::with_format(Cursor::new(bytes), format);
    let mut limits = Limits::default();
    limits.max_image_width = Some(12_000);
    limits.max_image_height = Some(20_000);
    limits.max_alloc = Some(256 * 1024 * 1024);
    reader.limits(limits);
    let image = reader
        .decode()
        .map_err(|e| format!("画像を読み込めません: {e}"))?;
    if image.width() as u64 * image.height() as u64 > 32_000_000 {
        return Err("画像は3,200万画素以内にしてください".into());
    }
    // Flatten alpha onto white and re-encode. No original metadata is retained.
    let mut rgba = image.into_rgba8();
    for pixel in rgba.pixels_mut() {
        let a = pixel[3] as u16;
        for channel in &mut pixel.0[..3] {
            *channel = ((*channel as u16 * a + 255 * (255 - a)) / 255) as u8;
        }
        pixel[3] = 255;
    }
    let mut output = Cursor::new(Vec::new());
    image::DynamicImage::ImageRgba8(rgba)
        .write_to(&mut output, ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(output.into_inner())
}

pub fn prepare_source(path: &Path) -> Result<Source, String> {
    let bytes = read_limited(path, MAX_SOURCE_BYTES)?;
    let extension = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let (mime, bytes) = match extension.as_str() {
        "pdf" if bytes.starts_with(b"%PDF-") => ("application/pdf", bytes),
        "png" => ("image/png", png(&bytes, ImageFormat::Png)?),
        "jpg" | "jpeg" => ("image/png", png(&bytes, ImageFormat::Jpeg)?),
        "webp" => ("image/png", png(&bytes, ImageFormat::WebP)?),
        "tga" => ("image/png", png(&bytes, ImageFormat::Tga)?),
        _ => return Err("PNG・JPEG・WebP・TGA・PDFを選択してください".into()),
    };
    Ok(Source {
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        mime: mime.into(),
        data_url: format!("data:{mime};base64,{}", STANDARD.encode(bytes)),
    })
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Key,
    Inbetween,
}
impl Kind {
    fn label(&self) -> &str {
        match self {
            Self::Key => "原画",
            Self::Inbetween => "動画",
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Region {
    pub kind: Kind,
    pub start_frame: usize,
    pub frame_count: usize,
    pub image: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Exposure {
    pub start: usize,
    pub end: usize,
    pub value: Option<String>,
    pub uncertain: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RecognizedLayer {
    pub name: String,
    pub exposures: Vec<Exposure>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RecognizedRegion {
    pub index: usize,
    pub layers: Vec<RecognizedLayer>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Recognition {
    pub regions: Vec<RecognizedRegion>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReviewRow {
    pub kind: Kind,
    pub layer: String,
    pub start: usize,
    pub end: usize,
    pub value: Option<String>,
    pub uncertain: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Review {
    pub rows: Vec<ReviewRow>,
    pub warnings: Vec<String>,
}

fn check_regions(regions: &[Region], fps: f64) -> Result<(), String> {
    if regions.is_empty() || regions.len() > 24 || !fps.is_finite() || !(1.0..=240.0).contains(&fps)
    {
        return Err("送信範囲またはFPSが不正です".into());
    }
    for r in regions {
        if r.start_frame == 0
            || r.frame_count == 0
            || r.frame_count > 2000
            || r.start_frame > 20_000
            || r.start_frame + r.frame_count - 1 > 20_000
        {
            return Err("範囲の開始コマ・コマ数を確認してください".into());
        }
    }
    Ok(())
}

/// The API accepts ONLY cropped PNGs. It cannot read source paths or send PDFs.
/// Re-encoding here strips metadata even if a frontend supplied a PNG with metadata.
pub fn request_body(regions: &[Region], fps: f64, model: &str) -> Result<Value, String> {
    check_regions(regions, fps)?;
    if model.is_empty() || model.len() > 128 || model.chars().any(char::is_control) {
        return Err("モデル名が不正です".into());
    }
    let mut total = 0;
    let mut content = Vec::new();
    for (index, region) in regions.iter().enumerate() {
        let encoded = region
            .image
            .strip_prefix("data:image/png;base64,")
            .ok_or("送信できるのは切り出したPNG画像だけです")?;
        if encoded.len() > MAX_SEND_BYTES * 4 / 3 + 4 {
            return Err("送信画像が大きすぎます".into());
        }
        let decoded = STANDARD
            .decode(encoded)
            .map_err(|_| "送信画像の形式が不正です")?;
        let sanitized = png(&decoded, ImageFormat::Png)?;
        total += sanitized.len();
        if total > MAX_SEND_BYTES {
            return Err("送信画像は合計24MB以内にしてください".into());
        }
        content.push(json!({"type":"input_text","text":format!(
            "Region index={index}, kind={}, first frame={}, frame count={}, fps={fps}. Frame numbers in your output must be absolute, inclusive, 1-based.",
            region.kind.label(), region.start_frame, region.frame_count)}));
        content.push(json!({"type":"input_image","image_url":format!("data:image/png;base64,{}",STANDARD.encode(sanitized)),"detail":"high"}));
    }
    Ok(json!({
        "model":model, "store":false, "max_output_tokens":16000,
        "instructions": include_str!("prompt.txt"),
        "input":[{"role":"user","content":content}],
        "text":{"format":{"type":"json_schema","name":"animation_timesheet","strict":true,
            "schema":serde_json::from_str::<Value>(include_str!("schema.json")).unwrap()}}
    }))
}

fn valid_value(value: &str) -> bool {
    value.chars().count() <= 128 && !value.chars().any(char::is_control)
}

pub fn parse_response(response: &Value, regions: &[Region], fps: f64) -> Result<Review, String> {
    check_regions(regions, fps)?;
    if response["status"] != "completed" {
        return Err("認識結果が途中で終了しました。範囲を減らして再実行してください".into());
    }
    let mut text = String::new();
    for item in response["output"].as_array().ok_or("APIの応答が不正です")? {
        if let Some(parts) = item["content"].as_array() {
            for part in parts {
                if part["type"] == "refusal" {
                    return Err("モデルが画像の読み取りを拒否しました".into());
                }
                if part["type"] == "output_text" {
                    text.push_str(part["text"].as_str().ok_or("APIの応答が不正です")?);
                }
            }
        }
    }
    let recognized: Recognition =
        serde_json::from_str(&text).map_err(|_| "認識結果のJSON形式が不正です")?;
    if recognized.regions.len() != regions.len() {
        return Err("一部の送信範囲の認識結果がありません".into());
    }
    let mut seen = BTreeSet::new();
    let mut rows = Vec::new();
    let mut warnings = recognized.warnings;
    if warnings.len() > 200 || warnings.iter().any(|w| w.len() > 4000) {
        return Err("認識結果が大きすぎます".into());
    }
    let mut cells = 0usize;
    for rr in recognized.regions {
        let r = regions
            .get(rr.index)
            .ok_or("認識結果の範囲番号が不正です")?;
        if !seen.insert(rr.index) || rr.layers.is_empty() || rr.layers.len() > 128 {
            return Err("認識結果の列数・範囲番号が不正です".into());
        }
        cells += r.frame_count * rr.layers.len();
        if cells > MAX_CELLS {
            return Err("認識結果が大きすぎます".into());
        }
        let mut layer_names = BTreeSet::new();
        let last = r.start_frame + r.frame_count - 1;
        for mut layer in rr.layers {
            if layer.name.trim().is_empty()
                || !valid_value(&layer.name)
                || !layer_names.insert(layer.name.clone())
                || layer.exposures.len() > r.frame_count
            {
                return Err("認識結果の列が不正です".into());
            }
            layer.exposures.sort_by_key(|e| e.start);
            let mut next = r.start_frame;
            for e in layer.exposures {
                if e.start < next
                    || e.end < e.start
                    || e.end > last
                    || e.value.as_ref().is_some_and(|v| !valid_value(v))
                {
                    return Err("認識結果のコマ範囲・値が不正です".into());
                }
                if e.start > next {
                    rows.push(ReviewRow {
                        kind: r.kind.clone(),
                        layer: layer.name.clone(),
                        start: next,
                        end: e.start - 1,
                        value: None,
                        uncertain: true,
                    });
                    warnings.push(format!(
                        "{} {}: {}〜{}コマは未認識です",
                        r.kind.label(),
                        layer.name,
                        next,
                        e.start - 1
                    ));
                }
                let continuation = e
                    .value
                    .as_deref()
                    .is_some_and(|v| matches!(v, "-" | "│" | "|"));
                rows.push(ReviewRow {
                    kind: r.kind.clone(),
                    layer: layer.name.clone(),
                    start: e.start,
                    end: e.end,
                    uncertain: e.uncertain || e.value.is_none() || continuation,
                    value: if continuation { None } else { e.value },
                });
                next = e.end + 1;
            }
            if next <= last {
                rows.push(ReviewRow {
                    kind: r.kind.clone(),
                    layer: layer.name.clone(),
                    start: next,
                    end: last,
                    value: None,
                    uncertain: true,
                });
                warnings.push(format!(
                    "{} {}: {}〜{}コマは未認識です",
                    r.kind.label(),
                    layer.name,
                    next,
                    last
                ));
            }
        }
    }
    // Validate overlaps across pages/regions before presenting editable results.
    check_rows(&rows, true)?;
    Ok(Review { rows, warnings })
}

fn check_rows(rows: &[ReviewRow], allow_uncertain: bool) -> Result<(), String> {
    if rows.is_empty() || rows.len() > MAX_CELLS {
        return Err("取り込むデータがありません、または大きすぎます".into());
    }
    let mut by_layer: BTreeMap<(Kind, &str), Vec<&ReviewRow>> = BTreeMap::new();
    for row in rows {
        if row.layer.trim().is_empty()
            || !valid_value(&row.layer)
            || row.start == 0
            || row.end < row.start
            || row.end > 20_000
            || row.value.as_ref().is_some_and(|v| !valid_value(v))
            || (!allow_uncertain && (row.uncertain || row.value.is_none()))
        {
            return Err("不明・要確認の行を確認し、列名・コマ範囲・値を修正してください".into());
        }
        by_layer
            .entry((row.kind.clone(), &row.layer))
            .or_default()
            .push(row);
    }
    for spans in by_layer.values_mut() {
        spans.sort_by_key(|r| r.start);
        for pair in spans.windows(2) {
            if pair[0].end >= pair[1].start {
                return Err("同じ欄・列のコマ範囲が重複しています".into());
            }
        }
    }
    Ok(())
}

pub fn to_document(
    review: &Review,
    fps: f64,
    name: &str,
    frame_page_size: usize,
) -> Result<Document, String> {
    check_rows(&review.rows, false)?;
    if name.trim().is_empty() || !valid_value(name) {
        return Err("シート名を確認してください".into());
    }
    let mut sheets = Vec::new();
    for kind in [Kind::Key, Kind::Inbetween] {
        let rows: Vec<_> = review.rows.iter().filter(|r| r.kind == kind).collect();
        if rows.is_empty() {
            continue;
        }
        let frames = rows.iter().map(|r| r.end).max().unwrap();
        let mut layers = Vec::new();
        for row in &rows {
            if !layers.contains(&row.layer) {
                layers.push(row.layer.clone());
            }
        }
        if frames * layers.len() > MAX_CELLS {
            return Err("取り込みサイズが大きすぎます".into());
        }
        let mut data = vec![vec![String::new(); frames]; layers.len()];
        for row in rows {
            let column = layers.iter().position(|n| n == &row.layer).unwrap();
            for frame in row.start..=row.end {
                data[column][frame - 1] = row.value.clone().unwrap();
            }
        }
        sheets.push(Sheet {
            name: format!("{}（{}）", name.trim(), kind.label()),
            fps,
            frames,
            frame_page_size,
            layers,
            data,
        });
    }
    let document = Document {
        version: "1.0".into(),
        sheets,
    };
    document.validate()?;
    Ok(document)
}
