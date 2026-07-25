//! PostHog 遥测（RFC 0163）：仅在用户明确同意后初始化，失败静默降级。

use photasa_preference::{
    PreferencesStore, TelemetryPreferences, CURRENT_TELEMETRY_POLICY_VERSION,
    TELEMETRY_CONSENT_GRANTED, TELEMETRY_CONSENT_UNDECIDED,
};
use posthog_rs::{client, Client, Event};
use serde_json::json;
use std::sync::{Arc, OnceLock};

pub const POSTHOG_API_KEY: &str = "phc_ohBeDHC9RNkG6HkWdbJdjPtacoDTxDjEnZbnYGuVmmja";
pub const POSTHOG_API_HOST: &str = "https://us.i.posthog.com/i/v0/e/";

/// 全局遥测状态，供 panic hook 与各 command 共享。
pub struct TelemetryState {
    client: Option<Arc<Client>>,
}

impl TelemetryState {
    pub fn disabled() -> Self {
        Self { client: None }
    }

    /// 非阻塞上报：后台线程发送，错误仅写日志。
    pub fn capture(&self, event_name: &str, properties: serde_json::Value) {
        let Some(client) = self.client.clone() else {
            return;
        };

        let event_name = event_name.to_string();
        std::thread::spawn(move || {
            let mut event = Event::new_anon(event_name);
            if let Ok(props) = serde_json::from_value::<serde_json::Map<String, serde_json::Value>>(
                properties,
            ) {
                for (key, value) in props {
                    let _ = event.insert_prop(key, value);
                }
            }
            if let Err(error) = client.capture(event) {
                log::debug!("🌌 遥测上报失败（已忽略）: {error}");
            }
        });
    }
}

/// 隐私政策版本不一致时重置为 undecided，并落盘。
pub async fn reconcile_telemetry_consent(store: &mut PreferencesStore) -> TelemetryPreferences {
    let mut telemetry = store.get_current_snapshot().data.telemetry.clone();
    if telemetry.consent_status != TELEMETRY_CONSENT_UNDECIDED
        && telemetry.consent_policy_version != CURRENT_TELEMETRY_POLICY_VERSION
    {
        telemetry.consent_status = TELEMETRY_CONSENT_UNDECIDED.to_string();
        let _ = store
            .update_preferences(
                json!({ "telemetry": { "consentStatus": TELEMETRY_CONSENT_UNDECIDED } }),
                "telemetry-policy",
            )
            .await;
    }
    telemetry
}

/// 按偏好初始化 PostHog；未同意时不建连。
pub fn initialize_from_consent(consent_status: &str) -> Arc<TelemetryState> {
    if consent_status != TELEMETRY_CONSENT_GRANTED {
        log::info!("🌌 遥测未启用：用户未授予同意");
        return Arc::new(TelemetryState::disabled());
    }

    let options = posthog_rs::ClientOptionsBuilder::default()
        .api_key(POSTHOG_API_KEY.to_string())
        .api_endpoint(POSTHOG_API_HOST.to_string())
        .build()
        .expect("PostHog client options");

    let client = Arc::new(client(options));
    let state = Arc::new(TelemetryState {
        client: Some(client),
    });

    state.capture("app_started", json!({ "surface": "rust" }));

    log::info!("🌌 遥测已启用（PostHog）");
    state
}

static PANIC_HOOK_STATE: OnceLock<Arc<TelemetryState>> = OnceLock::new();

/// 安装 panic hook：在原有处理之外尝试上报崩溃事件。
pub fn install_panic_hook(state: Arc<TelemetryState>) {
    let _ = PANIC_HOOK_STATE.set(state.clone());
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        if let Some(telemetry) = PANIC_HOOK_STATE.get() {
            telemetry.capture(
                "rust_panic",
                json!({
                    "message": panic_info.to_string(),
                    "surface": "rust",
                }),
            );
        }
        default_hook(panic_info);
    }));
}
