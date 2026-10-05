use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HealthStatus {
    Ok,
    InitializationRequired,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ServiceMode {
    Foundation,
    Identity,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StorageStatus {
    NotConfigured,
    Ready,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Health {
    pub status: HealthStatus,
    pub version: String,
    pub mode: ServiceMode,
    pub storage: StorageStatus,
}

impl Health {
    pub fn foundation(version: &str) -> Self {
        Self {
            status: HealthStatus::Ok,
            version: version.into(),
            mode: ServiceMode::Foundation,
            storage: StorageStatus::NotConfigured,
        }
    }

    pub fn identity(version: &str, initialized: bool) -> Self {
        Self {
            status: if initialized {
                HealthStatus::Ok
            } else {
                HealthStatus::InitializationRequired
            },
            version: version.into(),
            mode: ServiceMode::Identity,
            storage: StorageStatus::Ready,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiError {
    pub code: ErrorCode,
    pub request_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    NotFound,
    ServiceUnavailable,
    InvalidRequest,
    AuthenticationRejected,
    CsrfRejected,
}

// Tokens are transport data, never diagnostics. Deliberately no Debug.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountView {
    pub id: String,
    pub is_admin: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(
    tag = "state",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum SessionView {
    Anonymous {
        bootstrap_required: bool,
    },
    Authenticated {
        account: AccountView,
        csrf_token: String,
    },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Discovery {
    pub application: &'static str,
    pub version: &'static str,
    pub mode: ServiceMode,
    pub protocol_versions: Vec<String>,
    pub capabilities: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn health_matches_shared_fixture() -> Result<(), serde_json::Error> {
        let fixture: Health =
            serde_json::from_str(include_str!("../../../tests/fixtures/health.json"))?;
        assert_eq!(fixture, Health::foundation("0.1.0"));
        Ok(())
    }

    #[test]
    fn identity_responses_match_shared_fixtures() -> Result<(), serde_json::Error> {
        let health: Health =
            serde_json::from_str(include_str!("../../../tests/fixtures/health-identity.json"))?;
        assert_eq!(health, Health::identity("0.1.0", false));
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../../tests/fixtures/session-authenticated.json"
        ))?;
        let session: SessionView = serde_json::from_value(fixture.clone())?;
        assert!(
            serde_json::to_value(session)? == fixture,
            "session wire fixture mismatch"
        );
        Ok(())
    }
}
