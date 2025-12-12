const $ = (id) => document.getElementById(id);

// ===== ELEMENTS =====
// Browser
const urlBar = $('url-bar');
const searchGo = $('search-go');
const ntpSearchInput = $('ntp-search-input');
const ntpSearchBtn = $('ntp-search-btn');
const newTabPage = $('new-tab-page');
const webviewsContainer = $('webviews-container');
const tabsBar = $('tabs-bar');
const newTabBtn = $('new-tab-btn');

const backBtn = $('back-btn');
const forwardBtn = $('forward-btn');
const refreshBtn = $('refresh-btn');

// Mode
// Mode
const modeToggleBtn = $('mode-toggle-btn');
const ntpModeText = $('ntp-mode-text');
const settingsGreen = $('settings-green');
const settingsBlood = $('settings-blood');
const proxyIpDisplay = $('proxy-ip-display');

// ...

function setMode(mode) {
  currentMode = mode;
  document.body.classList.remove('green-mode', 'blood-mode');
  document.body.classList.add(`${mode}-mode`);

  // Update Toggle Button
  if (mode === 'green') {
    modeToggleBtn.textContent = '🛡️';
    modeToggleBtn.className = 'mode-btn-mini mode-toggle green';
    modeToggleBtn.title = "Safe Mode (Click to switch to Blood Mode)";

    ntpModeText.textContent = 'Safe Mode';
    if (proxyIpDisplay) proxyIpDisplay.textContent = 'Direct Connection';
    stopProxyRotation();
    window.arsenal.setMode('green');
  } else {
    modeToggleBtn.textContent = '🩸';
    modeToggleBtn.className = 'mode-btn-mini mode-toggle blood';
    modeToggleBtn.title = "Blood Mode (Click to switch to Safe Mode)";

    ntpModeText.textContent = 'Blood Mode • Proxy Active';
    startProxyRotation();
    window.arsenal.setMode('blood');
  }

  // Update Settings Panel Buttons if they exist
  settingsGreen?.classList.toggle('active', mode === 'green');
  settingsBlood?.classList.toggle('active', mode === 'blood');

  localStorage.setItem('arsenal-mode', mode);
}

// Single Toggle Event Listener
modeToggleBtn.addEventListener('click', () => {
  const newMode = currentMode === 'green' ? 'blood' : 'green';
  setMode(newMode);
});

// Remove old listeners references (conceptually)

// AI Sidebar
const aiSidebar = $('ai-sidebar');
const aiChatBtn = $('ai-chat-btn');
const aiCloseBtn = $('ai-close-btn');
const aiProvider = $('ai-provider');
const aiChatMessages = $('ai-chat-messages');
const aiChatInput = $('ai-chat-input');
const aiSendBtn = $('ai-send-btn');
const aiAttachBtn = $('ai-attach-btn');
const aiFileInput = $('ai-file-input');
const aiImagePreview = $('ai-image-preview');
const aiClipboardPreview = $('ai-clipboard-preview');

// Settings
const settingsPanel = $('settings-panel');
const settingsBtn = $('settings-btn');
const settingsClose = $('settings-close');
const saveKeysBtn = $('save-keys');
const saveStatus = $('save-status');

// Overlay
const overlay = $('key-overlay');
const overlayStatus = $('overlay-status');
const overlaySave = $('overlay-save');
const overlayDismiss = $('overlay-dismiss');

// Quick links
const quickLinks = document.querySelectorAll('.quick-link');

let currentMode = 'green';
let proxyRotationInterval = null;

// ===== TAB MANAGEMENT =====
let tabs = [];
let activeTabId = null;
let tabIdCounter = 0;

