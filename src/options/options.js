// Wires the settings page to stored preferences. Lets the user build any number
// of org-protocol schemes, restricting each one's parameters to those its
// sub-protocol accepts (per settings.subProtoScheme). The Advanced section
// edits the sub-protocol and parameter registries themselves.
// Licensed under MIT — see LICENSE.

import {
  loadSettings,
  saveSettings,
  sanitizeTemplateKey,
  DEFAULT_SETTINGS,
  PARAM_TYPE,
} from "../settings.js";

// Populated from the loaded settings so user-editable definitions are the
// source of truth everywhere below.
let paramSpec;
let subProtoScheme;

const TYPE_LABELS = {
  [PARAM_TYPE.key]: "Template key (asked at capture)",
  [PARAM_TYPE.href]: "Page URL",
  [PARAM_TYPE.path]: "Page URL, decoded (for local files)",
  [PARAM_TYPE.title]: "Page title",
  [PARAM_TYPE.selection]: "Selected text",
};

// The param that carries a template key, if the registry still has one.
function templateParamName() {
  return Object.keys(paramSpec).find(
    (name) => paramSpec[name].type === PARAM_TYPE.key,
  );
}

// Params a sub-protocol accepts that still exist in the registry.
function allowedParams(subProtocol) {
  return (subProtoScheme[subProtocol] ?? []).filter((p) => p in paramSpec);
}

// A fixed template key can be set when the sub-protocol accepts a key-type param.
function allowsTemplate(subProtocol) {
  return allowedParams(subProtocol).some(
    (p) => paramSpec[p].type === PARAM_TYPE.key,
  );
}

function decodeTemplateKey(stored) {
  try {
    return decodeURIComponent(stored ?? "");
  } catch {
    return stored ?? "";
  }
}

function isUrlSafe(text) {
  return encodeURIComponent(text) === text;
}

// --- In-memory state: the source of truth the form edits ---------------------

let state = null;
let uid = 0;

// Turn stored settings into editable state, dropping any param a scheme's
// sub-protocol does not actually allow.
function toState(settings) {
  const schemes = Object.entries(settings.schemeSpec).map(([name, spec]) => ({
    name,
    description: spec.description ?? "",
    subProtocol: spec.subProtocol,
    template: decodeTemplateKey(spec.template),
    params: new Set(
      allowedParams(spec.subProtocol).filter((p) => spec.params?.includes(p)),
    ),
  }));
  return {
    schemes,
    defaultTextScheme: settings.defaultTextScheme,
    defaultLinkScheme: settings.defaultLinkScheme,
    quickCapture: Boolean(settings.quickCapture),
    debug: Boolean(settings.debug),
  };
}

function uniqueName(base) {
  const names = new Set(state.schemes.map((s) => s.name));
  if (!names.has(base)) return base;
  let i = 2;
  while (names.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

function newScheme() {
  const subProtocol = Object.keys(subProtoScheme)[0] ?? "";
  return {
    name: uniqueName("New protocol"),
    description: "",
    subProtocol,
    template: "",
    // Preselect everything except key-type params, which default to a fixed key.
    params: new Set(
      allowedParams(subProtocol).filter(
        (p) => paramSpec[p].type !== PARAM_TYPE.key,
      ),
    ),
  };
}

// --- Rendering ---------------------------------------------------------------

// Small labeled-control helper; buildControl receives the id to bind the label.
function field(labelText, buildControl) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const id = `f${uid++}`;
  const label = document.createElement("label");
  label.setAttribute("for", id);
  label.textContent = labelText;
  wrap.append(label, buildControl(id));
  return wrap;
}

function chip(labelText, checked, onChange) {
  const wrap = document.createElement("label");
  wrap.className = "chip";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  checkbox.addEventListener("change", () => onChange(checkbox.checked));
  const text = document.createElement("span");
  text.textContent = labelText;
  wrap.append(checkbox, text);
  return wrap;
}

// The checkboxes are generated from the sub-protocol's allowed set, so a
// disallowed parameter can never be selected in the first place.
function renderParams(scheme, onKeyParamToggle) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "params";
  const legend = document.createElement("legend");
  legend.textContent = "Parameters";
  fieldset.append(legend);

  const params = allowedParams(scheme.subProtocol);
  if (params.length === 0) {
    const empty = document.createElement("p");
    empty.className = "params__empty";
    empty.textContent = "This sub-protocol takes no parameters.";
    fieldset.append(empty);
    return fieldset;
  }

  for (const name of params) {
    fieldset.append(
      chip(name, scheme.params.has(name), (on) => {
        if (on) scheme.params.add(name);
        else scheme.params.delete(name);
        // Selecting a key-type param switches the scheme from a fixed template
        // key to asking at capture time, so the template field must follow.
        if (paramSpec[name].type === PARAM_TYPE.key) onKeyParamToggle();
      }),
    );
  }
  return fieldset;
}

