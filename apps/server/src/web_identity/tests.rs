use super::*;
use axum::body::Body;
use tower::ServiceExt;

type TestResult = Result<(), Box<dyn std::error::Error>>;

#[tokio::test]
async fn fresh_identity_without_authority_fails_closed() -> TestResult {
    let directory = tempfile::tempdir()?;
    let storage = Arc::new(ServerStorage::open_identity(directory.path()).await?);
    let policy = WebPolicy::parse("https://notes.example", false, "127.0.0.1:3000".parse()?)?;
    assert!(matches!(
        WebIdentity::new(storage.clone(), policy, None).await,
        Err(IdentityError::Unavailable)
    ));
    assert!(storage.bootstrap_required().await?);
    storage.shutdown().await;
    Ok(())
}
async fn fixture() -> Result<
    (
        tempfile::TempDir,
        Arc<ServerStorage>,
        Arc<WebIdentity>,
        Router,
    ),
    Box<dyn std::error::Error>,
> {
    let directory = tempfile::tempdir()?;
    let storage = Arc::new(ServerStorage::open_identity(directory.path()).await?);
    let policy = WebPolicy::parse("https://notes.example", false, "127.0.0.1:3000".parse()?)?;
    let identity = Arc::new(
        WebIdentity::new(
            storage.clone(),
            policy,
            Some(BootstrapSecret::parse("ab".repeat(32))?),
        )
        .await?,
    );
    let router = crate::router_with_identity("missing-web".into(), identity.clone());
    Ok((directory, storage, identity, router))
}
fn request(path: &str, body: &str) -> Result<Request, axum::http::Error> {
    Request::builder()
        .method("POST")
        .uri(path)
        .header("Host", "notes.example")
        .header("Origin", "https://notes.example")
        .header("Content-Type", "application/json")
        .header("X-Snaptium-Request", "web-v1")
        .extension(ConnectInfo(SocketAddr::from(([127, 0, 0, 1], 4000))))
        .body(Body::from(body.to_owned()))
}
fn read_request(cookie: Option<&str>) -> Result<Request, axum::http::Error> {
    let mut builder = Request::builder()
        .uri("/api/v1/auth/session")
        .header("Host", "notes.example");
    if let Some(cookie) = cookie {
        builder = builder.header("Cookie", cookie);
    }
    builder.body(Body::empty())
}
async fn view(response: Response) -> Result<SessionView, Box<dyn std::error::Error>> {
    let bytes = to_bytes(response.into_body(), 4096).await?;
    Ok(serde_json::from_slice(&bytes)?)
}
fn cookie(response: &Response) -> Result<String, Box<dyn std::error::Error>> {
    let value = response
        .headers()
        .get(header::SET_COOKIE)
        .ok_or("missing cookie")?
        .to_str()?;
    Ok(value.split(';').next().ok_or("missing cookie")?.to_owned())
}

#[test]
fn throttle_is_bounded_and_window_recovers() -> TestResult {
    let now = Instant::now();
    let peer: IpAddr = "127.0.0.1".parse()?;
    let mut throttle = Throttle {
        global: Window {
            start: now,
            count: 0,
        },
        peers: HashMap::new(),
    };
    for _ in 0..10 {
        assert!(throttle.accept(peer, now));
    }
    assert!(!throttle.accept(peer, now));
    assert!(throttle.accept(peer, now + WINDOW));
    throttle.global.count = 60;
    assert!(!throttle.accept("127.0.0.2".parse()?, now + WINDOW));
    throttle.global.count = 0;
    for value in 0..PEER_LIMIT {
        throttle.peers.insert(
            IpAddr::V4(std::net::Ipv4Addr::from(value as u32)),
            Window {
                start: now + WINDOW,
                count: 0,
            },
        );
    }
    assert!(!throttle.accept("192.0.2.1".parse()?, now + WINDOW));
    Ok(())
}

