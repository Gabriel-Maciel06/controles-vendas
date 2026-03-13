/**
 * CRM & Relacionamento Module
 */

const CRMModule = {
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.dom.dateInput.value = new Date().toISOString().split('T')[0];
        this.loadAlerts();
    },

    cacheDOM() {
        this.dom = {
            form: document.getElementById('crm-form'),
            client: document.getElementById('crm-client'),
            phone: document.getElementById('crm-phone'),
            buyer: document.getElementById('crm-buyer'),
            products: document.getElementById('crm-products'),
            source: document.getElementById('crm-source'),
            dateInput: document.getElementById('crm-date'),
            notes: document.getElementById('crm-notes'),
            alertsBody: document.getElementById('crm-alerts-body')
        };
    },

    bindEvents() {
        this.dom.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFormSubmit();
        });
    },

    async handleFormSubmit() {
        const clientName = this.dom.client.value;
        const contactDate = this.dom.dateInput.value;
        const notes = this.dom.notes.value;
        const phone = this.dom.phone.value;
        const buyerName = this.dom.buyer.value;
        const products = this.dom.products.value;
        const source = this.dom.source.value;

        // Calculate next follow-up (e.g., +15 days)
        const dateObj = new Date(contactDate + 'T00:00:00');
        dateObj.setDate(dateObj.getDate() + 15);
        const nextFollowUp = dateObj.toISOString().split('T')[0];

        // ALIGNED WITH BACKEND FIELDS
        const newContact = {
            name: clientName,           // instead of client
            phone: phone,
            buyerName: buyerName,
            products: products,
            source: source,
            lastContactDate: contactDate, // instead of contactDate
            notes: notes,
            nextFollowUp: nextFollowUp,
            status: 'Contato'           // instead of type
        };

        await DataStore.add(STORAGE_KEYS.CUSTOMERS, newContact);

        this.dom.client.value = '';
        this.dom.notes.value = '';
        this.dom.phone.value = '';
        this.dom.buyer.value = '';
        this.dom.products.value = '';
        this.dom.source.value = '';
        this.dom.client.focus();

        this.loadAlerts();

        if (typeof CalendarModule !== 'undefined') CalendarModule.loadEvents();
    },

    deleteContact(id) {
        if (!confirm('Excluir este registro?')) return;
        DataStore.remove(STORAGE_KEYS.CUSTOMERS, id);
        this.loadAlerts();
    },

    loadAlerts() {
        const allContacts = DataStore.get(STORAGE_KEYS.CUSTOMERS);
        if (!allContacts || allContacts.length === 0) {
            this.renderTable([]);
            return;
        }

        // Get latest contact per client
        const clientLatest = {};
        allContacts.forEach(c => {
            const clientName = c.name || c.client; // fallback for legacy
            const cDate = c.lastContactDate || c.contactDate; // fallback

            if (!clientLatest[clientName] || new Date(cDate + 'T00:00:00') > new Date((clientLatest[clientName].lastContactDate || clientLatest[clientName].contactDate) + 'T00:00:00')) {
                clientLatest[clientName] = c;
            }
        });

        const alerts = Object.values(clientLatest);
        alerts.sort((a, b) => new Date((a.nextFollowUp || '') + 'T00:00:00') - new Date((b.nextFollowUp || '') + 'T00:00:00'));

        this.renderTable(alerts);
    },

    renderTable(alerts) {
        this.dom.alertsBody.innerHTML = '';

        if (alerts.length === 0) {
            this.dom.alertsBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhum cliente registrado.</td></tr>`;
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        alerts.forEach(alert => {
            const tr = document.createElement('tr');
            const clientName = alert.name || alert.client;
            const lastDate = alert.lastContactDate || alert.contactDate || '';
            const lastFormat = lastDate ? lastDate.split('-').reverse().join('/') : '-';
            const nextFollow = alert.nextFollowUp || '';
            const nextFormat = nextFollow ? nextFollow.split('-').reverse().join('/') : '-';

            let statusBadge = '';
            if (nextFollow < today) {
                statusBadge = '<span class="badge badge-warn">Atrasado</span>';
            } else if (nextFollow === today) {
                statusBadge = '<span class="badge badge-accent">Hoje</span>';
            } else {
                statusBadge = '<span class="badge badge-muted">Em dia</span>';
            }

            tr.innerHTML = `
                <td><strong>${this.escapeHTML(clientName)}</strong></td>
                <td>${lastFormat}</td>
                <td><small>${this.escapeHTML(alert.notes || '')}</small></td>
                <td>Ligar em: ${nextFormat} ${statusBadge}</td>
                <td style="display:flex; gap: 0.5rem;">
                    <button class="btn btn-sm btn-outline" onclick="document.getElementById('crm-client').value='${this.escapeHTML(clientName)}'; document.getElementById('crm-notes').focus();" title="Novo contato"><i class='bx bx-phone'></i></button>
                    <button class="btn btn-sm btn-outline" onclick="CRMModule.viewHistory('${this.escapeHTML(clientName)}')" title="Ver Histórico"><i class='bx bx-history'></i></button>
                </td>
            `;
            this.dom.alertsBody.appendChild(tr);
        });
    },

    viewHistory(clientName) {
        const all = DataStore.get(STORAGE_KEYS.CUSTOMERS);
        const history = all.filter(c => (c.name || c.client) === clientName)
            .sort((a, b) => new Date((b.lastContactDate || b.contactDate) + 'T00:00:00') - new Date((a.lastContactDate || a.contactDate) + 'T00:00:00'));

        let html = `<div style="padding: 1rem;"><h3>Histórico: ${clientName}</h3><hr style="margin: 1rem 0; opacity: 0.1;">`;

        if (history.length === 0) html += `<p>Nenhum registro encontrado.</p>`;
        else {
            history.forEach(h => {
                const date = (h.lastContactDate || h.contactDate || '').split('-').reverse().join('/');
                
                let detailsHtml = '';
                if(h.phone) detailsHtml += `<strong>Tel:</strong> ${this.escapeHTML(h.phone)} | `;
                if(h.buyerName) detailsHtml += `<strong>Comprador:</strong> ${this.escapeHTML(h.buyerName)} | `;
                if(h.products) detailsHtml += `<strong>Produtos:</strong> ${this.escapeHTML(h.products)} | `;
                if(h.source) detailsHtml += `<strong>Origem:</strong> ${this.escapeHTML(h.source)}`;
                
                html += `
                    <div style="margin-bottom: 1.5rem; background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; border-left: 3px solid var(--primary);">
                        <div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem;">
                            <span style="font-weight:700; color: var(--primary);">${date}</span>
                        </div>
                        ` + (detailsHtml ? `<p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">${detailsHtml.replace(/ \| $/, '')}</p>` : '') + `
                        <p style="font-size: 0.95rem; color: var(--text-main);">${this.escapeHTML(h.notes || 'Sem anotações.')}</p>
                    </div>
                `;
            });
        }
        html += `<button class="btn btn-primary" style="margin-top: 1rem;" onclick="document.getElementById('crm-history-modal').classList.add('hidden')">Fechar</button></div>`;

        const modal = document.getElementById('crm-history-modal');
        document.getElementById('crm-history-content').innerHTML = html;
        modal.classList.remove('hidden');
    },

    escapeHTML(str) {
        if (!str) return "";
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag]));
    }
};

window.CRMModule = CRMModule;

document.addEventListener('DataStoreReady', () => {
    CRMModule.init();
});
