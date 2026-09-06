// ===== KONFIGURACJA API =====
const API_ENDPOINTS = {
    'gpt-4o': { provider: 'openai', model: 'gpt-4o' },
    'gpt-4o-mini': { provider: 'openai', model: 'gpt-4o-mini' },
    'gpt-4-turbo': { provider: 'openai', model: 'gpt-4-turbo' },
    'gpt-3.5-turbo': { provider: 'openai', model: 'gpt-3.5-turbo' },
    'claude-3-5-sonnet': { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
    'claude-3-haiku': { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
    'gemini-pro': { provider: 'google', model: 'gemini-pro' },
    'gemini-flash': { provider: 'google', model: 'gemini-1.5-flash' },
    'deepseek-chat': { provider: 'deepseek', model: 'deepseek-chat' },
    'mistral-large': { provider: 'mistral', model: 'mistral-large-latest' },
    'llama-3-70b': { provider: 'groq', model: 'llama-3.1-70b-versatile' },
    'mixtral-8x7b': { provider: 'groq', model: 'mixtral-8x7b-32768' }
};

// ===== STAN =====
const state = {
    messages: [],
    mode: 'auto',
    currentModel: 'gpt-4o',
    apiKey: localStorage.getItem('apiKey') || '',
    attachedFiles: [],
    isOnline: navigator.onLine
};

// ===== REFERENCJE =====
const DOM = {
    messages: document.getElementById('messages'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    attachBtn: document.getElementById('attachBtn'),
    fileInput: document.getElementById('fileInput'),
    filePreview: document.getElementById('filePreview'),
    modelSelect: document.getElementById('modelSelect'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    loadOfflineBtn: document.getElementById('loadOfflineBtn'),
    offlineStatus: document.getElementById('offlineStatus'),
    progressContainer: document.getElementById('progressContainer'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    clearBtn: document.getElementById('clearBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFile: document.getElementById('importFile'),
    connectionStatus: document.getElementById('connectionStatus'),
    modelDisplay: document.getElementById('modelDisplay'),
    chatTitle: document.getElementById('chatTitle'),
    wordCount: document.getElementById('wordCount'),
    contextInfo: document.getElementById('contextInfo'),
    newChatBtn: document.getElementById('newChatBtn'),
    toggleSidebar: document.getElementById('toggleSidebar'),
    sidebar: document.getElementById('sidebar'),
    scrollToBottom: document.getElementById('scrollToBottom')
};

// ===== INICJALIZACJA =====
function init() {
    DOM.apiKeyInput.value = state.apiKey;
    loadHistory();
    renderMessages();
    updateUI();
    setupEvents();
}

// ===== ZDARZENIA =====
function setupEvents() {
    DOM.sendBtn.addEventListener('click', sendMessage);
    DOM.userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    DOM.userInput.addEventListener('input', updateUI);

    DOM.attachBtn.addEventListener('click', () => DOM.fileInput.click());
    DOM.fileInput.addEventListener('change', handleFiles);

    // Tryby
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.mode = btn.dataset.mode;
            updateUI();
        });
    });

    DOM.modelSelect.addEventListener('change', () => {
        state.currentModel = DOM.modelSelect.value;
        DOM.modelDisplay.textContent = state.currentModel;
        updateUI();
    });

    DOM.apiKeyInput.addEventListener('input', (e) => {
        state.apiKey = e.target.value;
        localStorage.setItem('apiKey', state.apiKey);
    });

    DOM.clearBtn.addEventListener('click', clearHistory);
    DOM.exportBtn.addEventListener('click', exportChat);
    DOM.importBtn.addEventListener('click', () => DOM.importFile.click());
    DOM.importFile.addEventListener('change', importChat);

    DOM.newChatBtn.addEventListener('click', newChat);
    DOM.toggleSidebar.addEventListener('click', toggleSidebar);

    // Scroll
    DOM.messagesContainer.addEventListener('scroll', handleScroll);

    // Offline
    DOM.loadOfflineBtn.addEventListener('click', loadOfflineModel);

    // Online/Offline
    window.addEventListener('online', () => { state.isOnline = true; updateUI(); });
    window.addEventListener('offline', () => { state.isOnline = false; updateUI(); });
}

// ===== WYSYŁANIE WIADOMOŚCI =====
async function sendMessage() {
    const text = DOM.userInput.value.trim();
    if (!text && state.attachedFiles.length === 0) return;

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

    DOM.userInput.value = '';
    DOM.sendBtn.disabled = true;
    DOM.sendBtn.textContent = '⏳';
    state.attachedFiles = [];
    updateFilePreview();
    updateUI();

    try {
        let reply = '';

        // Sprawdź tryb
        const mode = state.mode === 'auto' 
            ? (state.isOnline ? 'online' : 'offline')
            : state.mode;

        if (mode === 'offline' && state.offlinePipeline) {
            reply = await generateOffline(text);
        } else if (mode === 'online' || state.isOnline) {
            reply = await generateOnline(text);
        } else {
            throw new Error('Brak internetu i modelu offline');
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
            content: `❌ ${error.message}`,
            timestamp: new Date().toISOString()
        };
        state.messages.push(errorMsg);
        saveHistory();
        renderMessages();
    }

    DOM.sendBtn.disabled = false;
    DOM.sendBtn.textContent = '➤';
    DOM.userInput.focus();
    DOM.chatTitle.textContent = `💬 ${state.messages.length} wiadomości`;
}

// ===== GENEROWANIE ONLINE =====
async function generateOnline(text) {
    const model = state.currentModel;
    const apiKey = state.apiKey;

    if (!apiKey) {
        throw new Error('🔑 Wpisz klucz API w ustawieniach!');
    }

    const config = API_ENDPOINTS[model];
    if (!config) throw new Error('Nieznany model');

    // Przygotuj wiadomości
    const messages = state.messages.map(m => ({
        role: m.role,
        content: m.content
    }));

    let url, headers, body;

    switch(config.provider) {
        case 'openai':
            url = 'https://api.openai.com/v1/chat/completions';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            body = {
                model: config.model,
                messages: messages,
                max_tokens: 2000,
                temperature: 0.7
            };
            break;

        case 'anthropic':
            url = 'https://api.anthropic.com/v1/messages';
            headers = {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            };
            body = {
                model: config.model,
                messages: messages.map(m => ({
                    role: m.role === 'assistant' ? 'assistant' : 'user',
                    content: m.content
                })),
                max_tokens: 2000
            };
            break;

        case 'google':
            url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`;
            headers = { 'Content-Type': 'application/json' };
            body = {
                contents: messages.map(m => ({
                    parts: [{ text: m.content }],
                    role: m.role === 'user' ? 'user' : 'model'
                }))
            };
            break;

        case 'deepseek':
            url = 'https://api.deepseek.com/v1/chat/completions';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            body = {
                model: config.model,
                messages: messages,
                max_tokens: 2000,
                temperature: 0.7
            };
            break;

        case 'mistral':
            url = 'https://api.mistral.ai/v1/chat/completions';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            body = {
                model: config.model,
                messages: messages,
                max_tokens: 2000,
                temperature: 0.7
            };
            break;

        case 'groq':
            url = 'https://api.groq.com/openai/v1/chat/completions';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            body = {
                model: config.model,
                messages: messages,
                max_tokens: 2000,
                temperature: 0.7
            };
            break;

        default:
            throw new Error('Nieobsługiwany provider');
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message || JSON.stringify(data.error));
    }

    // Wyciągnij odpowiedź
    if (data.choices) return data.choices[0].message.content;
    if (data.content) return data.content[0]?.text || data.content;
    if (data.candidates) return data.candidates[0].content.parts[0].text;
    if (data.text) return data.text;
    
    return JSON.stringify(data);
}

// ===== GENEROWANIE OFFLINE =====
let offlinePipeline = null;
let isOfflineLoading = false;

async function loadOfflineModel() {
    if (isOfflineLoading) return;
    
    try {
        const { pipeline } = await import('@huggingface/transformers');
        
        isOfflineLoading = true;
        DOM.loadOfflineBtn.disabled = true;
        DOM.loadOfflineBtn.textContent = '⏳ Ładowanie...';
        DOM.progressContainer.style.display = 'block';
        DOM.offlineStatus.textContent = '⏳ Pobieranie modelu...';
        DOM.offlineStatus.style.color = '#f0883e';

        offlinePipeline = await pipeline('text-generation', 'Xenova/TinyLlama-1.1B-Chat-v1.0', {
            progress_callback: (progress) => {
                const percent = Math.round(progress.progress * 100);
                DOM.progressFill.style.width = `${percent}%`;
                DOM.progressText.textContent = `${percent}%`;
            }
        });

        DOM.offlineStatus.textContent = '✅ Model gotowy!';
        DOM.offlineStatus.style.color = '#3fb950';
        DOM.loadOfflineBtn.textContent = '✅ Załadowany';
        DOM.progressContainer.style.display = 'none';
        
    } catch (error) {
        DOM.offlineStatus.textContent = '❌ Błąd: ' + error.message;
        DOM.offlineStatus.style.color = '#f85149';
        DOM.loadOfflineBtn.textContent = '🔄 Spróbuj ponownie';
    } finally {
        isOfflineLoading = false;
        DOM.loadOfflineBtn.disabled = false;
    }
}

async function generateOffline(text) {
    if (!offlinePipeline) {
        throw new Error('Model offline nie jest załadowany');
    }

    const prompt = state.messages.slice(-10).map(m => 
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n') + `\nAssistant: `;

    const result = await offlinePipeline(prompt, {
        max_new_tokens: 256,
        temperature: 0.7,
        do_sample: true,
        return_full_text: false
    });

    return result[0].generated_text.trim();
}

// ===== RENDEROWANIE =====
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
        
        const text = document.createElement('div');
        text.className = 'message-text';
        text.innerHTML = formatMessage(msg.content || '');
        content.appendChild(text);
        
        if (msg.files && msg.files.length > 0) {
            const filesDiv = document.createElement('div');
            filesDiv.className = 'message-files';
            msg.files.forEach(f => {
                if (f.type && f.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = f.data;
                    filesDiv.appendChild(img);
                } else {
                    const a = document.createElement('a');
                    a.href = f.data;
                    a.download = f.name;
                    a.textContent = `📎 ${f.name}`;
                    filesDiv.appendChild(a);
                }
            });
            content.appendChild(filesDiv);
        }
        
        if (msg.timestamp) {
            const time = document.createElement('div');
            time.className = 'message-time';
            time.textContent = new Date(msg.timestamp).toLocaleTimeString();
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
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => 
        `<pre><code>${escapeHtml(code)}</code></pre>`
    );
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
            📎 ${f.name} (${Math.round(f.size/1024)}KB)
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
    try {
        localStorage.setItem('chatHistory', JSON.stringify(state.messages));
    } catch (e) {
        console.warn('Nie można zapisać historii');
    }
}

function loadHistory() {
    try {
        const data = localStorage.getItem('chatHistory');
        if (data) state.messages = JSON.parse(data);
    } catch (e) {
        state.messages = [];
    }
}

function clearHistory() {
    if (!confirm('Wyczyścić historię?')) return;
    state.messages = [];
    saveHistory();
    renderMessages();
    DOM.chatTitle.textContent = '💬 Nowa rozmowa';
}

function newChat() {
    if (state.messages.length > 0 && !confirm('Rozpocząć nową rozmowę?')) return;
    state.messages = [];
    saveHistory();
    renderMessages();
    DOM.chatTitle.textContent = '💬 Nowa rozmowa';
}

function exportChat() {
    const data = {
        messages: state.messages,
        exportedAt: new Date().toISOString()
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
                DOM.chatTitle.textContent = `💬 ${state.messages.length} wiadomości`;
                alert('✅ Zaimportowano!');
            }
        } catch (err) {
            alert('❌ Błąd importu');
        }
    };
    reader.readAsText(file);
    DOM.importFile.value = '';
}

// ===== UI =====
function updateUI() {
    const words = DOM.userInput.value.trim().split(/\s+/).length;
    DOM.wordCount.textContent = `${words || 0} słów`;
    
    // Status
    const mode = state.mode === 'auto' ? (state.isOnline ? 'online' : 'offline') : state.mode;
    const statusEl = DOM.connectionStatus;
    if (mode === 'online' && state.isOnline) {
        statusEl.textContent = '● Online';
        statusEl.className = 'status-online';
    } else if (mode === 'offline' || !state.isOnline) {
        statusEl.textContent = '● Offline';
        statusEl.className = 'status-offline';
    } else {
        statusEl.textContent = '● Łączenie...';
        statusEl.className = 'status-loading';
    }
    
    // Context
    const config = API_ENDPOINTS[state.currentModel];
    const maxTokens = config ? (config.maxTokens || 128000) : 128000;
    const used = Math.round(state.messages.reduce((sum, m) => sum + (m.content?.length || 0) / 4, 0));
    DOM.contextInfo.textContent = `📏 ${used}/${maxTokens}`;
}

function handleScroll() {
    const container = DOM.messagesContainer;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    DOM.scrollToBottom.style.display = atBottom ? 'none' : 'flex';
}

window.scrollToBottom = function() {
    DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
};

function toggleSidebar() {
    DOM.sidebar.classList.toggle('open');
    DOM.sidebar.classList.toggle('sidebar-hidden');
}

// ===== START =====
init();
console.log('🤖 ChatGPT Clone z 12+ modelami');
console.log(`💬 ${state.messages.length} wiadomości`);
console.log(`📡 Tryb: ${state.mode}, Online: ${state.isOnline}`);
console.log('🚀 Gotowe do działania! Wpisz klucz API i zacznij pisać.');
