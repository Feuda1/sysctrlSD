const enabledBtn = document.getElementById('enabled')
const closeBtn = document.getElementById('closeTab')

function render(enabled, closeTab) {
  enabledBtn.classList.toggle('on', enabled)
  closeBtn.classList.toggle('on', enabled && closeTab)
  closeBtn.classList.toggle('disabled', !enabled)
}

let state = { enabled: true, closeTab: false }

chrome.storage.local.get(['enabled', 'closeTab'], (s) => {
  state = { enabled: s.enabled !== false, closeTab: s.closeTab === true }
  render(state.enabled, state.closeTab)
})

enabledBtn.addEventListener('click', () => {
  state.enabled = !state.enabled
  chrome.storage.local.set({ enabled: state.enabled })
  render(state.enabled, state.closeTab)
})

closeBtn.addEventListener('click', () => {
  if (!state.enabled) return
  state.closeTab = !state.closeTab
  chrome.storage.local.set({ closeTab: state.closeTab })
  render(state.enabled, state.closeTab)
})
