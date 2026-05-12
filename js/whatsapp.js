/**
 * WhatsApp Integration Module - Versão Agente Inteligente (Isapel AI)
 * Integração Real com Evolution API + Histórico no CRM
 */

const WhatsAppModule = {
    TEMPLATES: [
        { id: 'followup', label: '📞 Follow-up', text: `Olá {nome}, tudo bem? Passando para dar um oi e ver se posso te ajudar com alguma coisa. Alguma novidade por aí?` },
        { id: 'proposta', label: '📋 Proposta', text: `Olá {nome}! Conforme conversamos, segue nossa proposta. Qualquer dúvida estou à disposição. Podemos fechar essa semana?` },
        { id: 'reativacao', label: '🔄 Reativar', text: `Olá {nome}, tudo bem? Faz um tempinho que não nos falamos. Temos novidades no portfólio que acho que vão te interessar. Posso te contar?` },
        { id: 'obrigado', label: '✅ Pós-venda', text: `Olá {nome}! Obrigado pela confiança e pelo pedido. Foi um prazer!` },
        { id: 'custom', label: '✏️ Personalizada', text: `` },
    ],

    _currentClient: null,
    _isGenerating: false,

    async openComposer(clientId) {
        const all = DataStore.get(STORAGE_KEYS.CUSTOMERS);
        const record = all.find(c => String(c.id) === String(clientId));
        if (!record) return;

        this._currentClient = record;
        const name = record.name || record.client || '';
        const phone = record.phone || '';

        // UI Setup
        document.getElementById('wapp-client-name').innerText = name;
        document.getElementById('wapp-client-phone').innerText = phone || 'Sem telefone';
        document.getElementById('wapp-client-id').value = clientId;
        document.getElementById('wapp-phone-input').value = this.cleanPhone(phone);
        document.getElementById('wapp-message').value = '';

        this.renderTemplates(name);
        document.getElementById('wapp-modal')?.classList.remove('hidden');

        // Carrega Histórico Real
        await this.loadMessages(this.cleanPhone(phone));
    },

    closeComposer() {
        document.getElementById('wapp-modal')?.classList.add('hidden');
        this._currentClient = null;
    },

    // ── Carrega mensagens do Backend ──
    async loadMessages(phone) {
        const container = document.getElementById('wapp-chat-container');
        if (!container) return;

        const jid = `${phone}@s.whatsapp.net`;
        const token = sessionStorage.getItem('maciel_token');

        try {
            const res = await fetch(`${API_BASE_URL}/whatsapp/messages/${jid}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Erro ao carregar mensagens');

            const messages = await res.json();
            this.renderChat(messages);
        } catch (err) {
            container.innerHTML = `<div style="text-align:center; color:#ef4444; font-size:0.75rem; padding:1rem;">⚠️ Erro ao carregar histórico: ${err.message}</div>`;
        }
    },

    renderChat(messages) {
        const container = document.getElementById('wapp-chat-container');
        if (!container) return;

        if (messages.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:0.75rem; padding:2rem 0;">Nenhuma conversa recente encontrada no banco.</div>`;
            return;
        }

        container.innerHTML = messages.map(m => `
            <div class="chat-bubble ${m.fromMe ? 'me' : 'client'}">
                ${m.content}
                <span class="chat-time">${new Date(m.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        `).join('');

        // Scroll para o final
        container.scrollTop = container.scrollHeight;
    },

    // ── GERA SUGESTÃO COM IA (O "Cérebro" Original) ──
    async generateAISuggestion() {
        if (this._isGenerating) return;
        
        const btn = document.getElementById('btn-wapp-ai');
        const textarea = document.getElementById('wapp-message');
        const container = document.getElementById('wapp-chat-container');
        
        // Pega as mensagens do container para contexto
        const lastMessages = Array.from(container.querySelectorAll('.chat-bubble'))
            .slice(-6) // Últimas 6 mensagens
            .map(el => `${el.classList.contains('me') ? 'Eu' : 'Cliente'}: ${el.innerText.split('\n')[0]}`)
            .join('\n');

        if (!lastMessages) {
            alert('Sem histórico suficiente para gerar sugestão.');
            return;
        }

        this._isGenerating = true;
        btn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Isapel AI pensando...`;
        btn.style.opacity = '0.7';

        try {
            const token = sessionStorage.getItem('maciel_token');
            const profile = sessionStorage.getItem('maciel_profile') || 'default';
            
            const prompt = `Você é o Isapel AI, assistente de vendas de Maciel.
            Contexto do Cliente: ${this._currentClient.name}, Segmento: ${this._currentClient.segment || 'Varejo'}.
            Últimas mensagens:
            ${lastMessages}
            
            Escreva uma resposta curta, profissional e persuasiva para continuar a venda ou follow-up. 
            Use um tom amigável. Responda APENAS com a mensagem sugerida.`;

            const res = await fetch(`${API_BASE_URL}/ai/proxy`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    system: "Você é um assistente de vendas focado em fechamento e follow-up para a empresa Isapel."
                })
            });

            const data = await res.json();
            const suggestion = data.content?.[0]?.text || data.choices?.[0]?.message?.content || "";
            
            if (suggestion) {
                textarea.value = suggestion.trim();
                textarea.focus();
                this.updateCharCount();
            }
        } catch (err) {
            console.error('Erro IA:', err);
            alert('Erro ao gerar sugestão da IA.');
        } finally {
            this._isGenerating = false;
            btn.innerHTML = `<i class='bx bx-sparkles'></i> Sugerir Resposta com Isapel AI`;
            btn.style.opacity = '1';
        }
    },

    renderTemplates(clientName) {
        const container = document.getElementById('wapp-templates');
        if (!container) return;
        container.innerHTML = '';

        this.TEMPLATES.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline';
            btn.style.cssText = 'font-size:0.72rem; padding:0.3rem 0.6rem; margin-bottom:2px;';
            btn.innerHTML = t.label;
            btn.onclick = () => {
                const textarea = document.getElementById('wapp-message');
                textarea.value = t.text.replace(/{nome}/g, clientName || 'cliente');
                this.updateCharCount();
            };
            container.appendChild(btn);
        });
    },

    updateCharCount() {
        const len = (document.getElementById('wapp-message')?.value || '').length;
        const el = document.getElementById('wapp-char-count');
        if (el) el.innerText = len + ' caracteres';
    },

    cleanPhone(phone) {
        if (!phone) return '';
        let clean = phone.replace(/\D/g, '');
        if (clean.length === 10 || clean.length === 11) clean = '55' + clean;
        return clean;
    },

    send() {
        const phone = document.getElementById('wapp-phone-input')?.value;
        const message = document.getElementById('wapp-message')?.value;

        if (!phone || !message) return alert('Telefone ou mensagem ausente.');

        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        this.closeComposer();
    },

    init() {
        document.getElementById('wapp-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'wapp-modal') this.closeComposer();
        });
        document.getElementById('wapp-message')?.addEventListener('input', () => this.updateCharCount());
    }
};

window.WhatsAppModule = WhatsAppModule;
document.addEventListener('DataStoreReady', () => WhatsAppModule.init());
