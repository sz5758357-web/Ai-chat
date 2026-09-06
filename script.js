// ===== IMPORTOWANIE =====
import { pipeline, env } from '@huggingface/transformers';

// ===== KONFIGURACJA =====
env.useBrowserCache = true;

// ===== STAN APLIKACJI =====
const state = {
    messages: JSON.parse(localStorage.getItem('chatHistory')) || [],
    mode: 'auto', // auto | online | offline
    currentModel: 'offline:phi3',
    offlinePipeline: null,
    isOfflineReady: false,
    isLoading: false,
    apiKey: localStorage.getItem('apiKey') || '',
    attachedFiles: [],
    isOnline: navigator.onLine
};

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
    chatTitle: document.getElementById('chatTitle'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    sidebar: document.getElementById('sidebar'),
    modeAuto: document.getElementById('modeAuto'),
    modeOnline: document.getElementById('modeOnline'),
    modeOffline: document.getElementById('modeOffline'),
    apiKeySection: document.getElementById('apiKeySection')
};

// ===== INICJALIZACJA =====
function init() {
    DOM.apiKeyInput.value = state.apiKey;
    renderMessages();
    updateConnectionStatus();
    updateModelDisplay();
    loadLastModel();
    setupEventListeners();
    autoLoadOfflineIfAvailable();
}

// ===== ZDARZENIA =====
function setupEventListeners() {
    // Wysyłanie
    DOM.sendBtn.addEventListener('click', sendMessage);
    DOM.userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    DOM.userInput.addEventListener('input', updateWordCount);

    // Pliki
    DOM.attachBtn.addEventListener('click', () => DOM.fileInput.click());
    DOM.fileInput.addEventListener('change', handleFiles);

    // Tryby
    DOM.modeAuto.addEventListener('click', () => setMode('auto'));
    DOM.modeOnline.addEventListener('click', () => setMode('online'));
    DOM.modeOffline.addEventListener('click', () => setMode('offline'));

    // Model
    DOM.modelSelect.addEventListener('change', onModelChange);
    DOM.apiKeyInput.addEventListener('input', (e) => {
        state.apiKey = e.target.value;
        localStorage.setItem('apiKey', state.apiKey);
    });

    // Offline
    DOM.loadOfflineBtn.addEventListener('click', loadOfflineModel);

    // Historia
    DOM.clearHistoryBtn.addEventListener('click', clearHistory);
    DOM.exportBtn.addEventListener('click', exportChat);
    DOM.importBtn.addEventListener('click', () => DOM.importFileInput.click());
    DOM.importFileInput.addEventListener('change', importChat);

    // Sidebar
    DOM.sidebarToggle.addEventListener('click', toggleSidebar);

    // Online/Offline detection
    window.addEventListener('online', () => {
        state.isOnline = true;
        updateConnectionStatus();
    });
    window.addEventListener('offline', () => {
        state.isOnline = false;
        updateConnectionStatus();
    });
}

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
    // Auto - wybierz offline jeśli dostępny, inaczej online
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
    
    // Pokaż/ukryj sekcję klucza API
    DOM.apiKeySection.style.display = mode === 'online' ? 'block' : 'none';
    DOM.modelInfo.textContent = isOffline ? 'Offline: ✅' : 'Online: 🌐';
}

// ===== MODEL =====
function updateModelDisplay() {
    const selected = DOM.modelSelect.value;
    const label = DOM.modelSelect.options[DOM.modelSelect.selectedIndex]?.text || 'Brak';
    DOM.modelDisplay.textContent = `Model: ${label}`;
}

function onModelChange() {
    state.currentModel = DOM.modelSelect.value;
    updateModelDisplay();
    
    // Jeśli offline i nie gotowy - pokaż status
    if (state.currentModel.startsWith('offline:')) {
        if (!state.isOfflineReady) {
            DOM.offlineModelStatus.textContent = '⚠️ Załaduj model offline';
            DOM.offlineModelStatus.style.color = '#f0883e';
        }
    }
}

async function loadLastModel() {
    // Jeśli ostatnio używany offline - spróbuj załadować
    const lastModel = localStorage.getItem('lastOfflineModel');
    if (lastModel && lastModel.startsWith('offline:')) {
        DOM.modelSelect.value = lastModel;
        state.currentModel = lastModel;
        await loadOfflineModel();
    }
}

async function autoLoadOfflineIfAvailable() {
    // Sprawdź czy model jest w cache
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
    } catch (e) {
        // Ignoruj
    }
}

