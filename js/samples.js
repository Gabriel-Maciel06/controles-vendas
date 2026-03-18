/**
 * Samples Module v2.0 - Gestão de Amostras Isapel
 */
const SamplesModule = {
    init() {
        this.cache = [];
        this.render();
        this.initForm();
        
        // Auto-refresh when DataStore is ready or updated
        window.addEventListener('datastore-ready', () => this.load());
        window.addEventListener('datastore-updated', () => this.load());
    },

    async load() {
        try {
            this.cache = await DataStore.get('samples');
            this.render();
        } catch (error) {
            console.error("Erro ao carregar amostras:", error);
        }
    },

    initForm() {
        const form = document.getElementById('sample-form');
        if (!form) return;

        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('sample-date');
        if (dateInput) dateInput.value = today;

        form.onsubmit = async (e) => {
            e.preventDefault();
            
            // Calculate default delivery date if empty (+10 days)
            let deliveryDate = document.getElementById('sample-delivery').value;
            if (!deliveryDate) {
                const dateObj = new Date(document.getElementById('sample-date').value);
                dateObj.setDate(dateObj.getDate() + 10);
                deliveryDate = dateObj.toISOString().split('T')[0];
            }

            const newSample = {
                id: 'samp_' + Date.now(),
                profile: DataStore.getProfile(),
                client: document.getElementById('sample-client').value,
                product: "Envelope completo",
                trackingCode: document.getElementById('sample-tracking').value.trim().toUpperCase(),
                sendDate: document.getElementById('sample-date').value,
                estimatedReturn: deliveryDate,
                notes: document.getElementById('sample-notes').value,
                status: 'Enviado',
                createdAt: new Date().toISOString()
            };

            const success = await DataStore.add('samples', newSample);
            if (success) {
                form.reset();
                if (dateInput) dateInput.value = today;
                this.load();
                
                // Alert visual fixo para usuário saber que salvou
                const btn = form.querySelector('button[type="submit"]');
                const originalText = btn.innerHTML;
                btn.innerHTML = "<i class='bx bx-check'></i> Enviado!";
                btn.style.background = "#10b981";
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = "";
                }, 2500);
            }
        };
    },

    render() {
        const tbody = document.getElementById('samples-table-body');
        if (!tbody) return;

        if (this.cache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">
                <i class='bx bx-package' style="font-size: 2rem; display: block; margin-bottom: 0.5rem; opacity: 0.3;"></i>
                Nenhum envio registrado.
            </td></tr>`;
            return;
        }

        // Ordenar: primeiro os que estão com entrega mais próxima ou atrasados
        const sorted = [...this.cache].sort((a, b) => new Date(a.estimatedReturn) - new Date(b.estimatedReturn));

        tbody.innerHTML = sorted.map(item => {
            const today = new Date();
            const delivery = new Date(item.estimatedReturn);
            const diffDays = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
            
            let statusBadge = '';
            let rowStyle = '';

            if (item.status === 'Entregue') {
                statusBadge = '<span class="badge badge-success">✅ Entregue</span>';
            } else if (diffDays < 0) {
                statusBadge = '<span class="badge badge-danger">⚠️ Atrasado</span>';
                rowStyle = 'background: rgba(239, 68, 68, 0.03);';
            } else if (diffDays <= 2) {
                statusBadge = '<span class="badge badge-warning">🔔 Entrega em breve</span>';
                rowStyle = 'background: rgba(245, 158, 11, 0.03);';
            } else {
                statusBadge = '<span class="badge badge-info">🚚 Em trânsito</span>';
            }

            const trackingLink = item.trackingCode 
                ? `<a href="https://www.linkcorreios.com.br/?id=${item.trackingCode}" target="_blank" class="tracking-code" title="Rastrear nos Correios">
                    <i class='bx bx-map-pin'></i> ${item.trackingCode}
                   </a>`
                : '<span style="color:var(--text-muted); font-size: 0.75rem;">—</span>';

            const formattedDelivery = new Date(item.estimatedReturn + 'T00:00:00').toLocaleDateString('pt-BR');

            return `
                <tr style="${rowStyle}">
                    <td>
                        <div style="font-weight: 600;">${item.client}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${item.notes || 'Sem observações'}
                        </div>
                    </td>
                    <td>${trackingLink}</td>
                    <td>
                        <div style="font-size: 0.85rem;">${formattedDelivery}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">${diffDays < 0 ? 'Atrasado há ' + Math.abs(diffDays) + 'd' : 'Em ' + diffDays + ' dias'}</div>
                    </td>
                    <td>${statusBadge}</td>
                    <td>
                        <div style="display:flex; gap: 4px;">
                            ${item.status !== 'Entregue' 
                                ? `<button onclick="SamplesModule.updateStatus('${item.id}', 'Entregue')" class="btn-icon-sm" title="Marcar como entregue"><i class='bx bx-check-double'></i></button>`
                                : `<button onclick="SamplesModule.updateStatus('${item.id}', 'Enviado')" class="btn-icon-sm" title="Reverter para em trânsito"><i class='bx bx-undo'></i></button>`
                            }
                        </div>
                    </td>
                    <td style="text-align: right;">
                        <button onclick="SamplesModule.delete('${item.id}')" class="btn-icon-sm" style="color: var(--danger);"><i class='bx bx-trash'></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async updateStatus(id, newStatus) {
        const item = this.cache.find(s => s.id === id);
        if (!item) return;

        const updated = { ...item, status: newStatus, updatedAt: new Date().toISOString() };
        await DataStore.update('samples', id, updated);
        this.load();
    },

    async delete(id) {
        if (confirm("Deseja excluir este registro de envio?")) {
            await DataStore.delete('samples', id);
            this.load();
        }
    }
};

// Start
SamplesModule.init();