#[tokio::test]
async fn session_capacity_rotation_expiry_and_digest_storage() -> TestResult {
    let (_directory, storage, identity, _router) = fixture().await?;
    let owner = EntityId::parse(&uuid::Uuid::now_v7().to_string())?;
    let headers = HeaderMap::new();
    let (first, csrf) = identity
        .issue(owner, &headers)
        .await
        .map_err(|_| "issue failed")?;
    assert!(valid_token(&first) && valid_token(&csrf));
    assert!(identity.sessions.lock().await.contains_key(&digest(&first)));
    let mut headers = HeaderMap::new();
    headers.insert(
        header::COOKIE,
        HeaderValue::from_str(&format!("__Host-snaptium_session={first}"))?,
    );
    let (second, _) = identity
        .issue(owner, &headers)
        .await
        .map_err(|_| "rotation failed")?;
    assert!(first != second, "session token did not rotate");
    assert!(
        identity
            .session(&headers)
            .await
            .map_err(|_| "read failed")?
            .is_none()
    );
    for _ in 0..7 {
        identity
            .issue(owner, &HeaderMap::new())
            .await
            .map_err(|_| "issue failed")?;
    }
    assert!(identity.issue(owner, &HeaderMap::new()).await.is_err());
    for session in identity.sessions.lock().await.values_mut() {
        session.expires = Instant::now() - Duration::from_secs(1);
    }
    headers.insert(
        header::COOKIE,
        HeaderValue::from_str(&format!("__Host-snaptium_session={second}"))?,
    );
    assert!(
        identity
            .session(&headers)
            .await
            .map_err(|_| "read failed")?
            .is_none()
    );
    assert!(identity.sessions.lock().await.is_empty());
    storage.shutdown().await;
    Ok(())
}

#[tokio::test]
async fn bootstrap_login_rotation_csrf_logout_and_restart() -> TestResult {
    let _guard = crate::identity::TEST_HASH_SERIAL.lock().await;
    let (_directory, storage, identity, router) = fixture().await?;
    assert!(matches!(
        view(router.clone().oneshot(read_request(None)?).await?).await?,
        SessionView::Anonymous {
            bootstrap_required: true
        }
    ));
    let bootstrap = serde_json::json!({"login":"alice", "password":"test password 长度足够 123", "initializationSecret":"ab".repeat(32)}).to_string();
    let response = router
        .clone()
        .oneshot(request("/api/v1/auth/bootstrap", &bootstrap)?)
        .await?;
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    assert_eq!(
        router
            .clone()
            .oneshot(request("/api/v1/auth/bootstrap", &bootstrap)?)
            .await?
            .status(),
        StatusCode::UNAUTHORIZED
    );
    let credentials = r#"{"login":"alice","password":"test password 长度足够 123"}"#;
    let response = router
        .clone()
        .oneshot(request("/api/v1/auth/login", credentials)?)
        .await?;
    assert_eq!(response.status(), StatusCode::OK);
    let first_cookie = cookie(&response)?;
    let set_cookie = response.headers()[header::SET_COOKIE].to_str()?;
    assert!(
        set_cookie.contains("HttpOnly")
            && set_cookie.contains("Secure")
            && set_cookie.contains("SameSite=Strict")
    );
    assert!(!set_cookie.contains("Domain"));
    assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
    let csrf = match view(response).await? {
        SessionView::Authenticated {
            csrf_token,
            account,
        } => {
            assert!(account.is_admin);
            csrf_token
        }
        _ => return Err("login did not authenticate".into()),
    };
    let mut missing = request("/api/v1/auth/logout", "{}")?;
    missing
        .headers_mut()
        .insert(header::COOKIE, HeaderValue::from_str(&first_cookie)?);
    assert_eq!(
        router.clone().oneshot(missing).await?.status(),
        StatusCode::FORBIDDEN
    );
    let mut wrong = request("/api/v1/auth/logout", "{}")?;
    wrong
        .headers_mut()
        .insert(header::COOKIE, HeaderValue::from_str(&first_cookie)?);
    wrong
        .headers_mut()
        .insert("x-csrf-token", HeaderValue::from_str(&"cd".repeat(32))?);
    assert_eq!(
        router.clone().oneshot(wrong).await?.status(),
        StatusCode::FORBIDDEN
    );
    let mut rotate = request("/api/v1/auth/login", credentials)?;
    rotate
        .headers_mut()
        .insert(header::COOKIE, HeaderValue::from_str(&first_cookie)?);
    let response = router.clone().oneshot(rotate).await?;
    let second_cookie = cookie(&response)?;
    assert!(first_cookie != second_cookie);
    let second_csrf = match view(response).await? {
        SessionView::Authenticated { csrf_token, .. } => csrf_token,
        _ => return Err("rotation failed".into()),
    };
    assert!(matches!(
        view(
            router
                .clone()
                .oneshot(read_request(Some(&first_cookie))?)
                .await?
        )
        .await?,
        SessionView::Anonymous {
            bootstrap_required: false
        }
    ));
    let mut stale_csrf = request("/api/v1/auth/logout", "{}")?;
    stale_csrf
        .headers_mut()
        .insert(header::COOKIE, HeaderValue::from_str(&second_cookie)?);
    stale_csrf
        .headers_mut()
        .insert("x-csrf-token", HeaderValue::from_str(&csrf)?);
    assert_eq!(
        router.clone().oneshot(stale_csrf).await?.status(),
        StatusCode::FORBIDDEN
    );
    let mut logout = request("/api/v1/auth/logout", "{}")?;
    logout
        .headers_mut()
        .insert(header::COOKIE, HeaderValue::from_str(&second_cookie)?);
    logout
        .headers_mut()
        .insert("x-csrf-token", HeaderValue::from_str(&second_csrf)?);
    let response = router.clone().oneshot(logout).await?;
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    assert!(
        response.headers()[header::SET_COOKIE]
            .to_str()?
            .contains("Max-Age=0")
    );
    assert!(matches!(
        view(
            router
                .clone()
                .oneshot(read_request(Some(&second_cookie))?)
                .await?
        )
        .await?,
        SessionView::Anonymous {
            bootstrap_required: false
        }
    ));
    let fresh_policy = WebPolicy::parse("https://notes.example", false, "127.0.0.1:3000".parse()?)?;
    let restarted = Arc::new(WebIdentity::new(storage.clone(), fresh_policy, None).await?);
    let restarted_router = crate::router_with_identity("missing-web".into(), restarted);
    assert!(matches!(
        view(
            restarted_router
                .oneshot(read_request(Some(&second_cookie))?)
                .await?
        )
        .await?,
        SessionView::Anonymous {
            bootstrap_required: false
        }
    ));
    assert!(!identity.storage.bootstrap_required().await?);
    storage.shutdown().await;
    Ok(())
}