async function createTab(url = null) {
  const tabId = tabIdCounter++;

  // Auto-rotate proxy on new tab in blood mode
  if (currentMode === 'blood') {
    const newProxy = await window.arsenal.rotateProxy();
    if (newProxy) {
      console.log(`Proxy rotated: ${newProxy.ip}:${newProxy.port}`);
      updateProxyIP();
    }
  }

  // Create Tab UI
  const tabEl = document.createElement('div');
  tabEl.className = 'tab';
  tabEl.dataset.id = tabId;
  tabEl.innerHTML = `
    <span class="tab-title">New Tab</span>
    <button class="tab-close">✕</button>
  `;

  // Insert before the new tab button
  tabsBar.insertBefore(tabEl, newTabBtn);

  // Create Webview
  const webview = document.createElement('webview');
  webview.className = 'webview hidden';
  webview.allowpopups = true;
  webview.setAttribute('partition', 'persist:arsenal'); // Persist cookies & sessions
  webview.src = url || 'about:blank';
  webview.preload = './webview-preload.js';

  // Attach events to webview
  webview.addEventListener('ipc-message', (e) => {
    if (e.channel === 'copied-text') {
      showClipboardPreview(e.args[0]);
    }
  });

  webview.addEventListener('did-start-loading', () => {
    if (activeTabId === tabId) {
      // Show loading state - keep icon, just add spinning class
      refreshBtn.classList.add('loading');
    }
  });

  webview.addEventListener('did-stop-loading', () => {
    if (activeTabId === tabId) {
      updateUrlBar(webview.getURL());
      // Stop spinning
      refreshBtn.classList.remove('loading');
    }
    updateTabTitle(tabId, webview.getTitle());
  });

  webview.addEventListener('did-navigate', (e) => {
    if (activeTabId === tabId) {
      updateUrlBar(e.url);
    }
    updateTabTitle(tabId, webview.getTitle());
  });

  webview.addEventListener('did-navigate-in-page', (e) => {
    if (activeTabId === tabId) {
      updateUrlBar(e.url);
    }
    updateTabTitle(tabId, webview.getTitle());
  });

  webview.addEventListener('page-title-updated', (e) => {
    updateTabTitle(tabId, e.title);
  });

  webview.addEventListener('new-window', (e) => {
    e.preventDefault();
    // Navigate in the CURRENT tab instead of opening a new one
    webview.loadURL(e.url);
  });

  webviewsContainer.appendChild(webview);

  const tabData = {
    id: tabId,
    el: tabEl,
    webview: webview,
    url: url || 'about:blank',
    title: 'New Tab'
  };

  tabs.push(tabData);

  // Event listeners for tab UI
  tabEl.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab-close')) {
      switchTab(tabId);
    }
  });

  tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(tabId);
  });

  switchTab(tabId);
  return tabData;
}

function switchTab(id) {
  activeTabId = id;

  tabs.forEach(tab => {
    const isActive = tab.id === id;
    tab.el.classList.toggle('active', isActive);

    if (isActive) {
      // Show this webview
      if (tab.url === 'about:blank' || !tab.url) {
        tab.webview.classList.add('hidden');
        newTabPage.classList.remove('hidden');
        urlBar.value = '';
      } else {
        tab.webview.classList.remove('hidden');
        newTabPage.classList.add('hidden');
        urlBar.value = tab.webview.getURL();
      }
    } else {
      tab.webview.classList.add('hidden');
    }
  });
}

function closeTab(id) {
  const index = tabs.findIndex(t => t.id === id);
  if (index === -1) return;

  const tab = tabs[index];
  if (tab.el && tab.el.parentNode) tab.el.remove();
  if (tab.webview && tab.webview.parentNode) {
    // Remove event listeners if any
    tab.webview.remove();
  }

  tabs.splice(index, 1);

  if (tabs.length === 0) {
    createTab();
  } else if (activeTabId === id) {
    // Switch to the previous tab or the next one
    const newIndex = Math.max(0, index - 1);
    switchTab(tabs[newIndex].id);
  }
}

function updateTabTitle(id, title) {
  const tab = tabs.find(t => t.id === id);
  if (tab) {
    tab.title = title || 'New Tab';
    tab.el.querySelector('.tab-title').textContent = tab.title;
  }
}

