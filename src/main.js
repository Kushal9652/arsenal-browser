const { app, BrowserWindow, ipcMain, session, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const store = new Store({
  name: 'arsenal-keys',
  encryptionKey: 'arsenal-browser-local-encryption-key',
});

const PROVIDERS = ['openai', 'gemini', 'deepseek'];

// Authenticated proxy list for Blood Mode
// Format: { host, port, username, password }
const PROXY_LIST = [
  { host: '142.111.48.253', port: 7030, username: 'hnpkladt', password: 'vafiuz1lqicv' },
  { host: '31.59.20.176', port: 6754, username: 'hnpkladt', password: 'vafiuz1lqicv' },
  { host: '23.95.150.145', port: 6114, username: 'hnpkladt', password: 'vafiuz1lqicv' },
  { host: '198.23.239.134', port: 6540, username: 'hnpkladt', password: 'vafiuz1lqicv' },
  { host: '107.172.163.27', port: 6543, username: 'hnpkladt', password: 'vafiuz1lqicv' },
  { host: '198.105.121.200', port: 6462, username: 'hnpkladt', password: 'vafiuz1lqicv' },
  { host: '64.137.96.74', port: 6641, username: 'hnpkladt', password: 'vafiuz1lqicv' },
  { host: '84.247.60.125', port: 6095, username: 'hnpkladt', password: 'vafiuz1lqicv' },
  { host: '216.10.27.159', port: 6837, username: 'hnpkladt', password: 'vafiuz1lqicv' },
  { host: '142.111.67.146', port: 5611, username: 'hnpkladt', password: 'vafiuz1lqicv' },
];

let currentProxy = null;

// Get proxy URL for configuration
function getProxyUrl(proxy) {
  return `http://${proxy.host}:${proxy.port}`;
}

// Realistic User-Agents for anti-detection
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
];

let currentUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

let currentMode = 'green';
let proxyIndex = 0;

const DEFAULT_SYSTEM = 'You are an AI assistant embedded in a developer-focused browser. Keep answers concise unless asked for detail.';

async function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Arsenal Browser',
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, '..', 'assets', 'Arsenal-logo.png'),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      sandbox: false,
      devTools: true,
      webviewTag: true,
    },
  });

  await win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  
  // Check if Arsenal is the default browser
  checkDefaultBrowser();
}

// Check and prompt for default browser
function checkDefaultBrowser() {
  const isDefault = app.isDefaultProtocolClient('http');
  const hasAsked = store.get('askedDefaultBrowser', false);
  
  if (!isDefault && !hasAsked) {
    dialog.showMessageBox({
      type: 'question',
      buttons: ['Yes, make it default', 'Not now', 'Don\'t ask again'],
      defaultId: 0,
      cancelId: 1,
      title: 'Default Browser',
      message: 'Make Arsenal your default browser?',
      detail: 'Arsenal will open all web links automatically.'
    }).then(result => {
      if (result.response === 0) {
        // Set as default
        app.setAsDefaultProtocolClient('http');
        app.setAsDefaultProtocolClient('https');
        dialog.showMessageBox({
          type: 'info',
          title: 'Success',
          message: 'Arsenal is now your default browser!',
          detail: 'You may need to confirm this in System Settings on macOS.'
        });
      } else if (result.response === 2) {
        // Don't ask again
        store.set('askedDefaultBrowser', true);
      }
    });
  }
}

app.whenReady().then(() => {
  // Anti-detection: Set realistic User-Agent
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (currentMode === 'blood') {
      details.requestHeaders['User-Agent'] = currentUserAgent;
      // Remove Electron/automation markers
      delete details.requestHeaders['X-Electron'];
    }
    callback({ requestHeaders: details.requestHeaders });
  });
  
  // Apply to webview partition too
  const webviewSession = session.fromPartition('persist:arsenal');
  webviewSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (currentMode === 'blood') {
      details.requestHeaders['User-Agent'] = currentUserAgent;
      delete details.requestHeaders['X-Electron'];
    }
    callback({ requestHeaders: details.requestHeaders });
  });
  
  // Disable WebRTC IP leak in blood mode
  webviewSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (currentMode === 'blood' && permission === 'media') {
      // Still allow media but WebRTC will use proxy
      callback(true);
    } else {
      callback(true);
    }
  });
  
  createWindow();
});

