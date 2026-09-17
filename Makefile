# Build the extension for each browser. The source is shared; only the manifest
# differs, so a build copies src/, icons/ and LICENSE into dist/<browser>/ next to
# that browser's manifest and zips the result for store upload.
#
#   make            build both
#   make chrome     dist/chrome/ + dist/org-protocol-client-<version>-chrome.zip
#   make firefox    dist/firefox/ + dist/org-protocol-client-<version>-firefox.zip
#   make lint       run web-ext lint on the Firefox build (needs web-ext)
#   make clean      remove dist/

NAME    := org-protocol-client
DIST    := dist
VERSION := $(shell sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.chrome.json)
FFVERSION := $(shell sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.firefox.json)

SOURCES := $(shell find src icons -type f) LICENSE

.PHONY: all chrome firefox lint clean check-version
# Keep the unpacked dist/<browser>/manifest.json; make would otherwise delete it
# as an intermediate of the pattern rules.
.SECONDARY:

all: chrome firefox

chrome: check-version $(DIST)/$(NAME)-$(VERSION)-chrome.zip
firefox: check-version $(DIST)/$(NAME)-$(VERSION)-firefox.zip

# Unpacked build directory for one browser; load this in the browser for
# development. Rebuilt from scratch whenever the manifest or any source changes.
$(DIST)/%/manifest.json: manifest.%.json $(SOURCES)
	rm -rf $(DIST)/$*
	mkdir -p $(DIST)/$*
	cp -r src icons LICENSE $(DIST)/$*/
	cp $< $@

$(DIST)/$(NAME)-$(VERSION)-%.zip: $(DIST)/%/manifest.json
	rm -f $@
	cd $(DIST)/$* && zip -qr ../$(notdir $@) . -x '*~' '.#*' '*/.#*'
	@echo "built $@"

# Both manifests must carry the same version so the two store uploads match.
check-version:
	@test -n "$(VERSION)" || { echo "could not read version from manifest.chrome.json"; exit 1; }
	@test "$(VERSION)" = "$(FFVERSION)" || { \
		echo "version mismatch: chrome=$(VERSION) firefox=$(FFVERSION)"; exit 1; }

lint: $(DIST)/firefox/manifest.json
	web-ext lint --source-dir $(DIST)/firefox

clean:
	rm -rf $(DIST)