// ===== ŁADOWANIE MODELU OFFLINE =====
async function loadOfflineModel() {
    if (state.isLoading) return;
    if (!state.currentModel.startsWith('offline:')) {
        alert('Wybierz model offline z listy');
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
    
    // Dodaj wiadomość użytkownika
    const userMsg = {
        role: 'user',
        content: text,
        files: [...state.attachedFiles],
        timestamp: new Date().toISOString()
    };
    state.messages.push(userMsg);
    saveHistory();
    renderMessages();

    // Przygotuj do wysłania
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
            timestamp: new Date().toISOString()
        };
        state.messages.push(aiMsg);
        saveHistory();
        renderMessages();

    } catch (error) {
        const errorMsg = {
            role: 'assistant',
            content: `❌ Błąd: ${error.message}`,
            timestamp: new Date().toISOString()
        };
        state.messages.push(errorMsg);
        saveHistory();
        renderMessages();
    }

    state.attachedFiles = [];
    updateFilePreview();
    DOM.sendBtn.disabled = false;
    DOM.sendBtn.textContent = '➤';
    DOM.userInput.focus();
    updateWordCount();
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

    // Mapowanie modeli
    const endpoints = {
        'online:gpt4o': { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
        'online:gpt4o-mini': { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
        'online:claude': { url: 'https://api.anthropic.com/v1/messages', model: 'claude-3-5-sonnet-20241022' },
        'online:gemini': { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', model: 'gemini-pro' },
        'online:deepseek': { url: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
        'online:mistral': { url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
        'online:llama3': { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.1-70b-versatile' }
    };

    const config = endpoints[model];
    if (!config) throw new Error('Nieznany model online');

    let headers = { 'Content-Type': 'application/json' };
    let body = {};

    // Konfiguracja dla różnych API
    if (model === 'online:claude') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        body = {
            model: config.model,
            messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
            max_tokens: 2000
        };
    } else if (model === 'online:gemini') {
        const url = `${config.url}?key=${apiKey}`;
        const response = await fetch(url, {
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
    } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = {
            model: config.model,
            messages: messages,
            max_tokens: 2000,
            temperature: 0.7
        };
    }

    const response = await fetch(config.url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

    // Wyciągnij odpowiedź
    if (data.choices) return data.choices[0].message.content;
    if (data.content) return data.content[0].text;
    if (data.candidates) return data.candidates[0].content.parts[0].text;
    
    throw new Error('Nieznany format odpowiedzi');
}

// ===== BUDOWANIE PROMPTU =====
function buildPrompt(messages) {
    let prompt = `<|system|>
Jesteś pomocnym asystentem AI. Odpowiadaj po polsku. Bądź konkretny i pomocny.
<|end|>\n\n`;
    
    for (const msg of messages) {
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
    
    state.messages.forEach((msg, index) => {
        const div = document.createElement('div');
        div.className = `message message-${msg.role}`;
        
        // Avatar
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = msg.role === 'user' ? '👤' : '🤖';
        div.appendChild(avatar);
        
        // Treść
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = formatMessage(msg.content);
        content.appendChild(textDiv);
        
        // Pliki
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
        
        // Czas
        if (msg.timestamp) {
            const time = document.createElement('div');
            time.className = 'message-timestamp';
            time.textContent = new Date(msg.timestamp).toLocaleTimeString();
            content.appendChild(time);
        }
        
        div.appendChild(content);
        DOM.messages.appendChild(div);
    });
    
    DOM.messages.scrollTop = DOM.messages.scrollHeight;
    DOM.chatTitle.textContent = `💬 ${state.messages.length} wiadomości`;
}

// ===== FORMATOWANIE WIADOMOŚCI =====
function formatMessage(text) {
    // Kod
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code class="language-${lang || ''}">${escapeHtml(code)}</code></pre>`;
    });
    
    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Linki
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    
    // Nowe linie
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
                size: file.size
            });
            updateFilePreview();
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
};

// ===== HISTORIA =====
function saveHistory() {
    localStorage.setItem('chatHistory', JSON.stringify(state.messages));
}

function clearHistory() {
    if (confirm('Wyczyścić całą historię rozmowy?')) {
        state.messages = [];
        saveHistory();
        renderMessages();
    }
}

function exportChat() {
    const data = {
        messages: state.messages,
        exportedAt: new Date().toISOString(),
        version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chat_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
}

function importChat(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if (data.messages && Array.isArray(data.messages)) {
                state.messages = data.messages;
                saveHistory();
                renderMessages();
                alert('✅ Import udany!');
            } else {
                alert('❌ Niepoprawny format pliku');
            }
        } catch (err) {
            alert('❌ Błąd odczytu pliku');
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

// ===== START =====
init();
console.log('🤖 AI Chat Pro - Online/Offline ready!');
console.log(`📊 ${state.messages.length} wiadomości w historii`);
console.log(`📡 Tryb: ${state.mode}, Online: ${state.isOnline}`);