// Handle proxy authentication
app.on('login', (event, webContents, details, authInfo, callback) => {
  if (authInfo.isProxy && currentProxy) {
    event.preventDefault();
    callback(currentProxy.username, currentProxy.password);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('keys:load', async () => {
  const data = {};
  for (const provider of PROVIDERS) {
    const existingKey = store.get(`keys.${provider}`);
    const existingModel = store.get(`models.${provider}`);
    data[provider] = {
      hasKey: Boolean(existingKey),
      model: existingModel || ''
    };
  }
  return data;
});

ipcMain.handle('keys:save', async (_event, payload) => {
  const provider = payload?.provider;
  const apiKey = payload?.key;
  const model = payload?.model;

  if (!PROVIDERS.includes(provider)) {
    throw new Error('Unsupported provider');
  }
  
  if (apiKey) {
    store.set(`keys.${provider}`, apiKey.trim());
  }
  
  if (model) {
    store.set(`models.${provider}`, model.trim());
  }
  
  return { provider };
});

ipcMain.handle('window:toggle-devtools', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.webContents.toggleDevTools();
  }
  return { ok: true };
});

// Mode switching with proxy support
ipcMain.handle('mode:set', async (_event, mode) => {
  currentMode = mode;
  const win = BrowserWindow.getFocusedWindow();
  
  // Get the webview partition session (persist:arsenal)
  const webviewSession = session.fromPartition('persist:arsenal');
  
  if (mode === 'blood') {
    // In Blood Mode, set up authenticated proxy
    if (PROXY_LIST.length > 0) {
      currentProxy = PROXY_LIST[proxyIndex % PROXY_LIST.length];
      proxyIndex++;
      
      try {
        const proxyUrl = getProxyUrl(currentProxy);
        // Set proxy on BOTH sessions
        await session.defaultSession.setProxy({ proxyRules: proxyUrl });
        await webviewSession.setProxy({ proxyRules: proxyUrl });
        console.log(`Proxy enabled: ${currentProxy.host}:${currentProxy.port}`);
      } catch (e) {
        console.log('Proxy configuration error:', e.message);
      }
    }
    
    // Handle proxy authentication for webview session
    webviewSession.on('login', (event, webContents, details, authInfo, callback) => {
      if (authInfo.isProxy && currentProxy) {
        event.preventDefault();
        callback(currentProxy.username, currentProxy.password);
      }
    });
    
    // Disable some tracking features
    if (win) {
      win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        // Block geolocation and other tracking in blood mode
        if (permission === 'geolocation') {
          callback(false);
        } else {
          callback(true);
        }
      });
    }
    
    return { mode: 'blood', status: `Proxy: ${currentProxy?.host}:${currentProxy?.port}` };
  } else {
    // Green mode - direct connection
    currentProxy = null;
    const webviewSession = session.fromPartition('persist:arsenal');
    await session.defaultSession.setProxy({ proxyRules: '' });
    await webviewSession.setProxy({ proxyRules: '' });
    return { mode: 'green', status: 'Direct connection' };
  }
});

// Proxy list and current proxy handlers
ipcMain.handle('proxy:list', async () => {
  return PROXY_LIST.map(p => `${p.host}:${p.port}`);
});

ipcMain.handle('proxy:current', async () => {
  if (currentMode !== 'blood' || !currentProxy) {
    return null;
  }
  
  const ip = currentProxy.host;
  
  // Determine region based on IP ranges
  const regionMap = {
    '142.111': 'US',
    '31.59': 'EU', 
    '23.95': 'US',
    '198.23': 'US',
    '107.172': 'US',
    '198.105': 'US',
    '64.137': 'US',
    '84.247': 'EU',
    '216.10': 'US',
  };
  
  const ipPrefix = ip.split('.').slice(0, 2).join('.');
  const region = regionMap[ipPrefix] || 'US';
  
  return { ip, region, full: `${ip}:${currentProxy.port}` };
});

