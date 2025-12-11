const { ipcRenderer } = require('electron');

// Anti-fingerprinting: Spoof WebRTC to prevent IP leaks
const spoofWebRTC = () => {
  // Override RTCPeerConnection to prevent WebRTC IP leaks
  const originalRTC = window.RTCPeerConnection;
  
  window.RTCPeerConnection = function(...args) {
    const pc = new originalRTC(...args);
    
    // Override createDataChannel to prevent leaks
    const origCreateDataChannel = pc.createDataChannel.bind(pc);
    pc.createDataChannel = function(label, options) {
      return origCreateDataChannel(label, options);
    };
    
    return pc;
  };
  
  // Inherit prototype
  if (originalRTC) {
    window.RTCPeerConnection.prototype = originalRTC.prototype;
  }
  
  // Also handle webkit prefix
  if (window.webkitRTCPeerConnection) {
    window.webkitRTCPeerConnection = window.RTCPeerConnection;
  }
};

// Anti-detection: Remove automation markers
const removeAutomationMarkers = () => {
  // Remove webdriver property
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
  });
  
  // Remove automation-related properties
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  
  // Spoof plugins to look like a real browser
  Object.defineProperty(navigator, 'plugins', {
    get: () => [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
      { name: 'Native Client', filename: 'internal-nacl-plugin' },
    ],
  });
  
  // Spoof languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  });
};

// Apply anti-detection when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    spoofWebRTC();
    removeAutomationMarkers();
  });
} else {
  spoofWebRTC();
  removeAutomationMarkers();
}

document.addEventListener('copy', () => {
  // Wait a brief moment for the copy to complete and selection to be available
  setTimeout(() => {
    const text = document.getSelection().toString();
    if (text && text.trim().length > 0) {
      ipcRenderer.sendToHost('copied-text', text);
    }
  }, 100);
});
