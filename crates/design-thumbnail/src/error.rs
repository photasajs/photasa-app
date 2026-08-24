use thiserror::Error;

#[derive(Debug, Error)]
pub enum ThumbnailError {
    #[error("thumbnail dimensions must be greater than zero")]
    InvalidDimensions,
    #[error("unsupported source extension: {0}")]
    UnsupportedExtension(String),
    #[error("invalid PSD: {0}")]
    InvalidPsd(String),
    #[error("unsupported PSD: {0}")]
    UnsupportedPsd(String),
    #[error("invalid AI: {0}")]
    InvalidAi(String),
    #[error("unsupported AI: {0}")]
    UnsupportedAi(String),
    #[error("decode failed: {0}")]
    Decode(String),
    #[error("encode failed: {0}")]
    Encode(String),
    #[error("I/O failed: {0}")]
    Io(#[from] std::io::Error),
}
