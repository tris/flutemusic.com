all: install
	npm run build

serve: install
	npm run dev

test: all
	npm test

install:
	npm install --silent

.PHONY: all serve test install