#[tokio::test]
async fn cross_origin_ambiguous_headers_and_unbounded_bodies_fail_closed() -> TestResult {
    let (_directory, storage, _identity, router) = fixture().await?;
    for (name, value) in [
        ("origin", "https://attacker.example"),
        ("host", "attacker.example"),
        ("sec-fetch-site", "same-site"),
        ("content-type", "text/plain"),
        ("x-snaptium-request", "wrong"),
    ] {
        let mut request = request("/api/v1/auth/login", "{}")?;
        request
            .headers_mut()
            .insert(name, HeaderValue::from_str(value)?);
        assert_eq!(
            router.clone().oneshot(request).await?.status(),
            StatusCode::FORBIDDEN
        );
    }
    let mut duplicate = request("/api/v1/auth/login", "{}")?;
    duplicate
        .headers_mut()
        .append("origin", HeaderValue::from_static("https://notes.example"));
    assert_eq!(
        router.clone().oneshot(duplicate).await?.status(),
        StatusCode::FORBIDDEN
    );
    let mut no_origin = request("/api/v1/auth/login", "{}")?;
    no_origin.headers_mut().remove("origin");
    assert_eq!(
        router.clone().oneshot(no_origin).await?.status(),
        StatusCode::FORBIDDEN
    );
    let response = router
        .clone()
        .oneshot(request("/api/v1/auth/login", &"x".repeat(4097))?)
        .await?;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let response = router
        .clone()
        .oneshot(request(
            "/api/v1/auth/login",
            r#"{"login":"alice","password":"sensitive-value","owner":"evil"}"#,
        )?)
        .await?;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = String::from_utf8(to_bytes(response.into_body(), 4096).await?.to_vec())?;
    assert!(
        !body.contains("sensitive-value") && !body.contains("evil"),
        "error leaked input"
    );
    let mut duplicate_cookie = read_request(None)?;
    duplicate_cookie.headers_mut().insert(
        header::COOKIE,
        HeaderValue::from_str(&format!(
            "__Host-snaptium_session={0}; __Host-snaptium_session={0}",
            "ab".repeat(32)
        ))?,
    );
    assert_eq!(
        router.clone().oneshot(duplicate_cookie).await?.status(),
        StatusCode::UNAUTHORIZED
    );
    storage.shutdown().await;
    Ok(())
}

#[tokio::test]
async fn forwarded_headers_cannot_bypass_peer_throttle() -> TestResult {
    let (_directory, storage, _identity, router) = fixture().await?;
    for value in 0..11 {
        let mut request = request("/api/v1/auth/login", "{}")?;
        request.headers_mut().insert(
            "x-forwarded-for",
            HeaderValue::from_str(&format!("192.0.2.{value}"))?,
        );
        let response = router.clone().oneshot(request).await?;
        if value < 10 {
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        } else {
            assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
            assert_eq!(response.headers()[header::RETRY_AFTER], "60");
            let body = String::from_utf8(to_bytes(response.into_body(), 4096).await?.to_vec())?;
            assert!(body.contains("authentication_rejected"));
        }
    }
    storage.shutdown().await;
    Ok(())
}