function updateUrlBar(url) {
  if (url === 'about:blank') {
    urlBar.value = '';
  } else {
    urlBar.value = url;
  }
}

function getActiveWebview() {
  const tab = tabs.find(t => t.id === activeTabId);
  return tab ? tab.webview : null;
}

function updateActiveTabUrl(url) {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab) {
    tab.url = url;
    tab.webview.src = url;

    if (url === 'about:blank') {
      tab.webview.classList.add('hidden');
      newTabPage.classList.remove('hidden');
    } else {
      tab.webview.classList.remove('hidden');
      newTabPage.classList.add('hidden');
    }
  }
}

// ===== NAVIGATION =====
function navigate(url) {
  if (!url) return;

  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
    // Check if it looks like a URL
    if (url.includes('.') && !url.includes(' ')) {
      url = 'https://' + url;
    } else {
      // It's a search query
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }
  }

  updateActiveTabUrl(url);
  urlBar.value = url;
}

// URL bar events
searchGo.addEventListener('click', () => navigate(urlBar.value.trim()));
urlBar.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') navigate(urlBar.value.trim());
});

// NTP search events
ntpSearchBtn.addEventListener('click', () => navigate(ntpSearchInput.value.trim()));
ntpSearchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') navigate(ntpSearchInput.value.trim());
});

// Navigation buttons
backBtn.addEventListener('click', () => {
  const wv = getActiveWebview();
  if (wv && wv.canGoBack()) wv.goBack();
});
forwardBtn.addEventListener('click', () => {
  const wv = getActiveWebview();
  if (wv && wv.canGoForward()) wv.goForward();
});
refreshBtn.addEventListener('click', () => {
  const wv = getActiveWebview();
  if (wv) wv.reload();
});

newTabBtn.addEventListener('click', () => createTab());

// Quick links
quickLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(link.dataset.url);
  });
});

// ===== MODE SWITCHING =====


function startProxyRotation() {
  updateProxyIP();
  proxyRotationInterval = setInterval(updateProxyIP, 30000);
}

function stopProxyRotation() {
  if (proxyRotationInterval) {
    clearInterval(proxyRotationInterval);
    proxyRotationInterval = null;
  }
}

async function updateProxyIP() {
  if (!proxyIpDisplay) return;
  try {
    const proxyInfo = await window.arsenal.getCurrentProxy();
    if (proxyInfo && proxyInfo.ip) {
      proxyIpDisplay.textContent = `${proxyInfo.region} • ${proxyInfo.ip}`;
    } else {
      proxyIpDisplay.textContent = 'Proxy Rotating...';
    }
  } catch (err) {
    proxyIpDisplay.textContent = 'Proxy Active';
  }
}


settingsGreen?.addEventListener('click', () => setMode('green'));
settingsBlood?.addEventListener('click', () => setMode('blood'));

// ===== AI SIDEBAR =====
function toggleAiSidebar(show) {
  aiSidebar.classList.toggle('hidden', !show);
  if (show) {
    // Focus input when opened
    setTimeout(() => aiInput.focus(), 300);
  }
}

aiChatBtn.addEventListener('click', () => toggleAiSidebar(true));
aiCloseBtn.addEventListener('click', () => toggleAiSidebar(false));

// ===== SIDEBAR RESIZE (DRAG TO EXPAND) =====
// ===== SIDEBAR RESIZE (DRAG TO EXPAND) =====
const resizeHandle = document.getElementById('ai-resize-handle');
const resizeOverlay = document.getElementById('resize-overlay');
let isResizing = false;
let startX, startWidth;

resizeHandle?.addEventListener('mousedown', (e) => {
  isResizing = true;
  startX = e.clientX;
  startWidth = aiSidebar.offsetWidth;

  // Show overlay to capture events over webviews
  resizeOverlay.classList.remove('hidden');
  document.body.style.cursor = 'ew-resize';
  document.body.style.userSelect = 'none';
  resizeHandle.classList.add('active');

  e.preventDefault();
});

