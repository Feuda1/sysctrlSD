const id = new URLSearchParams(location.search).get('id') || ''
document.getElementById('num').textContent = id ? '№' + id : ''

// Trigger the desktop app. On the very first launches the browser shows an
// "Открыть в приложении?" prompt — the tab is only closed when the user has
// turned that option on (off by default), so the prompt is never interrupted.
if (id) location.href = 'sysctrlsd://ticket/' + id

document.getElementById('close').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'closeSelf' })
})

chrome.storage.local.get(['closeTab'], ({ closeTab }) => {
  if (closeTab) {
    setTimeout(() => chrome.runtime.sendMessage({ type: 'closeSelf' }), 1200)
  }
})
