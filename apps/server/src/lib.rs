use std::path::PathBuf;
use std::sync::Arc;

pub mod backup;
pub mod configuration;
pub mod identity;
pub mod migration;
pub mod repository;
mod schema;
pub mod storage;
pub mod web_identity;

use axum::{
    Extension, Json, Router,
    body::Body,
    extract::{Request, State},
    http::{HeaderValue, StatusCode, Uri, header},
    middleware::{self, Next},
    response::{Html, IntoResponse, Response},
    routing::get,
};
use snaptium_protocol::{ApiError, Discovery, ErrorCode, Health, ServiceMode};
use tower_http::services::ServeDir;

#[derive(Clone)]
struct AppState {
    web_dir: PathBuf,
    identity: Option<Arc<web_identity::WebIdentity>>,
}

#[derive(Clone)]
struct RequestId(String);

pub fn router(web_dir: PathBuf) -> Router {
    build_router(web_dir, None)
}

pub fn router_with_identity(web_dir: PathBuf, identity: Arc<web_identity::WebIdentity>) -> Router {
    build_router(web_dir, Some(identity))
}

fn build_router(web_dir: PathBuf, identity: Option<Arc<web_identity::WebIdentity>>) -> Router {
    let mut router = Router::new()
        .route("/api/v1/health", get(health))
        .route("/.well-known/notes", get(discovery))
        .nest_service("/assets", ServeDir::new(web_dir.join("assets")))
        .fallback(get(shell));
    if let Some(state) = &identity {
        router = router.merge(web_identity::router().with_state(state.clone()));
    }
    router
        .with_state(AppState { web_dir, identity })
        .layer(middleware::from_fn(response_headers))
}

async fn health(
    State(state): State<AppState>,
    Extension(RequestId(id)): Extension<RequestId>,
) -> Response {
    if let Some(identity) = state.identity {
        if identity.storage.check().await.is_err() {
            return error(
                StatusCode::SERVICE_UNAVAILABLE,
                ErrorCode::ServiceUnavailable,
                id,
            );
        }
        return match identity.storage.bootstrap_required().await {
            Ok(required) => {
                Json(Health::identity(env!("CARGO_PKG_VERSION"), !required)).into_response()
            }
            Err(_) => error(
                StatusCode::SERVICE_UNAVAILABLE,
                ErrorCode::ServiceUnavailable,
                id,
            ),
        };
    }
    Json(Health::foundation(env!("CARGO_PKG_VERSION"))).into_response()
}

async fn discovery(State(state): State<AppState>) -> Json<Discovery> {
    let identity_enabled = state.identity.is_some();
    Json(Discovery {
        application: "snaptium",
        version: env!("CARGO_PKG_VERSION"),
        mode: if identity_enabled {
            ServiceMode::Identity
        } else {
            ServiceMode::Foundation
        },
        protocol_versions: vec![],
        capabilities: if identity_enabled {
            vec!["web_identity".into()]
        } else {
            vec![]
        },
    })
}

async fn shell(
    State(state): State<AppState>,
    Extension(request_id): Extension<RequestId>,
    uri: Uri,
) -> Response {
    // Explicit UI routes ensure API/WS/missing static assets never become HTML 200.
    if !matches!(uri.path(), "/" | "/notes" | "/settings") {
        return error(StatusCode::NOT_FOUND, ErrorCode::NotFound, request_id.0);
    }
    match tokio::fs::read_to_string(state.web_dir.join("index.html")).await {
        Ok(html) => Html(html).into_response(),
        Err(_) => error(
            StatusCode::SERVICE_UNAVAILABLE,
            ErrorCode::ServiceUnavailable,
            request_id.0,
        ),
    }
}

fn error(status: StatusCode, code: ErrorCode, request_id: String) -> Response {
    (status, Json(ApiError { code, request_id })).into_response()
}

async fn response_headers(mut request: Request<Body>, next: Next) -> Response {
    let request_id = uuid::Uuid::now_v7().to_string();
    request
        .extensions_mut()
        .insert(RequestId(request_id.clone()));
    let mut response = next.run(request).await;
    if let Ok(value) = HeaderValue::from_str(&request_id) {
        response.headers_mut().insert("x-request-id", value);
    }
    response.headers_mut().insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    response.headers_mut().insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response.headers_mut().insert(header::CONTENT_SECURITY_POLICY, HeaderValue::from_static(
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    ));
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;
    use tower::ServiceExt;

    #[tokio::test]
    async fn health_is_typed_and_content_free() -> Result<(), Box<dyn std::error::Error>> {
        let response = router(PathBuf::from("missing-web"))
            .oneshot(
                Request::builder()
                    .uri("/api/v1/health")
                    .body(Body::empty())?,
            )
            .await?;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers()[header::X_CONTENT_TYPE_OPTIONS],
            "nosniff"
        );
        let bytes = to_bytes(response.into_body(), 2048).await?;
        let health: Health = serde_json::from_slice(&bytes)?;
        assert_eq!(health, Health::foundation(env!("CARGO_PKG_VERSION")));
        Ok(())
    }

    #[tokio::test]
    async fn reserved_paths_never_receive_spa_fallback() -> Result<(), Box<dyn std::error::Error>> {
        for path in [
            "/api/v1/missing",
            "/ws",
            "/.well-known/missing",
            "/missing.js",
            "/assets/missing.js",
        ] {
            let response = router(PathBuf::from("missing-web"))
                .oneshot(Request::builder().uri(path).body(Body::empty())?)
                .await?;
            assert_eq!(response.status(), StatusCode::NOT_FOUND, "{path}");
        }
        Ok(())
    }
}
