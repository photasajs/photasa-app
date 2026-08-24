use std::path::Path;

use hayro::hayro_interpret::InterpreterSettings;
use hayro::hayro_syntax::Pdf;
use hayro::{render, RenderCache, RenderSettings};
use image::DynamicImage;

use crate::{ThumbnailError, ThumbnailOptions};

pub(crate) fn decode(
    source: &Path,
    options: ThumbnailOptions,
) -> Result<DynamicImage, ThumbnailError> {
    let bytes = std::fs::read(source)?;
    validate_pdf_compatibility(&bytes)?;
    let png = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        render_first_page(bytes, options)
    }))
    .map_err(|_| ThumbnailError::InvalidAi("AI renderer panicked".to_string()))??;

    image::load_from_memory(&png).map_err(|error| ThumbnailError::Decode(error.to_string()))
}

fn validate_pdf_compatibility(bytes: &[u8]) -> Result<(), ThumbnailError> {
    let header = &bytes[..bytes.len().min(1024)];
    if !header.windows(5).any(|window| window == b"%PDF-") {
        return Err(ThumbnailError::UnsupportedAi(
            "AI file has no PDF-compatible content".to_string(),
        ));
    }

    Ok(())
}

fn render_first_page(bytes: Vec<u8>, options: ThumbnailOptions) -> Result<Vec<u8>, ThumbnailError> {
    let pdf = Pdf::new(bytes).map_err(|error| ThumbnailError::InvalidAi(format!("{error:?}")))?;
    let page = pdf
        .pages()
        .iter()
        .next()
        .ok_or_else(|| ThumbnailError::UnsupportedAi("AI file has no pages".to_string()))?;
    let (scale, width, height) = render_size(page.render_dimensions(), options)?;
    let pixmap = render(
        page,
        &RenderCache::new(),
        &InterpreterSettings::default(),
        &RenderSettings {
            x_scale: scale,
            y_scale: scale,
            width: Some(width),
            height: Some(height),
            ..RenderSettings::default()
        },
    );

    pixmap
        .into_png()
        .map_err(|error| ThumbnailError::Decode(error.to_string()))
}

fn render_size(
    (width, height): (f32, f32),
    options: ThumbnailOptions,
) -> Result<(f32, u16, u16), ThumbnailError> {
    if !width.is_finite() || !height.is_finite() || width <= 0.0 || height <= 0.0 {
        return Err(ThumbnailError::InvalidAi(
            "AI page has invalid dimensions".to_string(),
        ));
    }

    let max_width = options.max_width.min(u16::MAX as u32) as f32;
    let max_height = options.max_height.min(u16::MAX as u32) as f32;
    let scale = (max_width / width).min(max_height / height).min(1.0);
    let width = (width * scale).floor().max(1.0) as u16;
    let height = (height * scale).floor().max(1.0) as u16;

    Ok((scale, width, height))
}
