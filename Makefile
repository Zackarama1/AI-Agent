# Convenience targets. Run `make` to start the app locally.
.DEFAULT_GOAL := run

.PHONY: run
run:            ## Set up (if needed) and start the app locally
	./run.sh

.PHONY: docker-build
docker-build:   ## Build the production container image
	docker build -t concierge-booking .

.PHONY: docker-run
docker-run:     ## Run the production image locally on :8000
	docker run --rm -p 8000:8000 -e ANTHROPIC_API_KEY="$${ANTHROPIC_API_KEY:-}" concierge-booking

.PHONY: deploy-fly
deploy-fly:     ## Deploy to Fly.io (needs: flyctl, `fly auth login`)
	fly launch --copy-config --ha=false || fly deploy

.PHONY: test
test:           ## Run the reliability harness against the sample tasks
	python run_reliability_test.py --tasks tasks/ --repeats 3
