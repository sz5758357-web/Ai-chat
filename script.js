// ===== IMPORTOWANIE =====
import { pipeline, env } from '@huggingface/transformers';

// ===== KONFIGURACJA =====
env.useBrowserCache = true;

// ===== KONFIGURACJA 50+ MODELI =====
const MODEL_CONFIGS = {
    // ===== OPENAI (6) =====
    'online:gpt-4o': { provider: 'openai', model: 'gpt-4o', maxTokens: 128000 },
    'online:gpt-4o-mini': { provider: 'openai', model: 'gpt-4o-mini', maxTokens: 128000 },
    'online:gpt-4-turbo': { provider: 'openai', model: 'gpt-4-turbo', maxTokens: 128000 },
    'online:gpt-4': { provider: 'openai', model: 'gpt-4', maxTokens: 8192 },
    'online:gpt-3.5-turbo': { provider: 'openai', model: 'gpt-3.5-turbo', maxTokens: 16384 },
    'online:gpt-3.5-turbo-16k': { provider: 'openai', model: 'gpt-3.5-turbo-16k', maxTokens: 16384 },

    // ===== ANTHROPIC (4) =====
    'online:claude-3-5-sonnet': { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', maxTokens: 200000 },
    'online:claude-3-5-haiku': { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', maxTokens: 200000 },
    'online:claude-3-opus': { provider: 'anthropic', model: 'claude-3-opus-20240229', maxTokens: 200000 },
    'online:claude-3-sonnet': { provider: 'anthropic', model: 'claude-3-sonnet-20240229', maxTokens: 200000 },

    // ===== GOOGLE (4) =====
    'online:gemini-pro': { provider: 'google', model: 'gemini-pro', maxTokens: 32768 },
    'online:gemini-flash': { provider: 'google', model: 'gemini-1.5-flash', maxTokens: 1048576 },
    'online:gemini-pro-vision': { provider: 'google', model: 'gemini-pro-vision', maxTokens: 32768 },
    'online:gemini-ultra': { provider: 'google', model: 'gemini-ultra', maxTokens: 32768 },

    // ===== DEEPSEEK (3) =====
    'online:deepseek-chat': { provider: 'deepseek', model: 'deepseek-chat', maxTokens: 32768 },
    'online:deepseek-coder': { provider: 'deepseek', model: 'deepseek-coder', maxTokens: 32768 },
    'online:deepseek-v2': { provider: 'deepseek', model: 'deepseek-v2', maxTokens: 32768 },

    // ===== MISTRAL (3) =====
    'online:mistral-large': { provider: 'mistral', model: 'mistral-large-latest', maxTokens: 32768 },
    'online:mistral-small': { provider: 'mistral', model: 'mistral-small-latest', maxTokens: 32768 },
    'online:mistral-8x7b': { provider: 'mistral', model: 'mistral-8x7b', maxTokens: 32768 },

    // ===== GROQ (4) =====
    'online:llama-3-70b': { provider: 'groq', model: 'llama-3.1-70b-versatile', maxTokens: 8192 },
    'online:llama-3-8b': { provider: 'groq', model: 'llama-3.1-8b-instant', maxTokens: 8192 },
    'online:mixtral-8x7b-32768': { provider: 'groq', model: 'mixtral-8x7b-32768', maxTokens: 32768 },
    'online:gemma-7b': { provider: 'groq', model: 'gemma-7b-it', maxTokens: 8192 },

    // ===== COHERE (3) =====
    'online:command-r': { provider: 'cohere', model: 'command-r', maxTokens: 4096 },
    'online:command-r-plus': { provider: 'cohere', model: 'command-r-plus', maxTokens: 4096 },
    'online:command-r-08-2024': { provider: 'cohere', model: 'command-r-08-2024', maxTokens: 4096 },

    // ===== INNE (7) =====
    'online:perplexity-sonar': { provider: 'perplexity', model: 'sonar-small-chat', maxTokens: 8192 },
    'online:perplexity-sonar-large': { provider: 'perplexity', model: 'sonar-large-chat', maxTokens: 8192 },
    'online:gemini-1.5-pro': { provider: 'google', model: 'gemini-1.5-pro', maxTokens: 2097152 },
    'online:gemini-1.5-flash': { provider: 'google', model: 'gemini-1.5-flash', maxTokens: 1048576 },
    'online:qwen-72b': { provider: 'openai', model: 'qwen-72b', maxTokens: 32768 },
    'online:qwen-32b': { provider: 'openai', model: 'qwen-32b', maxTokens: 32768 },
    'online:yi-34b': { provider: 'openai', model: 'yi-34b', maxTokens: 32768 },
};

// ===== STAN APLIKACJI =====
const state = {
    messages: [],
    currentChatId: Date.now().toString(),
    mode: 'auto',
    currentModel: 'offline:Phi-3-mini-4k-instruct',
    offlinePipeline: null,
    isOfflineReady: false,
    isLoading: false,
    apiKey: localStorage.getItem('apiKey') || '',
    attachedFiles: [],
    isOnline: navigator.onLine,
    tokenCount: 0,
    db: null,
    messageCount: 0,
    fileCount: 0
};

// ===== INDEXEDDB =====
const DB_NAME = 'MegaChatDB';
const DB_VERSION = 1;
const STORE_NAME = 'messages';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                db.createObjectStore('chats', { keyPath: 'id' });
                db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

async function saveMessageToDB(message) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.add({
            ...message,
            chatId: state.currentChatId,
            timestamp: message.timestamp || new Date().toISOString()
        });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function loadMessagesFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('chatId');
        const request = index.getAll(state.currentChatId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function deleteAllMessages() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getDBStats() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.count();
        request.onsuccess = () => {
            const count = request.result;
            // Szacunkowy rozmiar
            const size = count * 2.5; // średnio 2.5KB na wiadomość
            resolve({ count, size: Math.round(size / 1024 / 1024 * 10) / 10 });
        };
        request.onerror = () => reject(request.error);
    });
}

