//! Real listener/process smoke test using only disposable data and credentials.
use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    path::Path,
    process::{Child, Command, Stdio},
    time::{Duration, Instant},
};

struct Server(Child);
impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
fn start(
    directory: &Path,
    secret: bool,
) -> Result<(Server, SocketAddr), Box<dyn std::error::Error>> {
    let reserve = TcpListener::bind("127.0.0.1:0")?;
    let address = reserve.local_addr()?;
    drop(reserve);
    let mut command = Command::new(env!("CARGO_BIN_EXE_snaptium-server"));
    command
        .env("SNAPTIUM_LISTEN", address.to_string())
        .env("SNAPTIUM_WEB_DIR", directory.join("web"))
        .env("SNAPTIUM_DATA_DIR", directory.join("data"))
        .env("SNAPTIUM_PUBLIC_ORIGIN", format!("http://{address}"))
        .env("SNAPTIUM_ALLOW_HTTP_LOOPBACK", "true")
        .env_remove("SNAPTIUM_BOOTSTRAP_SECRET_FILE")
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if secret {
        command.env("SNAPTIUM_BOOTSTRAP_SECRET_FILE", directory.join("secret"));
    }
    let mut server = Server(command.spawn()?);
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        if TcpStream::connect_timeout(&address, Duration::from_millis(100)).is_ok() {
            break;
        }
        if server.0.try_wait()?.is_some() || Instant::now() >= deadline {
            return Err("test server did not start".into());
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    Ok((server, address))
}
fn http(
    address: SocketAddr,
    method: &str,
    path: &str,
    body: &str,
    extra: &str,
) -> Result<(String, String), Box<dyn std::error::Error>> {
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_secs(2))?;
    stream.set_read_timeout(Some(Duration::from_secs(3)))?;
    stream.set_write_timeout(Some(Duration::from_secs(3)))?;
    write!(
        stream,
        "{method} {path} HTTP/1.1\r\nHost: {address}\r\nOrigin: http://{address}\r\nX-Snaptium-Request: web-v1\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n{extra}\r\n{body}",
        body.len()
    )?;
    let mut response = String::new();
    stream.take(16385).read_to_string(&mut response)?;
    let (headers, body) = response
        .split_once("\r\n\r\n")
        .ok_or("invalid test HTTP response")?;
    Ok((headers.into(), body.into()))
}
fn session_cookie(headers: &str) -> Result<String, Box<dyn std::error::Error>> {
    let header = headers
        .lines()
        .find(|line| line.to_ascii_lowercase().starts_with("set-cookie:"))
        .ok_or("missing test cookie")?;
    Ok(header
        .split_once(':')
        .ok_or("invalid test cookie")?
        .1
        .trim()
        .split(';')
        .next()
        .ok_or("invalid test cookie")?
        .into())
}

#[test]
fn configured_process_persists_admin_but_not_browser_sessions()
-> Result<(), Box<dyn std::error::Error>> {
    let directory = tempfile::tempdir()?;
    std::fs::create_dir(directory.path().join("web"))?;
    std::fs::write(
        directory.path().join("web/index.html"),
        "<!doctype html><div id=\"app\"></div>",
    )?;
    std::fs::write(directory.path().join("secret"), "ab".repeat(32))?;
    let (server, address) = start(directory.path(), true)?;
    let (headers, body) = http(address, "GET", "/api/v1/health", "", "")?;
    assert!(headers.starts_with("HTTP/1.1 200"));
    let health: serde_json::Value = serde_json::from_str(&body)?;
    assert!(health["mode"] == "identity" && health["status"] == "initialization_required");
    let bootstrap = serde_json::json!({"login":"alice", "password":"test password 长度足够 123", "initializationSecret":"ab".repeat(32)}).to_string();
    let (headers, _) = http(address, "POST", "/api/v1/auth/bootstrap", &bootstrap, "")?;
    assert!(headers.starts_with("HTTP/1.1 204"));
    let credentials = r#"{"login":"alice","password":"test password 长度足够 123"}"#;
    let (headers, body) = http(address, "POST", "/api/v1/auth/login", credentials, "")?;
    assert!(headers.starts_with("HTTP/1.1 200"));
    let first_cookie = session_cookie(&headers)?;
    assert!(first_cookie.starts_with("snaptium_dev_session="));
    let session: snaptium_protocol::SessionView = serde_json::from_str(&body)?;
    assert!(matches!(
        session,
        snaptium_protocol::SessionView::Authenticated { .. }
    ));
    drop(server); // Forced process stop verifies committed SQLite state, not just an Arc reset.
    let (server, address) = start(directory.path(), false)?;
    let (_, body) = http(
        address,
        "GET",
        "/api/v1/auth/session",
        "",
        &format!("Cookie: {first_cookie}\r\n"),
    )?;
    let session: snaptium_protocol::SessionView = serde_json::from_str(&body)?;
    assert!(matches!(
        session,
        snaptium_protocol::SessionView::Anonymous {
            bootstrap_required: false
        }
    ));
    let (headers, _) = http(address, "POST", "/api/v1/auth/bootstrap", &bootstrap, "")?;
    assert!(headers.starts_with("HTTP/1.1 401"));
    let (headers, body) = http(address, "POST", "/api/v1/auth/login", credentials, "")?;
    assert!(headers.starts_with("HTTP/1.1 200"));
    let new_cookie = session_cookie(&headers)?;
    let csrf = match serde_json::from_str::<snaptium_protocol::SessionView>(&body)? {
        snaptium_protocol::SessionView::Authenticated { csrf_token, .. } => csrf_token,
        _ => return Err("restarted sign-in failed".into()),
    };
    let (headers, _) = http(
        address,
        "POST",
        "/api/v1/auth/logout",
        "{}",
        &format!("Cookie: {new_cookie}\r\nX-CSRF-Token: {csrf}\r\n"),
    )?;
    assert!(headers.starts_with("HTTP/1.1 204"));
    drop(server);
    Ok(())
}
