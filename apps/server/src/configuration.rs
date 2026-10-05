//! Trusted process configuration; no sensitive values in error messages.
use crate::identity::BootstrapSecret;
use axum::http::Uri;
use std::{io::Read, net::SocketAddr, path::PathBuf};
use zeroize::Zeroizing;

#[derive(Debug)]
pub struct ConfigurationError;
impl std::fmt::Display for ConfigurationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("invalid_server_configuration")
    }
}
impl std::error::Error for ConfigurationError {}

pub struct WebPolicy {
    pub(crate) origin: String,
    pub(crate) authority: String,
    pub(crate) secure: bool,
}
impl WebPolicy {
    pub fn parse(
        origin: &str,
        allow_http: bool,
        listen: SocketAddr,
    ) -> Result<Self, ConfigurationError> {
        if origin.len() > 256 || !origin.is_ascii() {
            return Err(ConfigurationError);
        }
        let uri: Uri = origin.parse().map_err(|_| ConfigurationError)?;
        let scheme = uri.scheme_str().ok_or(ConfigurationError)?;
        let authority = uri.authority().ok_or(ConfigurationError)?;
        if authority.as_str().contains('@')
            || uri.query().is_some()
            || origin != format!("{scheme}://{authority}")
            || authority.as_str() != authority.as_str().to_ascii_lowercase()
            || (authority.as_str() != authority.host() && authority.port_u16().is_none())
            || authority.port_u16() == Some(0)
            || (scheme == "https" && authority.port_u16() == Some(443))
            || (scheme == "http" && authority.port_u16() == Some(80))
            || authority
                .port()
                .is_some_and(|port| port.as_str().parse::<u16>().is_err())
        {
            return Err(ConfigurationError);
        }
        let secure = match scheme {
            "https" => true,
            "http"
                if allow_http
                    && listen.ip().is_loopback()
                    && matches!(uri.host(), Some("127.0.0.1" | "localhost" | "[::1]")) =>
            {
                false
            }
            _ => return Err(ConfigurationError),
        };
        Ok(Self {
            origin: origin.into(),
            authority: authority.as_str().into(),
            secure,
        })
    }
    pub(crate) fn cookie_name(&self) -> &'static str {
        if self.secure {
            "__Host-snaptium_session"
        } else {
            "snaptium_dev_session"
        }
    }
    pub(crate) fn cookie(&self, token: &str, max_age: u32) -> String {
        format!(
            "{}={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={max_age}{}",
            self.cookie_name(),
            if self.secure { "; Secure" } else { "" }
        )
    }
}

pub struct IdentitySettings {
    pub directory: PathBuf,
    pub policy: WebPolicy,
    pub secret_file: Option<PathBuf>,
}
pub struct Settings {
    pub listen: SocketAddr,
    pub web_dir: PathBuf,
    pub identity: Option<IdentitySettings>,
}
impl Settings {
    pub fn from_env() -> Result<Self, ConfigurationError> {
        Self::parse(|name| match std::env::var(name) {
            Ok(value) => Ok(Some(value)),
            Err(std::env::VarError::NotPresent) => Ok(None),
            Err(_) => Err(ConfigurationError),
        })
    }
    fn parse(
        read: impl Fn(&str) -> Result<Option<String>, ConfigurationError>,
    ) -> Result<Self, ConfigurationError> {
        let value = |name| -> Result<Option<String>, ConfigurationError> {
            let result = read(name)?;
            if result.as_ref().is_some_and(|v| v.trim().is_empty()) {
                return Err(ConfigurationError);
            }
            Ok(result)
        };
        let listen: SocketAddr = value("SNAPTIUM_LISTEN")?
            .unwrap_or_else(|| "127.0.0.1:3000".into())
            .parse()
            .map_err(|_| ConfigurationError)?;
        let web_dir =
            PathBuf::from(value("SNAPTIUM_WEB_DIR")?.unwrap_or_else(|| "apps/web/dist".into()));
        let directory = value("SNAPTIUM_DATA_DIR")?;
        let origin = value("SNAPTIUM_PUBLIC_ORIGIN")?;
        let secret_file = value("SNAPTIUM_BOOTSTRAP_SECRET_FILE")?;
        let allow_http = value("SNAPTIUM_ALLOW_HTTP_LOOPBACK")?;
        let identity = if let Some(directory) = directory {
            let allow_http = match allow_http.as_deref() {
                None | Some("false") => false,
                Some("true") => true,
                _ => return Err(ConfigurationError),
            };
            Some(IdentitySettings {
                directory: directory.into(),
                policy: WebPolicy::parse(&origin.ok_or(ConfigurationError)?, allow_http, listen)?,
                secret_file: secret_file.map(PathBuf::from),
            })
        } else {
            if origin.is_some() || secret_file.is_some() || allow_http.is_some() {
                return Err(ConfigurationError);
            }
            None
        };
        Ok(Self {
            listen,
            web_dir,
            identity,
        })
    }
}

