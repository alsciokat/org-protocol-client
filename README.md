# Org Protocol Client

A Chrome extension (Manifest V3) that sends the current page to Emacs as an
[`org-protocol://`](https://orgmode.org/worg/org-contrib/org-protocol.html)
link — capture a page or selection with org-capture, store a link for
`org-insert-link`, add a Roam ref, or open the page in Emacs.

## Features

- **Protocol menu** — clicking the toolbar icon (or pressing
  `Ctrl+Shift+X` / `⌘⇧X` by default) opens an in-page menu of your configured protocols.
- **Quick capture** — optionally skip the menu and immediately send a default
  protocol, chosen by whether text is selected.
- **Fully configurable** — the options page lets you create any number of
  protocols, each with its own sub-protocol, template key, and parameters.
  Parameters are validated against what the sub-protocol accepts.
- **Extensible wire format** — an Advanced section edits the sub-protocol and
  parameter registries themselves: define new sub-protocols, rename the query
  keys parameters are sent under, and choose where each value comes from
  (page URL — raw or decoded, page title, selected text, or a template key
  prompted at capture time).

## Installation

### Install Extension

Download it from the [Chrome extension store](https://chromewebstore.google.com/detail/org-protocol-client/cejabhlekhkbajhhfpbgdaomkkocegam "Org Protocol Client").

Or install manually as follows:
1. Clone this repository.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the repository folder.

### Setup Emacs

Emacs needs `org-protocol` loaded and the Emacs server running.
Add the followings to your `init.el`.

```elisp
(require 'org-protocol)
(server-start)
```

Add capture templates whose keys match the **Template key** of your protocols
(the defaults use `[` for links and `]` for selections):

```elisp
(setq org-capture-templates
      '(("[" "Capture link" entry (file "~/org/inbox.org")
         "* %:description\n%:link\n%U")
        ("]" "Capture selection" entry (file "~/org/inbox.org")
         "* %:description\n%:link\n%U\n\n#+begin_quote\n%i\n#+end_quote")))
```

### Register `emacsclient` as the `org-protocol://` handler

Your OS must hand `org-protocol://` links to emacsclient.

**Linux (freedesktop):** add desktop entry for
`org-protocol` and set it as the default handler
for `x-scheme-handler/org-protocol` MIME type.

```bash
cat > "${HOME}/.local/share/applications/org-protocol.desktop" << EOF
[Desktop Entry]
Name=org-protocol
Exec=emacsclient %u
Icon=emacs
Type=Application
Terminal=false
Categories=System;
MimeType=x-scheme-handler/org-protocol;
EOF
update-desktop-database ~/.local/share/applications/
```

**MacOS:** download Emacsclient from Homebrew

```sh
brew cask install emacsclient
```

or download directly from [sprig/org-capture-extension](https://github.com/sprig/org-capture-extension/raw/master/EmacsClient.app.zip).

See [org-protocol documentation](https://orgmode.org/worg/org-contrib/org-protocol.html)
for alternatives.

**Windows:** modify the registry
by creating the following `.reg` file
and executing it. Be careful with the path
of `emacsclientw.exe` if you did not choose the
default path.

```reg
Windows Registry Editor Version 5.00

[HKEY_CLASSES_ROOT\org-protocol]
@="URL:Org Protocol"
"URL Protocol"=""
[HKEY_CLASSES_ROOT\org-protocol\shell]
[HKEY_CLASSES_ROOT\org-protocol\shell\open]
[HKEY_CLASSES_ROOT\org-protocol\shell\open\command]
@="\"C:\\Program Files\\Emacs\\emacs\\bin\\emacsclientw.exe\" \"%1\""
```

Windows does not support local domain socket, so you must use TCP socket by
adding the following to your `init.el`.

```elisp
(setopt server-use-tcp t)
```


## Usage

Click the toolbar icon and pick a protocol from the menu, or enable
**quick capture** in the settings to send the default protocol immediately.
The defaults:

|Protocol         |Sub-protocol |Sends                                  |
|-----------------|-------------|---------------------------------------|
|Capture link     |`capture`    |URL + title to template `[`            |
|Capture selection|`capture`    |URL + title + selection to template `]`|
|Store link       |`store-link` |URL + title for `C-c C-l`              |
|Open source      |`open-source`|decoded URL, opened locally in Emacs   |

The first time you capture, the browser asks permission to open the external
handler — accept it, ticking **"Always allow…"** to skip the dialog on future
captures. The link is launched from the extension's own origin, so a single
"always allow" applies to every site rather than needing re-approval per site.

## Settings

Open the extension's options (also reachable from the menu's **Settings**
button). There you can:

- **Protocols** — add, rename, and delete protocols; pick each one's
  sub-protocol, template key, and parameters.
- **Defaults** — which protocol quick capture sends with and without a
  selection.
- **Behavior** — toggle quick capture and debug logging.
- **Advanced** — edit the registries the protocols are built from:
  - *Sub-protocols*: the handlers on the Emacs side and which parameters each
    accepts.
  - *Parameters*: the query key each value is sent under (**URL key**) and
    what fills it (**Value**): the page URL (raw, or decoded so local
    filenames reach Emacs without percent-encoding), page title, selected
    text, or a template key you are asked for at capture time.

**Reset** discards unsaved edits; **Defaults** loads the factory settings into
the form (press **Save** to keep them). A **Help** dialog summarizes all of
the above.

### How the link is built

For a protocol with sub-protocol `capture`, template `[`, and parameters
`URL` + `Title` (sent under URL keys `url` and `title`), the extension
navigates to:

```
org-protocol://capture?template=[&url=<page url>&title=<page title>
```

All values are percent-encoded, including `(`, `)`, and `'`, which Org's link
parser treats specially.

## Troubleshooting

- **Nothing happens in Emacs** — enable the debug toggle in the settings, then
  check the page's DevTools console for the generated link and try opening it
  manually. Verify `(server-start)` has run and the OS handler is registered.
- **`No capture template referred to by "..." keys`** — the protocol's
  template key does not match any entry in `org-capture-templates`.
- **Settings look wrong after an update** — press **Defaults**, then **Save**,
  to rewrite storage with the current schema.

## License

This repository is licensed under [GPLv3](LICENSE) license.
