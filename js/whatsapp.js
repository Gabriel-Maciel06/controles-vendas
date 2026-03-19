/**
 * WhatsApp Integration Module
 * Abre conversas via wa.me — 100% gratuito, sem API
 */

const WhatsAppModule = {

    // ── Templates de mensagem por situação ──
    TEMPLATES: [
        {
            id: 'followup',
            label: '📞 Follow-up geral',
            text: `Olá {nome}, tudo bem? Passando para dar um oi e ver se posso te ajudar com alguma coisa. Alguma novidade por aí?`
        },
        {
            id: 'apresentacao',
            label: '👋 Primeira apresentação',
            text: `Olá {nome}! Meu nome é Maciel, trabalho com {produto}. Vi que vocês podem se interessar pelo nosso portfólio. Posso te apresentar rapidinho?`
        },
        {
            id: 'proposta',
            label: '📋 Enviar proposta',
            text: `Olá {nome}! Conforme conversamos, segue nossa proposta. Qualquer dúvida estou à disposição. Podemos fechar essa semana?`
        },
        {
            id: 'reativacao',
            label: '🔄 Reativar cliente',
            text: `Olá {nome}, tudo bem? Faz um tempinho que não nos falamos. Temos novidades no portfólio que acho que vão te interessar. Posso te contar?`
        },
        {
            id: 'amostra',
            label: '📦 Cobrar amostra',
            text: `Olá {nome}! Passando para saber como ficou a amostra que enviamos. O que achou? Podemos conversar sobre um pedido?`
        },
        {
            id: 'obrigado',
            label: '✅ Pós-venda',
            text: `Olá {nome}! Obrigado pela confiança e pelo pedido. Qualquer coisa que precisar pode me chamar. Foi um prazer!`
        },
        {
            id: 'custom',
            label: '✏️ Personalizada',
            text: ``
        },
    ],

    // Registro do cliente atual aberto no compositor
    _currentClient: null,

    // ── Abre compositor de mensagem ──
    openComposer(clientId) {
        const all    = DataStore.get(STORAGE_KEYS.CUSTOMERS);
        const record = all.find(c => String(c.id) === String(clientId));
        if (!record) return;

        this._currentClient = record;

        const name    = record.name || record.client || '';
        const phone   = record.phone || '';
        const produto = record.products || 'nossos produtos';

        // Preenche dados no modal
        const nameEl     = document.getElementById('wapp-client-name');
        const phoneEl    = document.getElementById('wapp-client-phone');
        const idInput    = document.getElementById('wapp-client-id');
        const phoneInput = document.getElementById('wapp-phone-input');

        if (nameEl)     nameEl.innerText   = name;
        if (phoneEl)    phoneEl.innerText  = phone || 'Sem telefone';
        if (idInput)    idInput.value      = clientId;
        if (phoneInput) phoneInput.value   = this.cleanPhone(phone);

        // Aviso se não tem telefone
        const alertEl = document.getElementById('wapp-no-phone-alert');
        if (alertEl) alertEl.style.display = phone ? 'none' : 'block';

        // Renderiza templates com as variáveis do cliente
        this.renderTemplates(name, produto);

        // Seleciona o primeiro template por padrão
        this.selectTemplate('followup', name, produto);

        document.getElementById('wapp-modal')?.classList.remove('hidden');
    },

    closeComposer() {
        document.getElementById('wapp-modal')?.classList.add('hidden');
        this._currentClient = null;
    },

    // ── Renderiza botões de template ──
    renderTemplates(clientName, produto) {
        const container = document.getElementById('wapp-templates');
        if (!container) return;
        container.innerHTML = '';

        this.TEMPLATES.forEach(t => {
            const btn           = document.createElement('button');
            btn.className       = 'btn btn-outline';
            btn.id              = `wapp-tpl-${t.id}`;
            btn.style.cssText   = 'font-size:0.78rem; padding:0.3rem 0.7rem; text-align:left; white-space:nowrap; margin-bottom:2px;';
            btn.innerHTML       = t.label;
            btn.onclick         = () => this.selectTemplate(t.id, clientName, produto);
            container.appendChild(btn);
        });
    },

    // ── Seleciona template e preenche textarea ──
    selectTemplate(id, clientName, produto) {
        const tpl = this.TEMPLATES.find(t => t.id === id);
        if (!tpl) return;

        // Destaca botão selecionado
        this.TEMPLATES.forEach(t => {
            const btn = document.getElementById(`wapp-tpl-${t.id}`);
            if (btn) btn.style.background = t.id === id ? 'rgba(83,74,183,0.3)' : '';
        });

        const textarea = document.getElementById('wapp-message');
        if (textarea) {
            if (id === 'custom') {
                textarea.value = '';
                textarea.focus();
            } else {
                // Substitui {nome} e {produto} com os dados reais do cliente
                textarea.value = tpl.text
                    .replace(/{nome}/g,    clientName || 'cliente')
                    .replace(/{produto}/g, produto    || 'nossos produtos');
            }
        }
        this.updateCharCount();
    },

    updateCharCount() {
        const len = (document.getElementById('wapp-message')?.value || '').length;
        const el  = document.getElementById('wapp-char-count');
        if (el) el.innerText = len + ' caracteres';
    },

    // ── Limpa número de telefone para o formato wa.me ──
    cleanPhone(phone) {
        if (!phone) return '';
        let clean = phone.replace(/\D/g, '');
        // Adiciona DDI 55 (Brasil) se não tiver
        if (clean.length === 10 || clean.length === 11) clean = '55' + clean;
        return clean;
    },

    // ── Valida se o número limpo é válido ──
    isValidPhone(clean) {
        return clean.length >= 12 && clean.length <= 13; // 55 + 10 ou 11 dígitos
    },

    // ── Envia: abre WhatsApp na aba ──
    send() {
        const phoneRaw = document.getElementById('wapp-phone-input')?.value.trim();
        const message  = document.getElementById('wapp-message')?.value.trim();

        if (!phoneRaw) {
            alert('Digite o número de telefone do cliente.');
            document.getElementById('wapp-phone-input')?.focus();
            return;
        }

        const cleanedPhone = this.cleanPhone(phoneRaw);
        if (!this.isValidPhone(cleanedPhone)) {
            alert('Número de telefone inválido. Use o formato: (DDD) 9XXXX-XXXX.');
            document.getElementById('wapp-phone-input')?.focus();
            return;
        }

        if (!message) {
            alert('Escreva uma mensagem antes de enviar.');
            document.getElementById('wapp-message')?.focus();
            return;
        }

        const url = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');

        // Registra o contato no CRM — atualiza o registro existente
        this.registerContact(message, cleanedPhone);
    },

    // ── Atualiza registro existente no CRM com o contato feito ──
    async registerContact(message, phoneUsed) {
        const clientId = document.getElementById('wapp-client-id')?.value;
        if (!clientId) return;

        const today   = new Date().toISOString().split('T')[0];
        const nextDate = new Date(today + 'T00:00:00');
        nextDate.setDate(nextDate.getDate() + 15);

        const updated = {
            lastContactDate: today,
            nextFollowUp:    nextDate.toISOString().split('T')[0],
            status:          this._currentClient?.status || 'Contato',
            notes:           `[WhatsApp] ${message.substring(0, 150)}${message.length > 150 ? '...' : ''}`,
        };

        // Atualiza o telefone se o usuário digitou um diferente no modal
        if (phoneUsed && this._currentClient) {
            const originalClean = this.cleanPhone(this._currentClient.phone || '');
            if (phoneUsed !== originalClean) {
                // Formata de volta para exibição (ex: 5511999991234 → (11) 99999-1234)
                updated.phone = phoneUsed; // salva com DDI, o sistema limpa depois
            }
        }

        await DataStore.update(STORAGE_KEYS.CUSTOMERS, clientId, updated);

        if (typeof CRMModule       !== 'undefined') CRMModule.loadAlerts();
        if (typeof DashboardModule !== 'undefined') DashboardModule.update();

        this.closeComposer();
    },

    // ── Abre WhatsApp direto sem modal (clique no número) ──
    openDirect(phone, name) {
        const clean = this.cleanPhone(phone);
        if (!clean || !this.isValidPhone(clean)) {
            alert('Número inválido ou não cadastrado.');
            return;
        }
        const msg = `Olá ${name || ''}!`;
        window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, '_blank');
    },

    init() {
        // Fechar modal clicando fora
        document.getElementById('wapp-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'wapp-modal') this.closeComposer();
        });
        // Contador de caracteres em tempo real
        document.getElementById('wapp-message')?.addEventListener('input', () => this.updateCharCount());
    }
};

window.WhatsAppModule = WhatsAppModule;

document.addEventListener('DataStoreReady', () => {
    WhatsAppModule.init();
});
