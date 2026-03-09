/**
 * Universal Calendar Module
 * Aggregates events from Sales, CRM, and Samples
 */

const CalendarModule = {
    viewMode: 'list', // 'list' or 'grid'
    currentDate: new Date(),
    eventsCache: [],

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadEvents();
    },

    cacheDOM() {
        this.dom = {
            tableBody: document.getElementById('calendar-table-body'),
            btnToggle: document.getElementById('btn-toggle-calendar'),
            btnPrevMonth: document.getElementById('btn-prev-month'),
            btnNextMonth: document.getElementById('btn-next-month'),
            calendarTitle: document.getElementById('calendar-title'),
            listContainer: document.getElementById('calendar-list-container'),
            gridContainer: document.getElementById('calendar-grid-container'),
            gridBody: document.getElementById('calendar-grid')
        };
    },

    bindEvents() {
        if (this.dom.btnToggle) {
            this.dom.btnToggle.addEventListener('click', () => {
                this.viewMode = this.viewMode === 'list' ? 'grid' : 'list';
                this.updateView();
            });
        }
        if (this.dom.btnPrevMonth) {
            this.dom.btnPrevMonth.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                this.updateView();
            });
        }
        if (this.dom.btnNextMonth) {
            this.dom.btnNextMonth.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                this.updateView();
            });
        }
    },

    loadEvents() {
        if (!this.dom.tableBody) return;

        let allEvents = [];

        // 1. Sales Expected Invoices
        const sales = DataStore.get(STORAGE_KEYS.SALES);
        sales.forEach(sale => {
            allEvents.push({
                date: sale.invoiceDate,
                client: sale.client,
                type: 'Faturamento',
                status: 'Aguardando',
                color: 'accent',
                rawDate: new Date(sale.invoiceDate + 'T00:00:00')
            });
        });

        // 2. CRM Follow ups
        const contacts = DataStore.get(STORAGE_KEYS.CUSTOMERS);
        // Map to get latest only per client
        const clientLatest = {};
        contacts.forEach(c => {
            if (!clientLatest[c.client] || new Date(c.contactDate + 'T00:00:00') > new Date(clientLatest[c.client].contactDate + 'T00:00:00')) {
                clientLatest[c.client] = c;
            }
        });
        Object.values(clientLatest).forEach(c => {
            allEvents.push({
                date: c.nextFollowUp,
                client: c.client,
                type: 'Follow-up Ligação',
                status: 'CRM',
                color: 'warning',
                rawDate: new Date(c.nextFollowUp + 'T00:00:00')
            });
        });

        // 3. Samples Return
        const samples = DataStore.get(STORAGE_KEYS.SAMPLES);
        samples.forEach(s => {
            if (s.status === 'Enviada' || s.status === 'Follow-up Pendente') {
                allEvents.push({
                    date: s.estimatedReturn,
                    client: s.client,
                    type: `Retorno Amostra: ${s.product}`,
                    status: s.status,
                    color: 'primary',
                    rawDate: new Date(s.estimatedReturn + 'T00:00:00')
                });
            }
        });

        // Sort by date ascending
        allEvents.sort((a, b) => a.rawDate - b.rawDate);

        this.eventsCache = allEvents;
        this.updateView();
    },

    updateView() {
        if (!this.dom.tableBody) return;

        if (this.viewMode === 'list') {
            this.dom.gridContainer.classList.add('hidden');
            this.dom.listContainer.classList.remove('hidden');
            this.dom.btnPrevMonth.classList.add('hidden');
            this.dom.btnNextMonth.classList.add('hidden');
            this.dom.calendarTitle.innerText = 'Próximos Faturamentos e Follow-ups';
            this.dom.btnToggle.innerHTML = "<i class='bx bx-calendar'></i>";
            this.renderTable(this.eventsCache);
        } else {
            this.dom.listContainer.classList.add('hidden');
            this.dom.gridContainer.classList.remove('hidden');
            this.dom.btnPrevMonth.classList.remove('hidden');
            this.dom.btnNextMonth.classList.remove('hidden');
            this.dom.btnToggle.innerHTML = "<i class='bx bx-list-ul'></i>";

            const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            this.dom.calendarTitle.innerText = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
            this.renderGrid(this.eventsCache);
        }
    },

    renderTable(events) {
        this.dom.tableBody.innerHTML = '';

        // Filter out very old events? We'll show everything from today onward + past due recent ones
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const filtered = events.filter(e => {
            // Include if not more than 30 days old
            const diffTime = today - e.rawDate;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays < 30;
        });

        if (filtered.length === 0) {
            this.dom.tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhum evento futuro ou pendente encontrado.</td></tr>`;
            return;
        }

        filtered.forEach(event => {
            const tr = document.createElement('tr');

            const dateFormat = event.date.split('-').reverse().join('/');

            // Status/Overdue coloring
            let dateStyle = '';
            if (event.rawDate < today) dateStyle = 'color: var(--danger); font-weight: bold;';
            else if (event.rawDate.getTime() === today.getTime()) dateStyle = 'color: var(--warning); font-weight: bold;';

            tr.innerHTML = `
                <td style="${dateStyle}"><i class='bx bx-time'></i> ${dateFormat}</td>
                <td><strong>${this.escapeHTML(event.client)}</strong></td>
                <td><span class="badge badge-${event.color}">${event.type}</span></td>
                <td>${event.status}</td>
            `;
            this.dom.tableBody.appendChild(tr);
        });
    },

    renderGrid(events) {
        if (!this.dom.gridBody) return;
        this.dom.gridBody.innerHTML = '';

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Days from previous month to fill first row
        const startingDayOfWeek = firstDay.getDay(); // 0 is Sunday

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fill previous month empty spaces
        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'calendar-day empty';
            this.dom.gridBody.appendChild(emptyDiv);
        }

        // Fill current month days
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const currentObjDate = new Date(year, month, day);
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';

            if (currentObjDate.getTime() === today.getTime()) {
                dayDiv.classList.add('today');
            }

            dayDiv.innerHTML = `<span class="day-number">${day}</span>`;

            // Find events for this day
            const dayEvents = events.filter(e =>
                e.rawDate.getFullYear() === year &&
                e.rawDate.getMonth() === month &&
                e.rawDate.getDate() === day
            );

            dayEvents.forEach(evt => {
                const evtDiv = document.createElement('div');
                let colorClass = 'event-crm';
                if (evt.type.includes('Faturamento')) colorClass = 'event-faturamento';
                if (evt.type.includes('Amostra')) colorClass = 'event-amostra';

                evtDiv.className = `calendar-event ${colorClass}`;
                evtDiv.title = `${evt.client} - ${evt.type} (${evt.status})`;
                evtDiv.innerText = evt.client;
                dayDiv.appendChild(evtDiv);
            });

            this.dom.gridBody.appendChild(dayDiv);
        }

        // Fill next month empty spaces
        const remainingDays = 42 - (startingDayOfWeek + lastDay.getDate()); // Max 6 weeks * 7 = 42 cells
        if (remainingDays < 7) { // Only fill if we don't end perfectly or leave a whole week empty
            for (let i = 0; i < remainingDays; i++) {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'calendar-day empty';
                this.dom.gridBody.appendChild(emptyDiv);
            }
        }
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

window.CalendarModule = CalendarModule;

document.addEventListener('DataStoreReady', () => {
    CalendarModule.init();
});
