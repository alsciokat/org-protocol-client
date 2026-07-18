// Wires the settings form to stored preferences.
// Licensed under MIT — see LICENSE.

import { loadSettings, saveSettings } from "../settings.js";

// Maps each setting key to the id of the form control that edits it.
const FIELD_IDS = {
  selectedTemplate: "selected-template",
  selectedProtocol: "selected-protocol",
  unselectedTemplate: "unselected-template",
  unselectedProtocol: "unselected-protocol",
  notifyOnCapture: "notify-on-capture",
  useModernProtocol: "use-modern-protocol",
  debug: "debug",
};

const CHECKBOX_KEYS = new Set(["notifyOnCapture", "useModernProtocol", "debug"]);

function controlFor(key) {
  return document.getElementById(FIELD_IDS[key]);
}

function fillForm(settings) {
  for (const key of Object.keys(FIELD_IDS)) {
    const control = controlFor(key);
    if (CHECKBOX_KEYS.has(key)) control.checked = Boolean(settings[key]);
    else control.value = settings[key];
  }
}

function collectForm() {
  const settings = {};
  for (const key of Object.keys(FIELD_IDS)) {
    const control = controlFor(key);
    settings[key] = CHECKBOX_KEYS.has(key) ? control.checked : control.value;
  }
  return settings;
}

function flashStatus(message) {
  const status = document.getElementById("status");
  status.textContent = message;
  setTimeout(() => (status.textContent = ""), 1500);
}

async function handleSubmit(event) {
  event.preventDefault();
  await saveSettings(collectForm());
  flashStatus("Saved");
}

document.addEventListener("DOMContentLoaded", async () => {
  fillForm(await loadSettings());
  document.getElementById("settings-form").addEventListener("submit", handleSubmit);
});
