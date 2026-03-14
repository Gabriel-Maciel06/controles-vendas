/**
 * Sales & Commission Module
 */

const SalesModule = {
    // Commission Rules Config (Defaults)
    RULES: {
        BOX_20056_VALUE: 5,
        VARIABLE_PCT: 0.01 // 1%
    },

    getFixedRules() {
        const settings = DataStore.get('crm_settings') || {}; // Fallback hardcoded if empty somehow
        return {
            "Google": parseFloat(settings.google) ?? 100,
            "Reativacao": parseFloat(settings.reativacao) ?? 100,
            "Introducao": parseFloat(settings.introducao) ?? 25,
            "Normal": 0
        };
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
        // Set default dates
        const today = new Date().toISOString().split('T')[0];
        this.dom.dateInput.value = today;
        this.dom.fatInput.value = today;

        // Recalculate all commissions automatically
        this.loadSales();
    },


    cacheDOM() {
        this.dom = {
            form: document.getElementById('sales-form'),
            client: document.getElementById('sale-client'),
            type: document.getElementById('sale-type'),
            boxes: document.getElementById('sale-boxes'),
            dateInput: document.getElementById('sale-date'),
            fatInput: document.getElementById('sale-faturamento'),
            value: document.getElementById('sale-value'),
            tableBody: document.getElementById('sales-table-body'),
            productName: document.getElementById('sale-product-name'),
            costValue: document.getElementById('sale-cost-value'),

            // KPIs
            kpiGoogle: document.getElementById('kpi-google-count'),
            kpiReativacao: document.getElementById('kpi-reativacao-count'),
            kpiIntroducao: document.getElementById('kpi-introducao-count'),
            kpiTotalComm: document.getElementById('kpi-total-commission')
        };
    },

    bindEvents() {
        this.dom.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFormSubmit();
        });
    },

    calculateCommission(type, boxesQty, totalValue) {
        const profile = sessionStorage.getItem('maciel_profile');
        
        if (profile === 'mamae') {
            // No perfil da mãe, comissão = Lucro (Venda - Custo)
            const saleValue = parseFloat(totalValue) || 0;
            const costValue = parseFloat(this.dom.costValue.value) || 0;
            return saleValue - costValue;
        }

        const fixedRules = this.getFixedRules();
        let fixed = fixedRules[type] || 0;
        let boxes = (parseInt(boxesQty) || 0) * this.RULES.BOX_20056_VALUE;
        let variable = (parseFloat(totalValue) || 0) * this.RULES.VARIABLE_PCT;

        return fixed + boxes + variable;
    },

    async handleFormSubmit() {
        const type = this.dom.type.value;
        const boxes = parseInt(this.dom.boxes.value) || 0;
        const value = parseFloat(this.dom.value.value) || 0;

        const comm = this.calculateCommission(type, boxes, value);

        const newSale = {
            client: this.dom.client.value,
            productName: this.dom.productName.value || "",
            costPrice: parseFloat(this.dom.costValue.value) || 0,
            type: type,
            boxes20056: boxes,
            saleDate: this.dom.dateInput.value,
            invoiceDate: this.dom.fatInput.value,
            value: value,
            commission: comm
        };

        await DataStore.add(STORAGE_KEYS.SALES, newSale);

        // Form reset - mas preservando a data
        this.dom.client.value = '';
        const profile = sessionStorage.getItem('maciel_profile');
        if (profile === 'mamae') {
            this.dom.type.value = 'Normal'; 
            this.dom.boxes.value = '0';
            this.dom.productName.value = '';
            this.dom.costValue.value = '';
        } else {
            this.dom.type.value = '';
            this.dom.boxes.value = '0';
        }
        
        this.dom.value.value = '';
        this.dom.client.focus();

        this.loadSales();
    },

    loadSales() {
        // We filter for CURRENT MONTH for KPIs
        const allSales = DataStore.get(STORAGE_KEYS.SALES);

        // Sort descending by created date
        allSales.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        this.renderTable(allSales);
        this.updateKPIs(allSales);
    },

    renderTable(sales) {
        this.dom.tableBody.innerHTML = '';

        if (sales.length === 0) {
            this.dom.tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhuma venda registrada ainda.</td></tr>`;
            return;
        }

        // Only render the latest 10 for dashboard
        const recent = sales.slice(0, 10);

        const typeMapping = {
            "Google": '<span class="badge badge-primary">Google</span>',
            "Reativacao": '<span class="badge badge-accent">Reativação</span>',
            "Introducao": '<span class="badge badge-warn">Introdução</span>',
            "Normal": '<span class="badge badge-muted">Normal</span>'
        };

        const profile = sessionStorage.getItem('maciel_profile');

        recent.forEach(sale => {
            const tr = document.createElement('tr');

            const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

            // Se for perfil mamae, mostramos o nome do produto no lugar da badge de 'Normal'
            let statusHTML = typeMapping[sale.type] || sale.type;
            if (profile === 'mamae' && sale.productName) {
                statusHTML = `<span class="badge badge-muted" style="background:#4c0519; color:white;">${this.escapeHTML(sale.productName)}</span>`;
            }

            tr.innerHTML = `
                <td><strong>${this.escapeHTML(sale.client)}</strong></td>
                <td>${statusHTML}</td>
                <td>${formatCurrency(sale.value)}</td>
                <td style="color: var(--accent); font-weight: 600;">+ ${formatCurrency(sale.commission)}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="SalesModule.editSale('${sale.id}')" title="Editar">✏️</button>
                    <button class="btn btn-sm btn-outline" style="color:#ef4444" onclick="SalesModule.deleteSale('${sale.id}')" title="Excluir">🗑️</button>
                </td>
            `;
            this.dom.tableBody.appendChild(tr);
        });
    },

    updateKPIs(sales) {
        // Logic to filter by current month
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let stats = {
            google: 0,
            reativacao: 0,
            introducao: 0,
            totalCommission: 0
        };

        sales.forEach(sale => {
            // Guarantee pure date formatting
            let dateStr = sale.saleDate || "";
            if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];

            if (dateStr) {
                const saleDate = new Date(dateStr + 'T00:00:00');
                if (sale.type === "Google") stats.google++;
                if (sale.type === "Reativacao") stats.reativacao++;
                if (sale.type === "Introducao") stats.introducao++;

                stats.totalCommission += parseFloat(sale.commission || 0);
            }
        });

        this.dom.kpiGoogle.innerText = stats.google;
        this.dom.kpiReativacao.innerText = stats.reativacao;
        this.dom.kpiIntroducao.innerText = stats.introducao;

        this.dom.kpiTotalComm.innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalCommission);
    },

    async deleteSale(id) {
        if (!confirm('Excluir esta venda?')) return;
        await DataStore.remove(STORAGE_KEYS.SALES, id);
        this.loadSales();
        if (typeof CalendarModule !== 'undefined') CalendarModule.loadEvents();
    },

    editSale(id) {
        const sale = DataStore.get(STORAGE_KEYS.SALES).find(s => String(s.id) === String(id));
        if (!sale) return;

        this.dom.client.value = sale.client;
        this.dom.type.value = sale.type;
        this.dom.boxes.value = sale.boxes20056 || 0;
        this.dom.dateInput.value = sale.saleDate;
        this.dom.fatInput.value = sale.invoiceDate;
        this.dom.value.value = sale.value;
        if (this.dom.productName) this.dom.productName.value = sale.productName || "";
        if (this.dom.costValue) this.dom.costValue.value = sale.costPrice || "";

        // Remove a venda antiga e salva a edição no submit
        DataStore.remove(STORAGE_KEYS.SALES, id);
        this.loadSales();
        this.dom.client.focus();
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

window.SalesModule = SalesModule;

window.SalesModule = SalesModule;

// Auto-init on load
document.addEventListener('DataStoreReady', () => {
    SalesModule.init();
});
