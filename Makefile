all:
	bundle exec jekyll build

serve:
	bundle exec jekyll serve --incremental

.PHONY: all serve
