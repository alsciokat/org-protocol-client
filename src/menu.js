// In-page menu for picking which capture scheme to send to Emacs. Injected (as
// an ES module) into the active tab when quick capture is off, it renders a
// small Shadow-DOM overlay styled to match the options page, then hands the
// chosen scheme to capture().
// Licensed under MIT — see LICENSE.

import { capture } from "./capture.js";
import { loadSettings } from "./settings.js";

const HOST_ID = "org-protocol-menu";

// Mirrors the design tokens and shapes from options.css. `all: initial` on the
// host, plus the shadow root, keeps the page's styles out of the menu.
const STYLE = `
	:host { all: initial; }
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 2147483647;
		display: flex;
		align-items: flex-start;
		justify-content: flex-end;
		padding: 12px;
		font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
	}
	.menu {
		color-scheme: light dark;
		min-width: 240px;
		padding: 8px;
		background: Canvas;
		color: CanvasText;
		border: 1px solid ButtonBorder;
		border-radius: 12px;
		box-shadow: 0 10px 34px rgba(0, 0, 0, 0.22);
	}
	.menu__header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px 10px;
	}
	.menu__logo {
		width: 20px;
		height: 20px;
	}
	.menu__title {
		font-size: 13px;
		font-weight: 600;
	}
	.menu__item {
		display: block;
		width: 100%;
		padding: 9px 10px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: CanvasText;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.menu__item:hover,
	.menu__item:focus-visible {
		outline: none;
		background: color-mix(in srgb, AccentColor 16%, transparent);
	}
	.menu__hint {
		display: none;
		margin: 6px 8px 2px;
		max-width: 260px;
		color: color-mix(in srgb, CanvasText 80%, Canvas);
		font-size: 12px;
	}
	.menu__hint--open {
		display: block;
	}
	.menu__footer {
		display: flex;
		gap: 4px;
		margin-top: 6px;
		padding-top: 6px;
		border-top: 1px solid ButtonBorder;
	}
	.menu__footer .menu__item {
		flex: 1;
		padding: 6px 10px;
		color: CanvasText;
		font-size: 13px;
		text-align: center;
	}
`;

function render(settings) {
	document.getElementById(HOST_ID)?.remove();

	const host = document.createElement("div");
	host.id = HOST_ID;
	const root = host.attachShadow({ mode: "open" });

	const style = document.createElement("style");
	style.textContent = STYLE;

	const backdrop = document.createElement("div");
	backdrop.className = "backdrop";

	const menu = document.createElement("div");
	menu.className = "menu";
	menu.setAttribute("role", "menu");

	const header = document.createElement("div");
	header.className = "menu__header";
	const logo = document.createElement("img");
	logo.className = "menu__logo";
	logo.src = chrome.runtime.getURL("icons/org-mode-unicorn.png");
	logo.alt = "";
	const title = document.createElement("span");
	title.className = "menu__title";
	title.textContent = "Send to Emacs";
	header.append(logo, title);
	menu.append(header);

	function close() {
		document.removeEventListener("keydown", onKey);
		host.remove();
	}

	function onKey(event) {
		if (event.key === "Escape") close();
	}

	for (const name of Object.keys(settings.schemeSpec)) {
		const item = document.createElement("button");
		item.type = "button";
		item.className = "menu__item";
		item.setAttribute("role", "menuitem");
		item.textContent = name;
		item.addEventListener("click", () => {
			close();
			capture(name).catch((error) =>
				console.error("[org-capture] capture failed:", error));
		});
		menu.append(item);
	}

	// Help toggles a short inline explanation; Settings asks the service worker
	// to open the options page (content scripts cannot open it directly).
	const hint = document.createElement("p");
	hint.className = "menu__hint";
	hint.textContent =
		"Each entry sends this page to Emacs as an org-protocol:// link. " +
		"Emacs must be running with org-protocol set up. Add or edit entries " +
		"in Settings.";

	const footer = document.createElement("div");
	footer.className = "menu__footer";

	const helpButton = document.createElement("button");
	helpButton.type = "button";
	helpButton.className = "menu__item";
	helpButton.textContent = "Help";
	helpButton.addEventListener("click", () => {
		hint.classList.toggle("menu__hint--open");
	});

	const settingsButton = document.createElement("button");
	settingsButton.type = "button";
	settingsButton.className = "menu__item";
	settingsButton.textContent = "Settings";
	settingsButton.addEventListener("click", () => {
		chrome.runtime.sendMessage({ type: "openOptions" });
		close();
	});

	footer.append(helpButton, settingsButton);
	menu.append(hint, footer);

	backdrop.addEventListener("click", (event) => {
		if (event.target === backdrop) close();
	});
	document.addEventListener("keydown", onKey);

	backdrop.append(menu);
	root.append(style, backdrop);
	document.documentElement.append(host);

	menu.querySelector(".menu__item")?.focus();
}

// Injected entry point: open the scheme picker over the current page.
export async function openMenu() {
	render(await loadSettings());
}
