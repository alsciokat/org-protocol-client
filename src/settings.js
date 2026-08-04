// Manage storing and loading settings
// Licensed under MIT — see LICENSE.

// transport layer specification
// the protocol format specification
export const PARAM = {
	template: "Template",
	title: "Title",
	url: "URL",
	ref: "Ref",
	body: "Body",
};

export const PARAM_TYPE = {
	key: "key",
	href: "href",
	title: "title",
	selection: "selection",
};

export const SUB_PROTO = {
	capture: "capture",
	roamRef: "roam-ref",
	storeLink: "store-link",
	openSource: "open-source",
};

export const SUB_PROTO_SCHEME = {
	[SUB_PROTO.capture]: [PARAM.template, PARAM.url, PARAM.title, PARAM.body],
	[SUB_PROTO.roamRef]: [PARAM.template, PARAM.ref, PARAM.title, PARAM.body],
	[SUB_PROTO.storeLink]: [PARAM.url, PARAM.title],
	[SUB_PROTO.openSource]: [PARAM.url],
};

// application layer specification
// protocol usage specification
export const DEFAULT_SETTINGS = {
	paramSpec: {
		[PARAM.template]: {
			urlKey: "template",
			type: PARAM_TYPE.key,
		},
		[PARAM.title]: {
			urlKey: "title",
			type: PARAM_TYPE.title,
		},
		[PARAM.url]: {
			urlKey: "url",
			type: PARAM_TYPE.href,
		},
		[PARAM.ref]: {
			urlKey: "ref",
			type: PARAM_TYPE.href,
		},
		[PARAM.body]: {
			urlKey: "body",
			type: PARAM_TYPE.selection,
		},
	},
	subProtoScheme: SUB_PROTO_SCHEME,
	schemeSpec: {
		"Capture link": {
			description: "Capture link using org-capture",
			subProtocol: SUB_PROTO.capture,
			template: "[",
			params: [PARAM.url, PARAM.title],
		},
		"Capture selection": {
			description: "Capture selection using org-capture",
			subProtocol: SUB_PROTO.capture,
			template: "]",
			params: [PARAM.url, PARAM.title, PARAM.body],
		},
		"Store link": {
			description: "Store link for org-insert-link (C-c C-l)",
			subProtocol: SUB_PROTO.storeLink,
			template: null,
			params: [PARAM.url, PARAM.title],
		},
		"Open source": {
			description: "Open local file in org-protocol-project-alist",
			subProtocol: SUB_PROTO.openSource,
			template: null,
			params: [PARAM.url],
		},
	},
	defaultTextScheme: "Capture selection",
	defaultLinkScheme: "Capture link",
	quickCapture: false,
	contextMenu: true,
	debug: false,
};

// Template keys are dropped into the `template=` query value, so trim
// surrounding whitespace and percent-encode anything unsafe for a URL.
export function sanitizeTemplateKey(raw) {
	return encodeURIComponent((raw ?? "").trim());
}

// Reads stored settings with default fallbacks. Deep-cloned so callers can
// mutate the result (the options page does) without corrupting the shared
// DEFAULT_SETTINGS objects.
export async function loadSettings() {
	const stored = await chrome.storage.sync.get(null);
	return structuredClone({ ...DEFAULT_SETTINGS, ...stored });
}

export async function saveSettings(settings) {
	await chrome.storage.sync.set(settings);
}

// Ensures storage holds a complete, current-schema settings object.
export async function initializeSettings() {
	const stored = await chrome.storage.sync.get(null);
	const staleKeys = Object.keys(stored).filter((key) => !(key in DEFAULT_SETTINGS));
	if (staleKeys.length) {
		await chrome.storage.sync.remove(staleKeys);
	}
	await chrome.storage.sync.set({ ...DEFAULT_SETTINGS, ...stored });
}
