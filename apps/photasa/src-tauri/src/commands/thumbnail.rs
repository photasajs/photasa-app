use std::path::PathBuf;

pub use photasa_thumbnail::{ThumbnailRequest, ThumbnailResponse};

#[tauri::command]
pub async fn create_thumbnail(request: ThumbnailRequest) -> ThumbnailResponse {
    photasa_thumbnail::create_thumbnail(request).await
}

#[tauri::command]
pub async fn remove_thumbnail(request: ThumbnailRequest) -> ThumbnailResponse {
    let thumbnail = request.thumbnail.clone();
    match photasa_thumbnail::remove_thumbnail(PathBuf::from(&thumbnail)).await {
        Ok(()) => ThumbnailResponse::ok(thumbnail),
        Err(err) => ThumbnailResponse::err(err),
    }
}