pub async fn read_bootstrap_secret(path: PathBuf) -> Result<BootstrapSecret, ConfigurationError> {
    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(path).map_err(|_| ConfigurationError)?;
        let mut bytes = Zeroizing::new(Vec::new());
        file.take(67)
            .read_to_end(&mut bytes)
            .map_err(|_| ConfigurationError)?;
        let text = std::str::from_utf8(&bytes).map_err(|_| ConfigurationError)?;
        let text = text
            .strip_suffix("\r\n")
            .or_else(|| text.strip_suffix('\n'))
            .unwrap_or(text);
        BootstrapSecret::parse(text.into()).map_err(|_| ConfigurationError)
    })
    .await
    .map_err(|_| ConfigurationError)?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn policy_rejects_unsafe_and_ambiguous_origins() -> Result<(), Box<dyn std::error::Error>> {
        let listen = "127.0.0.1:3000".parse()?;
        for origin in [
            "http://nas",
            "https://user@nas",
            "https://nas/",
            "https://nas/path",
            "https://nas?x=y",
            "https://NAS",
            "https://nas:99999",
            "https://nas#fragment",
            "https://nas:443",
        ] {
            assert!(WebPolicy::parse(origin, false, listen).is_err());
        }
        assert!(WebPolicy::parse("http://127.0.0.1:5173", true, listen).is_ok());
        assert!(WebPolicy::parse("http://127.0.0.1:80", true, listen).is_err());
        assert!(WebPolicy::parse("http://127.0.0.1:3000", true, "0.0.0.0:3000".parse()?).is_err());
        let policy = WebPolicy::parse("https://notes.example", false, listen)?;
        let cookie = policy.cookie("test", 28800);
        assert!(cookie.starts_with("__Host-"));
        assert!(cookie.contains("; Secure"));
        assert!(!cookie.contains("Domain"));
        Ok(())
    }
    #[test]
    fn partial_configuration_never_falls_back_to_preview() {
        assert!(Settings::parse(|_| Ok(None)).is_ok());
        assert!(
            Settings::parse(|name| Ok((name == "SNAPTIUM_DATA_DIR").then(|| "test-data".into())))
                .is_err()
        );
        assert!(
            Settings::parse(|name| Ok(
                (name == "SNAPTIUM_PUBLIC_ORIGIN").then(|| "https://notes.example".into())
            ))
            .is_err()
        );
    }
    #[tokio::test]
    async fn secret_file_is_bounded_and_does_not_echo_failures()
    -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let path = directory.path().join("bootstrap-secret");
        std::fs::write(&path, format!("{}\r\n", "ab".repeat(32)))?;
        read_bootstrap_secret(path.clone()).await?;
        std::fs::write(&path, "a".repeat(1000))?;
        assert!(read_bootstrap_secret(path).await.is_err());
        assert_eq!(
            ConfigurationError.to_string(),
            "invalid_server_configuration"
        );
        Ok(())
    }
}