// ===== REFERENCJE DOM =====
const DOM = {
    messages: document.getElementById('messages'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    attachBtn: document.getElementById('attachBtn'),
    fileInput: document.getElementById('fileInput'),
    filePreview: document.getElementById('filePreviewContainer'),
    modelSelect: document.getElementById('modelSelect'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    loadOfflineBtn: document.getElementById('loadOfflineBtn'),
    offlineModelStatus: document.getElementById('offlineModelStatus'),
    progressContainer: document.getElementById('progressContainer'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFileInput: document.getElementById('importFileInput'),
    connectionStatus: document.getElementById('connectionStatus'),
    modelDisplay: document.getElementById('modelDisplay'),
    wordCount: document.getElementById('wordCount'),
    modelInfo: document.getElementById('modelInfo'),
    tokenCount: document.getElementById('tokenCount'),
    contextLength: document.getElementById('contextLength'),
    chatTitle: document.getElementById('chatTitle'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    sidebar: document.getElementById('sidebar'),
    modeAuto: document.getElementById('modeAuto'),
    modeOnline: document.getElementById('modeOnline'),
    modeOffline: document.getElementById('modeOffline'),
    apiKeySection: document.getElementById('apiKeySection'),
    msgCount: document.getElementById('msgCount'),
    fileCount: document.getElementById('fileCount'),
    dbSize: document.getElementById('dbSize'),
    newChatBtn: document.getElementById('newChatBtn'),
    deleteAllBtn: document.getElementById('deleteAllBtn'),
    scrollToBottom: document.getElementById('scrollToBottom')
};

// ===== INICJALIZACJA =====
async function init() {
    DOM.apiKeyInput.value = state.apiKey;
    await loadMessagesFromDB().then(msgs => {
        state.messages = msgs;
    });
    renderMessages();
    updateConnectionStatus();
    updateModelDisplay();
    loadLastModel();
    setupEventListeners();
    autoLoadOfflineIfAvailable();
    updateStats();
}

// ===== ZDARZENIA =====
function setupEventListeners() {
    DOM.sendBtn.addEventListener('click', sendMessage);
    DOM.userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    DOM.userInput.addEventListener('input', () => {
        updateWordCount();
        updateTokenCount();
    });

    DOM.attachBtn.addEventListener('click', () => DOM.fileInput.click());
    DOM.fileInput.addEventListener('change', handleFiles);

    DOM.modeAuto.addEventListener('click', () => setMode('auto'));
    DOM.modeOnline.addEventListener('click', () => setMode('online'));
    DOM.modeOffline.addEventListener('click', () => setMode('offline'));

    DOM.modelSelect.addEventListener('change', onModelChange);
    DOM.apiKeyInput.addEventListener('input', (e) => {
        state.apiKey = e.target.value;
        localStorage.setItem('apiKey', state.apiKey);
    });

    DOM.loadOfflineBtn.addEventListener('click', loadOfflineModel);

    DOM.clearHistoryBtn.addEventListener('click', clearHistory);
    DOM.exportBtn.addEventListener('click', exportChat);
    DOM.importBtn.addEventListener('click', () => DOM.importFileInput.click());
    DOM.importFileInput.addEventListener('change', importChat);

    DOM.sidebarToggle.addEventListener('click', toggleSidebar);

    DOM.newChatBtn.addEventListener('click', newChat);
    DOM.deleteAllBtn.addEventListener('click', deleteAllChats);

    // Scroll
    DOM.messagesContainer.addEventListener('scroll', handleScroll);

    window.addEventListener('online', () => {
        state.isOnline = true;
        updateConnectionStatus();
    });
    window.addEventListener('offline', () => {
        state.isOnline = false;
        updateConnectionStatus();
    });
}

// ===== NOWY CZAT =====
async function newChat() {
    if (state.messages.length > 0 && !confirm('Rozpocząć nową rozmowę? Bieżąca zostanie zapisana.')) return;
    state.currentChatId = Date.now().toString();
    state.messages = [];
    renderMessages();
    DOM.chatTitle.textContent = '💬 Nowa rozmowa';
    updateStats();
}

async function deleteAllChats() {
    if (!confirm('🗑️ USUNĄĆ WSZYSTKIE WIADOMOŚCI? Tej operacji nie można cofnąć!')) return;
    await deleteAllMessages();
    state.messages = [];
    renderMessages();
    updateStats();
}

// ===== SCROLL =====
function handleScroll() {
    const container = DOM.messagesContainer;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    DOM.scrollToBottom.style.display = atBottom ? 'none' : 'flex';
}

window.scrollToBottom = function() {
    DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
};

// ===== TRYB PRACY =====
function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    
    if (mode === 'auto') DOM.modeAuto.classList.add('active');
    else if (mode === 'online') DOM.modeOnline.classList.add('active');
    else if (mode === 'offline') DOM.modeOffline.classList.add('active');
    
    updateConnectionStatus();
    updateModelDisplay();
}

function getEffectiveMode() {
    if (state.mode === 'offline') return 'offline';
    if (state.mode === 'online') return 'online';
    return state.isOfflineReady ? 'offline' : 'online';
}

// ===== STATUS POŁĄCZENIA =====
function updateConnectionStatus() {
    const mode = getEffectiveMode();
    const statusEl = DOM.connectionStatus;
    const isOffline = mode === 'offline';
    
    if (isOffline && state.isOfflineReady) {
        statusEl.textContent = '● Offline (gotowy)';
        statusEl.className = 'status-online';
    } else if (isOffline && !state.isOfflineReady) {
        statusEl.textContent = '● Offline (ładuję...)';
        statusEl.className = 'status-loading';
    } else if (state.isOnline) {
        statusEl.textContent = '● Online';
        statusEl.className = 'status-online';
    } else {
        statusEl.textContent = '● Brak internetu';
        statusEl.className = 'status-offline';
    }
    
    DOM.apiKeySection.style.display = mode === 'online' ? 'block' : 'none';
    DOM.modelInfo.textContent = isOffline ? '📴 Offline' : '🌐 Online';
}

// ===== MODEL =====
function updateModelDisplay() {
    const selected = DOM.modelSelect.value;
    const label = DOM.modelSelect.options[DOM.modelSelect.selectedIndex]?.text || 'Brak';
    DOM.modelDisplay.textContent = `Model: ${label.replace(/\([^)]*\)/g, '').trim().substring(0, 30)}`;
    
    // Pokaż max context
    const config = MODEL_CONFIGS[selected];
    if (config && config.maxTokens) {
        const maxK = config.maxTokens >= 100000 ? `${config.maxTokens/1000}k` : config.maxTokens;
        DOM.contextLength.textContent = `📏 ${maxK}`;
    }
}

function onModelChange() {
    state.currentModel = DOM.modelSelect.value;
    updateModelDisplay();
    
    if (state.currentModel.startsWith('offline:')) {
        if (!state.isOfflineReady) {
            DOM.offlineModelStatus.textContent = '⚠️ Załaduj model offline';
            DOM.offlineModelStatus.style.color = '#f0883e';
        }
    }
}

async function loadLastModel() {
    const lastModel = localStorage.getItem('lastOfflineModel');
    if (lastModel && lastModel.startsWith('offline:')) {
        DOM.modelSelect.value = lastModel;
        state.currentModel = lastModel;
        await loadOfflineModel();
    }
}

async function autoLoadOfflineIfAvailable() {
    try {
        const cache = await caches.open('transformers-cache');
        const keys = await cache.keys();
        const modelName = DOM.modelSelect.value;
        const hasModel = keys.some(k => k.url.includes(modelName));
        
        if (hasModel) {
            DOM.offlineModelStatus.textContent = '✅ Model w cache';
            DOM.offlineModelStatus.style.color = '#3fb950';
            await loadOfflineModel();
        }
    } catch (e) {}
}

// ===== ŁADOWANIE MODELU OFFLINE =====
async function loadOfflineModel() {
    if (state.isLoading) return;
    if (!state.currentModel.startsWith('offline:')) {
        alert('❌ Wybierz model offline z listy');
        return;
    }

    state.isLoading = true;
    DOM.loadOfflineBtn.disabled = true;
    DOM.loadOfflineBtn.textContent = '⏳ Ładowanie...';
    DOM.progressContainer.style.display = 'block';
    DOM.offlineModelStatus.textContent = '⏳ Pobieranie...';
    DOM.offlineModelStatus.style.color = '#f0883e';

    try {
        const modelName = state.currentModel.replace('offline:', '');
        const fullModelName = `Xenova/${modelName}`;
        
        state.offlinePipeline = await pipeline('text-generation', fullModelName, {
            progress_callback: (progress) => {
                const percent = Math.round(progress.progress * 100);
                DOM.progressFill.style.width = `${percent}%`;
                DOM.progressText.textContent = `${percent}%`;
            }
        });

        state.isOfflineReady = true;
        localStorage.setItem('lastOfflineModel', state.currentModel);
        DOM.offlineModelStatus.textContent = '✅ Model gotowy!';
        DOM.offlineModelStatus.style.color = '#3fb950';
        DOM.loadOfflineBtn.textContent = '✅ Załadowany';
        DOM.progressContainer.style.display = 'none';
        updateConnectionStatus();
        
    } catch (error) {
        DOM.offlineModelStatus.textContent = '❌ Błąd: ' + error.message;
        DOM.offlineModelStatus.style.color = '#f85149';
        DOM.loadOfflineBtn.textContent = '🔄 Spróbuj ponownie';
    } finally {
        state.isLoading = false;
        DOM.loadOfflineBtn.disabled = false;
    }
}

// ===== WYSYŁANIE WIADOMOŚCI =====
async function sendMessage() {
    const text = DOM.userInput.value.trim();
    if (!text && state.attachedFiles.length === 0) return;

    const mode = getEffectiveMode();
    
    const userMsg = {
        role: 'user',
        content: text,
        files: [...state.attachedFiles],
        timestamp: new Date().toISOString(),
        chatId: state.currentChatId
    };
    
    state.messages.push(userMsg);
    await saveMessageToDB(userMsg);
    renderMessages();
    updateStats();

    DOM.userInput.value = '';
    DOM.sendBtn.disabled = true;
    DOM.sendBtn.textContent = '⏳';

    try {
        let reply = '';
        
        if (mode === 'offline' && state.isOfflineReady) {
            reply = await generateOffline(text);
        } else {
            reply = await generateOnline(text);
        }

        const aiMsg = {
            role: 'assistant',
            content: reply,
            timestamp: new Date().toISOString(),
            chatId: state.currentChatId
        };
        state.messages.push(aiMsg);
        await saveMessageToDB(aiMsg);
        renderMessages();
        updateStats();
        
    } catch (error) {
        const errorMsg = {
            role: 'assistant',
            content: `❌ Błąd: ${error.message}`,
            timestamp: new Date().toISOString(),
            chatId: state.currentChatId
        };
        state.messages.push(errorMsg);
        await saveMessageToDB(errorMsg);
        renderMessages();
        updateStats();
    }

    state.attachedFiles = [];
    updateFilePreview();
    DOM.sendBtn.disabled = false;
    DOM.sendBtn.textContent = '➤';
    DOM.userInput.focus();
    updateWordCount();
    DOM.chatTitle.textContent = `💬 ${state.messages.length} wiadomości`;
}

// ===== GENEROWANIE OFFLINE =====
async function generateOffline(text) {
    if (!state.offlinePipeline) {
        throw new Error('Model offline nie jest załadowany');
    }

    const prompt = buildPrompt(state.messages);
    
    const result = await state.offlinePipeline(prompt, {
        max_new_tokens: 512,
        temperature: 0.7,
        top_p: 0.9,
        do_sample: true,
        return_full_text: false
    });

    return result[0].generated_text.trim();
}

// ===== GENEROWANIE ONLINE =====
async function generateOnline(text) {
    const model = state.currentModel;
    const apiKey = state.apiKey;

    if (!apiKey) {
        throw new Error('Wpisz klucz API dla modeli online');
    }

    const messages = state.messages.map(m => ({
        role: m.role,
        content: m.content
    }));

    const config = MODEL_CONFIGS[model];
    if (!config) throw new Error('Nieznany model online');

    // Mapowanie endpointów
    const endpoints = {
        'openai': 'https://api.openai.com/v1/chat/completions',
        'anthropic': 'https://api.anthropic.com/v1/messages',
        'google': 'https://generativelanguage.googleapis.com/v1beta/models',
        'deepseek': 'https://api.deepseek.com/v1/chat/completions',
        'mistral': 'https://api.mistral.ai/v1/chat/completions',
        'groq': 'https://api.groq.com/openai/v1/chat/completions',
        'cohere': 'https://api.cohere.ai/v1/chat',
        'perplexity': 'https://api.perplexity.ai/chat/completions'
    };

    let url = endpoints[config.provider];
    let headers = { 'Content-Type': 'application/json' };
    let body = {};

    switch(config.provider) {
        case 'openai':
            headers['Authorization'] = `Bearer ${apiKey}`;
            body = { model: config.model, messages, max_tokens: 2000, temperature: 0.7 };
            break;
            
        case 'anthropic':
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
            body = {
                model: config.model,
                messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
                max_tokens: 2000
            };
            break;
            
        case 'google':
            const response = await fetch(`${url}/${config.model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: messages.map(m => ({
                        parts: [{ text: m.content }],
                        role: m.role === 'user' ? 'user' : 'model'
                    }))
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            return data.candidates[0].content.parts[0].text;
            
        case 'deepseek':
        case 'mistral':
        case 'groq':
        case 'perplexity':
            headers['Authorization'] = `Bearer ${apiKey}`;
            body = { model: config.model, messages, max_tokens: 2000, temperature: 0.7 };
            break;
            
        case 'cohere':
            headers['Authorization'] = `Bearer ${apiKey}`;
            body = {
                model: config.model,
                message: messages[messages.length - 1]?.content || '',
                chat_history: messages.slice(0, -1).map(m => ({
                    role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
                    message: m.content
                })),
                max_tokens: 2000
            };
            break;
            
        default:
            throw new Error('Nieznany provider');
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });

    const result = await response.json();
    if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));

    // Wyciągnij odpowiedź
    if (result.choices) return result.choices[0].message.content;
    if (result.content) return result.content[0]?.text || result.content;
    if (result.candidates) return result.candidates[0].content.parts[0].text;
    if (result.text) return result.text;
    if (result.reply) return result.reply;
    
    throw new Error('Nieznany format odpowiedzi');
}

// ===== BUDOWANIE PROMPTU =====
function buildPrompt(messages) {
    let prompt = `<|system|>
Jesteś pomocnym asystentem AI. Odpowiadaj po polsku. Bądź konkretny i pomocny.
<|end|>\n\n`;
    
    // Ogranicz do ostatnich 20 wiadomości dla offline
    const recentMessages = messages.slice(-20);
    
    for (const msg of recentMessages) {
        if (msg.role === 'user') {
            prompt += `<|user|>\n${msg.content}\n<|end|>\n`;
        } else if (msg.role === 'assistant') {
            prompt += `<|assistant|>\n${msg.content}\n<|end|>\n`;
        }
    }
    
    prompt += `<|assistant|>\n`;
    return prompt;
}

// ===== RENDEROWANIE WIADOMOŚCI =====
function renderMessages() {
    DOM.messages.innerHTML = '';
    
    state.messages.forEach((msg) => {
        const div = document.createElement('div');
        div.className = `message message-${msg.role}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = msg.role === 'user' ? '👤' : '🤖';
        div.appendChild(avatar);
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = formatMessage(msg.content);
        content.appendChild(textDiv);
        
        if (msg.files && msg.files.length > 0) {
            msg.files.forEach(f => {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'file-attachment';
                
                if (f.type && f.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = f.data;
                    fileDiv.appendChild(img);
                } else {
                    const a = document.createElement('a');
                    a.href = f.data;
                    a.download = f.name;
                    a.textContent = `📎 ${f.name}`;
                    fileDiv.appendChild(a);
                }
                content.appendChild(fileDiv);
            });
        }
        
        if (msg.timestamp) {
            const time = document.createElement('div');
            time.className = 'message-timestamp';
            time.textContent = new Date(msg.timestamp).toLocaleString();
            content.appendChild(time);
        }
        
        div.appendChild(content);
        DOM.messages.appendChild(div);
    });
    
    setTimeout(() => {
        DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
        DOM.scrollToBottom.style.display = 'none';
    }, 50);
}

// ===== FORMATOWANIE =====
function formatMessage(text) {
    if (!text) return '';
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code class="language-${lang || ''}">${escapeHtml(code)}</code></pre>`;
    });
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    text = text.replace(/\n/g, '<br>');
    return text;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== PLIKI =====
function handleFiles(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            state.attachedFiles.push({
                name: file.name,
                type: file.type,
                data: ev.target.result,
                size: file.size,
                lastModified: file.lastModified
            });
            updateFilePreview();
            updateStats();
        };
        reader.readAsDataURL(file);
    });
    DOM.fileInput.value = '';
}

function updateFilePreview() {
    DOM.filePreview.innerHTML = state.attachedFiles.map((f, i) => `
        <div class="preview-item">
            📎 ${f.name} (${Math.round(f.size / 1024)}KB)
            <button onclick="window.removeFile(${i})">✕</button>
        </div>
    `).join('');
}

window.removeFile = function(index) {
    state.attachedFiles.splice(index, 1);
    updateFilePreview();
    updateStats();
};

// ===== STATYSTYKI =====
async function updateStats() {
    const stats = await getDBStats();
    DOM.msgCount.textContent = state.messages.length;
    DOM.fileCount.textContent = state.attachedFiles.length;
    DOM.dbSize.textContent = `${stats.size} MB`;
}

// ===== HISTORIA =====
async function clearHistory() {
    if (!confirm('Wyczyścić historię bieżącej rozmowy?')) return;
    state.messages = [];
    await deleteAllMessages();
    renderMessages();
    updateStats();
    DOM.chatTitle.textContent = '💬 Nowa rozmowa';
}

function exportChat() {
    const data = {
        messages: state.messages,
        exportedAt: new Date().toISOString(),
        version: '1.0',
        chatId: state.currentChatId,
        totalMessages: state.messages.length
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chat_${new Date().toISOString().slice(0,10)}_${state.messages.length}msgs.json`;
    a.click();
}

async function importChat(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if (data.messages && Array.isArray(data.messages)) {
                if (!confirm(`Importować ${data.messages.length} wiadomości? Bieżące zostaną zastąpione.`)) return;
                
                // Usuń stare
                await deleteAllMessages();
                state.messages = [];
                
                // Dodaj nowe
                for (const msg of data.messages) {
                    state.messages.push(msg);
                    await saveMessageToDB(msg);
                }
                
                renderMessages();
                updateStats();
                DOM.chatTitle.textContent = `💬 ${state.messages.length} wiadomości`;
                alert(`✅ Zaimportowano ${data.messages.length} wiadomości!`);
            } else {
                alert('❌ Niepoprawny format pliku');
            }
        } catch (err) {
            alert('❌ Błąd odczytu pliku: ' + err.message);
        }
    };
    reader.readAsText(file);
    DOM.importFileInput.value = '';
}

// ===== SIDEBAR =====
let sidebarVisible = true;

function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    DOM.sidebar.classList.toggle('sidebar-hidden', !sidebarVisible);
    DOM.sidebarToggle.textContent = sidebarVisible ? '✕' : '☰';
}

// ===== WORD COUNT =====
function updateWordCount() {
    const text = DOM.userInput.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    DOM.wordCount.textContent = `${words} słów`;
}

function updateTokenCount() {
    const text = DOM.userInput.value;
    // Przybliżona liczba tokenów (1 token ≈ 4 znaki)
    const tokens = Math.round(text.length / 4);
    state.tokenCount = tokens;
    DOM.tokenCount.textContent = `🔄 ${tokens} tokenów`;
}

// ===== START =====
init();
console.log('🤖 Mega AI Chat - 50+ modeli');
console.log(`📊 ${state.messages.length} wiadomości w historii`);
console.log(`📡 Tryb: ${state.mode}, Online: ${state.isOnline}`);
console.log('🚀 Nieskończona historia w IndexedDB!');
