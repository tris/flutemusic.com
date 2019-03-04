all: install
	bundle exec jekyll build

serve: install
	bundle exec jekyll serve --incremental

install:
	bundle install --quiet

.PHONY: all serve install