function createCard(scheme) {
  const card = document.createElement("section");
  card.className = "protocol";

  const nameField = field("Name", (id) => {
    const input = document.createElement("input");
    input.id = id;
    input.type = "text";
    input.autocomplete = "off";
    input.value = scheme.name;
    input.addEventListener("input", () => {
      const oldName = scheme.name;
      scheme.name = input.value;
      // Keep the default selectors pinned to this scheme through a rename.
      if (state.defaultTextScheme === oldName) state.defaultTextScheme = scheme.name;
      if (state.defaultLinkScheme === oldName) state.defaultLinkScheme = scheme.name;
      renderDefaults();
    });
    return input;
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "btn btn--danger";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => {
    state.schemes = state.schemes.filter((s) => s !== scheme);
    card.remove();
    renderDefaults();
  });

  const head = document.createElement("div");
  head.className = "protocol__head";
  head.append(nameField, deleteButton);

  const descriptionField = field("Description", (id) => {
    const input = document.createElement("input");
    input.id = id;
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = "What this protocol does";
    input.value = scheme.description;
    input.addEventListener("input", () => {
      scheme.description = input.value;
    });
    return input;
  });

  const subField = field("Sub-protocol", (id) => {
    const select = document.createElement("select");
    select.id = id;
    for (const sub of Object.keys(subProtoScheme)) {
      const option = document.createElement("option");
      option.value = sub;
      option.textContent = sub;
      select.append(option);
    }
    select.value = scheme.subProtocol;
    select.addEventListener("change", () => {
      scheme.subProtocol = select.value;
      // Drop params the new sub-protocol no longer allows.
      const allowed = new Set(allowedParams(scheme.subProtocol));
      scheme.params = new Set([...scheme.params].filter((p) => allowed.has(p)));
      renderVariant();
    });
    return select;
  });

  // Template + params depend on the chosen sub-protocol, so they re-render when
  // it changes.
  const variant = document.createElement("div");
  variant.className = "protocol__variant";

  function renderVariant() {
    variant.replaceChildren();
    if (!allowsTemplate(scheme.subProtocol)) {
      scheme.template = "";
    }
    // A checked key-type param means "ask at capture time", which replaces the
    // fixed template key field.
    const keyName = templateParamName();
    const asksAtCapture = keyName && scheme.params.has(keyName);
    if (allowsTemplate(scheme.subProtocol) && !asksAtCapture) {
      variant.append(
        field("Template key", (id) => {
          const input = document.createElement("input");
          input.id = id;
          input.type = "text";
          input.maxLength = 16;
          input.autocomplete = "off";
          input.placeholder = "e.g. t";
          input.value = scheme.template;
          input.addEventListener("input", () => {
            scheme.template = input.value;
          });
          return input;
        }),
      );
    }
    variant.append(renderParams(scheme, renderVariant));
  }

  card.append(head, descriptionField, subField, variant);
  renderVariant();
  return card;
}

function renderProtocols() {
  const host = document.getElementById("protocols");
  host.replaceChildren();
  for (const scheme of state.schemes) host.append(createCard(scheme));
}

// --- Advanced: edit the sub-protocol registry (settings.subProtoScheme) ------

function uniqueKey(object, base) {
  if (!(base in object)) return base;
  let i = 2;
  while (`${base}${i}` in object) i++;
  return `${base}${i}`;
}

// Add or remove a param in a sub-protocol's spec array.
function toggleSpecParam(subProtocol, name, on) {
  const spec = subProtoScheme[subProtocol];
  if (on) {
    if (!spec.includes(name)) spec.push(name);
  } else {
    subProtoScheme[subProtocol] = spec.filter((p) => p !== name);
  }
}

// One card edits a single sub-protocol. Its name is the object key, so renaming
// re-keys the entry (committed on blur). Toggling params mutates its spec
// array, then re-renders the protocol cards so their allowed params follow.
function createSubCard(subName) {
  let currentName = subName;

  const card = document.createElement("section");
  card.className = "protocol";

  const nameField = field("Sub-protocol name", (id) => {
    const input = document.createElement("input");
    input.id = id;
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = "e.g. my-capture";
    input.value = currentName;
    input.addEventListener("change", () => {
      const next = input.value.trim();
      if (next === currentName) return;
      if (!next || next in subProtoScheme) {
        input.value = currentName;
        flashStatus(next ? "That sub-protocol name is taken." : "Sub-protocol needs a name.", true);
        return;
      }
      subProtoScheme[next] = subProtoScheme[currentName];
      delete subProtoScheme[currentName];
      // Follow the rename in any protocol that referenced it.
      for (const s of state.schemes) if (s.subProtocol === currentName) s.subProtocol = next;
      currentName = next;
      renderProtocols();
    });
    return input;
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "btn btn--danger";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => {
    delete subProtoScheme[currentName];
    card.remove();
    renderProtocols();
  });

  const head = document.createElement("div");
  head.className = "protocol__head";
  head.append(nameField, deleteButton);

  const fieldset = document.createElement("fieldset");
  fieldset.className = "params";
  const legend = document.createElement("legend");
  legend.textContent = "Accepted parameters";
  fieldset.append(legend);
  for (const name of Object.keys(paramSpec)) {
    fieldset.append(
      chip(name, subProtoScheme[currentName].includes(name), (on) => {
        toggleSpecParam(currentName, name, on);
        renderProtocols();
      }),
    );
  }

  card.append(head, fieldset);
  return card;
}

function renderSubProtocols() {
  const host = document.getElementById("sub-protocols");
  host.replaceChildren();
  for (const name of Object.keys(subProtoScheme)) host.append(createSubCard(name));
}

// --- Advanced: edit the parameter registry (settings.paramSpec) --------------

// One card edits a single parameter: its name (the object key — renames re-key
// the entry and follow through sub-protocols and protocols), the query key it
// is sent under, and the page data that fills it.
function createParamCard(paramName) {
  let currentName = paramName;

  const card = document.createElement("section");
  card.className = "protocol";

  const nameField = field("Parameter name", (id) => {
    const input = document.createElement("input");
    input.id = id;
    input.type = "text";
    input.autocomplete = "off";
    input.value = currentName;
    input.addEventListener("change", () => {
      const next = input.value.trim();
      if (next === currentName) return;
      if (!next || next in paramSpec) {
        input.value = currentName;
        flashStatus(next ? "That parameter name is taken." : "Parameter needs a name.", true);
        return;
      }
      paramSpec[next] = paramSpec[currentName];
      delete paramSpec[currentName];
      // Follow the rename wherever the old name was referenced.
      for (const sub of Object.keys(subProtoScheme)) {
        subProtoScheme[sub] = subProtoScheme[sub].map((p) =>
          p === currentName ? next : p,
        );
      }
      for (const s of state.schemes) {
        if (s.params.delete(currentName)) s.params.add(next);
      }
      currentName = next;
      renderSubProtocols();
      renderProtocols();
    });
    return input;
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "btn btn--danger";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => {
    delete paramSpec[currentName];
    for (const sub of Object.keys(subProtoScheme)) {
      subProtoScheme[sub] = subProtoScheme[sub].filter((p) => p !== currentName);
    }
    for (const s of state.schemes) s.params.delete(currentName);
    card.remove();
    renderSubProtocols();
    renderProtocols();
  });

  const head = document.createElement("div");
  head.className = "protocol__head";
  head.append(nameField, deleteButton);

  const urlKeyField = field("URL key", (id) => {
    const input = document.createElement("input");
    input.id = id;
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = "e.g. url";
    input.value = paramSpec[currentName].urlKey;
    input.addEventListener("change", () => {
      const next = input.value.trim();
      if (!next || !isUrlSafe(next)) {
        input.value = paramSpec[currentName].urlKey;
        flashStatus(next ? "URL key must be URL-safe." : "Parameter needs a URL key.", true);
        return;
      }
      paramSpec[currentName].urlKey = next;
    });
    return input;
  });

  const typeField = field("Value", (id) => {
    const select = document.createElement("select");
    select.id = id;
    for (const type of Object.values(PARAM_TYPE)) {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = TYPE_LABELS[type] ?? type;
      select.append(option);
    }
    select.value = paramSpec[currentName].type;
    select.addEventListener("change", () => {
      paramSpec[currentName].type = select.value;
      // Key-type-ness drives the template UI on the protocol cards.
      renderProtocols();
    });
    return select;
  });

  card.append(head, urlKeyField, typeField);
  return card;
}

function renderParamSpecs() {
  const host = document.getElementById("param-specs");
  host.replaceChildren();
  for (const name of Object.keys(paramSpec)) host.append(createParamCard(name));
}

// --- Defaults & behavior -----------------------------------------------------

function fillSchemeSelect(select, selectedName) {
  select.replaceChildren();
  const names = state.schemes.map((s) => s.name);
  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name.trim() || "(unnamed)";
    select.append(option);
  }
  if (names.includes(selectedName)) select.value = selectedName;
  else if (names.length) select.value = names[0];
  return select.value;
}

function renderDefaults() {
  const textSelect = document.getElementById("default-text");
  const linkSelect = document.getElementById("default-link");
  state.defaultTextScheme = fillSchemeSelect(textSelect, state.defaultTextScheme);
  state.defaultLinkScheme = fillSchemeSelect(linkSelect, state.defaultLinkScheme);
}

function renderBehavior() {
  document.getElementById("quick-capture").checked = state.quickCapture;
  document.getElementById("debug").checked = state.debug;
}

function renderAll() {
  renderProtocols();
  renderSubProtocols();
  renderParamSpecs();
  renderDefaults();
  renderBehavior();
}

// Point the whole form at a (fresh) settings object: used on load, on Reset
// (re-reads storage) and on Defaults (loads a copy of DEFAULT_SETTINGS).
function applySettings(settings) {
  ({ paramSpec, subProtoScheme } = settings);
  state = toState(settings);
  renderAll();
}

// --- Save --------------------------------------------------------------------

function validate() {
  if (state.schemes.length === 0) return "Add at least one protocol.";
  const names = state.schemes.map((s) => s.name.trim());
  if (names.some((n) => n === "")) return "Every protocol needs a name.";
  if (new Set(names).size !== names.length) return "Protocol names must be unique.";
  return null;
}

function collect() {
  const schemeSpec = {};
  for (const scheme of state.schemes) {
    const subProtocol = scheme.subProtocol;
    // Re-filter against the allowed set so only valid params are ever stored.
    const params = allowedParams(subProtocol).filter((p) => scheme.params.has(p));
    // A selected key-type param asks at capture time, superseding a fixed key.
    const asksAtCapture = params.some(
      (p) => paramSpec[p].type === PARAM_TYPE.key,
    );
    const template = allowsTemplate(subProtocol) && !asksAtCapture
      ? sanitizeTemplateKey(scheme.template) || null
      : null;
    schemeSpec[scheme.name.trim()] = {
      description: scheme.description.trim(),
      subProtocol,
      template,
      params,
    };
  }

  const names = Object.keys(schemeSpec);
  const resolveDefault = (name) => {
    const trimmed = (name ?? "").trim();
    return names.includes(trimmed) ? trimmed : names[0];
  };

  return {
    paramSpec,
    subProtoScheme,
    schemeSpec,
    defaultTextScheme: resolveDefault(state.defaultTextScheme),
    defaultLinkScheme: resolveDefault(state.defaultLinkScheme),
    quickCapture: state.quickCapture,
    debug: state.debug,
  };
}

function flashStatus(message, isError = false) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.classList.toggle("status--error", isError);
  clearTimeout(flashStatus.timer);
  flashStatus.timer = setTimeout(() => {
    status.textContent = "";
    status.classList.remove("status--error");
  }, 2500);
}

async function handleSubmit(event) {
  event.preventDefault();
  const error = validate();
  if (error) {
    flashStatus(error, true);
    return;
  }
  await saveSettings(collect());
  flashStatus("Saved");
}

// --- Init --------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  applySettings(await loadSettings());

  document.getElementById("add-protocol").addEventListener("click", () => {
    const scheme = newScheme();
    state.schemes.push(scheme);
    document.getElementById("protocols").append(createCard(scheme));
    renderDefaults();
  });

  document.getElementById("add-sub").addEventListener("click", () => {
    const name = uniqueKey(subProtoScheme, "my-protocol");
    subProtoScheme[name] = [];
    document.getElementById("sub-protocols").append(createSubCard(name));
    renderProtocols();
  });

  document.getElementById("add-param").addEventListener("click", () => {
    const name = uniqueKey(paramSpec, "Custom");
    paramSpec[name] = { urlKey: name.toLowerCase(), type: PARAM_TYPE.href };
    document.getElementById("param-specs").append(createParamCard(name));
    renderSubProtocols();
  });

  document.getElementById("reset").addEventListener("click", async () => {
    applySettings(await loadSettings());
    flashStatus("Reverted to saved settings");
  });

  document.getElementById("defaults").addEventListener("click", () => {
    applySettings(structuredClone(DEFAULT_SETTINGS));
    flashStatus("Defaults loaded — Save to keep them");
  });

  const help = document.getElementById("help");
  document.getElementById("open-help").addEventListener("click", () => help.showModal());
  document.getElementById("help-close").addEventListener("click", () => help.close());

  document.getElementById("default-text").addEventListener("change", (event) => {
    state.defaultTextScheme = event.target.value;
  });
  document.getElementById("default-link").addEventListener("change", (event) => {
    state.defaultLinkScheme = event.target.value;
  });
  document.getElementById("quick-capture").addEventListener("change", (event) => {
    state.quickCapture = event.target.checked;
  });
  document.getElementById("debug").addEventListener("change", (event) => {
    state.debug = event.target.checked;
  });

  document.getElementById("settings-form").addEventListener("submit", handleSubmit);
});