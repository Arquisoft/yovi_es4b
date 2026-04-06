# Use a Rust base image for compilation
FROM rust:latest AS builder

WORKDIR /app/gamey

# Copy Cargo.toml
COPY Cargo.toml ./
COPY src/ ./src/

# Build the application
RUN cargo build --release

# Use a minimal image for the final stage
FROM debian:bookworm-slim

WORKDIR /app/gamey

# Copy the compiled binary from the builder stage
COPY --from=builder /app/gamey/target/release/gamey .

# Expose the port gamey will listen on
EXPOSE 4000

# Run the gamey server on port 4000
CMD ["./gamey", "--mode", "server", "--port", "4000"]
