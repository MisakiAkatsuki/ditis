use base64::{engine::general_purpose::STANDARD, Engine};
use ditis_openai_import_core::*;
use serde_json::{json, Value};
use std::io::Cursor;

fn tga(kind: u8, descriptor: u8, pixels: &[u8]) -> Vec<u8> {
    let mut bytes = vec![0; 18];
    bytes[2] = kind;
    bytes[12] = 2;
    bytes[14] = 2;
    bytes[16] = 24;
    bytes[17] = descriptor;
    bytes.extend_from_slice(pixels);
    bytes
}
fn source(bytes: &[u8], extension: &str) -> Source {
    let dir =
        std::env::temp_dir().join(format!("ditis-image-{}-{}", std::process::id(), extension));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join(format!("SECRET_PRODUCTION_TITLE.{extension}"));
    std::fs::write(&path, bytes).unwrap();
    let source = prepare_source(&path).unwrap();
    std::fs::remove_dir_all(dir).unwrap();
    source
}
fn pixel(image: &str, x: u32, y: u32) -> [u8; 3] {
    let bytes = STANDARD
        .decode(image.strip_prefix("data:image/png;base64,").unwrap())
        .unwrap();
    image::load_from_memory(&bytes)
        .unwrap()
        .to_rgb8()
        .get_pixel(x, y)
        .0
}
fn region(kind: Kind, start: usize) -> Region {
    let mut png = Cursor::new(Vec::new());
    image::DynamicImage::new_rgb8(8, 8)
        .write_to(&mut png, image::ImageFormat::Png)
        .unwrap();
    Region {
        kind,
        start_frame: start,
        frame_count: 4,
        image: format!(
            "data:image/png;base64,{}",
            STANDARD.encode(png.into_inner())
        ),
    }
}
fn response(regions: Value) -> Value {
    json!({"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":json!({"regions":regions,"warnings":[]}).to_string()}]}]})
}
fn layer(start: usize, end: usize, value: Value, uncertain: bool) -> Value {
    json!({"name":"A","exposures":[{"start":start,"end":end,"value":value,"uncertain":uncertain}]})
}

#[test]
fn tga_bgr_origin_and_rle_are_decoded_before_preview_and_send() {
    // Bottom-origin 2x2 TGA. Top row must stay red/green, not blue/white.
    let image = source(
        &tga(2, 0, &[255, 0, 0, 255, 255, 255, 0, 0, 255, 0, 255, 0]),
        "tga",
    );
    assert_eq!(pixel(&image.data_url, 0, 0), [255, 0, 0]);
    assert_eq!(pixel(&image.data_url, 1, 0), [0, 255, 0]);
    assert_eq!(pixel(&image.data_url, 0, 1), [0, 0, 255]);
    let rle = source(&tga(10, 32, &[0x83, 0, 0, 255]), "TGA");
    assert_eq!(pixel(&rle.data_url, 1, 1), [255, 0, 0]);
}

#[test]
fn network_payload_only_contains_cropped_pngs_and_neutral_labels() {
    let body = request_body(&[region(Kind::Inbetween, 1)], 24.0, "gpt-4.1").unwrap();
    assert_eq!(body["store"], false);
    assert_eq!(body["input"][0]["content"][1]["type"], "input_image");
    assert!(!body.to_string().contains("SECRET_PRODUCTION_TITLE"));
    assert!(!body.to_string().contains("filename"));
    let mut pdf = region(Kind::Key, 1);
    pdf.image = "data:application/pdf;base64,JVBERi0=".into();
    assert!(request_body(&[pdf], 24.0, "gpt-4.1").is_err());
    let mut invalid = region(Kind::Key, 1);
    invalid.image = "data:image/png;base64,JVBERi0=".into();
    assert!(request_body(&[invalid], 24.0, "gpt-4.1").is_err());
}

#[test]
fn fills_unrecognized_gaps_as_unresolved_instead_of_extending_a_cel() {
    let input = vec![region(Kind::Inbetween, 1)];
    let value = response(json!([{"index":0,"layers":[layer(1,2,json!("001"),false)]}]));
    let mut review = parse_response(&value, &input, 24.0).unwrap();
    assert_eq!(review.rows.len(), 2);
    assert_eq!(review.rows[1].start, 3);
    assert!(review.rows[1].value.is_none());
    assert!(to_document(&review, 24.0, "cut", 144).is_err());
    review.rows[1].value = Some("".into());
    review.rows[1].uncertain = false;
    let doc = to_document(&review, 24.0, "cut", 144).unwrap();
    assert_eq!(doc.sheets[0].data[0], vec!["001", "001", "", ""]);
}

#[test]
fn key_and_inbetween_regions_become_separate_tabs_with_one_based_frames() {
    let input = vec![
        region(Kind::Key, 1),
        region(Kind::Inbetween, 1),
        region(Kind::Inbetween, 5),
    ];
    let value = response(json!([
        {"index":2,"layers":[layer(5,8,json!("002"),false)]},
        {"index":0,"layers":[layer(1,4,json!("001"),false)]},
        {"index":1,"layers":[layer(1,4,json!("×"),false)]}
    ]));
    let review = parse_response(&value, &input, 24.0).unwrap();
    let doc = to_document(&review, 24.0, "cut", 144).unwrap();
    assert_eq!(doc.sheets.len(), 2);
    assert!(doc.sheets[0].name.contains("原画"));
    assert!(doc.sheets[1].name.contains("動画"));
    assert_eq!(doc.sheets[1].frames, 8);
    assert_eq!(
        doc.sheets[1].data[0],
        vec!["×", "×", "×", "×", "002", "002", "002", "002"]
    );
}

#[test]
fn incomplete_refused_duplicated_and_overlapping_results_never_import() {
    let input = vec![region(Kind::Inbetween, 1)];
    let mut value = response(json!([{"index":0,"layers":[layer(1,4,json!("1"),false)]}]));
    value["status"] = json!("incomplete");
    assert!(parse_response(&value, &input, 24.0).is_err());
    value["status"] = json!("completed");
    value["output"][0]["content"][0]["type"] = json!("refusal");
    assert!(parse_response(&value, &input, 24.0).is_err());
    let value = response(json!([{"index":0,"layers":[layer(1,5,json!("1"),false)]}]));
    assert!(parse_response(&value, &input, 24.0).is_err());
    let inputs = vec![region(Kind::Inbetween, 1), region(Kind::Inbetween, 1)];
    let value = response(
        json!([{"index":0,"layers":[layer(1,4,json!("1"),false)]},{"index":1,"layers":[layer(1,4,json!("2"),false)]}]),
    );
    assert!(parse_response(&value, &inputs, 24.0).is_err());
}
