use std::path::Path;

use image::DynamicImage;

use crate::{ThumbnailError, ThumbnailOptions};

pub(crate) fn save(
    image: DynamicImage,
    destination: &Path,
    options: ThumbnailOptions,
) -> Result<(), ThumbnailError> {
    if let Some(parent) = destination
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        std::fs::create_dir_all(parent)?;
    }

    image
        .thumbnail(options.max_width, options.max_height)
        .save(destination)
        .map_err(|error| ThumbnailError::Encode(error.to_string()))
}
