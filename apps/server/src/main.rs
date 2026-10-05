use std::{net::SocketAddr, path::PathBuf};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let listen: SocketAddr = setting("SNAPTIUM_LISTEN", "127.0.0.1:3000")?.parse()?;
    let web_dir = PathBuf::from(setting("SNAPTIUM_WEB_DIR", "apps/web/dist")?);
    if !web_dir.join("index.html").is_file() {
        return Err("web build missing; run pnpm build:web before starting the server".into());
    }
    let listener = tokio::net::TcpListener::bind(listen).await?;
    println!("snaptium server started");
    axum::serve(listener, snaptium_server::router(web_dir))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}

fn setting(name: &str, default: &str) -> Result<String, Box<dyn std::error::Error>> {
    match std::env::var(name) {
        Ok(value) if !value.trim().is_empty() => Ok(value),
        Ok(_) => Err("configuration value must not be empty".into()),
        Err(std::env::VarError::NotPresent) => Ok(default.into()),
        Err(_) => Err("configuration value must be valid Unicode".into()),
    }
}
