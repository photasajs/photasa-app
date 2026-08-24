use std::path::Path;

use image::DynamicImage;
use psd::Psd;

use crate::ThumbnailError;

pub(crate) fn decode(source: &Path) -> Result<DynamicImage, ThumbnailError> {
    let bytes = std::fs::read(source)?;
    validate_header(&bytes)?;
    let psd = std::panic::catch_unwind(|| Psd::from_bytes(&bytes))
        .map_err(|_| {
            ThumbnailError::UnsupportedPsd("PSD feature is not supported by decoder".to_string())
        })?
        .map_err(|error| ThumbnailError::InvalidPsd(error.to_string()))?;
    let image = image::RgbaImage::from_raw(psd.width(), psd.height(), psd.rgba())
        .ok_or_else(|| ThumbnailError::Decode("PSD composite buffer size mismatch".to_string()))?;

    Ok(DynamicImage::ImageRgba8(image))
}

fn validate_header(bytes: &[u8]) -> Result<(), ThumbnailError> {
    if bytes.len() < 6 || &bytes[0..4] != b"8BPS" {
        return Err(ThumbnailError::InvalidPsd(
            "missing 8BPS header".to_string(),
        ));
    }

    match u16::from_be_bytes([bytes[4], bytes[5]]) {
        1 => Ok(()),
        2 => Err(ThumbnailError::UnsupportedPsd(
            "PSB version 2 is not supported".to_string(),
        )),
        version => Err(ThumbnailError::InvalidPsd(format!(
            "unsupported PSD version {version}"
        ))),
    }
}