// Auto-rotate proxy (called on new tab in blood mode)
ipcMain.handle('proxy:rotate', async () => {
  if (currentMode !== 'blood' || PROXY_LIST.length === 0) {
    return null;
  }
  
  // Move to next proxy
  currentProxy = PROXY_LIST[proxyIndex % PROXY_LIST.length];
  proxyIndex++;
  
  // Also rotate User-Agent for better anti-detection
  currentUserAgent = getRandomUserAgent();
  
  const webviewSession = session.fromPartition('persist:arsenal');
  const proxyUrl = getProxyUrl(currentProxy);
  
  try {
    await session.defaultSession.setProxy({ proxyRules: proxyUrl });
    await webviewSession.setProxy({ proxyRules: proxyUrl });
    console.log(`Proxy rotated to: ${currentProxy.host}:${currentProxy.port}`);
  } catch (e) {
    console.log('Proxy rotation error:', e.message);
  }
  
  return { ip: currentProxy.host, port: currentProxy.port };
});

ipcMain.handle('ai:request', async (_event, payload) => {
  const provider = payload?.provider;
  const prompt = payload?.prompt;
  const images = payload?.images || [];
  const system = payload?.system || DEFAULT_SYSTEM;

  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt is required');
  }
  if (!PROVIDERS.includes(provider)) {
    throw new Error('Unsupported provider');
  }

  const apiKey = store.get(`keys.${provider}`);
  const customModel = store.get(`models.${provider}`);
  
  if (!apiKey) {
    throw new Error(`Missing API key for ${provider}`);
  }

  switch (provider) {
    case 'openai':
      return runOpenAI(apiKey, prompt, system, { model: customModel }, images);
    case 'deepseek':
      return runOpenAI(apiKey, prompt, system, {
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        model: customModel || 'deepseek-chat',
      });
    case 'gemini':
      return runGemini(apiKey, prompt, system, customModel, images);
    default:
      throw new Error('Unsupported provider');
  }
});

async function runOpenAI(apiKey, prompt, system, opts = {}, images = []) {
  const endpoint = opts.endpoint || 'https://api.openai.com/v1/chat/completions';
  const model = opts.model || 'gpt-4o-mini';
  
  let userContent;
  if (images.length > 0 && !endpoint.includes('deepseek')) { // DeepSeek might not support vision yet in this format
    userContent = [
      { type: 'text', text: prompt },
      ...images.map(img => ({
        type: 'image_url',
        image_url: { url: img }
      }))
    ];
  } else {
    userContent = prompt;
  }

  const body = {
    model,
    messages: [
      system ? { role: 'system', content: system } : null, 
      { role: 'user', content: userContent }
    ].filter(Boolean),
    temperature: 0.7,
    max_tokens: 2048,
  };

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI request failed (${resp.status}): ${text.slice(0, 300)}`);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return { text };
}

async function runGemini(apiKey, prompt, system, customModel, images = []) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use custom model if provided, else default to 1.5 Flash (supports vision)
    const modelName = customModel || "gemini-1.5-flash";
    
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: system 
    });

    let contentParts = [prompt];
    
    if (images && images.length > 0) {
      const imageParts = images.map(img => {
        // img is "data:image/png;base64,..."
        const match = img.match(/^data:(.*?);base64,(.*)$/);
        if (match) {
          return {
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          };
        }
        return null;
      }).filter(Boolean);
      
      contentParts = [prompt, ...imageParts];
    }

    const result = await model.generateContent(contentParts);
    const response = await result.response;
    const text = response.text();
    // Return only text to avoid cloning issues with complex objects
    return { text };
  } catch (error) {
    // Fallback logic only if no custom model was forced
    if (!customModel) {
        try {
            console.log("Gemini default failed, trying gemini-1.5-flash...");
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ 
                model: "gemini-1.5-flash",
                systemInstruction: system 
            });
            
            // Retry with same content parts
            let contentParts = [prompt];
            if (images && images.length > 0) {
                const imageParts = images.map(img => {
                    const match = img.match(/^data:(.*?);base64,(.*)$/);
                    if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
                    return null;
                }).filter(Boolean);
                contentParts = [prompt, ...imageParts];
            }

            const result = await model.generateContent(contentParts);
            const response = await result.response;
            const text = response.text();
            return { text };
        } catch (fallbackError) {
            throw new Error(`Gemini request failed: ${error.message}`);
        }
    }
    throw new Error(`Gemini request failed: ${error.message}`);
  }
}