// Attach mousemove/up to document to catch fast movements
document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;

  const diff = startX - e.clientX;
  // Limit resize between 300px and window width - 100px
  const newWidth = Math.min(Math.max(startWidth + diff, 300), window.innerWidth - 100);
  aiSidebar.style.width = newWidth + 'px';
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    // Hide overlay
    resizeOverlay.classList.add('hidden');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    resizeHandle.classList.remove('active');
  }
});

function formatContent(text) {
  // Simple markdown code block parser
  const escapeHtml = (str) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  // Split by code blocks
  const parts = text.split(/```(\w*)\n?([\s\S]*?)```/g);

  let html = '';

  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      // Normal text
      let normalText = escapeHtml(parts[i]);
      // Handle inline code `...`
      normalText = normalText.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
      // Handle newlines
      normalText = normalText.replace(/\n/g, '<br>');
      html += normalText;
    } else if (i % 3 === 1) {
      // Language
      const lang = parts[i] || 'text';
      html += `<div class="code-block-wrapper"><div class="code-header"><span>${lang}</span><button class="copy-code-btn">Copy</button></div><pre><code class="language-${lang}">`;
    } else {
      // Code content
      html += escapeHtml(parts[i]) + '</code></pre></div>';
    }
  }
  return html;
}

function addMessage(role, content) {
  const msgEl = document.createElement('div');
  msgEl.className = `ai-message ${role}`;

  if (role === 'assistant') {
    msgEl.innerHTML = formatContent(content);

    // Highlight code blocks
    msgEl.querySelectorAll('pre code').forEach((block) => {
      if (window.hljs) window.hljs.highlightElement(block);
    });

    // Add copy functionality
    msgEl.querySelectorAll('.copy-code-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = e.target.closest('.code-block-wrapper').querySelector('code').innerText;
        navigator.clipboard.writeText(code).then(() => {
          const originalText = e.target.textContent;
          e.target.textContent = 'Copied!';
          setTimeout(() => {
            e.target.textContent = originalText;
          }, 2000);
        });
      });
    });
  } else {
    msgEl.textContent = content;
  }

  // Remove welcome message if exists
  const welcome = aiChatMessages.querySelector('.ai-welcome');
  if (welcome) welcome.remove();

  aiChatMessages.appendChild(msgEl);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

// Auto-typing effect for AI responses
async function addMessageWithTyping(role, content) {
  const msgEl = document.createElement('div');
  msgEl.className = `ai-message ${role}`;

  // Remove welcome message if exists
  const welcome = aiChatMessages.querySelector('.ai-welcome');
  if (welcome) welcome.remove();

  aiChatMessages.appendChild(msgEl);

  // Check if content has code blocks
  const hasCodeBlocks = content.includes('```');

  if (hasCodeBlocks) {
    // For code blocks, type faster and in chunks
    await typeContentWithCode(msgEl, content);
  } else {
    // For plain text, type character by character
    await typeContent(msgEl, content);
  }

  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

async function typeContent(element, text) {
  const escapeHtml = (str) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let displayed = '';
  const speed = 8; // milliseconds per character (fast typing)

  for (let i = 0; i < text.length; i++) {
    displayed += text[i];
    // Handle inline code and newlines
    let html = escapeHtml(displayed);
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    html = html.replace(/\n/g, '<br>');
    element.innerHTML = html + '<span class="typing-cursor">|</span>';
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

    // Variable speed: faster for spaces, slower for punctuation
    const char = text[i];
    const delay = char === ' ' ? speed / 2 : (char === '.' || char === '!' || char === '?') ? speed * 3 : speed;
    await sleep(delay);
  }

  // Remove cursor and format final content
  element.innerHTML = formatContent(displayed);

  // Highlight code blocks
  element.querySelectorAll('pre code').forEach((block) => {
    if (window.hljs) window.hljs.highlightElement(block);
  });

  // Add copy functionality
  element.querySelectorAll('.copy-code-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const code = e.target.closest('.code-block-wrapper').querySelector('code').innerText;
      navigator.clipboard.writeText(code).then(() => {
        const originalText = e.target.textContent;
        e.target.textContent = 'Copied!';
        setTimeout(() => e.target.textContent = originalText, 2000);
      });
    });
  });
}

