.PHONY: build clean dev deploy


dev: dev-compiler

dev-compiler:
	cd compiler; zig build --prefix-exe-dir ../../app/src/assets --watch

dev-app:
	cd app; npm run dev
	
build: build-compiler build-app

build-compiler:
	cd compiler; zig build --prefix-exe-dir ../../app/src/assets -Doptimize=ReleaseSmall

build-app:
	cd app; npm run build
