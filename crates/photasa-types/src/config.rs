pub const PHOTASA_CONFIG_FILE: &str = ".photasa.json";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhotasaConfigPhoto {
    pub path: String,
}

pub trait PhotasaConfigView {
    fn has_config(&self, folder: &str) -> bool;
    fn photo_list(&self, folder: &str) -> Result<Option<Vec<PhotasaConfigPhoto>>, String>;
}