async function typeContentWithCode(element, text) {
  // For content with code blocks, type in word chunks for speed
  const words = text.split(/( +)/);
  let displayed = '';
  const speed = 15; // milliseconds per word

  for (let i = 0; i < words.length; i++) {
    displayed += words[i];
    element.innerHTML = formatContent(displayed) + '<span class="typing-cursor">|</span>';
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    await sleep(speed);
  }

  // Final formatting
  element.innerHTML = formatContent(displayed);

  // Highlight code blocks
  element.querySelectorAll('pre code').forEach((block) => {
    if (window.hljs) window.hljs.highlightElement(block);
  });

  // Add copy functionality
  element.querySelectorAll('.copy-code-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const code = e.target.closest('.code-block-wrapper').querySelector('code').innerText;
      navigator.clipboard.writeText(code).then(() => {
        const originalText = e.target.textContent;
        e.target.textContent = 'Copied!';
        setTimeout(() => e.target.textContent = originalText, 2000);
      });
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== IMAGE ATTACHMENT & CLIPBOARD =====
let attachedImages = [];
let pendingClipboardText = '';

// Paste handler for images
aiChatInput.addEventListener('paste', (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let index in items) {
    const item = items[index];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (event) => {
        attachedImages.push(event.target.result);
        updateImagePreview();
      };
      reader.readAsDataURL(blob);
    }
  }
});

// Clipboard Preview Logic
function showClipboardPreview(text) {
  if (!text) return;
  pendingClipboardText = text;

  const textEl = aiClipboardPreview.querySelector('.clipboard-text');
  textEl.textContent = text.length > 50 ? text.substring(0, 50) + '...' : text;

  aiClipboardPreview.classList.remove('hidden');

  // Auto-hide after 10 seconds if ignored
  setTimeout(() => {
    if (aiClipboardPreview.classList.contains('hidden') === false) {
      // Only hide if user hasn't interacted (simple check)
    }
  }, 10000);
}

aiClipboardPreview.querySelector('.clipboard-add-btn').addEventListener('click', () => {
  if (pendingClipboardText) {
    // Insert at cursor position or append
    const start = aiChatInput.selectionStart;
    const end = aiChatInput.selectionEnd;
    const text = aiChatInput.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    aiChatInput.value = before + pendingClipboardText + after;
    aiChatInput.focus();
    aiClipboardPreview.classList.add('hidden');
    pendingClipboardText = '';
  }
});

aiClipboardPreview.querySelector('.clipboard-close-btn').addEventListener('click', () => {
  aiClipboardPreview.classList.add('hidden');
  pendingClipboardText = '';
});

aiAttachBtn.addEventListener('click', () => {
  aiFileInput.click();
});

aiFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;
    attachedImages.push(base64);
    updateImagePreview();
  };
  reader.readAsDataURL(file);

  // Reset input so same file can be selected again
  aiFileInput.value = '';
});

function updateImagePreview() {
  aiImagePreview.innerHTML = '';

  if (attachedImages.length > 0) {
    aiImagePreview.classList.remove('hidden');
  } else {
    aiImagePreview.classList.add('hidden');
  }

  attachedImages.forEach((imgSrc, index) => {
    const thumb = document.createElement('div');
    thumb.className = 'preview-thumb';

    const img = document.createElement('img');
    img.src = imgSrc;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'preview-remove';
    removeBtn.innerHTML = '✕';
    removeBtn.onclick = () => {
      attachedImages.splice(index, 1);
      updateImagePreview();
    };

    thumb.appendChild(img);
    thumb.appendChild(removeBtn);
    aiImagePreview.appendChild(thumb);
  });
}

