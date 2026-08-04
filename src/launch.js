// Redirect this extension-origin page to the org-protocol URL passed in the
// fragment. Because the navigation is initiated here (chrome-extension://<id>)
// rather than from the captured web page, Chrome scopes its "always allow"
// external-protocol grant to this single origin, so one allow covers all sites.
// Licensed under MIT — see LICENSE.

location.href = decodeURIComponent(location.hash.slice(1));
