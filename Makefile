all: install
	npm run build

serve: install
	npm run dev

install:
	npm ci

.PHONY: all serve install
