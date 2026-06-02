// Service worker: redirects clients.denvic.ru ticket pages to the sysctrlSD app
// via a custom protocol, using a dynamic declarativeNetRequest rule that is
// switched on/off by the user's settings. Tab closing is handled on request
// from the interstitial page.

const RULE_ID = 1
const TICKET_REGEX = '^https?://clients\\.denvic\\.ru/Tickets/Details/(\\d+)'

async function getSettings() {
  const { enabled = true, closeTab = false } = await chrome.storage.local.get(['enabled', 'closeTab'])
  return { enabled, closeTab }
}

async function syncRule() {
  const { enabled } = await getSettings()
  const addRules = enabled
    ? [{
        id: RULE_ID,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: { regexSubstitution: chrome.runtime.getURL('redirect.html') + '?id=\\1' }
        },
        condition: { regexFilter: TICKET_REGEX, resourceTypes: ['main_frame'] }
      }]
    : []
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [RULE_ID], addRules })
  } catch (e) {
    console.error('sysctrlSD: не удалось обновить правило перенаправления', e)
  }
}

chrome.runtime.onInstalled.addListener(syncRule)
chrome.runtime.onStartup.addListener(syncRule)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) syncRule()
})

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'closeSelf' && sender.tab && sender.tab.id != null) {
    chrome.tabs.remove(sender.tab.id).catch(() => {})
  }
})