async function sendAiMessage() {
  const message = aiChatInput.value.trim();
  if (!message && attachedImages.length === 0) return;

  // Add user message with images if any
  const userMsgEl = document.createElement('div');
  userMsgEl.className = 'ai-message user';

  let contentHtml = '';
  if (attachedImages.length > 0) {
    contentHtml += `<div class="message-images">`;
    attachedImages.forEach(img => {
      contentHtml += `<img src="${img}" class="message-img" style="max-width: 200px; border-radius: 8px; margin-bottom: 8px; display: block;">`;
    });
    contentHtml += `</div>`;
  }
  contentHtml += `<div>${message}</div>`;

  userMsgEl.innerHTML = contentHtml;
  aiChatMessages.appendChild(userMsgEl);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

  // Clear input and images
  aiChatInput.value = '';
  const imagesToSend = [...attachedImages];
  attachedImages = [];
  updateImagePreview();

  const provider = aiProvider.value;

  // Show typing indicator
  const typingEl = document.createElement('div');
  typingEl.className = 'ai-message assistant typing';
  typingEl.innerHTML = '<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
  typingEl.id = 'typing-indicator';
  aiChatMessages.appendChild(typingEl);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

  try {
    // Pass images to the backend
    const result = await window.arsenal.requestAI(provider, message, imagesToSend);
    typingEl.remove();

    // Create message element for typing effect
    const responseText = result?.text || 'No response received.';
    await addMessageWithTyping('assistant', responseText);
  } catch (err) {
    typingEl.remove();
    addMessage('assistant', `Error: ${err.message || 'Failed to get response'}`);
  }
}

aiSendBtn.addEventListener('click', sendAiMessage);
aiChatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAiMessage();
  }
});

// ===== SETTINGS =====
function toggleSettings(show) {
  settingsPanel.classList.toggle('hidden', !show);
}

settingsBtn.addEventListener('click', () => toggleSettings(true));
settingsClose.addEventListener('click', () => toggleSettings(false));

// ===== API KEYS =====
async function saveKeys(source) {
  const providers = ['openai', 'gemini', 'deepseek'];
  let savedCount = 0;

  for (const provider of providers) {
    const keyInput = source === 'overlay' ? $(`overlay-${provider}`) : $(`${provider}-key`);
    const modelInput = source === 'overlay' ? null : $(`${provider}-model`);

    // Get key value - only if input is visible (not showing badge)
    const keyStatusEl = $(`${provider}-status`);
    const keyIsEditing = !keyStatusEl || keyStatusEl.classList.contains('hidden');
    const key = (keyIsEditing && keyInput) ? keyInput.value.trim() : '';

    // Get model value - check if input is visible or get from display
    const modelStatusEl = $(`${provider}-model-status`);
    const modelIsEditing = !modelStatusEl || modelStatusEl.classList.contains('hidden');
    let model = '';
    if (modelIsEditing && modelInput) {
      model = modelInput.value.trim();
    }

    if (key || model) {
      await window.arsenal.saveKey(provider, key, model);
      savedCount++;
    }
  }

  if (savedCount === 0) {
    return 'No changes to save';
  }

  return 'Settings saved ✓';
}

