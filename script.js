// ===== KONFIGURACJA =====
const WORKER_URL = 'https://twoj-worker.nazwa.workers.dev'; // ZMIEŃ PO WDROŻENIU WORKERA

let currentModel = document.getElementById('modelSelect').value;
let apiKey = localStorage.getItem('apiKey') || '';
let messages = JSON.parse(localStorage.getItem('chatHistory')) || [];
let attachedFiles = [];

// ===== REFERENCJE =====
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const modelSelect = document.getElementById('modelSelect');
const apiKeyInput = document.getElementById('apiKeyInput');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// ===== INICJALIZACJA =====
apiKeyInput.value = apiKey;
renderMessages();

// ===== OBSŁUGA WIADOMOŚCI =====
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && attachedFiles.length === 0) return;

    // Dodaj wiadomość użytkownika
    const userMsg = { role: 'user', content: text, files: [...attachedFiles] };
    messages.push(userMsg);
    saveHistory();
    renderMessages();

    // Przygotuj payload do Workera
    const payload = {
        model: currentModel,
        messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            files: m.files || []
        })),
        apiKey: apiKeyInput.value || undefined
    };

    // Wyślij do Workera
    try {
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        // Dodaj odpowiedź AI
        const aiMsg = { role: 'assistant', content: data.reply || 'Brak odpowiedzi' };
        messages.push(aiMsg);
        saveHistory();
        renderMessages();
    } catch (error) {
        const errorMsg = { role: 'assistant', content: '❌ Błąd: ' + error.message };
        messages.push(errorMsg);
        saveHistory();
        renderMessages();
    }

    userInput.value = '';
    attachedFiles = [];
    updateFilePreview();
}

// ===== RENDEROWANIE =====
function renderMessages() {
    messagesContainer.innerHTML = '';
    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `message ${msg.role === 'user' ? 'user' : 'ai'}`;
        div.textContent = msg.content;
        if (msg.files) {
            msg.files.forEach(f => {
                if (f.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = f.data;
                    div.appendChild(img);
                } else {
                    const a = document.createElement('a');
                    a.href = f.data;
                    a.download = f.name;
                    a.textContent = `📎 ${f.name}`;
                    div.appendChild(a);
                }
            });
        }
        messagesContainer.appendChild(div);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ===== PLIKI =====
fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            attachedFiles.push({
                name: file.name,
                type: file.type,
                data: ev.target.result
            });
            updateFilePreview();
        };
        reader.readAsDataURL(file);
    });
    fileInput.value = '';
});

function updateFilePreview() {
    filePreview.innerHTML = attachedFiles.map((f, i) => `
        <div class="preview-item">
            📎 ${f.name}
            <button onclick="removeFile(${i})">✕</button>
        </div>
    `).join('');
}

function removeFile(index) {
    attachedFiles.splice(index, 1);
    updateFilePreview();
}

// ===== HISTORIA (localStorage) =====
function saveHistory() {
    localStorage.setItem('chatHistory', JSON.stringify(messages));
}

// ===== EKSPORT / IMPORT =====
document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chat_${new Date().toISOString()}.json`;
    a.click();
});

document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
});
document.getElementById('importFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const imported = JSON.parse(ev.target.result);
            if (Array.isArray(imported)) {
                messages = imported;
                saveHistory();
                renderMessages();
            }
        } catch (err) { alert('Niepoprawny plik JSON'); }
    };
    reader.readAsText(file);
});

// ===== CZYSZCZENIE =====
clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Wyczyścić całą historię?')) {
        messages = [];
        saveHistory();
        renderMessages();
    }
});

// ===== WYSYŁANIE =====
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
modelSelect.addEventListener('change', () => { currentModel = modelSelect.value; });
apiKeyInput.addEventListener('input', () => {
    localStorage.setItem('apiKey', apiKeyInput.value);
});
