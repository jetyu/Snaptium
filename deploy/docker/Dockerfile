FROM node:22.22.1-bookworm-slim AS web
WORKDIR /build
RUN npm install --global pnpm@11.17.0
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web ./apps/web
COPY packages ./packages
RUN pnpm install --frozen-lockfile && pnpm build:web

FROM rust:1.94.0-bookworm AS server
WORKDIR /build
COPY Cargo.toml rust-toolchain.toml ./
COPY crates ./crates
COPY apps/server ./apps/server
RUN cargo build --release -p snaptium-server

FROM debian:bookworm-slim AS runtime
RUN groupadd --gid 10001 snaptium && useradd --uid 10001 --gid snaptium --no-create-home snaptium \
    && mkdir -p /app/web /data && chown snaptium:snaptium /data
COPY --from=server /build/target/release/snaptium-server /app/snaptium-server
COPY --from=web /build/apps/web/dist /app/web
ENV SNAPTIUM_LISTEN=0.0.0.0:3000 SNAPTIUM_WEB_DIR=/app/web
USER 10001:10001
EXPOSE 3000
ENTRYPOINT ["/app/snaptium-server"]