async function checkKeys() {
  try {
    const data = await window.arsenal.loadKeys();
    // data is now { provider: { hasKey: bool, model: string } }

    const hasAny = Object.values(data).some(d => d.hasKey);

    // Update key status UI and pre-fill model inputs
    for (const [provider, info] of Object.entries(data)) {
      const keyInput = $(`${provider}-key`);
      const modelInput = $(`${provider}-model`);
      const statusEl = $(`${provider}-status`);
      const modelStatusEl = $(`${provider}-model-status`);
      const modelDisplayEl = $(`${provider}-model-display`);

      if (info.hasKey) {
        // Show "Key Added" badge, hide input
        if (statusEl) statusEl.classList.remove('hidden');
        if (keyInput) keyInput.classList.add('hidden');
      } else {
        // Show input, hide badge
        if (statusEl) statusEl.classList.add('hidden');
        if (keyInput) keyInput.classList.remove('hidden');
      }

      // Handle model status
      if (info.model) {
        if (modelStatusEl) modelStatusEl.classList.remove('hidden');
        if (modelInput) {
          modelInput.classList.add('hidden');
          modelInput.value = info.model; // Always keep value in sync
        }
        if (modelDisplayEl) modelDisplayEl.textContent = info.model;
      } else {
        if (modelStatusEl) modelStatusEl.classList.add('hidden');
        if (modelInput) modelInput.classList.remove('hidden');
      }
    }

    // Update dropdown options based on available keys
    const select = document.getElementById('ai-provider');
    if (select) {
      const currentVal = select.value;
      select.innerHTML = '';

      const providerNames = {
        openai: 'OpenAI',
        gemini: 'Google Gemini',
        deepseek: 'DeepSeek'
      };

      let hasValidSelection = false;

      for (const [provider, info] of Object.entries(data)) {
        if (info.hasKey) {
          const option = document.createElement('option');
          option.value = provider;
          // Show custom model name in dropdown if available
          const modelDisplay = info.model ? ` (${info.model})` : '';
          option.textContent = `${providerNames[provider]}${modelDisplay}`;
          select.appendChild(option);

          if (provider === currentVal) hasValidSelection = true;
        }
      }

      if (select.options.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'No API Keys Saved';
        option.disabled = true;
        select.appendChild(option);
      } else if (hasValidSelection) {
        select.value = currentVal;
      } else {
        select.selectedIndex = 0;
      }
    }

    // Don't show overlay on startup - users can access settings manually
    // if (!hasAny) {
    //   overlay.classList.remove('hidden');
    // } else {
    overlay.classList.add('hidden');
    // }
  } catch (err) {
    console.error('Error checking keys:', err);
  }
}

saveKeysBtn.addEventListener('click', async () => {
  saveStatus.textContent = 'Saving...';
  try {
    const msg = await saveKeys('settings');
    saveStatus.textContent = msg;
    // Refresh dropdown
    await checkKeys();
  } catch (err) {
    saveStatus.textContent = err.message || 'Failed';
  }
});

overlaySave.addEventListener('click', async () => {
  overlayStatus.textContent = 'Saving...';
  try {
    const msg = await saveKeys('overlay');
    overlayStatus.textContent = msg;
    // Refresh dropdown
    await checkKeys();
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 500);
  } catch (err) {
    overlayStatus.textContent = err.message || 'Failed';
  }
});

overlayDismiss.addEventListener('click', () => {
  overlay.classList.add('hidden');
});

// ===== EDIT KEY BUTTONS =====
document.querySelectorAll('.edit-key-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const provider = e.target.dataset.provider;
    const isModel = e.target.dataset.type === 'model';

    if (isModel) {
      const modelInput = $(`${provider}-model`);
      const modelStatusEl = $(`${provider}-model-status`);

      if (modelStatusEl) modelStatusEl.classList.add('hidden');
      if (modelInput) {
        modelInput.classList.remove('hidden');
        modelInput.focus();
        modelInput.select();
      }
    } else {
      const keyInput = $(`${provider}-key`);
      const statusEl = $(`${provider}-status`);

      if (statusEl) statusEl.classList.add('hidden');
      if (keyInput) {
        keyInput.classList.remove('hidden');
        keyInput.value = '';
        keyInput.placeholder = 'Enter new key...';
        keyInput.focus();
      }
    }
  });
});

// ===== SHORTCUTS =====
document.addEventListener('keydown', (e) => {
  // Toggle DevTools: Cmd+D or Ctrl+D
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    window.arsenal.toggleDevTools();
  }
});

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  const savedMode = localStorage.getItem('arsenal-mode') || 'green';
  setMode(savedMode);
  checkKeys();
  createTab(); // Create initial tab
});
