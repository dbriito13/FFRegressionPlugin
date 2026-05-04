/**
 * Background Service Worker
 * Handles keyboard shortcuts and communicates with popup
 */

// Listen for keyboard command
chrome.commands.onCommand.addListener((command) => {
  if (command === 'run-regression') {
    handleRunRegression();
  }
});

async function handleRunRegression() {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      console.error('No active tab found');
      return;
    }

    // Inject script to get selected text
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: getSelectedText
    });

    const selectedText = results[0]?.result;

    if (!selectedText || selectedText.trim() === '') {
      console.log('No text selected');
      // Open popup anyway but don't pre-fill
      chrome.action.openPopup();
      return;
    }

    // Clean the selected text (remove whitespace, special chars)
    const ticker = cleanTicker(selectedText);

    console.log(`Selected text: "${selectedText}" -> Ticker: "${ticker}"`);

    // Store the ticker and trigger flag
    await chrome.storage.local.set({
      autoRunTicker: ticker,
      autoRunPeriod: '20y',
      autoRunTimestamp: Date.now()
    });

    // Open the popup (it will read the storage and auto-run)
    chrome.action.openPopup();

  } catch (error) {
    console.error('Error handling run-regression command:', error);
  }
}

// Function injected into page to get selected text
function getSelectedText() {
  return window.getSelection().toString();
}

// Clean ticker symbol from selected text
function cleanTicker(text) {
  // Remove whitespace and convert to uppercase
  let ticker = text.trim().toUpperCase();

  // Remove common prefixes/suffixes
  ticker = ticker.replace(/^\$/, ''); // Remove leading $
  ticker = ticker.replace(/[^\w.-]/g, ''); // Keep only alphanumeric, dots, hyphens

  return ticker;
}
