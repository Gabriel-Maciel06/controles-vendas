/**
 * WhatsApp Analyzer Module — v1.0
 * Analisa logs de conversas (.txt) exportadas do WhatsApp
 */

const WhatsAppAnalyzer = {
    files: [],

    init() {
        this.cacheDOM();
        this.bindEvents();
    },

    cacheDOM() {
        this.dom = {
            dropzone:    document.getElementById('wpp-dropzone'),
            fileInput:   document.getElementById('wpp-file-input'),
            fileList:    document.getElementById('wpp-file-list'),
            btnAnalyze:  document.getElementById('btn-wpp-analyze'),
            btnClear:    document.getElementById('btn-wpp-clear'),
            summarySec:  document.getElementById('wpp-summary-section'),
            summaryCont: document.getElementById('wpp-summary-content'),
            resultsSec:  document.getElementById('wpp-results-section'),
            resultsList: document.getElementById('wpp-results-list'),
            emptyState:  document.getElementById('wpp-empty-state')
        };
    },

    bindEvents() {
        this.dom.dropzone.onclick = () => this.dom.fileInput.click();
        
        this.dom.fileInput.onchange = (e) => this.handleFiles(e.target.files);

        this.dom.dropzone.ondragover = (e) => {
            e.preventDefault();
            this.dom.dropzone.classList.add('dragover');
        };

        this.dom.dropzone.ondragleave = () => {
            this.dom.dropzone.classList.remove('dragover');
        };

        this.dom.dropzone.ondrop = (e) => {
            e.preventDefault();
            this.dom.dropzone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        };

        this.dom.btnAnalyze.onclick = () => this.analyze();
        this.dom.btnClear.onclick = () => this.clear();
    },

    handleFiles(fileList) {
        for (let file of fileList) {
            if (file.type === "text/plain" || file.name.endsWith('.txt')) {
                this.files.push(file);
            }
        }
        this.updateFileList();
    },

    updateFileList() {
        if (this.files.length === 0) {
            this.dom.fileList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Nenhum arquivo carregado.</p>';
            this.dom.btnAnalyze.disabled = true;
            this.dom.btnClear.style.display = 'none';
        } else {
            let html = '<ul style="list-style:none;padding:0;">';
            this.files.forEach((f, i) => {
                html += `<li style="font-size:0.8rem;padding:0.4rem;background:rgba(255,255,255,0.03);margin-bottom:0.2rem;border-radius:4px;display:flex;justify-content:space-between;">
                    <span>📄 ${f.name}</span>
                    <button onclick="WhatsAppAnalyzer.removeFile(${i})" style="color:var(--danger);cursor:pointer;"><i class='bx bx-trash'></i></button>
                </li>`;
            });
            html += '</ul>';
            this.dom.fileList.innerHTML = html;
            this.dom.btnAnalyze.disabled = false;
            this.dom.btnClear.style.display = 'block';
        }
    },

    removeFile(index) {
        this.files.splice(index, 1);
        this.updateFileList();
    },

    clear() {
        this.files = [];
        this.updateFileList();
        this.dom.summarySec.style.display = 'none';
        this.dom.resultsSec.style.display = 'none';
        this.dom.emptyState.style.display = 'block';
    },

    async analyze() {
        this.dom.btnAnalyze.disabled = True;
        this.dom.btnAnalyze.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Analisando...";

        const results = [];
        for (let file of this.files) {
            const text = await file.text();
            results.push(this.parseTxt(file.name, text));
        }

        this.renderResults(results);
        
        this.dom.btnAnalyze.disabled = false;
        this.dom.btnAnalyze.innerHTML = "<i class='bx bx-search-alt'></i> Analisar Conversas";
    },

    parseTxt(filename, content) {
        const lines = content.split('\n');
        let msgCount = 0;
        let userMsgs = 0;
        let words = {};
        
        // Regex simples para capturar mensagem [data, hora] Usuário: Mensagem
        const regex = /\[?(\d{2}\/\d{2}\/\d{4}),?\s(\d{2}:\d{2})\]?\s-?\s?([^:]+):\s(.*)/;

        lines.forEach(line => {
            const match = line.match(regex);
            if (match) {
                msgCount++;
                const text = match[4].toLowerCase();
                // Contagem de palavras chave
                const keywords = ['preço', 'pedido', 'entrega', 'pagamento', 'boleto', 'amostra', 'orçamento', 'comprar'];
                keywords.forEach(kw => {
                    if (text.includes(kw)) words[kw] = (words[kw] || 0) + 1;
                });
            }
        });

        return {
            filename,
            totalMessages: msgCount,
            keywords: words,
            sentiment: msgCount > 10 ? 'Engajado' : 'Frio'
        };
    },

    renderResults(results) {
        this.dom.emptyState.style.display = 'none';
        this.dom.summarySec.style.display = 'block';
        this.dom.resultsSec.style.display = 'block';

        // Resumo Geral
        const total = results.reduce((acc, r) => acc + r.totalMessages, 0);
        this.dom.summaryCont.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <div class="card-stat">
                    <span class="stat-label">Total de Mensagens</span>
                    <span class="stat-value">${total}</span>
                </div>
                <div class="card-stat">
                    <span class="stat-label">Conversas Analisadas</span>
                    <span class="stat-value">${results.length}</span>
                </div>
            </div>
        `;

        // Detalhes
        let html = '';
        results.forEach(r => {
            let kwHtml = Object.entries(r.keywords)
                .map(([word, count]) => `<span class="badge badge-primary">${word}: ${count}</span>`)
                .join(' ');

            html += `
                <div style="padding:1rem;background:rgba(255,255,255,0.02);border-radius:10px;border:1px solid var(--border-color);margin-bottom:1rem;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
                        <strong style="color:var(--primary);">${r.filename}</strong>
                        <span class="badge ${r.sentiment==='Engajado'?'badge-accent':'badge-muted'}">${r.sentiment}</span>
                    </div>
                    <p style="font-size:0.85rem;margin-bottom:0.8rem;">
                        ${r.totalMessages} mensagens encontradas.
                    </p>
                    <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
                        ${kwHtml || '<small style="color:var(--text-muted);">Nenhuma palavra-chave comercial detectada.</small>'}
                    </div>
                </div>
            `;
        });
        this.dom.resultsList.innerHTML = html;
    }
};

window.WhatsAppAnalyzer = WhatsAppAnalyzer;

document.addEventListener('DOMContentLoaded', () => {
    WhatsAppAnalyzer.init();
});
