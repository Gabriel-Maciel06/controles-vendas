/**
 * CRM & Relacionamento Module — v2.0
 * Com edição completa de clientes via modal
 */

const CRMModule = {
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.dom.dateInput.value = new Date().toISOString().split('T')[0];
        this.loadAlerts();
        if (typeof AISuggestions !== 'undefined') AISuggestions.renderSuggestionsPanel();
    },

    cacheDOM() {
        this.dom = {
            form:       document.getElementById('crm-form'),
            client:     document.getElementById('crm-client'),
            phone:      document.getElementById('crm-phone'),
            buyer:      document.getElementById('crm-buyer'),
            products:   document.getElementById('crm-products'),
            source:     document.getElementById('crm-source'),
            dateInput:  document.getElementById('crm-date'),
            notes:      document.getElementById('crm-notes'),
            alertsBody: document.getElementById('crm-alerts-body'),
        };
    },

    bindEvents() {
        this.dom.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFormSubmit();
        });

        // Fechar modal de edição clicando fora
        document.getElementById('crm-edit-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'crm-edit-modal') this.closeEditModal();
        });
    },

    // ── Registrar novo contato ──
    async handleFormSubmit() {
        const contactDate = this.dom.dateInput.value;
        const dateObj = new Date(contactDate + 'T00:00:00');
        dateObj.setDate(dateObj.getDate() + 15);

        const newContact = {
            name:            this.dom.client.value.trim(),
            phone:           this.dom.phone.value.trim(),
            buyerName:       this.dom.buyer.value.trim(),
            products:        this.dom.products.value.trim(),
            source:          this.dom.source.value.trim(),
            lastContactDate: contactDate,
            notes:           this.dom.notes.value.trim(),
            nextFollowUp:    dateObj.toISOString().split('T')[0],
            status:          'Contato',
        };

        await DataStore.add(STORAGE_KEYS.CUSTOMERS, newContact);

        // Limpar formulário
        ['client','notes','phone','buyer','products','source'].forEach(f => this.dom[f].value = '');
        this.dom.client.focus();
        this.loadAlerts();
        if (typeof AISuggestions !== 'undefined') AISuggestions.renderSuggestionsPanel();
        if (typeof CalendarModule !== 'undefined') CalendarModule.loadEvents();
        if (typeof DashboardModule !== 'undefined') DashboardModule.update();
    },

    // ── Excluir registro ──
    deleteContact(id) {
        if (!confirm('Excluir este registro de contato?')) return;
        DataStore.remove(STORAGE_KEYS.CUSTOMERS, id);
        this.loadAlerts();
        if (typeof AISuggestions !== 'undefined') AISuggestions.renderSuggestionsPanel();
        if (typeof DashboardModule !== 'undefined') DashboardModule.update();
    },

    // ── Preencher nome no form para novo contato rápido ──
    quickContact(clientName) {
        this.dom.client.value = clientName;
        this.dom.notes.focus();
        this.dom.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    // ── Abrir modal de edição ──
    openEditModal(id) {
        const all    = DataStore.get(STORAGE_KEYS.CUSTOMERS);
        const record = all.find(c => String(c.id) === String(id));
        if (!record) return;

        // Preenche todos os campos do modal
        document.getElementById('edit-id').value            = record.id;
        document.getElementById('edit-name').value          = record.name     || record.client || '';
        document.getElementById('edit-phone').value         = record.phone    || '';
        document.getElementById('edit-buyer').value         = record.buyerName|| '';
        document.getElementById('edit-email').value         = record.email    || '';
        document.getElementById('edit-company').value       = record.company  || '';
        document.getElementById('edit-cnpj').value          = record.cnpj     || '';
        document.getElementById('edit-address').value       = record.address  || '';
        document.getElementById('edit-instagram').value     = record.instagram|| '';
        document.getElementById('edit-segment').value       = record.segment  || '';
        document.getElementById('edit-products').value      = record.products || '';
        document.getElementById('edit-source').value        = record.source   || '';
        document.getElementById('edit-status').value        = record.status   || 'Contato';
        document.getElementById('edit-lastContact').value   = record.lastContactDate || record.contactDate || '';
        document.getElementById('edit-nextFollowUp').value  = record.nextFollowUp    || '';
        document.getElementById('edit-notes').value         = record.notes    || '';

        document.getElementById('crm-edit-modal').classList.remove('hidden');
    },

    closeEditModal() {
        document.getElementById('crm-edit-modal').classList.add('hidden');
    },

    // ── Salvar edição ──
    async saveEdit() {
        const id = document.getElementById('edit-id').value;

        // Recalcula nextFollowUp se lastContact mudou e nextFollowUp estiver vazio
        let nextFollowUp = document.getElementById('edit-nextFollowUp').value;
        const lastContact = document.getElementById('edit-lastContact').value;
        if (!nextFollowUp && lastContact) {
            const d = new Date(lastContact + 'T00:00:00');
            d.setDate(d.getDate() + 15);
            nextFollowUp = d.toISOString().split('T')[0];
        }

        const updated = {
            name:            document.getElementById('edit-name').value.trim(),
            phone:           document.getElementById('edit-phone').value.trim(),
            buyerName:       document.getElementById('edit-buyer').value.trim(),
            email:           document.getElementById('edit-email').value.trim(),
            company:         document.getElementById('edit-company').value.trim(),
            cnpj:            document.getElementById('edit-cnpj').value.trim(),
            address:         document.getElementById('edit-address').value.trim(),
            instagram:       document.getElementById('edit-instagram').value.trim(),
            segment:         document.getElementById('edit-segment').value.trim(),
            products:        document.getElementById('edit-products').value.trim(),
            source:          document.getElementById('edit-source').value.trim(),
            status:          document.getElementById('edit-status').value,
            lastContactDate: lastContact,
            nextFollowUp:    nextFollowUp,
            notes:           document.getElementById('edit-notes').value.trim(),
        };

        const btn = document.getElementById('btn-save-edit');
        btn.disabled  = true;
        btn.innerText = 'Salvando...';

        await DataStore.update(STORAGE_KEYS.CUSTOMERS, id, updated);

        btn.disabled  = false;
        btn.innerText = 'Salvar alterações';

        this.closeEditModal();
        this.loadAlerts();
        if (typeof CalendarModule  !== 'undefined') CalendarModule.loadEvents();
        if (typeof DashboardModule !== 'undefined') DashboardModule.update();
    },

    // ── Carregar tabela de alertas ──
    loadAlerts() {
        const all = DataStore.get(STORAGE_KEYS.CUSTOMERS);
        if (!all || all.length === 0) { this.renderTable([]); return; }

        // Pegar o registro mais recente por cliente
        const latest = {};
        all.forEach(c => {
            const name = c.name || c.client;
            const date = c.lastContactDate || c.contactDate || '';
            if (!latest[name] || date > (latest[name].lastContactDate || '')) latest[name] = c;
        });

        const alerts = Object.values(latest)
            .sort((a,b) => (a.nextFollowUp||'').localeCompare(b.nextFollowUp||''));

        this.renderTable(alerts);
    },

    renderTable(alerts) {
        this.dom.alertsBody.innerHTML = '';

        if (alerts.length === 0) {
            this.dom.alertsBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">Nenhum cliente registrado.</td></tr>`;
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        alerts.forEach(alert => {
            const name       = alert.name || alert.client;
            const lastDate   = alert.lastContactDate || alert.contactDate || '';
            const lastFmt    = lastDate   ? lastDate.split('-').reverse().join('/')   : '-';
            const nextFollow = alert.nextFollowUp || '';
            const nextFmt    = nextFollow ? nextFollow.split('-').reverse().join('/') : '-';

            let badge = '';
            if      (nextFollow && nextFollow < today)  badge = '<span class="badge badge-warn">Atrasado</span>';
            else if (nextFollow === today)               badge = '<span class="badge badge-accent">Hoje</span>';
            else                                         badge = '<span class="badge badge-muted">Em dia</span>';

            // Badge de status do cliente
            const statusColors = {
                'Ativo':    'badge-accent',
                'Contato':  'badge-primary',
                'Inativo':  'badge-muted',
                'Prospect': 'badge-warn',
            };
            const statusBadge = `<span class="badge ${statusColors[alert.status] || 'badge-muted'}" style="font-size:0.7rem;">${alert.status || 'Contato'}</span>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong>${this.escapeHTML(name)}</strong><br>
                    <small style="color:var(--text-muted);">${this.escapeHTML(alert.phone || '')}</small>
                </td>
                <td>${statusBadge}</td>
                <td>${lastFmt}</td>
                <td><small style="color:var(--text-muted);">${this.escapeHTML((alert.notes||'').substring(0,50))}${(alert.notes||'').length>50?'...':''}</small></td>
                <td>${nextFmt} ${badge}</td>
                <td style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-primary" onclick="CRMModule.openEditModal('${alert.id}')" title="Editar cliente">
                        <i class='bx bx-edit'></i>
                    </button>
                    <button class="btn btn-sm btn-outline" style="color:#25D366; border-color:#25D366;" onclick="WhatsAppModule.openComposer('${alert.id}')" title="Enviar WhatsApp">
                        <i class='bx bxl-whatsapp'></i>
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="CRMModule.quickContact('${this.escapeHTML(name)}')" title="Novo contato">
                        <i class='bx bx-phone'></i>
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="CRMModule.viewHistory('${this.escapeHTML(name)}')" title="Ver histórico">
                        <i class='bx bx-history'></i>
                    </button>
                    <button class="btn btn-sm btn-outline" style="color:#ef4444;" onclick="CRMModule.deleteContact('${alert.id}')" title="Excluir">
                        <i class='bx bx-trash'></i>
                    </button>
                </td>
            `;
            this.dom.alertsBody.appendChild(tr);
        });
    },

    // ── Modal de histórico ──
    viewHistory(clientName) {
        const all     = DataStore.get(STORAGE_KEYS.CUSTOMERS);
        const history = all
            .filter(c => (c.name || c.client) === clientName)
            .sort((a,b) => (b.lastContactDate||b.contactDate||'').localeCompare(a.lastContactDate||a.contactDate||''));

        let html = `<div style="padding:1rem;">
            <h3 style="margin-bottom:1rem;">📋 Histórico: ${this.escapeHTML(clientName)}</h3>`;

        if (!history.length) {
            html += `<p style="color:var(--text-muted);">Nenhum registro encontrado.</p>`;
        } else {
            history.forEach(h => {
                const date = (h.lastContactDate||h.contactDate||'').split('-').reverse().join('/');
                let details = '';
                if (h.phone)     details += `<strong>Tel:</strong> ${this.escapeHTML(h.phone)} &nbsp;`;
                if (h.buyerName) details += `<strong>Comprador:</strong> ${this.escapeHTML(h.buyerName)} &nbsp;`;
                if (h.products)  details += `<strong>Produtos:</strong> ${this.escapeHTML(h.products)} &nbsp;`;
                if (h.source)    details += `<strong>Origem:</strong> ${this.escapeHTML(h.source)}`;

                html += `
                <div style="margin-bottom:1.2rem;background:rgba(255,255,255,0.03);padding:1rem;border-radius:8px;border-left:3px solid var(--primary);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">
                        <span style="font-weight:700;color:var(--primary);">${date}</span>
                        <button class="btn btn-sm btn-primary" onclick="CRMModule.closeHistoryAndEdit('${h.id}')" style="font-size:0.72rem;">✏️ Editar</button>
                    </div>
                    ${details ? `<p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.4rem;">${details}</p>` : ''}
                    <p style="font-size:0.92rem;color:var(--text-main);">${this.escapeHTML(h.notes||'Sem anotações.')}</p>
                </div>`;
            });
        }

        html += `<button class="btn btn-outline" style="margin-top:0.5rem;" onclick="document.getElementById('crm-history-modal').classList.add('hidden')">Fechar</button></div>`;

        document.getElementById('crm-history-content').innerHTML = html;
        document.getElementById('crm-history-modal').classList.remove('hidden');
    },

    closeHistoryAndEdit(id) {
        document.getElementById('crm-history-modal').classList.add('hidden');
        this.openEditModal(id);
    },

    escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, t =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[t]));
    }
};

window.CRMModule = CRMModule;

document.addEventListener('DataStoreReady', () => {
    CRMModule.init();
});
