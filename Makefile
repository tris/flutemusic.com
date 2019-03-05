all: install
	bundle exec jekyll build

serve: install
	bundle exec jekyll serve --incremental

install:
	gem list bundler | grep bundler >/dev/null || sudo gem install bundler
	bundle install --quiet

.PHONY: all serve install
