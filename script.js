// ===== IMPORTOWANIE TRANSFORMERS.JS =====
import { pipeline, env } from '@huggingface/transformers';

// ===== KONFIGURACJA =====
env.useBrowserCache = true; // Zapisz model w pamięci przeglądarki
env.localModelPath = '/models/'; // Opcjonalnie - własny folder

let messages = JSON.parse(localStorage.getItem('chatHistory')) || [];
let attachedFiles = [];
let chatPipeline = null;
let isLoading = false;

// ===== REFERENCJE =====
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const modelSelect = document.getElementById('modelSelect');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const loadModelBtn = document.getElementById('loadModelBtn');
const status = document.getElementById('status');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// ===== INICJALIZACJA =====
renderMessages();
checkIfModelLoaded();

// ===== SPRAWDZANIE CZY MODEL JUŻ JEST =====
async function checkIfModelLoaded() {
    try {
        // Sprawdzamy czy model jest już w cache przeglądarki
        const modelName = modelSelect.value;
        const cache = await caches.open('transformers-cache');
        const keys = await cache.keys();
        const hasModel = keys.some(k => k.url.includes(modelName));
        
        if (hasModel) {
            status.textContent = '✅ Model gotowy (w cache)';
            status.style.color = '#2ea043';
        } else {
            status.textContent = '💡 Kliknij "Pobierz model"';
            status.style.color = '#f0883e';
        }
    } catch (e) {
        status.textContent = '⚠️ Kliknij "Pobierz model"';
    }
}

// ===== ŁADOWANIE MODELU =====
loadModelBtn.addEventListener('click', async () => {
    if (isLoading) return;
    
    isLoading = true;
    loadModelBtn.disabled = true;
    loadModelBtn.textContent = '⏳ Ładowanie...';
    status.textContent = '⏳ Pobieranie modelu... (może potrwać kilka minut)';
    progressBar.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = '0%';

    try {
        const modelName = modelSelect.value;
        
        // Załaduj model z progresem
        chatPipeline = await pipeline('text-generation', modelName, {
            progress_callback: (progress) => {
                const percent = Math.round(progress.progress * 100);
                progressFill.style.width = `${percent}%`;
                progressText.textContent = `${percent}%`;
                
                if (progress.status === 'downloading') {
                    status.textContent = `⬇️ Pobieranie... ${percent}%`;
                } else if (progress.status === 'loading') {
                    status.textContent = `🧠 Ładowanie do pamięci... ${percent}%`;
                }
            }
        });

        status.textContent = '✅ Model gotowy do pracy!';
        status.style.color = '#2ea043';
        loadModelBtn.textContent = '✅ Załadowany';
        progressBar.style.display = 'none';
        
    } catch (error) {
        status.textContent = '❌ Błąd: ' + error.message;
        status.style.color = '#f85149';
        loadModelBtn.textContent = '🔄 Spróbuj ponownie';
    } finally {
        isLoading = false;
        loadModelBtn.disabled = false;
    }
});

// ===== WYSYŁANIE WIADOMOŚCI =====
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && attachedFiles.length === 0) return;
    
    if (!chatPipeline) {
        alert('❌ Najpierw załaduj model (kliknij "Pobierz model")!');
        return;
    }

    // Dodaj wiadomość użytkownika
    const userMsg = { role: 'user', content: text, files: [...attachedFiles] };
    messages.push(userMsg);
    saveHistory();
    renderMessages();

    // Przygotuj prompt dla modelu (z historią)
    const prompt = buildPrompt(messages);

    try {
        status.textContent = '🧠 Myślenie... (offline)';
        
        // Generuj odpowiedź
        const result = await chatPipeline(prompt, {
            max_new_tokens: 512,
            temperature: 0.7,
            top_p: 0.9,
            do_sample: true,
            return_full_text: false
        });

        const reply = result[0].generated_text.trim();
        
        // Dodaj odpowiedź AI
        const aiMsg = { role: 'assistant', content: reply };
        messages.push(aiMsg);
        saveHistory();
        renderMessages();
        
        status.textContent = '✅ Model gotowy';
        
    } catch (error) {
        const errorMsg = { role: 'assistant', content: '❌ Błąd: ' + error.message };
        messages.push(errorMsg);
        saveHistory();
        renderMessages();
        status.textContent = '❌ Błąd: ' + error.message;
    }

    userInput.value = '';
    attachedFiles = [];
    updateFilePreview();
}

// ===== BUDOWANIE PROMPTU Z HISTORIĄ =====
function buildPrompt(messages) {
    // Instrukcja systemowa dla modelu
    let prompt = `<|system|>
Jesteś pomocnym asystentem AI. Odpowiadaj po polsku. Bądź konkretny i pomocny.
<|end|>\n\n`;
    
    // Dodaj historię wiadomości
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

// ===== RESZTA FUNKCJI (renderowanie, pliki, historia) =====
function renderMessages() {
    messagesContainer.innerHTML = '';
    messages.forEach((msg, index) => {
        const div = document.createElement('div');
        div.className = `message ${msg.role === 'user' ? 'user' : 'ai'}`;
        
        // Wyświetl tekst
        const textSpan = document.createElement('span');
        textSpan.textContent = msg.content || '(pusty)';
        div.appendChild(textSpan);
        
        // Wyświetl pliki
        if (msg.files && msg.files.length > 0) {
            msg.files.forEach(f => {
                if (f.type && f.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = f.data;
                    img.style.maxWidth = '200px';
                    img.style.borderRadius = '8px';
                    img.style.marginTop = '5px';
                    div.appendChild(img);
                } else {
                    const a = document.createElement('a');
                    a.href = f.data;
                    a.download = f.name;
                    a.textContent = `📎 ${f.name}`;
                    a.style.display = 'block';
                    a.style.marginTop = '5px';
                    div.appendChild(a);
                }
            });
        }
        
        messagesContainer.appendChild(div);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function saveHistory() {
    localStorage.setItem('chatHistory', JSON.stringify(messages));
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
            <button onclick="window.removeFile(${i})">✕</button>
        </div>
    `).join('');
}

window.removeFile = function(index) {
    attachedFiles.splice(index, 1);
    updateFilePreview();
};

// ===== EKSPORT / IMPORT =====
document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chat_${new Date().toISOString()}.json`;
    a.click();
});

document.getElementById('importBtn')?.addEventListener('click', () => {
    document.getElementById('importFileInput')?.click();
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

// Zmiana modelu - aktualizacja statusu
modelSelect.addEventListener('change', checkIfModelLoaded);
