use async_trait::async_trait;
use photasa_thumbnail::{ThumbnailRequest, ThumbnailResponse};
use photasa_types::NotifyPayload;

#[async_trait]
pub trait ScanEventSink: Send + Sync {
    async fn emit_scan_event(&self, payload: serde_json::Value);
    async fn emit_status_notify(&self, payload: NotifyPayload);
}

#[async_trait]
pub trait ThumbnailBridge: Send + Sync {
    async fn create_thumbnail(&self, request: ThumbnailRequest) -> ThumbnailResponse;
}

pub struct PhotasaThumbnailBridge;

#[async_trait]
impl ThumbnailBridge for PhotasaThumbnailBridge {
    async fn create_thumbnail(&self, request: ThumbnailRequest) -> ThumbnailResponse {
        photasa_thumbnail::create_thumbnail(request).await
    }
}
