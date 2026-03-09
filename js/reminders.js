/**
 * Reminders Module
 * Handles creation, listing, and deletion of user reminders.
 */

const RemindersModule = {
    init() {
        this.cacheDOM();
        this.bindEvents();
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        if (this.dom.dateInput) this.dom.dateInput.value = today;

        this.loadReminders();
    },

    cacheDOM() {
        this.dom = {
            form: document.getElementById('reminder-form'),
            title: document.getElementById('reminder-title'),
            dateInput: document.getElementById('reminder-date'),
            timeInput: document.getElementById('reminder-time'),
            priority: document.getElementById('reminder-priority'),
            tableBody: document.getElementById('reminders-table-body'),
        };
    },

    bindEvents() {
        if (this.dom.form) {
            this.dom.form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleFormSubmit();
            });
        }
    },

    async handleFormSubmit() {
        const title = this.dom.title.value.trim();
        const dateLimit = this.dom.dateInput.value;
        const timeLimit = this.dom.timeInput.value;
        const priority = this.dom.priority.value;

        if (!title || !dateLimit || !timeLimit) return;

        const newReminder = {
            title: title,
            dateLimit: dateLimit,
            timeLimit: timeLimit,
            priority: priority,
            status: 'Pendente' // can be "Concluida" if we add a checkout later
        };

        await DataStore.add(STORAGE_KEYS.REMINDERS, newReminder);

        // Reset text only
        this.dom.title.value = '';
        this.dom.title.focus();

        this.loadReminders();

        // Try to update app notifications if available
        if (window.AppModule && window.AppModule.updateNotifications) {
            window.AppModule.updateNotifications(true);
        }
    },

    loadReminders() {
        if (!this.dom.tableBody) return;

        const allReminders = DataStore.get(STORAGE_KEYS.REMINDERS) || [];

        // Sort by date and time ascending (closest first)
        allReminders.sort((a, b) => {
            const dateA = new Date(`${a.dateLimit}T${a.timeLimit || '00:00'}:00`);
            const dateB = new Date(`${b.dateLimit}T${b.timeLimit || '00:00'}:00`);
            return dateA - dateB;
        });

        this.renderTable(allReminders);
    },

    renderTable(reminders) {
        this.dom.tableBody.innerHTML = '';

        if (reminders.length === 0) {
            this.dom.tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhum lembrete pendente. Vazia a cabeça!</td></tr>`;
            return;
        }

        const priorityColors = {
            "Alta": "var(--danger)",
            "Media": "var(--warning)",
            "Baixa": "var(--accent)"
        };

        const now = new Date();

        reminders.forEach(rmd => {
            const tr = document.createElement('tr');
            const rmdDate = new Date(`${rmd.dateLimit}T${rmd.timeLimit || '00:00'}:00`);
            const dateFormat = rmd.dateLimit.split('-').reverse().join('/');
            const timeFormat = rmd.timeLimit ? ` às ${rmd.timeLimit}` : '';

            let dateStyle = '';
            if (rmdDate < now) {
                dateStyle = 'color: var(--danger); font-weight: bold;';
            }

            tr.innerHTML = `
                <td style="${dateStyle}"><i class='bx bx-calendar-exclamation'></i> ${dateFormat}${timeFormat}</td>
                <td><strong>${this.escapeHTML(rmd.title)}</strong></td>
                <td><span class="badge" style="background: ${priorityColors[rmd.priority]}20; color: ${priorityColors[rmd.priority]}">${rmd.priority}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline" style="color:var(--accent); border-color:var(--accent)" onclick="RemindersModule.completeReminder('${rmd.id}')" title="Concluir">✔️</button>
                    <button class="btn btn-sm btn-outline" style="color:var(--danger)" onclick="RemindersModule.deleteReminder('${rmd.id}')" title="Excluir">🗑️</button>
                </td>
            `;
            this.dom.tableBody.appendChild(tr);
        });
    },

    completeReminder(id) {
        DataStore.remove(STORAGE_KEYS.REMINDERS, id);
        this.loadReminders();
        if (window.AppModule && window.AppModule.updateNotifications) {
            window.AppModule.updateNotifications(true);
        }
    },

    deleteReminder(id) {
        if (!confirm('Excluir este lembrete?')) return;
        this.completeReminder(id); // doing the exact same logic (removing it)
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

window.RemindersModule = RemindersModule;

document.addEventListener('DataStoreReady', () => {
    RemindersModule.init();
});
