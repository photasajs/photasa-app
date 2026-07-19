//! Photasa shared Rust DTOs used across scan, watch, and Tauri adapters.

pub mod config;
pub mod file_operation;
pub mod notify;
pub mod scan;
pub mod media_type;

pub use config::{PhotasaConfigPhoto, PhotasaConfigView, PHOTASA_CONFIG_FILE};
pub use file_operation::{FileOperation, FileOperationMetadata, FileOperationType};
pub use notify::{NotifyPayload, ScanNotifyAction, ScanNotifyProgress, ScanWorkerNotifySource};
pub use scan::{PhotoFileRequest, ScanAction, ScanParamValidation};
pub use media_type::MediaType;
