Place the TLS certificate and private key for the gateway in this directory.

Expected default filenames:

- `server.crt`
- `server.key`

If you prefer different names or paths, update these gateway environment variables:

- `HTTPS_CERT_PATH`
- `HTTPS_KEY_PATH`

This folder is mounted read-only into the `gateway` container as `/app/certs`.
