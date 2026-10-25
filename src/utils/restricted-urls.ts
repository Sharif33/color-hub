export const RESTRICTED_URLS = [
  "chrome://",
  "chrome-extension://",
  "chrome-search://",
  "chrome-untrusted://",
  "edge://",
  "about:",
  "devtools://",
  "view-source:",
  // Browser extension stores block scripting
  "https://chromewebstore.google.com/",
  "https://chrome.google.com/webstore",
  "https://microsoftedge.microsoft.com/addons"
]

export const isRestrictedUrl = (url: string) => {
  return RESTRICTED_URLS.some((prefix) => url.startsWith(prefix))
}
