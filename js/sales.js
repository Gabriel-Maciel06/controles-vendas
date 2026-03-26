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
        const settings = DataStore.get('crm_settings') || {};
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
            kpiTotalComm: document.getElementById('kpi-total-commission'),
            customerDatalist: document.getElementById('crm-clients-list')
        };
    },

    bindEvents() {
        if (this._eventsBound) return;
        this.dom.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFormSubmit();
        });
        
        const btnCancel = document.getElementById('btn-cancel-edit');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => this.cancelEdit());
        }

        this._eventsBound = true;
    },

    calculateCommission(type, boxesQty, totalValue) {
        const profile = sessionStorage.getItem('maciel_profile');
        
        if (profile === 'mamae') {
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
        if (this._submitting) return;
        this._submitting = true;

        const btnSubmit = this.dom.form.querySelector('button[type="submit"]');
        const originalText = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = 'Lançando... <i class="bx bx-loader-alt bx-spin"></i>';

        try {
            // Normalizar nome do cliente
            const clientName = this.dom.client.value.trim().toUpperCase();
            if (!clientName) {
                alert("Por favor, informe o nome do cliente.");
                return;
            }
            const type = this.dom.type.value;
            const boxes = parseInt(this.dom.boxes.value) || 0;
            const value = parseFloat(this.dom.value.value) || 0;
            const comm = this.calculateCommission(type, boxes, value);

            const saleData = {
                client: clientName,
                productName: this.dom.productName.value || "",
                costPrice: parseFloat(this.dom.costValue.value) || 0,
                type: type,
                boxes20056: boxes,
                saleDate: this.dom.dateInput.value,
                invoiceDate: this.dom.fatInput.value,
                value: value,
                commission: comm
            };

            if (this.editingId) {
                await DataStore.update(STORAGE_KEYS.SALES, this.editingId, saleData);
            } else {
                await DataStore.add(STORAGE_KEYS.SALES, saleData);
            }

            this.cancelEdit();
            this.loadSales();
            if (window.DashboardModule) window.DashboardModule.update();
        } catch (error) {
            console.error("Erro ao salvar venda:", error);
        } finally {
            this._submitting = false;
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = originalText;
            }
        }
    },

    cancelEdit() {
        this.editingId = null;
        this.dom.form.reset();
        
        const btnSubmit = this.dom.form.querySelector('button[type="submit"]');
        if (btnSubmit) btnSubmit.innerHTML = '<i class="bx bx-plus"></i> LANÇAR VENDA';
        
        const btnCancel = document.getElementById('btn-cancel-edit');
        if (btnCancel) btnCancel.classList.add('hidden');
        
        const today = new Date().toISOString().split('T')[0];
        this.dom.dateInput.value = today;
        this.dom.fatInput.value = today;
    },

    loadSales() {
        const allSales = DataStore.get(STORAGE_KEYS.SALES) || [];
        this.renderTable(allSales);
        this.updateKPIs(allSales);
        this.updateCustomerDatalist();
    },

    updateCustomerDatalist() {
        if (!this.dom.customerDatalist) return;
        const customers = DataStore.get(STORAGE_KEYS.CUSTOMERS) || [];
        const customerNames = customers.map(c => (c.name || c.client || "").trim()).filter(n => n);
        const sales = DataStore.get(STORAGE_KEYS.SALES) || [];
        const salesNames = sales.map(s => (s.client || "").trim()).filter(n => n);
        const uniqueNames = [...new Set([...customerNames, ...salesNames])].sort();
        this.dom.customerDatalist.innerHTML = uniqueNames.map(name => `<option value="${name}">`).join('');
    },

    renderTable(sales) {
        this.dom.tableBody.innerHTML = '';
        if (sales.length === 0) {
            this.dom.tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhuma venda registrada ainda.</td></tr>`;
            return;
        }

        const recent = [...sales].sort((a,b) => b.saleDate.localeCompare(a.saleDate)).slice(0, 50);
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
        if (!Array.isArray(sales)) return;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let stats = { google: 0, reativacao: 0, introducao: 0, totalCommission: 0 };

        sales.forEach(sale => {
            let dateStr = (sale.saleDate || "").split('T')[0];
            if (dateStr) {
                const saleDate = new Date(dateStr + 'T00:00:00');
                if (saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear) {
                    if (sale.type === "Google") stats.google++;
                    if (sale.type === "Reativacao") stats.reativacao++;
                    if (sale.type === "Introducao") stats.introducao++;
                    stats.totalCommission += parseFloat(sale.commission || 0);
                }
            }
        });

        if (this.dom.kpiGoogle) this.dom.kpiGoogle.innerText = stats.google;
        if (this.dom.kpiReativacao) this.dom.kpiReativacao.innerText = stats.reativacao;
        if (this.dom.kpiIntroducao) this.dom.kpiIntroducao.innerText = stats.introducao;
        if (this.dom.kpiTotalComm) this.dom.kpiTotalComm.innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalCommission);
    },

    async deleteSale(id) {
        if (!confirm('Excluir esta venda?')) return;
        await DataStore.remove(STORAGE_KEYS.SALES, id);
        this.loadSales();
        if (window.DashboardModule) window.DashboardModule.update();
        if (typeof CalendarModule !== 'undefined') CalendarModule.loadEvents();
    },

    editSale(id) {
        const sale = DataStore.get(STORAGE_KEYS.SALES).find(s => String(s.id) === String(id));
        if (!sale) return;

        this.editingId = id;
        this.dom.client.value = sale.client;
        this.dom.type.value = sale.type;
        this.dom.boxes.value = sale.boxes20056 || 0;
        this.dom.dateInput.value = sale.saleDate;
        this.dom.fatInput.value = sale.invoiceDate;
        this.dom.value.value = sale.value;
        if (this.dom.productName) this.dom.productName.value = sale.productName || "";
        if (this.dom.costValue) this.dom.costValue.value = sale.costPrice || "";

        const btnSubmit = this.dom.form.querySelector('button[type="submit"]');
        if (btnSubmit) btnSubmit.innerHTML = '<i class="bx bx-save"></i> SALVAR ALTERAÇÃO';
        
        const btnCancel = document.getElementById('btn-cancel-edit');
        if (btnCancel) btnCancel.classList.remove('hidden');

        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.dom.client.focus();
    },

    fixLegacyData() {},
    escapeHTML(str) {
        return (str || "").replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t]));
    }
};

window.SalesModule = SalesModule;
document.addEventListener('DataStoreReady', () => SalesModule.init());
