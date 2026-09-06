// worker.js – wrzuć na Cloudflare Workers
export default {
    async fetch(request) {
        if (request.method !== 'POST') {
            return new Response('Metoda dozwolona: POST', { status: 405 });
        }

        try {
            const { model, messages, apiKey } = await request.json();

            // Mapowanie modeli na odpowiednie API
            const modelConfigs = {
                'gpt-4o': {
                    url: 'https://api.openai.com/v1/chat/completions',
                    headers: { 'Authorization': `Bearer ${apiKey || OPENAI_API_KEY}` },
                    buildBody: (msgs) => ({
                        model: 'gpt-4o',
                        messages: msgs.map(m => ({ role: m.role, content: m.content })),
                        max_tokens: 2000
                    })
                },
                'claude-3.5-sonnet': {
                    url: 'https://api.anthropic.com/v1/messages',
                    headers: { 
                        'x-api-key': apiKey || ANTHROPIC_API_KEY,
                        'anthropic-version': '2023-06-01'
                    },
                    buildBody: (msgs) => ({
                        model: 'claude-3-5-sonnet-20241022',
                        messages: msgs.map(m => ({ role: m.role, content: m.content })),
                        max_tokens: 2000
                    })
                },
                'gemini-pro': {
                    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey || GEMINI_API_KEY}`,
                    headers: { 'Content-Type': 'application/json' },
                    buildBody: (msgs) => ({
                        contents: msgs.map(m => ({
                            parts: [{ text: m.content }],
                            role: m.role === 'user' ? 'user' : 'model'
                        }))
                    })
                },
                'deepseek-chat': {
                    url: 'https://api.deepseek.com/v1/chat/completions',
                    headers: { 'Authorization': `Bearer ${apiKey || DEEPSEEK_API_KEY}` },
                    buildBody: (msgs) => ({
                        model: 'deepseek-chat',
                        messages: msgs.map(m => ({ role: m.role, content: m.content })),
                        max_tokens: 2000
                    })
                },
                'mistral-large': {
                    url: 'https://api.mistral.ai/v1/chat/completions',
                    headers: { 'Authorization': `Bearer ${apiKey || MISTRAL_API_KEY}` },
                    buildBody: (msgs) => ({
                        model: 'mistral-large-latest',
                        messages: msgs.map(m => ({ role: m.role, content: m.content })),
                        max_tokens: 2000
                    })
                }
            };

            const config = modelConfigs[model];
            if (!config) {
                return new Response(JSON.stringify({ error: 'Nieznany model' }), { status: 400 });
            }

            // Buduj zapytanie
            const body = config.buildBody(messages);
            const response = await fetch(config.url, {
                method: 'POST',
                headers: config.headers,
                body: JSON.stringify(body)
            });

            const data = await response.json();

            // Wyciągnij odpowiedź (różne formaty API)
            let reply = '';
            if (data.choices) reply = data.choices[0].message.content;
            else if (data.content) reply = data.content;
            else if (data.candidates) reply = data.candidates[0].content.parts[0].text;
            else reply = JSON.stringify(data);

            return new Response(JSON.stringify({ reply }), {
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
};
