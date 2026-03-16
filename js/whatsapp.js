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
            icon: '📞',
            text: `Olá {nome}, tudo bem? Passando para dar um oi e ver se posso te ajudar com alguma coisa. Alguma novidade por aí?`
        },
        {
            id: 'apresentacao',
            label: '👋 Primeira apresentação',
            icon: '👋',
            text: `Olá {nome}! Meu nome é Maciel, trabalho com {produto}. Vi que vocês podem se interessar pelo nosso portfólio. Posso te apresentar rapidinho?`
        },
        {
            id: 'proposta',
            label: '📋 Enviar proposta',
            icon: '📋',
            text: `Olá {nome}! Conforme conversamos, segue nossa proposta. Qualquer dúvida estou à disposição. Podemos fechar essa semana?`
        },
        {
            id: 'reativacao',
            label: '🔄 Reativar cliente',
            icon: '🔄',
            text: `Olá {nome}, tudo bem? Faz um tempinho que não nos falamos. Temos novidades no portfólio que acho que vão te interessar. Posso te contar?`
        },
        {
            id: 'amostra',
            label: '📦 Cobrar amostra',
            icon: '📦',
            text: `Olá {nome}! Passando para saber como ficou a amostra que enviamos. O que achou? Podemos conversar sobre um pedido?`
        },
        {
            id: 'obrigado',
            label: '✅ Agradecimento pós-venda',
            icon: '✅',
            text: `Olá {nome}! Obrigado pela confiança e pelo pedido. Qualquer coisa que precisar pode me chamar. Foi um prazer!`
        },
        {
            id: 'custom',
            label: '✏️ Mensagem personalizada',
            icon: '✏️',
            text: ``
        },
    ],

    // ── Abre compositor de mensagem ──
    openComposer(clientId) {
        const all    = DataStore.get(STORAGE_KEYS.CUSTOMERS);
        const record = all.find(c => String(c.id) === String(clientId));
        if (!record) return;

        const name  = record.name || record.client || '';
        const phone = record.phone || '';

        // Preenche dados no modal
        const nameEl = document.getElementById('wapp-client-name');
        const phoneEl = document.getElementById('wapp-client-phone');
        const idInput = document.getElementById('wapp-client-id');
        const phoneInput = document.getElementById('wapp-phone-input');

        if (nameEl) nameEl.innerText = name;
        if (phoneEl) phoneEl.innerText = phone || 'Sem telefone';
        if (idInput) idInput.value = clientId;
        if (phoneInput) phoneInput.value = this.cleanPhone(phone);

        // Aviso se não tem telefone
        const alertEl = document.getElementById('wapp-no-phone-alert');
        if (alertEl) alertEl.style.display = phone ? 'none' : 'block';

        // Renderiza templates
        this.renderTemplates(name);

        // Seleciona o primeiro template por padrão
        this.selectTemplate('followup', name);

        document.getElementById('wapp-modal')?.classList.remove('hidden');
    },

    closeComposer() {
        document.getElementById('wapp-modal')?.classList.add('hidden');
    },

    // ── Renderiza botões de template ──
    renderTemplates(clientName) {
        const container = document.getElementById('wapp-templates');
        if (!container) return;
        container.innerHTML = '';

        this.TEMPLATES.forEach(t => {
            const btn = document.createElement('button');
            btn.className   = 'btn btn-outline';
            btn.id          = `wapp-tpl-${t.id}`;
            btn.style.cssText = 'font-size:0.78rem; padding:0.3rem 0.7rem; text-align:left; white-space:nowrap;';
            btn.innerHTML   = t.label;
            btn.onclick     = () => this.selectTemplate(t.id, clientName);
            container.appendChild(btn);
        });
    },

    // ── Seleciona template e preenche textarea ──
    selectTemplate(id, clientName) {
        const tpl = this.TEMPLATES.find(t => t.id === id);
        if (!tpl) return;

        // Destaca botão selecionado
        this.TEMPLATES.forEach(t => {
            const btn = document.getElementById(`wapp-tpl-${t.id}`);
            if (btn) btn.style.background = t.id === id ? 'rgba(83,74,183,0.25)' : '';
        });

        const textarea = document.getElementById('wapp-message');
        if (textarea) {
            if (id === 'custom') {
                textarea.value = '';
                textarea.focus();
            } else {
                textarea.value = tpl.text.replace(/{nome}/g, clientName || 'cliente');
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

    // ── Envia: abre WhatsApp na aba ──
    send() {
        const phone   = document.getElementById('wapp-phone-input')?.value.trim();
        const message = document.getElementById('wapp-message')?.value.trim();

        if (!phone) {
            alert('Digite o número de telefone do cliente.');
            document.getElementById('wapp-phone-input')?.focus();
            return;
        }
        if (!message) {
            alert('Escreva uma mensagem antes de enviar.');
            document.getElementById('wapp-message')?.focus();
            return;
        }

        const cleanedPhone = this.cleanPhone(phone);
        const url = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');

        // Registra o contato automaticamente no CRM
        this.registerContact(message);
    },

    // ── Registra o envio como novo contato no CRM ──
    async registerContact(message) {
        const clientId = document.getElementById('wapp-client-id')?.value;
        const all      = DataStore.get(STORAGE_KEYS.CUSTOMERS);
        const record   = all.find(c => String(c.id) === String(clientId));
        if (!record) return;

        const today    = new Date().toISOString().split('T')[0];
        const nextDate = new Date(today + 'T00:00:00');
        nextDate.setDate(nextDate.getDate() + 15);

        // Cria novo registro de contato (mantém histórico)
        const newContact = {
            name:            record.name || record.client,
            phone:           record.phone,
            buyerName:       record.buyerName,
            products:        record.products,
            source:          record.source,
            lastContactDate: today,
            nextFollowUp:    nextDate.toISOString().split('T')[0],
            notes:           `[WhatsApp] ${message.substring(0, 120)}${message.length > 120 ? '...' : ''}`,
            status:          record.status || 'Contato',
        };

        if (window.DataStore) {
            await DataStore.add(STORAGE_KEYS.CUSTOMERS, newContact);
        }

        if (typeof CRMModule     !== 'undefined') CRMModule.loadAlerts();
        if (typeof DashboardModule !== 'undefined') DashboardModule.update();
        
        this.closeComposer();
    },

    // ── Abre WhatsApp direto sem compositor (para número avulso) ──
    openDirect(phone, name) {
        const clean = this.cleanPhone(phone);
        if (!clean) { alert('Número inválido.'); return; }
        const msg = `Olá ${name || ''}!`;
        window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, '_blank');
    },

    init() {
        // Fechar modal clicando fora
        document.getElementById('wapp-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'wapp-modal') this.closeComposer();
        });
        // Contador de caracteres
        document.getElementById('wapp-message')?.addEventListener('input', () => this.updateCharCount());
    }
};

window.WhatsAppModule = WhatsAppModule;

document.addEventListener('DataStoreReady', () => {
    WhatsAppModule.init();
});
