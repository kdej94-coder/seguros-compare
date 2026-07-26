document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initTabs();
    initUpload();
    initClear();
    initExport();
});

// ─── Authentication Logic ───────────────────────────────────────────────────

function initAuth() {
    const loginModal = document.getElementById('loginModal');
    const appMain = document.getElementById('appMain');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const btnLogout = document.getElementById('btnLogout');

    function checkAuth() {
        const isAuth = localStorage.getItem('seguros_auth_token') === 'user-auth-token-valid';
        if (isAuth) {
            loginModal.style.display = 'none';
            appMain.style.filter = 'none';
            appMain.style.pointerEvents = 'auto';
            loadData();
        } else {
            loginModal.style.display = 'flex';
            appMain.style.filter = 'blur(8px)';
            appMain.style.pointerEvents = 'none';
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUser').value.trim();
        const password = document.getElementById('loginPass').value.trim();
        loginError.style.display = 'none';

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                localStorage.setItem('seguros_auth_token', data.token);
                checkAuth();
            } else {
                loginError.textContent = data.error || 'Credenciales inválidas.';
                loginError.style.display = 'block';
            }
        } catch (err) {
            loginError.textContent = 'Error al conectar con el servidor.';
            loginError.style.display = 'block';
        }
    });

    btnLogout?.addEventListener('click', () => {
        localStorage.removeItem('seguros_auth_token');
        checkAuth();
    });

    checkAuth();
}

// ─── Tab Navigation ──────────────────────────────────────────────────────────

function initTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanels = document.querySelectorAll('.tab-panel');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            navItems.forEach(n => n.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(targetTab)?.classList.add('active');
        });
    });
}

// ─── Load Data from API ──────────────────────────────────────────────────────

async function loadData() {
    try {
        const res = await fetch('/api/proposals');
        const data = await res.json();
        renderAll(data);
    } catch (err) {
        console.error('Error cargando datos:', err);
    }
}

function renderAll(data) {
    const { proposals, recommendation, totalProposals } = data;
    const hasData = proposals && proposals.length > 0;

    // Show/hide info banner
    document.getElementById('infoBanner').style.display = hasData ? 'grid' : 'none';
    document.getElementById('btnClear').style.display = hasData ? 'flex' : 'none';

    if (hasData) {
        // Fill info banner with first available data
        const first = proposals.find(p => p.asegurado) || proposals[0];
        document.getElementById('infoAsegurado').textContent = first.asegurado || '—';
        document.getElementById('infoDomicilio').textContent = first.domicilio ? first.domicilio.substring(0, 60) : '—';
        document.getElementById('infoGiro').textContent = first.giro ? first.giro.substring(0, 50) : '—';
        document.getElementById('infoTotal').textContent = totalProposals + ' propuesta(s)';
        document.getElementById('tagClient').innerHTML = `<i class="fa-solid fa-building"></i> ${first.asegurado || 'SegurosCompare'}`;
    }

    renderRecommendation(recommendation, hasData);
    renderResumen(proposals, hasData);
    renderCoberturas(proposals, hasData);
    renderSumas(proposals, hasData);
}

// ─── Render: Recommendation ──────────────────────────────────────────────────

