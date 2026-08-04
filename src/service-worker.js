// Background service worker: seeds settings on install and, when the toolbar
// button is clicked (or the shortcut fires), either captures the page straight
// away or injects an in-page menu so the user can pick a capture scheme.
// Licensed under MIT — see LICENSE.

import { initializeSettings, loadSettings } from "./settings.js";

// The context-menu tree is a single parent whose children are the capture
// schemes. Child item ids carry their scheme name after this prefix.
const MENU_PARENT_ID = "org-protocol-menu";
const MENU_ITEM_PREFIX = "org-protocol-scheme:";
const MENU_CONTEXTS = ["page", "selection"];

// Capture works by injecting a script into the tab, which Chrome only allows on
// regular web pages. Restrict the menu to these so it never appears on
// chrome://, chrome-extension://, the Web Store, etc., where a click would only
// fail. The same set gates the toolbar/menu click handlers as a backstop.
const MENU_DOCUMENT_PATTERNS = ["http://*/*", "https://*/*", "file://*/*"];

function isCapturableUrl(url) {
	return typeof url === "string" && /^(https?|file):\/\//i.test(url);
}

chrome.runtime.onInstalled.addListener(async () => {
	await initializeSettings();
	refreshContextMenu();
});

// Service workers are torn down between events, so rebuild the menu on startup
// too — contextMenus entries do not survive the worker being suspended.
chrome.runtime.onStartup.addListener(() => {
	refreshContextMenu();
});

// Keep the menu in sync when schemes are added/renamed or the toggle changes.
chrome.storage.onChanged.addListener((_changes, area) => {
	if (area === "sync") {
		refreshContextMenu();
	}
});

// Rebuild the "Send to Emacs" context menu from current settings. Cleared and
// recreated wholesale so scheme edits (and the on/off toggle) are always
// reflected exactly. Refreshes are serialized through this promise chain:
// several triggers can fire close together (install writes settings, which in
// turn fires storage.onChanged), and letting two runs interleave their async
// removeAll/create would create duplicate ids.
let refreshChain = Promise.resolve();

function refreshContextMenu() {
	refreshChain = refreshChain
		.then(rebuildContextMenu)
		.catch((error) => console.error("[org-capture] context menu:", error));
	return refreshChain;
}

async function rebuildContextMenu() {
	await chrome.contextMenus.removeAll();
	const settings = await loadSettings();
	const names = Object.keys(settings.schemeSpec);
	if (!settings.contextMenu || names.length === 0) {
		return;
	}
	createMenu({
		id: MENU_PARENT_ID,
		title: "Send to Emacs",
		contexts: MENU_CONTEXTS,
		documentUrlPatterns: MENU_DOCUMENT_PATTERNS,
	});
	for (const name of names) {
		createMenu({
			id: MENU_ITEM_PREFIX + name,
			parentId: MENU_PARENT_ID,
			title: name,
			contexts: MENU_CONTEXTS,
			documentUrlPatterns: MENU_DOCUMENT_PATTERNS,
		});
	}
}

// contextMenus.create reports failures through lastError rather than throwing,
// so without a callback they surface as "Unchecked runtime.lastError" noise.
// Check it here so one bad item is logged and swallowed instead of leaving the
// rebuild looking broken.
function createMenu(properties) {
	chrome.contextMenus.create(properties, () => {
		const error = chrome.runtime.lastError;
		if (error) {
			console.error("[org-capture] context menu:", error.message);
		}
	});
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	const id = info.menuItemId;
	if (typeof id !== "string" || !id.startsWith(MENU_ITEM_PREFIX) || !tab?.id) {
		return;
	}
	if (!isCapturableUrl(info.pageUrl)) {
		console.warn("[org-capture] cannot capture this page:", info.pageUrl);
		return;
	}
	const schemeName = id.slice(MENU_ITEM_PREFIX.length);
	try {
		await runInTab(tab.id, "src/capture.js", "capture", schemeName);
	} catch (error) {
		console.error("[org-capture] could not capture this page:", error);
	}
});

// The in-page menu cannot open the options page itself, so it asks us to.
chrome.runtime.onMessage.addListener((message) => {
	if (message?.type === "openOptions") {
		chrome.runtime.openOptionsPage();
	}
});

// Inject an ES module into the tab and call one of its exports, forwarding any
// extra arguments. Dynamic import keeps the injected code sharing
// capture.js/settings.js instead of duplicating them; the modules are listed in
// web_accessible_resources so the page can load them.
function runInTab(tabId, moduleFile, exportName, ...callArgs) {
	return chrome.scripting.executeScript({
		target: { tabId },
		func: (url, fn, args) => import(url).then((module) => module[fn](...args)),
		args: [chrome.runtime.getURL(moduleFile), exportName, callArgs],
	});
}

chrome.action.onClicked.addListener(async (tab) => {
	if (!isCapturableUrl(tab.url)) {
		console.warn("[org-capture] cannot capture this page:", tab.url);
		return;
	}
	try {
		const settings = await loadSettings();
		if (settings.quickCapture) {
			await runInTab(tab.id, "src/capture.js", "quickCapture");
		} else {
			await runInTab(tab.id, "src/menu.js", "openMenu");
		}
	} catch (error) {
		console.error("[org-capture] could not capture this page:", error);
	}
});