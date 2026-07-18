// Background service worker: seeds settings on install and injects the capture
// script when the user clicks the toolbar button or presses the shortcut.
// Licensed under MIT — see LICENSE.

import { initializeSettings } from "./settings.js";

chrome.runtime.onInstalled.addListener(() => {
  initializeSettings();
});

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["src/capture.js"],
  });
});
