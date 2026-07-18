// Injected into the active tab when the toolbar button or keyboard shortcut
// fires. Builds an org-protocol URL for the current page (and any selected
// text) and hands it to Emacs by navigating to it.
// Licensed under MIT — see LICENSE.

(async () => {
  "use strict";

  const TOAST_ID = "org-capture-toast";

  // encodeURIComponent leaves ( ) ' intact, but Org's link parser treats them
  // specially, so percent-encode them too.
  function orgEscape(text) {
    return encodeURIComponent(text)
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
      .replace(/'/g, "%27");
  }

  function getPageContext() {
    return {
      url: location.href,
      title: document.title,
      selection: window.getSelection().toString(),
    };
  }

  function buildOrgProtocolUrl(settings, page) {
    const hasSelection = page.selection !== "";
    const protocol = hasSelection ? settings.selectedProtocol : settings.unselectedProtocol;
    const template = hasSelection ? settings.selectedTemplate : settings.unselectedTemplate;

    const url = encodeURIComponent(page.url);
    const title = orgEscape(page.title);
    const body = orgEscape(page.selection);

    if (protocol === "roam-ref") {
      return `org-protocol://roam-ref?template=${template}&ref=${url}&title=${title}&body=${body}`;
    }
    if (settings.useModernProtocol) {
      return `org-protocol://capture?template=${template}&url=${url}&title=${title}&body=${body}`;
    }
    return `org-protocol://capture:/${template}/${url}/${title}/${body}`;
  }

  function showCaptureToast() {
    if (document.getElementById(TOAST_ID)) return;

    const toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.textContent = "Captured";
    Object.assign(toast.style, {
      position: "fixed",
      top: "24px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "12px 24px",
      background: "rgba(0, 0, 0, 0.82)",
      color: "#fff",
      font: "600 15px/1 system-ui, sans-serif",
      borderRadius: "8px",
      zIndex: "2147483647",
      pointerEvents: "none",
    });

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 900);
  }

  try {
    const settings = await chrome.storage.sync.get(null);
    const page = getPageContext();
    const orgUrl = buildOrgProtocolUrl(settings, page);

    if (settings.debug) {
      console.log("[org-capture] navigating to:", orgUrl);
    }

    location.href = orgUrl;

    if (settings.notifyOnCapture) {
      showCaptureToast();
    }
  } catch (error) {
    console.error("[org-capture] capture failed:", error);
    alert("Org Capture: could not capture this page.\n" + error.message);
  }
})();
