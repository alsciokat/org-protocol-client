// Page-context capture helpers. These are injected (as an ES module) into the
// active tab, so they run with access to the DOM and to chrome.storage. They
// build an org-protocol URL for the current page and hand it to Emacs by
// navigating to it.
// Licensed under MIT — see LICENSE.

import { loadSettings, sanitizeTemplateKey, PARAM_TYPE } from "./settings.js";

// encodeURIComponent leaves ( ) ' intact, but Org's link parser treats them
// specially, so percent-encode them too.
function orgEscape(text) {
	return encodeURIComponent(text)
		.replace(/\(/g, "%28")
		.replace(/\)/g, "%29")
		.replace(/'/g, "%27");
}

// Undo the URL's own percent-encoding so filenames survive the round trip to
// Emacs (which decodes the org-protocol link exactly once). Malformed escapes
// would make decodeURIComponent throw, so fall back to the raw href.
function decodedHref() {
	try {
		return decodeURIComponent(location.href);
	} catch {
		return location.href;
	}
}

// Resolve each of the scheme's parameters from the page according to its
// declared type. Key-type params ask the user for a template key on the spot;
// returns null if that prompt is cancelled.
function getPageContext(params, settings) {
	const context = {};
	for (const param of params) {
		const spec = settings.paramSpec[param];
		if (!spec) {
			continue; // param was deleted from the registry
		}
		switch (spec.type) {
		case PARAM_TYPE.key: {
			const key = window.prompt(`Template key for "${param}":`);
			if (key === null) {
				return null; // user cancelled the capture
			}
			context[param] = sanitizeTemplateKey(key);
			break;
		}
		case PARAM_TYPE.href:
			context[param] = orgEscape(decodedHref());
			break;
		case PARAM_TYPE.title:
			context[param] = orgEscape(document.title);
			break;
		case PARAM_TYPE.selection:
			context[param] = orgEscape(window.getSelection().toString());
			break;
		}
	}
	return context;
}

// The query key a fixed template value is sent under: the key-type param's
// urlKey, falling back to org-protocol's conventional "template".
function templateUrlKey(paramSpec) {
	for (const spec of Object.values(paramSpec)) {
		if (spec.type === PARAM_TYPE.key) {
			return spec.urlKey;
		}
	}
	return "template";
}

function buildOrgProtocolUrl(schemeSpec, settings) {
	const context = getPageContext(schemeSpec.params, settings);
	if (context === null) {
		return null;
	}

	const query = [];
	if (schemeSpec.template) {
		query.push(`${templateUrlKey(settings.paramSpec)}=${schemeSpec.template}`);
	}
	for (const param of schemeSpec.params) {
		const spec = settings.paramSpec[param];
		if (spec && param in context) {
			query.push(`${spec.urlKey}=${context[param]}`);
		}
	}
	return "org-protocol://" + schemeSpec.subProtocol + "?" + query.join("&");
}

// Build the org-protocol URL for the named scheme and hand it to Emacs by
// navigating the current page to it.
export async function capture(schemeName) {
	const settings = await loadSettings();
	const schemeSpec = settings.schemeSpec[schemeName];
	if (!schemeSpec) {
		throw new Error(`unknown capture scheme: ${schemeName}`);
	}
	const url = buildOrgProtocolUrl(schemeSpec, settings);
	if (url === null) {
		return; // cancelled at the template prompt
	}
	if (settings.debug) {
		console.log("[org-capture] navigating to:", url);
	}
	location.href = url;
}

// Capture straight away, picking the scheme from whether text is selected.
export async function quickCapture() {
	const settings = await loadSettings();
	const hasSelection = window.getSelection().toString().length > 0;
	await capture(hasSelection ? settings.defaultTextScheme : settings.defaultLinkScheme);
}
