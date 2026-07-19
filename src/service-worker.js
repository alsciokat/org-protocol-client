// Background service worker: seeds settings on install and, when the toolbar
// button is clicked (or the shortcut fires), either captures the page straight
// away or injects an in-page menu so the user can pick a capture scheme.
// Licensed under MIT — see LICENSE.

import { initializeSettings, loadSettings } from "./settings.js";

chrome.runtime.onInstalled.addListener(() => {
	initializeSettings();
});

// The in-page menu cannot open the options page itself, so it asks us to.
chrome.runtime.onMessage.addListener((message) => {
	if (message?.type === "openOptions") {
		chrome.runtime.openOptionsPage();
	}
});

// Inject an ES module into the tab and call one of its exports. Dynamic import
// keeps the injected code sharing capture.js/settings.js instead of duplicating
// them; the modules are listed in web_accessible_resources so the page can load
// them.
function runInTab(tabId, moduleFile, exportName) {
	return chrome.scripting.executeScript({
		target: { tabId },
		func: (url, fn) => import(url).then((module) => module[fn]()),
		args: [chrome.runtime.getURL(moduleFile), exportName],
	});
}

chrome.action.onClicked.addListener(async (tab) => {
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