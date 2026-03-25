/**
 * Samples Module — v2.1
 * Compatível com DataStore padrão do sistema
 */

const SamplesModule = {

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.dom.dateInput.value = new Date().toISOString().split('T')[0];
        this.setDefaultDelivery();
        this.loadSamples();
        this.startTrackingLoop();
    },

    cacheDOM() {
        this.dom = {
            form:         document.getElementById('sample-form'),
            client:       document.getElementById('sample-client'),
            tracking:     document.getElementById('sample-tracking'),
            dateInput:    document.getElementById('sample-date'),
            deliveryDate: document.getElementById('sample-delivery'),
            notes:        document.getElementById('sample-notes'),
            tableBody:    document.getElementById('samples-table-body'),
        };
    },

    bindEvents() {
        this.dom.form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFormSubmit();
        });
        this.dom.dateInput?.addEventListener('change', () => this.setDefaultDelivery());
    },

    // Previsão padrão +10 dias (prazo médio Correios)
    setDefaultDelivery() {
        const base = this.dom.dateInput?.value;
        if (!base) return;
        // Só preenche se estiver vazio
        if (!this.dom.deliveryDate?.value) {
            const d = new Date(base + 'T00:00:00');
            d.setDate(d.getDate() + 10);
            if (this.dom.deliveryDate) this.dom.deliveryDate.value = d.toISOString().split('T')[0];
        }
    },

    async handleFormSubmit() {
        const sendDate     = this.dom.dateInput.value;
        const deliveryDate = this.dom.deliveryDate?.value || (() => {
            const d = new Date(sendDate + 'T00:00:00');
            d.setDate(d.getDate() + 10);
            return d.toISOString().split('T')[0];
        })();

        const newSample = {
            client:          this.dom.client.value.trim(),
            product:         'Envelope completo',
            trackingCode:    (this.dom.tracking?.value || '').trim().toUpperCase(),
            sendDate:        sendDate,
            estimatedReturn: deliveryDate,
            notes:           (this.dom.notes?.value || '').trim(),
            status:          'Enviada',
        };

        const btn = this.dom.form.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Salvando...'; }

        await DataStore.add(STORAGE_KEYS.SAMPLES, newSample);

        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bx bx-send"></i> Registrar Envio'; }

        // Limpar formulário
        this.dom.client.value = '';
        if (this.dom.tracking)     this.dom.tracking.value     = '';
        if (this.dom.notes)        this.dom.notes.value        = '';
        if (this.dom.deliveryDate) this.dom.deliveryDate.value = '';
        this.dom.dateInput.value = new Date().toISOString().split('T')[0];
        this.setDefaultDelivery();
        this.dom.client.focus();

        this.loadSamples();
        if (typeof CalendarModule  !== 'undefined') CalendarModule.loadEvents();
        if (typeof DashboardModule !== 'undefined') DashboardModule.update();
    },

    async updateDelivery(id, newDate) {
        if (!newDate) return;
        await DataStore.update(STORAGE_KEYS.SAMPLES, id, { estimatedReturn: newDate });
        this.loadSamples();
        if (typeof CalendarModule !== 'undefined') CalendarModule.loadEvents();
    },

    async updateStatus(id, newStatus) {
        if (!newStatus) return;
        await DataStore.update(STORAGE_KEYS.SAMPLES, id, { status: newStatus });
        this.loadSamples();
        if (typeof DashboardModule !== 'undefined') DashboardModule.update();
    },

    deleteSample(id) {
        if (!confirm('Excluir este registro de envio?')) return;
        DataStore.remove(STORAGE_KEYS.SAMPLES, id);
        this.loadSamples();
        if (typeof CalendarModule  !== 'undefined') CalendarModule.loadEvents();
        if (typeof DashboardModule !== 'undefined') DashboardModule.update();
    },

    startTrackingLoop() {
        // Atualizar rastreios ao abrir a tela (com pequeno delay para o DataStore estabilizar)
        setTimeout(() => this.updateAllTracking(), 2000);
        
        // Depois atualizar a cada 4 horas
        const FOUR_HOURS = 4 * 60 * 60 * 1000;
        setInterval(() => this.updateAllTracking(), FOUR_HOURS);
    },

    async updateAllTracking() {
        const btn = document.getElementById('btn-track-all');
        const profile = sessionStorage.getItem('maciel_profile') || 'default';
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Atualizando...';
        }

        try {
            const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://controles-vendas.onrender.com';
            const res = await fetch(`${apiBase}/api/samples/track-all?profile=${profile}`, { method: 'POST' });
            
            if (res.ok) {
                const data = await res.json();
                if (data.updated > 0) {
                    await DataStore.init(); // Recarrega cache
                    this.loadSamples();
                }
            }
        } catch (e) {
            console.warn('Erro ao atualizar rastreios:', e);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bx bx-refresh"></i> Atualizar Rastreios';
            }
        }
    },

    loadSamples() {
        const samples = DataStore.get(STORAGE_KEYS.SAMPLES) || [];
        // Ativas primeiro, depois por data de entrega
        samples.sort((a, b) => {
            const aFinal = ['Convertida','Rejeitada'].includes(a.status) ? 1 : 0;
            const bFinal = ['Convertida','Rejeitada'].includes(b.status) ? 1 : 0;
            if (aFinal !== bFinal) return aFinal - bFinal;
            return (a.estimatedReturn||'').localeCompare(b.estimatedReturn||'');
        });
        this.renderTable(samples);
    },

    renderTable(samples) {
        if (!this.dom.tableBody) return;
        this.dom.tableBody.innerHTML = '';

        if (!samples.length) {
            this.dom.tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:var(--text-muted);">
                <i class='bx bx-package' style="font-size:2rem;display:block;margin-bottom:0.5rem;opacity:0.3;"></i>
                Nenhum envio registrado.
            </td></tr>`;
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        samples.forEach(s => {
            const delivDate = s.estimatedReturn || '';
            const delivFmt  = delivDate ? new Date(delivDate + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
            const sendFmt   = s.sendDate  ? new Date(s.sendDate  + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
            const isLate    = delivDate && delivDate < today && !['Convertida','Rejeitada','Entregue'].includes(s.status);
            const isToday   = delivDate === today;
            const tracking  = s.trackingCode || '';

            // Calcula dias
            const diffDays  = delivDate ? Math.ceil((new Date(delivDate + 'T00:00:00') - new Date()) / 86400000) : null;
            const diffLabel = diffDays === null ? '' : isLate
                ? `Atrasado ${Math.abs(diffDays)}d`
                : diffDays === 0 ? 'Hoje' : `Em ${diffDays}d`;

            const statusMap = {
                'Enviada':             { label:'📦 Enviada',       cls:'badge-primary' },
                'Em trânsito':         { label:'🚚 Em trânsito',   cls:'badge-warn'    },
                'Entregue':            { label:'✅ Entregue',       cls:'badge-accent'  },
                'Follow-up Pendente':  { label:'📞 Follow-up',     cls:'badge-warn'    },
                'Convertida':          { label:'💰 Convertida',    cls:'badge-accent'  },
                'Rejeitada':           { label:'❌ Rejeitada',      cls:'badge-danger'  },
                'Tentativa de entrega':{ label:'⚠️ Tentativa',     cls:'badge-danger'  },
                'Aguardando retirada': { label:'📬 Na Agência',    cls:'badge-warn'    },
            };
            const st    = statusMap[s.status] || { label: s.status, cls: 'badge-muted' };
            
            // Subtexto do último evento
            const lastEvent = s.trackingLastEvent || '';
            const lastEventFmt = lastEvent.length > 50 ? lastEvent.substring(0, 50) + '...' : lastEvent;
            
            const badge = `
                <span class="badge ${st.cls}">${st.label}</span>
            `;

            const dateColor = isLate ? '#E24B4A' : isToday ? '#EF9F27' : 'var(--text-muted)';
            const dateAlert = isLate ? ' ⚠️' : isToday ? ' 🔔' : '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:0.75rem 0.5rem;">
                    <div style="font-weight:600;font-size:0.87rem;color:var(--text-main);">${this.esc(s.client)}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:1px;">Enviado: ${sendFmt}</div>
                    ${s.notes ? `<div style="font-size:0.71rem;color:var(--text-muted);margin-top:2px;font-style:italic;">${this.esc(s.notes)}</div>` : ''}
                </td>

                <td style="padding:0.75rem 0.5rem;">
                    ${tracking
                        ? `<a href="https://www.17track.net/pt/track?nums=${tracking}"
                              target="_blank"
                              style="font-family:monospace;font-size:0.8rem;color:#818cf8;text-decoration:none;display:flex;align-items:center;gap:0.3rem;"
                              title="Rastrear no site dos Correios">
                              <i class='bx bx-link-external' style="font-size:0.85rem;"></i>${tracking}
                           </a>`
                        : `<span style="font-size:0.78rem;color:var(--text-muted);font-style:italic;">sem rastreio</span>`
                    }
                </td>

                <td style="padding:0.75rem 0.5rem;">
                    <div style="font-size:0.82rem;color:${dateColor};font-weight:${isLate||isToday?'600':'400'};">
                        ${delivFmt}${dateAlert}
                    </div>
                    ${diffLabel ? `<div style="font-size:0.71rem;color:${dateColor};margin-top:1px;">${diffLabel}</div>` : ''}
                    <input type="date" value="${delivDate}"
                        style="font-size:0.71rem;padding:0.12rem 0.35rem;border-radius:5px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-muted);cursor:pointer;width:118px;margin-top:3px;"
                        title="Alterar data prevista"
                        onchange="SamplesModule.updateDelivery('${s.id}', this.value)">
                </td>

                <td style="padding:0.75rem 0.5rem;">${badge}</td>

                <td style="padding:0.75rem 0.5rem;">
                    <select onchange="SamplesModule.updateStatus('${s.id}', this.value)"
                        style="font-size:0.78rem;padding:0.25rem 0.5rem;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-main);cursor:pointer;max-width:148px;">
                        <option value="">↪ Mover para...</option>
                        <option value="Enviada">📦 Enviada</option>
                        <option value="Em trânsito">🚚 Em trânsito</option>
                        <option value="Entregue">✅ Entregue</option>
                        <option value="Follow-up Pendente">📞 Follow-up</option>
                        <option value="Convertida">💰 Convertida</option>
                        <option value="Rejeitada">❌ Rejeitada</option>
                    </select>
                </td>

                <td style="padding:0.75rem 0.5rem;">
                    <button onclick="SamplesModule.deleteSample('${s.id}')" title="Excluir"
                        style="width:28px;height:28px;border-radius:7px;border:none;background:rgba(239,68,68,0.07);color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.88rem;"
                        onmouseover="this.style.background='rgba(239,68,68,0.2)'" onmouseout="this.style.background='rgba(239,68,68,0.07)'">
                        <i class='bx bx-trash'></i>
                    </button>
                </td>
            `;
            this.dom.tableBody.appendChild(tr);
        });
    },

    esc(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, t =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[t]));
    }
};

window.SamplesModule = SamplesModule;

document.addEventListener('DataStoreReady', () => {
    SamplesModule.init();
});
