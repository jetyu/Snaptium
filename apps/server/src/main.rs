use snaptium_server::{
    configuration::{Settings, read_bootstrap_secret},
    storage::ServerStorage,
    web_identity::WebIdentity,
};
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let settings = Settings::from_env()?;
    if !settings.web_dir.join("index.html").is_file() {
        return Err("web build missing; run pnpm build:web before starting the server".into());
    }
    let mut storage = None;
    let app = if let Some(identity) = settings.identity {
        let authority = match identity.secret_file {
            Some(path) => Some(read_bootstrap_secret(path).await?),
            None => None,
        };
        let database = Arc::new(ServerStorage::open_identity(&identity.directory).await?);
        let identity = match WebIdentity::new(database.clone(), identity.policy, authority).await {
            Ok(identity) => Arc::new(identity),
            Err(error) => {
                database.shutdown().await;
                return Err(error.into());
            }
        };
        storage = Some(database);
        snaptium_server::router_with_identity(settings.web_dir, identity)
    } else {
        snaptium_server::router(settings.web_dir)
    };
    let listener = tokio::net::TcpListener::bind(settings.listen).await?;
    println!("snaptium server started");
    let result = axum::serve(
        listener,
        app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await;
    if let Some(storage) = storage {
        storage.shutdown().await;
    }
    result?;
    Ok(())
}

async fn shutdown_signal() {
    #[cfg(unix)]
    if let Ok(mut terminate) =
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
    {
        tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = terminate.recv() => {} }
        return;
    }
    let _ = tokio::signal::ctrl_c().await;
}
