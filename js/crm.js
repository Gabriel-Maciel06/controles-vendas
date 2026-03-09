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

        // Calculate next follow-up (e.g., +15 days)
        const dateObj = new Date(contactDate + 'T00:00:00');
        dateObj.setDate(dateObj.getDate() + 15);
        const nextFollowUp = dateObj.toISOString().split('T')[0];

        const newContact = {
            client: clientName,
            contactDate: contactDate,
            notes: notes,
            nextFollowUp: nextFollowUp,
            type: 'Contato'
        };

        await DataStore.add(STORAGE_KEYS.CUSTOMERS, newContact);

        this.dom.client.value = '';
        this.dom.notes.value = '';
        this.dom.client.focus();

        this.loadAlerts();

        // If CalendarModule is present, we should ideally refresh it too
        if (typeof CalendarModule !== 'undefined') CalendarModule.loadEvents();
    },

    deleteContact(id) {
        if (!confirm('Excluir este registro de contato?')) return;
        DataStore.remove(STORAGE_KEYS.CUSTOMERS, id);
        this.loadAlerts();
        if (typeof CalendarModule !== 'undefined') CalendarModule.loadEvents();
    },

    loadAlerts() {
        const allContacts = DataStore.get(STORAGE_KEYS.CUSTOMERS);

        // Get latest contact per client to figure out if they need follow-up
        const clientLatest = {};
        allContacts.forEach(c => {
            if (!clientLatest[c.client] || new Date(c.contactDate + 'T00:00:00') > new Date(clientLatest[c.client].contactDate + 'T00:00:00')) {
                clientLatest[c.client] = c;
            }
        });

        // Convert back to array
        const alerts = Object.values(clientLatest);

        // Sort by next follow up date ascending (most urgent first)
        alerts.sort((a, b) => new Date(a.nextFollowUp + 'T00:00:00') - new Date(b.nextFollowUp + 'T00:00:00'));

        this.renderTable(alerts);
    },

    renderTable(alerts) {
        this.dom.alertsBody.innerHTML = '';

        if (alerts.length === 0) {
            this.dom.alertsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhum cliente registrado.</td></tr>`;
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        alerts.forEach(alert => {
            const tr = document.createElement('tr');

            // Format dates
            const lastFormat = alert.contactDate.split('-').reverse().join('/');
            const nextFormat = alert.nextFollowUp.split('-').reverse().join('/');

            // Status check
            let statusBadge = '';
            if (alert.nextFollowUp < today) {
                statusBadge = '<span class="badge badge-warn">Atrasado</span>';
            } else if (alert.nextFollowUp === today) {
                statusBadge = '<span class="badge badge-accent">Hoje</span>';
            } else {
                statusBadge = '<span class="badge badge-muted">Em dia</span>';
            }

            tr.innerHTML = `
                <td><strong>${this.escapeHTML(alert.client)}</strong></td>
                <td>${lastFormat}</td>
                <td>Ligar em: ${nextFormat} ${statusBadge}</td>
                <td><button class="btn btn-sm btn-outline" onclick="document.getElementById('crm-client').value='${this.escapeHTML(alert.client)}'; document.getElementById('crm-notes').focus();" title="Registrar novo contato"><i class='bx bx-phone'></i></button></td>
            `;
            this.dom.alertsBody.appendChild(tr);
        });
    },

    escapeHTML(str) {
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

// Auto-init on load
document.addEventListener('DataStoreReady', () => {
    CRMModule.init();
});
