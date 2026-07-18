// Single source of truth for the extension's stored preferences.
// Licensed under MIT — see LICENSE.

export const PROTOCOLS = {
  capture: "capture",
  roamRef: "roam-ref",
};

export const DEFAULT_SETTINGS = {
  selectedTemplate: "p",
  selectedProtocol: PROTOCOLS.capture,
  unselectedTemplate: "L",
  unselectedProtocol: PROTOCOLS.capture,
  useModernProtocol: true, // Org 9.0+ query-style `?template=…` links.
  notifyOnCapture: true,
  debug: false,
};

// Preferences saved under old names by earlier versions, mapped to their
// current names so existing installs keep their settings across an update.
const LEGACY_KEYS = {
  overlay: "notifyOnCapture",
  useNewStyleLinks: "useModernProtocol",
};

// Reads stored settings, backfilling missing keys with defaults and translating
// any values still saved under legacy names. Returns the effective settings.
export async function loadSettings() {
  const stored = await chrome.storage.sync.get(null);
  return { ...DEFAULT_SETTINGS, ...migrateLegacyKeys(stored) };
}

export async function saveSettings(settings) {
  await chrome.storage.sync.set(settings);
}

// Ensures storage holds a complete, current-schema settings object. Safe to run
// on every install and update.
export async function initializeSettings() {
  const stored = await chrome.storage.sync.get(null);
  const staleKeys = Object.keys(LEGACY_KEYS).filter((key) => key in stored);

  if (staleKeys.length) {
    await chrome.storage.sync.remove(staleKeys);
  }
  await chrome.storage.sync.set({ ...DEFAULT_SETTINGS, ...migrateLegacyKeys(stored) });
}

function migrateLegacyKeys(stored) {
  const result = { ...stored };
  for (const [oldKey, newKey] of Object.entries(LEGACY_KEYS)) {
    if (oldKey in result) {
      if (!(newKey in result)) result[newKey] = result[oldKey];
      delete result[oldKey];
    }
  }
  return result;
}
