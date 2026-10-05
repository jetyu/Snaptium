//! Browser-only identity. Opaque sessions are bounded and invalidated on restart.
#[cfg(test)]
mod tests;
use crate::{
    RequestId,
    configuration::WebPolicy,
    identity::{BootstrapSecret, IdentityError, LoginName, Password},
    repository::EntityId,
    storage::ServerStorage,
};
use axum::{
    Extension, Json, Router,
    body::to_bytes,
    extract::{ConnectInfo, Request, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, de::DeserializeOwned};
use sha2::{Digest, Sha256};
use snaptium_protocol::{AccountView, ErrorCode, SessionView};
use std::{
    collections::HashMap,
    net::{IpAddr, SocketAddr},
    sync::Arc,
    time::{Duration, Instant},
};
use subtle::ConstantTimeEq;
use tokio::sync::Mutex;
use zeroize::Zeroizing;

const LIFETIME: u32 = 8 * 60 * 60;
const WINDOW: Duration = Duration::from_secs(60);
const SESSION_LIMIT: usize = 1024;
const PEER_LIMIT: usize = 4096;

struct Session {
    owner: EntityId,
    csrf: Zeroizing<String>,
    expires: Instant,
}
struct Window {
    start: Instant,
    count: u32,
}
struct Throttle {
    global: Window,
    peers: HashMap<IpAddr, Window>,
}
impl Throttle {
    fn accept(&mut self, peer: IpAddr, now: Instant) -> bool {
        self.peers
            .retain(|_, window| now.duration_since(window.start) < WINDOW);
        if now.duration_since(self.global.start) >= WINDOW {
            self.global = Window {
                start: now,
                count: 0,
            };
        }
        if self.global.count >= 60 {
            return false;
        }
        self.global.count += 1;
        if !self.peers.contains_key(&peer) && self.peers.len() >= PEER_LIMIT {
            return false;
        }
        let window = self.peers.entry(peer).or_insert(Window {
            start: now,
            count: 0,
        });
        if window.count >= 10 {
            return false;
        }
        window.count += 1;
        true
    }
}

pub struct WebIdentity {
    pub(crate) storage: Arc<ServerStorage>,
    policy: WebPolicy,
    authority: Option<BootstrapSecret>,
    sessions: Mutex<HashMap<[u8; 32], Session>>,
    throttle: Mutex<Throttle>,
}
impl WebIdentity {
    pub async fn new(
        storage: Arc<ServerStorage>,
        policy: WebPolicy,
        authority: Option<BootstrapSecret>,
    ) -> Result<Self, IdentityError> {
        if storage.bootstrap_required().await? && authority.is_none() {
            return Err(IdentityError::Unavailable);
        }
        Ok(Self {
            storage,
            policy,
            authority,
            sessions: Mutex::new(HashMap::new()),
            throttle: Mutex::new(Throttle {
                global: Window {
                    start: Instant::now(),
                    count: 0,
                },
                peers: HashMap::new(),
            }),
        })
    }
    fn boundary(&self, headers: &HeaderMap, write: bool) -> Result<(), Failure> {
        if single(headers, "host") != Some(self.policy.authority.as_str())
            || single(headers, "origin").is_some_and(|value| value != self.policy.origin)
            || (write && single(headers, "origin") != Some(self.policy.origin.as_str()))
            || headers.get_all("origin").iter().count() > 1
            || (headers.contains_key("origin") && single(headers, "origin").is_none())
            || single(headers, "sec-fetch-site")
                .is_some_and(|value| value != "same-origin" && (write || value != "none"))
            || headers.get_all("sec-fetch-site").iter().count() > 1
            || (headers.contains_key("sec-fetch-site")
                && single(headers, "sec-fetch-site").is_none())
        {
            return Err(Failure::csrf());
        }
        if write
            && (single(headers, "x-snaptium-request") != Some("web-v1")
                || single(headers, "content-type").and_then(|value| value.split(';').next())
                    != Some("application/json")
                || headers.contains_key("content-encoding"))
        {
            return Err(Failure::csrf());
        }
        Ok(())
    }
    fn cookie_digest(&self, headers: &HeaderMap) -> Result<Option<[u8; 32]>, Failure> {
        let Some(cookie) = single(headers, "cookie") else {
            return if headers.contains_key("cookie") {
                Err(Failure::rejected())
            } else {
                Ok(None)
            };
        };
        if cookie.len() > 4096 {
            return Err(Failure::rejected());
        }
        let mut found = None;
        for item in cookie.split(';') {
            let Some((name, value)) = item.trim().split_once('=') else {
                continue;
            };
            if name == self.policy.cookie_name() {
                if found.is_some() || !valid_token(value) {
                    return Err(Failure::rejected());
                }
                found = Some(digest(value));
            }
        }
        Ok(found)
    }
    async fn session(
        &self,
        headers: &HeaderMap,
    ) -> Result<Option<([u8; 32], EntityId, String)>, Failure> {
        let Some(key) = self.cookie_digest(headers)? else {
            return Ok(None);
        };
        let mut sessions = self.sessions.lock().await;
        let now = Instant::now();
        sessions.retain(|_, session| session.expires > now);
        Ok(sessions
            .get(&key)
            .map(|session| (key, session.owner, session.csrf.to_string())))
    }
    async fn issue(
        &self,
        owner: EntityId,
        headers: &HeaderMap,
    ) -> Result<(String, String), Failure> {
        let token = random_token()?;
        let csrf = random_token()?;
        let old = self.cookie_digest(headers).ok().flatten();
        let mut sessions = self.sessions.lock().await;
        let now = Instant::now();
        sessions.retain(|_, session| session.expires > now);
        let replacing = old.is_some_and(|key| sessions.contains_key(&key));
        let account_count = sessions
            .iter()
            .filter(|(key, session)| Some(**key) != old && session.owner == owner)
            .count();
        if sessions.len() - usize::from(replacing) >= SESSION_LIMIT || account_count >= 8 {
            return Err(Failure::unavailable());
        }
        if let Some(old) = old {
            sessions.remove(&old);
        }
        sessions.insert(
            digest(&token),
            Session {
                owner,
                csrf: Zeroizing::new(csrf.clone()),
                expires: now + Duration::from_secs(LIFETIME.into()),
            },
        );
        Ok((token, csrf))
    }
    async fn request<T: DeserializeOwned>(
        &self,
        request: Request,
    ) -> Result<(HeaderMap, T), Failure> {
        let peer = request
            .extensions()
            .get::<ConnectInfo<SocketAddr>>()
            .ok_or_else(Failure::unavailable)?
            .0
            .ip();
        if !self.throttle.lock().await.accept(peer, Instant::now()) {
            return Err(Failure::throttled());
        }
        self.boundary(request.headers(), true)?;
        let (parts, body) = request.into_parts();
        let bytes = tokio::time::timeout(Duration::from_secs(5), to_bytes(body, 4096))
            .await
            .map_err(|_| Failure::invalid())?
            .map_err(|_| Failure::invalid())?;
        let bytes = Zeroizing::new(bytes.to_vec());
        let value = serde_json::from_slice(&bytes).map_err(|_| Failure::invalid())?;
        Ok((parts.headers, value))
    }
}

fn single<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    let mut values = headers.get_all(name).iter();
    let value = values.next()?.to_str().ok()?;
    if values.next().is_some() {
        return None;
    }
    Some(value)
}
fn valid_token(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn digest(value: &str) -> [u8; 32] {
    Sha256::digest(value.as_bytes()).into()
}
fn random_token() -> Result<String, Failure> {
    use std::fmt::Write;
    let mut bytes = Zeroizing::new([0_u8; 32]);
    OsRng
        .try_fill_bytes(&mut *bytes)
        .map_err(|_| Failure::unavailable())?;
    let mut token = String::with_capacity(64);
    for byte in *bytes {
        write!(&mut token, "{byte:02x}").map_err(|_| Failure::unavailable())?;
    }
    Ok(token)
}

struct Failure {
    status: StatusCode,
    code: ErrorCode,
}
impl Failure {
    fn rejected() -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            code: ErrorCode::AuthenticationRejected,
        }
    }
    fn csrf() -> Self {
        Self {
            status: StatusCode::FORBIDDEN,
            code: ErrorCode::CsrfRejected,
        }
    }
    fn invalid() -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            code: ErrorCode::InvalidRequest,
        }
    }
    fn unavailable() -> Self {
        Self {
            status: StatusCode::SERVICE_UNAVAILABLE,
            code: ErrorCode::ServiceUnavailable,
        }
    }
    fn throttled() -> Self {
        Self {
            status: StatusCode::TOO_MANY_REQUESTS,
            code: ErrorCode::AuthenticationRejected,
        }
    }
    fn response(self, id: String) -> Response {
        let mut response = crate::error(self.status, self.code, id);
        if self.status == StatusCode::TOO_MANY_REQUESTS {
            response
                .headers_mut()
                .insert(header::RETRY_AFTER, HeaderValue::from_static("60"));
        }
        response
    }
}
impl From<IdentityError> for Failure {
    fn from(error: IdentityError) -> Self {
        match error {
            IdentityError::InvalidInput => Self::invalid(),
            IdentityError::Rejected => Self::rejected(),
            IdentityError::Busy | IdentityError::Unavailable => Self::unavailable(),
        }
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Credentials {
    login: String,
    password: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Bootstrap {
    login: String,
    password: String,
    initialization_secret: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Empty {}

pub(crate) fn router() -> Router<Arc<WebIdentity>> {
    Router::new()
        .route("/api/v1/auth/session", get(session))
        .route("/api/v1/auth/bootstrap", post(bootstrap))
        .route("/api/v1/auth/login", post(login))
        .route("/api/v1/auth/logout", post(logout))
}
async fn session(
    State(state): State<Arc<WebIdentity>>,
    Extension(RequestId(id)): Extension<RequestId>,
    headers: HeaderMap,
) -> Response {
    match session_view(&state, &headers).await {
        Ok(view) => Json(view).into_response(),
        Err(error) => error.response(id),
    }
}
async fn session_view(state: &WebIdentity, headers: &HeaderMap) -> Result<SessionView, Failure> {
    state.boundary(headers, false)?;
    if let Some((key, owner, csrf)) = state.session(headers).await? {
        if let Some(is_admin) = state.storage.account_admin(&owner).await? {
            return Ok(SessionView::Authenticated {
                account: AccountView {
                    id: owner.canonical(),
                    is_admin,
                },
                csrf_token: csrf,
            });
        }
        state.sessions.lock().await.remove(&key);
    }
    Ok(SessionView::Anonymous {
        bootstrap_required: state.storage.bootstrap_required().await?,
    })
}
async fn bootstrap(
    State(state): State<Arc<WebIdentity>>,
    Extension(RequestId(id)): Extension<RequestId>,
    request: Request,
) -> Response {
    let result = async {
        let (_, input): (_, Bootstrap) = state.request(request).await?;
        let password = Password::for_creation(input.password)?;
        let candidate =
            BootstrapSecret::parse(input.initialization_secret).map_err(|_| Failure::rejected())?;
        let authority = state.authority.as_ref().ok_or_else(Failure::rejected)?;
        if !state.storage.bootstrap_required().await? {
            return Err(Failure::rejected());
        }
        state
            .storage
            .bootstrap_admin(
                authority,
                &candidate,
                LoginName::parse(&input.login)?,
                password,
            )
            .await?;
        Ok(StatusCode::NO_CONTENT.into_response())
    }
    .await;
    match result {
        Ok(response) => response,
        Err(error) => error.response(id),
    }
}
async fn login(
    State(state): State<Arc<WebIdentity>>,
    Extension(RequestId(id)): Extension<RequestId>,
    request: Request,
) -> Response {
    let result = async {
        let (headers, input): (_, Credentials) = state.request(request).await?;
        let password =
            Password::for_verification(input.password).map_err(|_| Failure::rejected())?;
        let login = LoginName::parse(&input.login).map_err(|_| Failure::rejected())?;
        if state.storage.bootstrap_required().await? {
            return Err(Failure::rejected());
        }
        let account = state.storage.verify_credentials(login, password).await?;
        let (token, csrf) = state.issue(account.id, &headers).await?;
        let cookie = HeaderValue::from_str(&state.policy.cookie(&token, LIFETIME))
            .map_err(|_| Failure::unavailable())?;
        let mut response = Json(SessionView::Authenticated {
            account: AccountView {
                id: account.id.canonical(),
                is_admin: account.is_admin,
            },
            csrf_token: csrf,
        })
        .into_response();
        response.headers_mut().insert(header::SET_COOKIE, cookie);
        Ok(response)
    }
    .await;
    match result {
        Ok(response) => response,
        Err(error) => error.response(id),
    }
}
async fn logout(
    State(state): State<Arc<WebIdentity>>,
    Extension(RequestId(id)): Extension<RequestId>,
    request: Request,
) -> Response {
    let result = async {
        let (headers, _): (_, Empty) = state.request(request).await?;
        let (key, owner, csrf) = state
            .session(&headers)
            .await?
            .ok_or_else(Failure::rejected)?;
        if state.storage.account_admin(&owner).await?.is_none() {
            return Err(Failure::rejected());
        }
        let candidate = single(&headers, "x-csrf-token")
            .filter(|value| valid_token(value))
            .ok_or_else(Failure::csrf)?;
        if !bool::from(csrf.as_bytes().ct_eq(candidate.as_bytes())) {
            return Err(Failure::csrf());
        }
        state.sessions.lock().await.remove(&key);
        let mut response = StatusCode::NO_CONTENT.into_response();
        response.headers_mut().insert(
            header::SET_COOKIE,
            HeaderValue::from_str(&state.policy.cookie("", 0))
                .map_err(|_| Failure::unavailable())?,
        );
        Ok(response)
    }
    .await;
    match result {
        Ok(response) => response,
        Err(error) => error.response(id),
    }
}
