.PHONY: dev build deploy frontend backend clean

# Frontend build
frontend:
	cd frontend && npm ci && npm run build

# Backend build (requires frontend first)
backend: frontend
	cargo install -q worker-build && worker-build --release

# Full build
build: backend

# Deploy to Cloudflare
deploy: build
	npx wrangler deploy

# Frontend dev server (proxy to wrangler dev)
dev:
	cd frontend && npm run dev

# Clean build artifacts
clean:
	rm -rf frontend/dist build
