document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initTabs();
    initUpload();
    initClear();
    initExport();
    initPortfolioManagement();
    initPolizaModal();
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
            loadCartera();
            loadInsurersReport();
            loadHistory();
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
    renderDeducibles(proposals, hasData);
    renderSumas(proposals, hasData);
    loadInsurersReport();
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

    head.innerHTML = `<tr>
        <th style="min-width: 240px;">Cobertura</th>
        ${proposals.map(p => `<th>${p.aseguradora}</th>`).join('')}
    </tr>`;

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

// ─── Render: Deducibles Matrix ───────────────────────────────────────────────

function renderDeducibles(proposals, hasData) {
    const emptyEl = document.getElementById('deduciblesEmpty');
    const contentEl = document.getElementById('deduciblesContent');

    if (!hasData) {
        emptyEl.style.display = 'flex';
        contentEl.style.display = 'none';
        return;
    }

    emptyEl.style.display = 'none';
    contentEl.style.display = 'block';

    const head = document.getElementById('deduciblesHead');
    const body = document.getElementById('deduciblesBody');

    head.innerHTML = `<tr>
        <th style="min-width: 240px;">Cobertura / Riesgo</th>
        ${proposals.map(p => `<th>${p.aseguradora}</th>`).join('')}
    </tr>`;

    // Extract unique concepts from deducibles
    const concepts = [
        'Incendio, rayo y explosión',
        'Fenómenos hidrometeorológicos (FHM)',
        'Terremoto y erupción volcánica',
        'Responsabilidad Civil General',
        'Rotura de Cristales',
        'Equipo Electrónico (Fijo / Móvil)',
        'Rotura de Maquinaria y Calderas',
        'Dinero y Valores'
    ];

    body.innerHTML = concepts.map(concepto => {
        const cells = proposals.map(p => {
            const item = p.deducibles?.find(d => d.concepto === concepto);
            if (!item) return '<td>—</td>';
            return `
                <td>
                    <strong style="color: var(--text-primary); font-size:12px;">${item.deducible}</strong>
                    <span class="deducible-obs">${item.observaciones}</span>
                </td>
            `;
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

// ─── Load Cartera & Insurers Market Report ───────────────────────────────────

async function loadCartera(query = '') {
    try {
        const res = await fetch(`/api/renovaciones?search=${encodeURIComponent(query)}`);
        const data = await res.json();

        document.getElementById('statTotalPolizas').textContent = data.totalRegistros.toLocaleString();
        document.getElementById('statPrima2025').textContent = '$' + data.totalPrima2025.toLocaleString('es-MX', { minimumFractionDigits: 2 });

        // Check which policies have linked quotations
        let linkedPolizas = {};
        try {
            const compRes = await fetch('/api/comparaciones');
            const compData = await compRes.json();
            for (const c of (compData.comparaciones || [])) {
                if (c.id && c.id.startsWith('poliza-')) {
                    // Extract poliza from nombre
                    const match = c.nombre?.match(/Renovaci\u00f3n (.+?) \u2014/);
                    if (match) linkedPolizas[match[1]] = c.totalProposals;
                }
            }
        } catch(e) {}

        const tbody = document.getElementById('portfolioBody');
        if (data.polizas && data.polizas.length > 0) {
            tbody.innerHTML = data.polizas.map(p => {
                const hasLinked = linkedPolizas[p.poliza];
                const escapedPoliza = p.poliza.replace(/'/g, "\\'");
                return `
                <tr>
                    <td><strong>${p.poliza}</strong></td>
                    <td>${p.finVigencia}</td>
                    <td>Mes ${p.mesVigencia} (${p.nombreMes})</td>
                    <td style="color:var(--accent-indigo); font-weight:600;">$${p.primaNeta2025 ? p.primaNeta2025.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '0.00'}</td>
                    <td style="text-align:center;">
                        ${hasLinked
                            ? `<span class="pill-linked" onclick="openPolizaModal('${escapedPoliza}', '${p.finVigencia}', ${p.primaNeta2025 || 0})">${hasLinked} cotiz.</span>`
                            : `<button class="btn-cotizar" onclick="openPolizaModal('${escapedPoliza}', '${p.finVigencia}', ${p.primaNeta2025 || 0})"><i class="fa-solid fa-file-circle-plus"></i> Cotizar</button>`
                        }
                    </td>
                </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No se encontraron pólizas.</td></tr>`;
        }

    } catch (err) {
        console.error('Error cargando cartera:', err);
    }
}

async function loadInsurersReport() {
    try {
        const res = await fetch('/api/reports/insurers');
        const data = await res.json();

        document.getElementById('statCotizacionesProcesadas').textContent = data.totalCuentasGeneral;

        const tbody = document.getElementById('insurersReportBody');
        if (data.report && data.report.length > 0) {
            tbody.innerHTML = data.report.map((r, idx) => {
                const pct = data.totalPrimaGeneral > 0 ? ((r.primaNetaTotal / data.totalPrimaGeneral) * 100).toFixed(1) : 0;
                const detailId = `insurer-detail-${idx}`;

                // Build detail sub-table rows
                const detailRows = r.cotizaciones.map((c, ci) => {
                    const fecha = c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                    const escapedArchivo = (c.archivo || '').replace(/'/g, "\\'");
                    const itemId = c.id || '';
                    return `
                        <tr style="background:#f8fafc;">
                            <td style="padding-left:30px; font-size:11px;">${ci + 1}.</td>
                            <td style="font-size:11px;" title="${c.archivo}">${c.archivo ? c.archivo.substring(0, 40) : '—'}</td>
                            <td style="font-size:11px;">${c.asegurado ? c.asegurado.substring(0, 35) : '—'}</td>
                            <td style="font-size:11px; font-weight:600; color:var(--accent-indigo);">$${c.primaNeta ? c.primaNeta.toLocaleString('es-MX', {minimumFractionDigits:2}) : '0.00'} ${c.moneda || 'MXN'}</td>
                            <td style="font-size:11px;">${c.coberturas || 0} detectadas</td>
                            <td style="font-size:11px; color:var(--text-muted);">${fecha}</td>
                            <td style="font-size:11px; text-align:center;">
                                <button onclick="event.stopPropagation(); deleteCotizacionItem('${itemId}', '${escapedArchivo}', '${c.primaNeta || 0}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:4px; padding:3px 8px; font-size:10px; cursor:pointer; font-weight:600; transition:all 0.15s;" title="Eliminar esta cotización del historial">
                                    <i class="fa-solid fa-trash-can"></i> Eliminar
                                </button>
                            </td>
                        </tr>`;
                }).join('');

                // Format primas por moneda
                let primaFormatted = '';
                if (r.primasPorMoneda && Object.keys(r.primasPorMoneda).length > 0) {
                    primaFormatted = Object.entries(r.primasPorMoneda)
                        .map(([m, val]) => `$${val.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${m}`)
                        .join(' / ');
                } else {
                    primaFormatted = `$${r.primaNetaTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;
                }

                return `
                    <tr style="cursor:pointer;" onclick="toggleInsurerDetail('${detailId}')" title="Clic para ver detalle de cotizaciones">
                        <td>
                            <strong>${r.aseguradora}</strong>
                            <i class="fa-solid fa-chevron-down" id="${detailId}-icon" style="margin-left:6px; font-size:10px; color:var(--text-muted); transition:transform 0.2s;"></i>
                        </td>
                        <td><span class="pill-status pill-blue">${r.cuentasPresentadas} cuenta(s)</span></td>
                        <td style="color:var(--accent-emerald); font-weight:700;">${primaFormatted}</td>
                        <td><strong>${pct}%</strong> del total cotizado</td>
                    </tr>
                    <tr id="${detailId}" style="display:none;">
                        <td colspan="4" style="padding:0; background:#f1f5f9;">
                            <div style="padding:12px 16px;">
                                <div style="font-size:11px; font-weight:700; color:var(--text-primary); margin-bottom:8px;">
                                    <i class="fa-solid fa-folder-open" style="margin-right:4px;"></i>
                                    Cotizaciones presentadas por ${r.aseguradora} (${r.cuentasPresentadas}):
                                </div>
                                <table style="width:100%; border-collapse:collapse; font-size:11px;">
                                    <thead>
                                        <tr style="background:#e2e8f0;">
                                            <th style="padding:6px 8px; text-align:left; font-size:10px; width:30px;">#</th>
                                            <th style="padding:6px 8px; text-align:left; font-size:10px;">Archivo PDF</th>
                                            <th style="padding:6px 8px; text-align:left; font-size:10px;">Cliente / Asegurado</th>
                                            <th style="padding:6px 8px; text-align:left; font-size:10px;">Prima Neta</th>
                                            <th style="padding:6px 8px; text-align:left; font-size:10px;">Coberturas</th>
                                            <th style="padding:6px 8px; text-align:left; font-size:10px;">Fecha Procesado</th>
                                            <th style="padding:6px 8px; text-align:center; font-size:10px;">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${detailRows}
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Suba cotizaciones PDF para acumular el reporte de participación por aseguradora.</td></tr>`;
        }

    } catch (err) {
        console.error('Error cargando reporte de aseguradoras:', err);
    }
}

function toggleInsurerDetail(detailId) {
    const row = document.getElementById(detailId);
    const icon = document.getElementById(detailId + '-icon');
    if (!row) return;

    if (row.style.display === 'none') {
        row.style.display = 'table-row';
        if (icon) icon.style.transform = 'rotate(180deg)';
    } else {
        row.style.display = 'none';
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
}

async function deleteCotizacionItem(id, archivo, primaNeta) {
    if (!confirm(`¿Está seguro de que desea eliminar permanentemente la cotización "${archivo}" del historial?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/proposals/item/${id}?archivo=${encodeURIComponent(archivo)}&primaNeta=${primaNeta}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        alert(data.mensaje || 'Cotización eliminada.');
        loadInsurersReport();
        loadHistory();
        loadData();
        loadCartera();
    } catch (err) {
        console.error('Error eliminando cotización:', err);
        alert('Error al eliminar la cotización.');
    }
}

function initPortfolioManagement() {
    const inputSearch = document.getElementById('portfolioSearch');
    inputSearch?.addEventListener('input', (e) => {
        loadCartera(e.target.value.trim());
    });

    const btnClear = document.getElementById('btnClearPortfolio');
    btnClear?.addEventListener('click', async () => {
        if (!confirm('¿Está seguro de que desea LIMPIAR/VACIAR la base de datos de pólizas a vencer?')) return;
        try {
            const res = await fetch('/api/renovaciones', { method: 'DELETE' });
            const data = await res.json();
            alert(data.mensaje);
            loadCartera();
        } catch (err) {
            console.error('Error vaciando cartera:', err);
            alert('Error al vaciar la base de datos.');
        }
    });

    const btnUpload = document.getElementById('btnUploadPortfolio');
    const fileInput = document.getElementById('portfolioFileInput');

    btnUpload?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', async () => {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('portfolioFile', file);

        try {
            const res = await fetch('/api/renovaciones', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.mensaje);
                loadCartera();
            } else {
                alert(data.error || 'Error subiendo la base de datos.');
            }
        } catch (err) {
            console.error('Error subiendo nueva cartera:', err);
            alert('Error al procesar el archivo.');
        }
        fileInput.value = '';
    });
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
                loadHistory();
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
        if (!confirm('¿Guardar esta comparación en el historial y limpiar para una nueva?')) return;

        try {
            const res = await fetch('/api/proposals', { method: 'DELETE' });
            const data = await res.json();
            document.getElementById('uploadStatus').innerHTML = 
                `<span style="color:#10b981;"><i class="fa-solid fa-check"></i> ${data.mensaje}</span>`;
            loadData();
            loadHistory();
        } catch (err) {
            console.error('Error limpiando datos:', err);
        }
    });
}

function initExport() {
    document.getElementById('btnExportPDF').addEventListener('click', async () => {
        try {
            const res = await fetch('/api/proposals');
            const data = await res.json();
            if (!data.proposals || data.proposals.length === 0) {
                alert('No hay propuestas cargadas para exportar. Suba al menos un PDF primero.');
                return;
            }
            generateExecutiveReport(data);
        } catch (err) {
            console.error('Error generating report:', err);
            alert('Error al generar el reporte.');
        }
    });
}

function generateExecutiveReport(data) {
    const { proposals, recommendation } = data;
    const fmt = (n) => n ? '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
    const fmtPct = (n) => n !== null && n !== undefined ? (n >= 0 ? '+' : '') + n.toFixed(0) + '%' : '—';

    // Extract common info from first proposal
    const first = proposals.find(p => p.asegurado) || proposals[0];
    const asegurado = first?.asegurado || 'Asegurado';
    const domicilio = first?.domicilio || '';
    const giro = first?.giro || 'Comercial e Inmobiliario';
    const moneda = first?.moneda || 'MXN';
    const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

    // Find lowest prima (winner)
    const withPrima = proposals.filter(p => p.primaNeta && p.primaNeta > 0);
    const sortedByPrima = [...withPrima].sort((a, b) => a.primaNeta - b.primaNeta);
    const cheapest = sortedByPrima[0];
    const mostExpensive = sortedByPrima[sortedByPrima.length - 1];
    const winner = recommendation?.ganador || cheapest?.aseguradora || '—';

    // Compute sumas aseguradas totals from first proposal with data
    const sumasSource = proposals.find(p => p.sumasAseguradas && Object.keys(p.sumasAseguradas).length > 0) || proposals[0];
    const edificio = sumasSource?.sumasAseguradas?.edificio || 0;
    const contenidos = sumasSource?.sumasAseguradas?.contenidos || 0;
    const totalSumas = edificio + contenidos;

    // Build evaluación text for each insurer
    const evalTexts = proposals.map(p => {
        const covCount = p.coberturas ? p.coberturas.filter(c => c.amparada).length : 0;
        const totalCov = p.coberturas ? p.coberturas.length : 25;
        const isWinner = p.aseguradora === winner;
        let text = `<strong>${p.aseguradora}:</strong> `;
        if (p.primaNeta) {
            text += `Presenta prima neta de ${fmt(p.primaNeta)} ${p.moneda || moneda}`;
        } else {
            text += `Prima neta no detectada en el PDF`;
        }
        text += `, con ${covCount} de ${totalCov} coberturas identificadas.`;
        if (isWinner && withPrima.length > 1) {
            text = `${text} <strong>Resulta en la propuesta económica más competitiva del mercado.</strong>`;
        }
        return text;
    });

    // Build comparison table rows
    const conceptos = [
        { label: 'Prima Neta', key: 'primaNeta', isMoney: true },
        { label: 'Prima Total', key: 'primaTotal', isMoney: true },
    ];

    // Coberturas for matrix
    const allConcepts = [];
    const seenCov = new Set();
    for (const p of proposals) {
        if (p.coberturas) {
            for (const c of p.coberturas) {
                if (!seenCov.has(c.concepto)) {
                    seenCov.add(c.concepto);
                    allConcepts.push(c.concepto);
                }
            }
        }
    }

    // Sumas aseguradas keys
    const sumaKeys = new Set();
    for (const p of proposals) {
        if (p.sumasAseguradas) Object.keys(p.sumasAseguradas).forEach(k => sumaKeys.add(k));
    }
    const sumaLabels = {
        edificio: 'Edificio', contenidos: 'Contenidos',
        perdidasConsecuenciales: 'Pérdidas Consecuenciales', equipoElectronico: 'Equipo Electrónico',
        roturaMaquinaria: 'Rotura de Maquinaria', responsabilidadCivil: 'Responsabilidad Civil',
        dineroValores: 'Dinero y Valores', roturaCristales: 'Rotura de Cristales'
    };

    // Deducibles
    const deducibleConcepts = [
        'Incendio, rayo y explosión', 'Fenómenos hidrometeorológicos (FHM)',
        'Terremoto y erupción volcánica', 'Responsabilidad Civil General',
        'Rotura de Cristales', 'Equipo Electrónico (Fijo / Móvil)',
        'Rotura de Maquinaria y Calderas', 'Dinero y Valores'
    ];

    // Count total pages
    const totalPages = 4;

    const reportHTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Análisis Técnico y Comparativo de Renovación — ${asegurado}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', 'Segoe UI', sans-serif;
            font-size: 11px;
            color: #1a2744;
            line-height: 1.55;
            background: #fff;
        }
        @page {
            size: letter;
            margin: 20mm 18mm 22mm 18mm;
        }
        .page {
            page-break-after: always;
            position: relative;
            min-height: 100%;
        }
        .page:last-child { page-break-after: auto; }

        /* Header */
        .report-title {
            font-size: 20px;
            font-weight: 800;
            color: #1a2744;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 4px;
            border-bottom: 3px solid #1a2744;
            padding-bottom: 8px;
        }
        .report-subtitle {
            font-size: 11px;
            color: #475569;
            font-style: italic;
            margin-bottom: 24px;
        }

        /* Sections */
        .section-title {
            font-size: 13px;
            font-weight: 800;
            color: #1a2744;
            text-transform: uppercase;
            margin: 22px 0 10px 0;
            padding-left: 12px;
            border-left: 4px solid #1a2744;
        }
        .section-text {
            font-size: 11px;
            color: #1a2744;
            margin-bottom: 10px;
            text-align: justify;
        }
        .section-text ul {
            margin-left: 20px;
            margin-top: 6px;
            margin-bottom: 8px;
        }
        .section-text ul li {
            margin-bottom: 5px;
        }
        .section-text .highlight {
            font-weight: 700;
            color: #1a2744;
        }

        /* Tables */
        .comp-table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0 16px 0;
            font-size: 10.5px;
        }
        .comp-table thead th {
            background: #1a2744;
            color: #fff;
            font-weight: 700;
            padding: 8px 10px;
            text-align: center;
            font-size: 10px;
            border: 1px solid #1a2744;
        }
        .comp-table thead th:first-child {
            text-align: left;
            min-width: 180px;
        }
        .comp-table tbody td {
            padding: 6px 10px;
            border: 1px solid #cbd5e1;
            text-align: center;
            vertical-align: middle;
        }
        .comp-table tbody td:first-child {
            text-align: left;
            font-weight: 600;
            background: #f8fafc;
        }
        .comp-table tbody tr:nth-child(even) td {
            background: #f1f5f9;
        }
        .comp-table tbody tr:nth-child(even) td:first-child {
            background: #eef2f7;
        }

        .text-highlight { color: #dc2626; font-weight: 700; }
        .text-blue { color: #1a2744; font-weight: 700; }
        .text-winner { background: #e8edf5 !important; }

        .check { color: #1a2744; font-weight: 700; }
        .cross { color: #94a3b8; }

        /* Footer */
        .page-footer {
            position: fixed;
            bottom: 0;
            right: 0;
            font-size: 9px;
            color: #94a3b8;
        }

        /* Winner highlight */
        .winner-col { background: #e8edf5 !important; }

        /* Print */
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
        }

        .print-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #1a2744;
            color: #fff;
            padding: 10px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 9999;
            font-size: 12px;
        }
        .print-bar button {
            background: #1a2744;
            color: #fff;
            border: none;
            padding: 8px 24px;
            border-radius: 6px;
            font-weight: 700;
            cursor: pointer;
            font-size: 12px;
            border: 1.5px solid #fff;
        }
        .print-bar button:hover { background: #2d3f5e; }
        .content-wrapper { margin-top: 50px; padding: 20px; }

        .sub-label {
            font-size: 9px;
            color: #64748b;
            display: block;
        }
    </style>
</head>
<body>

    <div class="print-bar no-print">
        <span>Reporte Ejecutivo - ${asegurado}</span>
        <button onclick="window.print()">Imprimir / Guardar como PDF</button>
    </div>

    <div class="content-wrapper">

    <!-- PAGE 1: Análisis de Mercado y Evaluación -->
    <div class="page">
        <h1 class="report-title">ANÁLISIS TÉCNICO Y COMPARATIVO DE RENOVACIÓN</h1>
        <p class="report-subtitle">Programa de Seguro Paquete Empresarial Corporativo | Vigencia 2025-2026</p>

        <h2 class="section-title">1. CONSIDERACIONES DE MERCADO</h2>
        <div class="section-text">
            <p>El mercado asegurador para giros comerciales e inmobiliarios ha mostrado un ajuste generalizado en tarifas. Se realizó la solicitud formal de cotización a las principales instituciones del mercado mexicano. El estatus final de las respuestas se detalla a continuación:</p>
            <ul>
                <li><strong>Ofertas Firmes Presentadas (${proposals.length}):</strong> ${proposals.map(p => p.aseguradora).join(', ')}.</li>
                <li><strong>Moneda de Cotización:</strong> ${moneda}.</li>
                <li><strong>Ubicación del Riesgo:</strong> ${domicilio || 'Ver póliza original.'}.</li>
                <li><strong>Giro / Actividad:</strong> ${giro}.</li>
            </ul>
        </div>

        <h2 class="section-title">2. EVALUACIÓN DE PROPUESTAS</h2>
        <div class="section-text">
            <p>El análisis con los costos actualizados del mercado muestra las siguientes condiciones por cada aseguradora participante:</p>
            <ul>
                ${evalTexts.map(t => `<li>${t}</li>`).join('\n                ')}
            </ul>
        </div>

        <h2 class="section-title">3. GARANTÍAS POR PARTE DEL ASEGURADO</h2>
        <div class="section-text">
            <p>Para la validez plena del programa de seguros, el asegurado ratifica las siguientes garantías de protección vigentes:</p>
            <ul>
                <li><strong>Giro Declarado:</strong> ${giro || 'Comercial, Oficinas y Departamentos'}.</li>
                <li><strong>Ubicación:</strong> ${domicilio || 'Ver póliza original.'}.</li>
                <li><strong>Medidas de Protección Contra Incendio (PCI):</strong> Sistema basado en extintores portátiles distribuidos estratégicamente e hidrantes funcionales con mantenimiento periódico.</li>
            </ul>
        </div>

        <h2 class="section-title">4. PROPUESTA ECONÓMICA</h2>
        <div class="section-text">
            ${totalSumas > 0 ? `<p>Los valores totales asegurados declarados se mantienen. Edificio por <strong>${fmt(edificio)}</strong> y Contenidos por <strong>${fmt(contenidos)}</strong>, sumando un valor total de <strong>${fmt(totalSumas)}</strong>. Los costos y variaciones del mercado se estructuran a continuación:</p>` : `<p>A continuación se presenta la propuesta económica comparativa entre las aseguradoras participantes:</p>`}
        </div>

        <table class="comp-table">
            <thead>
                <tr>
                    <th>Concepto (${moneda})</th>
                    ${proposals.map(p => `<th>${p.aseguradora}<br><span style="font-weight:400; font-size:9px;">Propuesta Renovación</span></th>`).join('')}
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Prima Neta</td>
                    ${proposals.map(p => {
                        const isWin = p.aseguradora === winner;
                        return `<td class="${isWin ? 'text-winner' : ''}" style="font-weight:700;">${fmt(p.primaNeta)}</td>`;
                    }).join('')}
                </tr>
                <tr>
                    <td>Prima Total</td>
                    ${proposals.map(p => `<td>${fmt(p.primaTotal)}</td>`).join('')}
                </tr>
                ${cheapest && withPrima.length > 1 ? `
                <tr>
                    <td>Variación en Pesos ($) vs Más Baja</td>
                    ${proposals.map(p => {
                        if (!p.primaNeta) return '<td>—</td>';
                        const diff = p.primaNeta - cheapest.primaNeta;
                        if (diff === 0) return '<td class="text-blue">Mas Baja</td>';
                        return `<td class="text-highlight">+${fmt(diff)}</td>`;
                    }).join('')}
                </tr>
                <tr>
                    <td>% de Variacion vs Mas Baja</td>
                    ${proposals.map(p => {
                        if (!p.primaNeta || !cheapest.primaNeta) return '<td>—</td>';
                        const pct = ((p.primaNeta - cheapest.primaNeta) / cheapest.primaNeta) * 100;
                        if (pct === 0) return '<td class="text-blue">Base</td>';
                        return `<td class="text-highlight">${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%</td>`;
                    }).join('')}
                </tr>` : ''}
                <tr>
                    <td>Coberturas Detectadas</td>
                    ${proposals.map(p => {
                        const cc = p.coberturas ? p.coberturas.filter(c => c.amparada).length : 0;
                        return `<td>${cc} / ${p.coberturas?.length || 25}</td>`;
                    }).join('')}
                </tr>
            </tbody>
        </table>

        ${recommendation ? `
        <div style="background:#e8edf5; border:1.5px solid #1a2744; border-radius:6px; padding:12px 16px; margin-top:12px;">
            <strong style="color:#1a2744;">RECOMENDACION:</strong> <strong>${recommendation.ganador}</strong> presenta la propuesta mas competitiva.
            ${recommendation.razones ? recommendation.razones.map(r => `<br>- ${r}`).join('') : ''}
        </div>` : ''}
    </div>

    <!-- PAGE 2: Coberturas Matrix -->
    <div class="page">
        <h1 class="report-title" style="font-size:16px;">MATRIZ COMPARATIVA DE COBERTURAS</h1>
        <p class="report-subtitle">Coberturas identificadas en cada propuesta de renovación.</p>

        <table class="comp-table">
            <thead>
                <tr>
                    <th>Cobertura</th>
                    ${proposals.map(p => `<th>${p.aseguradora}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${allConcepts.map(concepto => `
                <tr>
                    <td>${concepto}</td>
                    ${proposals.map(p => {
                        const cov = p.coberturas?.find(c => c.concepto === concepto);
                        if (cov && cov.amparada) return '<td class="check">Amparada</td>';
                        return '<td class="cross">No Incluida</td>';
                    }).join('')}
                </tr>`).join('')}
            </tbody>
        </table>
    </div>

    <!-- PAGE 3: Deducibles -->
    <div class="page">
        <h1 class="report-title" style="font-size:16px;">CUADRO COMPARATIVO DE DEDUCIBLES</h1>
        <p class="report-subtitle">Deducibles aplicables por cobertura y aseguradora.</p>

        <table class="comp-table">
            <thead>
                <tr>
                    <th>Cobertura / Riesgo</th>
                    ${proposals.map(p => `<th>${p.aseguradora}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${deducibleConcepts.map(concepto => `
                <tr>
                    <td>${concepto}</td>
                    ${proposals.map(p => {
                        const item = p.deducibles?.find(d => d.concepto === concepto);
                        if (!item) return '<td>—</td>';
                        return `<td><strong>${item.deducible}</strong><span class="sub-label">${item.observaciones}</span></td>`;
                    }).join('')}
                </tr>`).join('')}
            </tbody>
        </table>

        ${Array.from(sumaKeys).length > 0 ? `
        <h2 class="section-title" style="margin-top:30px;">SUMAS ASEGURADAS COMPARATIVAS</h2>
        <table class="comp-table">
            <thead>
                <tr>
                    <th>Concepto</th>
                    ${proposals.map(p => `<th>${p.aseguradora}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${Array.from(sumaKeys).map(key => `
                <tr>
                    <td>${sumaLabels[key] || key}</td>
                    ${proposals.map(p => {
                        const val = p.sumasAseguradas?.[key];
                        return `<td>${val ? fmt(val) : '—'}</td>`;
                    }).join('')}
                </tr>`).join('')}
            </tbody>
        </table>` : ''}
    </div>

    <!-- PAGE 4: Conclusión -->
    <div class="page">
        <h1 class="report-title" style="font-size:16px;">CONCLUSIÓN Y RECOMENDACIÓN FINAL</h1>
        <p class="report-subtitle">Resumen ejecutivo del análisis comparativo.</p>

        <h2 class="section-title">RESUMEN EJECUTIVO</h2>
        <div class="section-text">
            <p>Tras el análisis técnico y económico de las <strong>${proposals.length} propuestas</strong> recibidas para la renovación del programa de seguros de <strong>${asegurado}</strong>, se concluye lo siguiente:</p>
            <ul>
                ${sortedByPrima.map((p, i) => {
                    const covCount = p.coberturas ? p.coberturas.filter(c => c.amparada).length : 0;
                    const rank = `${i+1}er lugar`;
                    return `<li><strong>${rank} - ${p.aseguradora}:</strong> Prima Neta: ${fmt(p.primaNeta)} ${p.moneda || moneda} | Coberturas: ${covCount}.</li>`;
                }).join('\n                ')}
            </ul>
        </div>

        ${recommendation ? `
        <div style="background:#1a2744; color:#fff; border-radius:8px; padding:20px 24px; margin:20px 0;">
            <h3 style="margin:0 0 8px 0; font-size:14px;">MEJOR OPCION RECOMENDADA: ${recommendation.ganador}</h3>
            <p style="margin:0; font-size:11px; opacity:0.9;">
                ${recommendation.razones ? recommendation.razones.join(' ') : ''}
            </p>
        </div>` : ''}

        <div class="section-text" style="margin-top: 30px;">
            <p><strong>Nota Importante:</strong> La presente recomendación se basa exclusivamente en el análisis de los documentos proporcionados (cotizaciones en formato PDF). Se sugiere al asegurado revisar las condiciones particulares, exclusiones y limitaciones de cada póliza antes de tomar una decisión final.</p>
        </div>

        <div style="margin-top:40px; display:flex; justify-content:space-between; gap:40px;">
            <div style="flex:1; text-align:center; border-top: 1.5px solid #1a2744; padding-top:10px;">
                <strong>Elaboró</strong><br>
                <span style="font-size:10px; color:#64748b;">Ejecutivo de Cuenta</span>
            </div>
            <div style="flex:1; text-align:center; border-top: 1.5px solid #1a2744; padding-top:10px;">
                <strong>Revisó</strong><br>
                <span style="font-size:10px; color:#64748b;">Dirección Técnica</span>
            </div>
        </div>

        <div style="margin-top:40px; text-align:center; font-size:9px; color:#94a3b8;">
            <p>Reporte generado automáticamente por SegurosCompare — ${today}</p>
            <p>Este documento es confidencial y de uso exclusivo del asegurado.</p>
        </div>
    </div>

    </div>
</body>
</html>`;

    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(reportHTML);
    reportWindow.document.close();
}

// ─── Comparison History ──────────────────────────────────────────────────────

async function loadHistory() {
    try {
        const res = await fetch('/api/comparaciones');
        const data = await res.json();
        renderHistory(data.comparaciones || []);
    } catch (err) {
        console.error('Error cargando historial:', err);
    }
}

function renderHistory(comparaciones) {
    const container = document.getElementById('historyList');
    // Filter out the _current_ entry (that's the active workspace)
    const saved = comparaciones.filter(c => c.id !== '_current_');

    if (saved.length === 0) {
        container.innerHTML = `<p style="font-size:11px; color:var(--text-muted);">Sin comparaciones guardadas.</p>`;
        return;
    }

    container.innerHTML = saved.map(c => {
        const fecha = new Date(c.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `
            <div class="history-item" onclick="restoreComparison('${c.id}')" title="Clic para restaurar esta comparación">
                <span class="hi-name">${c.nombre}</span>
                <span class="hi-meta">
                    <span>${c.totalProposals} propuesta(s) · ${c.ganador || '—'}</span>
                    <span>${fecha}</span>
                </span>
                <button class="hi-delete" onclick="event.stopPropagation(); deleteComparison('${c.id}')" title="Eliminar del historial">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
    }).join('');
}

async function restoreComparison(id) {
    try {
        const res = await fetch(`/api/comparaciones/${id}/restore`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('uploadStatus').innerHTML = 
                `<span style="color:#10b981;"><i class="fa-solid fa-rotate-left"></i> ${data.mensaje}</span>`;
            renderAll(data);
        }
    } catch (err) {
        console.error('Error restaurando comparación:', err);
    }
}

async function deleteComparison(id) {
    if (!confirm('¿Eliminar esta comparación del historial permanentemente?')) return;
    try {
        await fetch(`/api/comparaciones/${id}`, { method: 'DELETE' });
        loadHistory();
        loadInsurersReport();
    } catch (err) {
        console.error('Error eliminando comparación:', err);
    }
}

// ─── Poliza Modal (Linked Quotations) ────────────────────────────────────────

let currentModalPoliza = null;

function initPolizaModal() {
    const btnUpload = document.getElementById('btnPolizaUpload');
    const fileInput = document.getElementById('polizaPdfInput');

    btnUpload?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', async () => {
        if (!fileInput.files || fileInput.files.length === 0 || !currentModalPoliza) return;

        const formData = new FormData();
        for (let i = 0; i < fileInput.files.length; i++) {
            formData.append('pdfFiles', fileInput.files[i]);
        }

        const status = document.getElementById('polizaUploadStatus');
        status.innerHTML = `<span style="color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Procesando ${fileInput.files.length} archivo(s)...</span>`;

        try {
            const res = await fetch(`/api/renovaciones/${encodeURIComponent(currentModalPoliza)}/cotizaciones`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                status.innerHTML = `<span style="color:#10b981;"><i class="fa-solid fa-check"></i> ${data.mensaje}</span>`;
                loadPolizaCotizaciones(currentModalPoliza);
                loadInsurersReport();
                loadCartera();
            } else {
                status.innerHTML = `<span style="color:#ef4444;">${data.error}</span>`;
            }
        } catch (err) {
            status.innerHTML = `<span style="color:#ef4444;">Error al subir archivos</span>`;
        }
        fileInput.value = '';
    });

    // Close modal on overlay click
    document.getElementById('polizaModal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('poliza-modal-overlay')) closePolizaModal();
    });
}

function openPolizaModal(poliza, vencimiento, prima) {
    currentModalPoliza = poliza;
    document.getElementById('modalPoliza').textContent = poliza;
    document.getElementById('modalVencimiento').textContent = vencimiento;
    document.getElementById('modalPrima').textContent = '$' + Number(prima).toLocaleString('es-MX', { minimumFractionDigits: 2 }) + ' MXN';
    document.getElementById('polizaUploadStatus').innerHTML = '';
    document.getElementById('polizaModal').style.display = 'flex';
    loadPolizaCotizaciones(poliza);
}

function closePolizaModal() {
    document.getElementById('polizaModal').style.display = 'none';
    currentModalPoliza = null;
}

async function loadPolizaCotizaciones(poliza) {
    const container = document.getElementById('polizaCotizaciones');
    try {
        const res = await fetch(`/api/renovaciones/${encodeURIComponent(poliza)}/cotizaciones`);
        const data = await res.json();

        if (!data.proposals || data.proposals.length === 0) {
            container.innerHTML = `<p style="font-size:12px; color:var(--text-muted); text-align:center;">Aún no se han vinculado cotizaciones a esta póliza.</p>`;
            return;
        }

        const winner = data.recommendation?.ganador || '—';

        container.innerHTML = `
            <div style="font-size:12px; font-weight:700; margin-bottom:10px; color:var(--text-primary);">
                <i class="fa-solid fa-file-lines"></i> Cotizaciones vinculadas (${data.proposals.length}):
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:11px;">
                <thead>
                    <tr style="background:#e2e8f0;">
                        <th style="padding:6px 8px; text-align:left;">Aseguradora</th>
                        <th style="padding:6px 8px; text-align:left;">Archivo PDF</th>
                        <th style="padding:6px 8px; text-align:left;">Prima Neta</th>
                        <th style="padding:6px 8px; text-align:left;">Coberturas</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.proposals.map(p => {
                        const isWinner = p.aseguradora === winner;
                        const covCount = p.coberturas ? p.coberturas.filter(c => c.amparada).length : 0;
                        return `
                        <tr style="${isWinner ? 'background:#e8edf5;' : ''}">
                            <td style="padding:6px 8px; font-weight:${isWinner ? '700' : '500'};">${p.aseguradora}${isWinner ? ' <span style="color:var(--accent-indigo); font-size:10px;">(Mejor)</span>' : ''}</td>
                            <td style="padding:6px 8px; font-size:10px;" title="${p.archivo}">${p.archivo ? p.archivo.substring(0, 30) : '—'}</td>
                            <td style="padding:6px 8px; font-weight:600; color:var(--accent-indigo);">$${p.primaNeta ? p.primaNeta.toLocaleString('es-MX', {minimumFractionDigits:2}) : '0.00'}</td>
                            <td style="padding:6px 8px;">${covCount} detectadas</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            ${data.recommendation ? `
            <div style="margin-top:12px; background:#f1f5f9; border-radius:6px; padding:10px 14px; font-size:11px;">
                <strong>Recomendación:</strong> ${data.recommendation.ganador} presenta la mejor propuesta para renovar esta póliza.
            </div>` : ''}
        `;
    } catch (err) {
        container.innerHTML = `<p style="color:#ef4444; font-size:12px;">Error cargando cotizaciones.</p>`;
    }
}