function renderRecommendation(rec, hasData) {
    const emptyEl = document.getElementById('winnerEmpty');
    const contentEl = document.getElementById('winnerContent');

    if (!rec || !hasData) {
        emptyEl.style.display = 'flex';
        contentEl.style.display = 'none';
        return;
    }

    emptyEl.style.display = 'none';
    contentEl.style.display = 'block';

    const ahorroVsSegundo = rec.segundoLugar && rec.ganadorData.primaNeta
        ? (rec.segundoLugar.primaNeta - rec.ganadorData.primaNeta)
        : 0;

    contentEl.innerHTML = `
        <div class="winner-hero">
            <div class="winner-header">
                <div class="winner-badge"><i class="fa-solid fa-circle-check"></i> MEJOR OPCIÓN RECOMENDADA</div>
                <h2>${rec.ganador}</h2>
                <p class="winner-subtitle">Propuesta seleccionada automáticamente por el motor de análisis costo-cobertura. Puntaje: ${rec.score}/100</p>
            </div>

            <div class="winner-grid">
                <div class="winner-stat-card">
                    <span class="w-label">Prima Neta</span>
                    <h3>${rec.ganadorData.primaNeta ? '$' + rec.ganadorData.primaNeta.toLocaleString() + ' ' + rec.ganadorData.moneda : 'N/D'}</h3>
                    <span class="w-sub text-success">Cotización más competitiva</span>
                </div>
                ${ahorroVsSegundo > 0 ? `
                <div class="winner-stat-card">
                    <span class="w-label">Ahorro vs ${rec.segundoLugar.aseguradora}</span>
                    <h3>$${ahorroVsSegundo.toLocaleString()} ${rec.ganadorData.moneda}</h3>
                    <span class="w-sub text-success">Diferencia directa</span>
                </div>` : ''}
                <div class="winner-stat-card">
                    <span class="w-label">Coberturas Detectadas</span>
                    <h3>${rec.ganadorData.coberturas ? rec.ganadorData.coberturas.filter(c => c.amparada).length : 0}</h3>
                    <span class="w-sub text-accent">Identificadas en el PDF</span>
                </div>
            </div>

            <div class="winner-reasons-box">
                <h3><i class="fa-solid fa-circle-check"></i> Razones de la Selección:</h3>
                <ul>
                    ${rec.razones.map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
}

// ─── Render: Resumen General ─────────────────────────────────────────────────

function renderResumen(proposals, hasData) {
    const emptyEl = document.getElementById('resumenEmpty');
    const contentEl = document.getElementById('resumenContent');

    if (!hasData) {
        emptyEl.style.display = 'flex';
        contentEl.style.display = 'none';
        return;
    }

    emptyEl.style.display = 'none';
    contentEl.style.display = 'block';

    const grid = document.getElementById('proposalsGrid');
    grid.innerHTML = proposals.map(p => `
        <div class="proposal-card">
            <h4>${p.aseguradora}</h4>
            <div class="proposal-detail">
                <span class="label">Archivo</span>
                <span class="value">${p.archivo ? p.archivo.substring(0, 30) : '—'}</span>
            </div>
            <div class="proposal-detail">
                <span class="label">Moneda</span>
                <span class="value">${p.moneda || '—'}</span>
            </div>
            <div class="proposal-detail">
                <span class="label">Prima Neta</span>
                <span class="value" style="color: var(--accent-emerald);">${p.primaNeta ? '$' + p.primaNeta.toLocaleString() : 'No detectada'}</span>
            </div>
            <div class="proposal-detail">
                <span class="label">Prima Total</span>
                <span class="value">${p.primaTotal ? '$' + p.primaTotal.toLocaleString() : '—'}</span>
            </div>
            <div class="proposal-detail">
                <span class="label">Coberturas</span>
                <span class="value">${p.coberturas ? p.coberturas.filter(c => c.amparada).length + ' detectadas' : '—'}</span>
            </div>
            <div class="proposal-detail">
                <span class="label">Procesado</span>
                <span class="value">${p.fechaProcesado ? new Date(p.fechaProcesado).toLocaleDateString('es-MX') : '—'}</span>
            </div>
        </div>
    `).join('');
}

// ─── Render: Coberturas Matrix ───────────────────────────────────────────────

function renderCoberturas(proposals, hasData) {
    const emptyEl = document.getElementById('coberturasEmpty');
    const contentEl = document.getElementById('coberturasContent');

    if (!hasData) {
        emptyEl.style.display = 'flex';
        contentEl.style.display = 'none';
        return;
    }

    emptyEl.style.display = 'none';
    contentEl.style.display = 'block';

    const head = document.getElementById('coberturasHead');
    const body = document.getElementById('coberturasBody');

    // Build dynamic header
    head.innerHTML = `<tr>
        <th style="min-width: 240px;">Cobertura</th>
        ${proposals.map(p => `<th>${p.aseguradora}</th>`).join('')}
    </tr>`;

    // Get all unique coverage concepts
    const allConcepts = [];
    const seen = new Set();
    for (const p of proposals) {
        if (p.coberturas) {
            for (const c of p.coberturas) {
                if (!seen.has(c.concepto)) {
                    seen.add(c.concepto);
                    allConcepts.push(c.concepto);
                }
            }
        }
    }

    body.innerHTML = allConcepts.map(concepto => {
        const cells = proposals.map(p => {
            const cov = p.coberturas?.find(c => c.concepto === concepto);
            if (!cov) return '<td>—</td>';
            if (cov.amparada) {
                return `<td><span class="text-amparada"><i class="fa-solid fa-circle-check"></i> Amparada</span></td>`;
            }
            return `<td><span class="text-excluida"><i class="fa-solid fa-circle-xmark"></i> No detectada</span></td>`;
        }).join('');
        return `<tr><td><strong>${concepto}</strong></td>${cells}</tr>`;
    }).join('');
}

// ─── Render: Sumas Aseguradas ────────────────────────────────────────────────

function renderSumas(proposals, hasData) {
    const emptyEl = document.getElementById('sumasEmpty');
    const contentEl = document.getElementById('sumasContent');

    if (!hasData) {
        emptyEl.style.display = 'flex';
        contentEl.style.display = 'none';
        return;
    }

    emptyEl.style.display = 'none';
    contentEl.style.display = 'block';

    const head = document.getElementById('sumasHead');
    const body = document.getElementById('sumasBody');

    head.innerHTML = `<tr>
        <th style="min-width: 200px;">Concepto</th>
        ${proposals.map(p => `<th>${p.aseguradora}</th>`).join('')}
    </tr>`;

    // Collect all sumas keys
    const allKeys = new Set();
    for (const p of proposals) {
        if (p.sumasAseguradas) {
            Object.keys(p.sumasAseguradas).forEach(k => allKeys.add(k));
        }
    }

    const labels = {
        edificio: 'Edificio',
        contenidos: 'Contenidos',
        perdidasConsecuenciales: 'Pérdidas Consecuenciales',
        equipoElectronico: 'Equipo Electrónico',
        roturaMaquinaria: 'Rotura de Maquinaria',
        responsabilidadCivil: 'Responsabilidad Civil',
        dineroValores: 'Dinero y Valores',
        roturaCristales: 'Rotura de Cristales'
    };

    body.innerHTML = Array.from(allKeys).map(key => {
        const cells = proposals.map(p => {
            const val = p.sumasAseguradas?.[key];
            return `<td>${val ? '<strong>$' + val.toLocaleString() + '</strong>' : '—'}</td>`;
        }).join('');
        return `<tr><td><strong>${labels[key] || key}</strong></td>${cells}</tr>`;
    }).join('');
}

// ─── File Upload ─────────────────────────────────────────────────────────────

function initUpload() {
    const btn = document.getElementById('btnTriggerUpload');
    const input = document.getElementById('pdfInput');
    const status = document.getElementById('uploadStatus');

    btn.addEventListener('click', () => input.click());

    input.addEventListener('change', async () => {
        if (input.files.length === 0) return;

        const formData = new FormData();
        for (let i = 0; i < input.files.length; i++) {
            formData.append('pdfFiles', input.files[i]);
        }

        status.innerHTML = `<span style="color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Procesando ${input.files.length} archivo(s)...</span>`;

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const result = await res.json();

            if (res.ok) {
                status.innerHTML = `<span style="color:#10b981;"><i class="fa-solid fa-check"></i> ${result.mensaje}</span>`;
                renderAll(result);
            } else {
                status.innerHTML = `<span style="color:#ef4444;">${result.error}</span>`;
            }
        } catch (err) {
            status.innerHTML = `<span style="color:#ef4444;">Error al subir archivos</span>`;
        }

        input.value = '';
    });
}

// ─── Clear Data ──────────────────────────────────────────────────────────────

function initClear() {
    document.getElementById('btnClear').addEventListener('click', async () => {
        if (!confirm('¿Está seguro de que desea eliminar todas las propuestas cargadas?')) return;

        try {
            await fetch('/api/proposals', { method: 'DELETE' });
            document.getElementById('uploadStatus').innerHTML = '';
            loadData();
        } catch (err) {
            console.error('Error limpiando datos:', err);
        }
    });
}

// ─── Export / Print ──────────────────────────────────────────────────────────

function initExport() {
    document.getElementById('btnExportPDF').addEventListener('click', () => {
        window.print();
    });
}
