# gamey

This folder contains the Rust implementation of the game engine. 

## Requirements 

In order to compile and run the code, it is necessary to have [cargo](https://doc.rust-lang.org/cargo/) which is part of [Rust](https://rust-lang.org/).

## Build

```sh
cargo build
```

For a release build with optimizations:

```sh
cargo build --release
```

## Run

```sh
cargo run
```

## Test

```sh
cargo test
```

Run API integration tests explicitly:

```sh
cargo test --test games_api_tests
```

### API error contract

The bot server returns HTTP status codes for API validation and game rule errors.

- `400 Bad Request` for invalid inputs (invalid board size, malformed coordinates, missing game, etc.)
- `409 Conflict` when trying to play on an occupied cell (In the current state of implementation it shouldn't happen, this is just for future-proofing)

Occupied-cell responses include an explanatory message, for example:

```json
{
	"message": "Could not apply move: Player 1 tries to place a stone on an occupied position: 2 0 0"
}
```

## Benchmarks

Run the benchmarks using Criterion:

```sh
cargo bench
```

## Fuzz Testing

Run fuzz tests using cargo-fuzz (requires nightly Rust):

```sh
cargo install cargo-fuzz
cargo +nightly fuzz run fuzz_yen_deserialize
cargo +nightly fuzz run fuzz_coordinates
```

## Documentation

Generate and open the documentation:

```sh
cargo doc --open
```
