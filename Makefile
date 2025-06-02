.PHONY: build clean dev deploy

build: build-wasm build-ts

build-wasm:
	zig build -Doptimize=ReleaseSmall

build-ts:
	tsc
