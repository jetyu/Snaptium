use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HealthStatus {
    Ok,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ServiceMode {
    Foundation,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StorageStatus {
    NotConfigured,
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
}
