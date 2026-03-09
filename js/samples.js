/**
 * Samples Management Module
 */

const SamplesModule = {
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.dom.dateInput.value = new Date().toISOString().split('T')[0];
        this.loadSamples();
    },

    cacheDOM() {
        this.dom = {
            form: document.getElementById('sample-form'),
            client: document.getElementById('sample-client'),
            product: document.getElementById('sample-product'),
            dateInput: document.getElementById('sample-date'),
            tableBody: document.getElementById('samples-table-body')
        };
    },

    bindEvents() {
        this.dom.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFormSubmit();
        });
    },

    async handleFormSubmit() {
        const client = this.dom.client.value;
        const product = this.dom.product.value;
        const sentDate = this.dom.dateInput.value;

        // Estimated return +7 days
        const dateObj = new Date(sentDate + 'T00:00:00');
        dateObj.setDate(dateObj.getDate() + 7);
        const estimatedReturn = dateObj.toISOString().split('T')[0];

        const newSample = {
            client: client,
            product: product,
            sentDate: sentDate,
            estimatedReturn: estimatedReturn,
            status: 'Enviada' // Enviada, Follow-up Pendente, Convertida, Rejeitada
        };

        await DataStore.add(STORAGE_KEYS.SAMPLES, newSample);

        this.dom.client.value = '';
        this.dom.product.value = '';
        this.dom.client.focus();

        this.loadSamples();
        if (typeof CalendarModule !== 'undefined') CalendarModule.loadEvents();
    },

    updateStatus(id, newStatus) {
        DataStore.update(STORAGE_KEYS.SAMPLES, id, { status: newStatus });
        this.loadSamples();
    },

    deleteSample(id) {
        if (!confirm('Excluir este registro de amostra?')) return;
        DataStore.remove(STORAGE_KEYS.SAMPLES, id);
        this.loadSamples();
        if (typeof CalendarModule !== 'undefined') CalendarModule.loadEvents();
    },

    loadSamples() {
        const samples = DataStore.get(STORAGE_KEYS.SAMPLES);
        samples.sort((a, b) => new Date(a.estimatedReturn + 'T00:00:00') - new Date(b.estimatedReturn + 'T00:00:00'));
        this.renderTable(samples);
    },

    renderTable(samples) {
        this.dom.tableBody.innerHTML = '';

        if (samples.length === 0) {
            this.dom.tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhuma amostra enviada.</td></tr>`;
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        samples.forEach(sample => {
            const tr = document.createElement('tr');

            const returnFormat = sample.estimatedReturn.split('-').reverse().join('/');

            // Status styling
            let statusBadge = `<span class="badge badge-muted">${sample.status}</span>`;
            if (sample.status === 'Convertida') statusBadge = `<span class="badge badge-accent">Convertida</span>`;
            else if (sample.status === 'Rejeitada') statusBadge = `<span class="badge" style="background:#ef444433;color:#ef4444">Rejeitada</span>`;
            else if (sample.status === 'Enviada') {
                statusBadge = `<span class="badge badge-primary">Enviada</span>`;
            }

            // Removido auto-update de dentro do render (causava loop infinito)
            // Se precisar de auto-update, deve ser feito em backend cron ou na hora do load e aguardar.

            tr.innerHTML = `
                <td><strong>${this.escapeHTML(sample.client)}</strong></td>
                <td>${this.escapeHTML(sample.product)}</td>
                <td>${returnFormat}</td>
                <td>${statusBadge}</td>
                <td>
                    <select onchange="SamplesModule.updateStatus('${sample.id}', this.value)" style="padding: 0.25rem; font-size: 0.8rem; width: auto; background: var(--bg-surface-hover); cursor:pointer;">
                        <option value="">Aterar...</option>
                        <option value="Enviada">Marcar Enviada</option>
                        <option value="Follow-up Pendente">Pendente FG</option>
                        <option value="Convertida">Foi Convertida</option>
                        <option value="Rejeitada">Cliente Rejeitou</option>
                    </select>
                </td>
            `;
            this.dom.tableBody.appendChild(tr);
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

window.SamplesModule = SamplesModule;

// Auto-init on load
document.addEventListener('DataStoreReady', () => {
    SamplesModule.init();
});
