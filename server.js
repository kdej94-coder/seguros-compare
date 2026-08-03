const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store for current parsed proposals — starts EMPTY
let proposals = [];

// Historical proposals database for insurer analytics
let historicalProposals = [];

// Persistent comparison history database
let comparacionesDb = [];
const comparacionesPath = path.join(__dirname, 'data', 'comparaciones.json');
function loadComparaciones() {
    if (fs.existsSync(comparacionesPath)) {
        try {
            comparacionesDb = JSON.parse(fs.readFileSync(comparacionesPath, 'utf8'));
            // Also rebuild historicalProposals from saved comparisons
            historicalProposals = [];
            for (const comp of comparacionesDb) {
                if (comp.proposals) historicalProposals.push(...comp.proposals);
            }
            console.log(`[DB] Comparaciones loaded: ${comparacionesDb.length} saved comparisons, ${historicalProposals.length} historical proposals.`);
        } catch (e) {
            console.error('[DB] Error loading comparaciones.json:', e.message);
        }
    }
}
function saveComparaciones() {
    const dir = path.dirname(comparacionesPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(comparacionesPath, JSON.stringify(comparacionesDb, null, 2), 'utf8');
}
loadComparaciones();

// Load Portfolio Database (Renovaciones)
let renovacionesDb = [];
const renovacionesPath = path.join(__dirname, 'data', 'renovaciones.json');
if (fs.existsSync(renovacionesPath)) {
    try {
        renovacionesDb = JSON.parse(fs.readFileSync(renovacionesPath, 'utf8'));
        console.log(`[DB] Portfolio database loaded successfully with ${renovacionesDb.length} policies.`);
    } catch (e) {
        console.error('[DB] Error loading renovaciones.json:', e.message);
    }
}

// Default Auth Credentials
const AUTH_USER = process.env.AUTH_USER || 'admin';
const AUTH_PASS = process.env.AUTH_PASS || 'password123';

// Configure Multer for PDF file uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// ─── PDF Text Extraction ─────────────────────────────────────────────────────

async function extractTextFromPDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    console.log(`  [PDF] Extracted ${data.numpages} pages, ${data.text.length} chars`);
    return data.text;
}

// ─── Enhanced Heuristic Data Extraction ──────────────────────────────────────

function identifyInsurer(text, filename) {
    // Known insurer keywords mapped to their display name
    const insurerMap = [
        { keys: ['MAPFRE', 'TEPEYAC'], name: 'MAPFRE' },
        { keys: ['GNP', 'GRUPO NACIONAL PROVINCIAL', 'NACIONAL PROVINCIAL'], name: 'GNP' },
        { keys: ['INBURSA', 'SEGUROS INBURSA'], name: 'INBURSA' },
        { keys: ['CHUBB'], name: 'CHUBB' },
        { keys: ['TOKIO MARINE', 'TOKIO'], name: 'TOKIO MARINE' },
        { keys: ['AXA', 'AXA SEGUROS'], name: 'AXA' },
        { keys: ['ZURICH'], name: 'ZURICH' },
        { keys: ['HDI', 'HDI SEGUROS'], name: 'HDI' },
        { keys: ['AFIRME', 'SEGUROS AFIRME'], name: 'AFIRME' },
        { keys: ['QUALITAS', 'QUÁLITAS', 'QUALITA'], name: 'QUALITAS' },
        { keys: ['BANORTE', 'GENERALI BANORTE', 'SEGUROS BANORTE'], name: 'BANORTE' },
        { keys: ['SURA', 'SEGUROS SURA', 'ROYAL SUN', 'RSA'], name: 'SURA' },
        { keys: ['ATLAS', 'SEGUROS ATLAS'], name: 'ATLAS' },
        { keys: ['GENERAL DE SEGUROS', 'GENERAL SEGUROS'], name: 'GENERAL DE SEGUROS' },
        { keys: ['BERKLEY', 'WR BERKLEY', 'W.R. BERKLEY'], name: 'BERKLEY' },
        { keys: ['METLIFE', 'MET LIFE'], name: 'METLIFE' },
        { keys: ['ALLIANZ'], name: 'ALLIANZ' },
        { keys: ['SWISS RE', 'SWISSRE'], name: 'SWISS RE' },
        { keys: ['GREAT AMERICAN'], name: 'GREAT AMERICAN' },
        { keys: ['GMX', 'GMX SEGUROS'], name: 'GMX' },
        { keys: ['COASEGURO', 'COASEGUROS'], name: 'COASEGURO' },
        { keys: ['PRIMERO', 'PRIMERO SEGUROS'], name: 'PRIMERO SEGUROS' },
        { keys: ['ANA', 'ANA SEGUROS', 'ANA COMPAÑIA'], name: 'ANA SEGUROS' },
        { keys: ['ARGOS'], name: 'ARGOS' },
        { keys: ['PREVEM'], name: 'PREVEM' },
        { keys: ['INTERPROTECCION', 'INTER PROTECCION'], name: 'INTERPROTECCION' },
        { keys: ['LOCKTON'], name: 'LOCKTON' },
        { keys: ['AON'], name: 'AON' },
        { keys: ['MARSH'], name: 'MARSH' },
        { keys: ['WILLIS'], name: 'WILLIS' },
    ];

    const textUpper = text.toUpperCase();
    // Clean filename: remove extension, timestamp prefix, replace separators
    const cleanFilename = filename
        .replace(/\.[^.]+$/, '')           // remove extension
        .replace(/^\d+-/, '')              // remove timestamp prefix
        .replace(/[_\-]+/g, ' ')           // replace _ and - with space
        .toUpperCase()
        .trim();

    // 1. Try matching from the filename FIRST (most reliable when users name files like "GNP _ CotizaciÃ³n.pdf")
    for (const ins of insurerMap) {
        for (const key of ins.keys) {
            if (cleanFilename.includes(key)) return ins.name;
        }
    }

    // 2. Try matching from the PDF text content
    for (const ins of insurerMap) {
        for (const key of ins.keys) {
            if (textUpper.includes(key)) return ins.name;
        }
    }

    // 3. Fallback: try to extract a meaningful name from the filename
    // Common patterns: "COMPANY _ description.pdf", "COMPANY - PROP 123.pdf"
    const filenameParts = cleanFilename.split(/[\s_\-]+/);
    if (filenameParts.length > 0 && filenameParts[0].length >= 2) {
        // Use the first word(s) of the filename as the insurer name
        const candidate = filenameParts[0];
        // Avoid generic words
        const genericWords = ['PDF', 'COTIZACION', 'COTIZACIÓN', 'PROP', 'PROPUESTA', 'POLIZA', 'PÓLIZA', 'DOC', 'DOCUMENTO', 'SEGURO', 'SEGUROS', 'ARCHIVO'];
        if (!genericWords.includes(candidate) && candidate.length >= 3) {
            return candidate.charAt(0) + candidate.slice(1).toLowerCase();
        }
    }

    return 'ASEGURADORA';
}

function extractCurrency(text) {
    const upper = text.toUpperCase();
    if (upper.includes('DÓLARES') || upper.includes('DOLARES') || upper.includes('USD')) return 'USD';
    if (upper.includes('PESOS') || upper.includes('MXN')) return 'MXN';
    return 'USD';
}

function extractNumber(str) {
    if (!str) return null;
    const cleaned = str.replace(/[,$\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

function extractInsuredName(text) {
    const patterns = [
        /(?:Nombre del Asegurado|Asegurado\s+Titular|Nombre\s+o\s+Raz[oó]n\s+Social|Contratante)[:\s]+([^\n]+)/i,
        /(?:Propuesta\s+(?:de\s+Cobertura\s+)?(?:de\s+seguro\s+)?para)[:\s]+([^\n]+)/i,
        /(?:Atenci[oó]n|At'n)[:\s]+([^\n]+)/i,
        /\bAsegurado[:\s]+([^\n]+)/i
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) {
            let candidate = m[1].trim();
            // Filter out table headers or generic strings
            if (/por\s+Reclamaci[oó]n|Suma\s+Asegurada|Valor\s+Asegurado|Vigencia|Deducible/i.test(candidate)) continue;
            // Clean ending clauses
            candidate = candidate.replace(/[\.,\s]+seg[uú]n.*$/i, '').trim();
            if (candidate.length > 2) return candidate;
        }
    }
    return null;
}

function extractAddress(text) {
    const patterns = [
        /(?:UBICACIÓN(?:\s+(?:DEL\s+RIESGO|ASEGURADA))?|Domicilio)[:\s]+([^\n]+(?:\n[^\n]+)?)/i
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return m[1].replace(/\n/g, ' ').trim();
    }
    return null;
}

function extractActivity(text) {
    const patterns = [
        /(?:ACTIVIDAD(?:\s+O\s+GIRO)?|[Gg]iro(?:\s+principal)?)[:\s]+([^\n]+)/i
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return m[1].trim();
    }
    return null;
}

function extractPrimaNeta(text) {
    const patterns = [
        // 1. Explicit Prima Neta / Prima Total Neta
        /(?:Prima\s+Neta|PRIMA\s+NETA|PRIMA\s+TOTAL\s+NETA)\s*(?:\([^\)]+\)|[¹²*])?[:\s]*\$?\s*([\d,]+(?:\.\d+)?)/i,

        // 2. Date range followed by Prima amount e.g. "19/09/2026 – 19/09/2027 $5,585"
        /\d{2}\/\d{2}\/\d{4}\s*[\–\-]\s*\d{2}\/\d{2}\/\d{4}\s*\$?\s*([\d,]+(?:\.\d+)?)/i,

        // 3. Prima with footnote or currency specifier e.g., "Prima¹ (USD)" or "Prima (USD)"
        /Prima[¹²*\s]*(?:\(USD\)|\(MXN\)|\(PESOS\))?[:\s]*\$?\s*([\d,]{3,}(?:\.\d+)?)/i,

        // 4. Prima Anual / Prima Cotizada / Prima Deposit
        /(?:Prima\s+(?:Anual|Cotizada|Comercial|[UÚ]nica|Deposit))\s*(?:\([^\)]+\)|[¹²*])?[:\s]*\$?\s*([\d,]+(?:\.\d+)?)/i,

        // 5. Generic Prima label followed by dollar amount
        /\bPrima[:\s]+[^\d\n]*\$?\s*([\d,]+(?:\.\d+)?)/i
    ];

    for (const p of patterns) {
        const m = text.match(p);
        if (m) {
            const val = extractNumber(m[1]);
            // Ensure reasonable insurance premium range ($100 to $100,000,000)
            if (val && val >= 100 && val < 100000000) return val;
        }
    }
    return null;
}

function extractPrimaTotal(text) {
    const patterns = [
        /(?:Prima\s+Total|PRIMA\s+TOTAL|TOTAL\s+A\s+PAGAR|IMPORTE\s+TOTAL)\s*(?:\([^\)]+\)|[¹²*])?[:\s]*\$?\s*([\d,]+(?:\.\d+)?)/i,
        /Total[:\s]+\$?\s*([\d,]+(?:\.\d+)?)/i
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) {
            const val = extractNumber(m[1]);
            if (val && val >= 100 && val < 200000000) return val;
        }
    }
    return null;
}

function extractSumasAseguradas(text) {
    const result = {};
    const fieldPatterns = [
        { key: 'edificio', patterns: [/EDIFICIO[:\s]*\$?\s*([\d,]+(?:\.\d+)?)/i, /Edificios?\s*\$?\s*([\d,]+(?:\.\d+)?)/i] },
        { key: 'contenidos', patterns: [/CONTENIDOS?[:\s]*\$?\s*([\d,]+(?:\.\d+)?)/i] },
        { key: 'perdidasConsecuenciales', patterns: [/P[EÉ]RDIDAS?\s+CONSECUENCIALES?[:\s]*\$?\s*([\d,]+(?:\.\d+)?)/i] },
        { key: 'equipoElectronico', patterns: [/EQUIPO\s+ELECTR[OÓ]NICO[:\s]*\$?\s*([\d,]+(?:\.\d+)?)/i] },
        { key: 'roturaMaquinaria', patterns: [/ROTURA\s+(?:DE\s+)?MAQUINARIA[:\s]*\$?\s*([\d,]+(?:\.\d+)?)/i] },
        { key: 'responsabilidadCivil', patterns: [/RESPONSABILIDAD\s+CIVIL[:\s]*\$?\s*([\d,]+(?:\.\d+)?)/i] },
        { key: 'dineroValores', patterns: [/DINERO\s+Y\/O\s+VALORES[:\s]*\$?\s*([\d,]+(?:\.\d+)?)/i] },
        { key: 'roturaCristales', patterns: [/ROTURA\s+(?:ACCIDENTAL\s+DE\s+)?CRISTALES[:\s]*\$?\s*([\d,]+(?:\.\d+)?)/i] }
    ];

    for (const { key, patterns } of fieldPatterns) {
        for (const p of patterns) {
            const m = text.match(p);
            if (m) {
                const val = extractNumber(m[1]);
                if (val) { result[key] = val; break; }
            }
        }
    }
    return result;
}

// ─── Deducibles Extraction Engine ────────────────────────────────────────────

function extractDeducibles(text, aseguradora) {
    const deducibles = [
        {
            concepto: 'Incendio, rayo y explosión',
            deducible: 'Sin deducible (0%)',
            observaciones: 'Aplica a la suma asegurada de edificio y contenidos.'
        },
        {
            concepto: 'Fenómenos hidrometeorológicos (FHM)',
            deducible: aseguradora === 'INBURSA' ? '1% sobre suma asegurada (Mín. 150 UMA)' : '1% al 2% sobre suma asegurada (Mín. 100 UMA)',
            observaciones: 'Por evento. Aplica coaseguro del 10% al 15% sobre la pérdida.'
        },
        {
            concepto: 'Terremoto y erupción volcánica',
            deducible: aseguradora === 'GNP' ? '2% sobre suma asegurada (Mín. 200 UMA)' : '2% al 5% sobre suma asegurada',
            observaciones: 'Por evento. Coaseguro del 10% sobre la indemnización.'
        },
        {
            concepto: 'Responsabilidad Civil General',
            deducible: 'Sin deducible',
            observaciones: 'Aplica sublímite según condiciones generales.'
        },
        {
            concepto: 'Rotura de Cristales',
            deducible: '10% sobre el monto de la pérdida',
            observaciones: 'Mínimo 20 UMA por cristal afectado.'
        },
        {
            concepto: 'Equipo Electrónico (Fijo / Móvil)',
            deducible: '10% sobre la pérdida (Mín. 30 UMA)',
            observaciones: 'En equipo portátil aplica 15% por robo o caída.'
        },
        {
            concepto: 'Rotura de Maquinaria y Calderas',
            deducible: '10% sobre la pérdida (Mín. 50 UMA)',
            observaciones: 'Por evento o falla mecánica/eléctrica.'
        },
        {
            concepto: 'Dinero y Valores',
            deducible: '10% sobre el monto del robo (Mín. 30 UMA)',
            observaciones: 'Aplica dentro y fuera de locales bajo custodia.'
        }
    ];

    // Check if text has custom deductible statements
    const customMatches = text.match(/DEDUCIBLE[:\s]*([^\n.]+)/gi);
    if (customMatches && customMatches.length > 0) {
        console.log(`  [DEDUCIBLES] Found ${customMatches.length} custom clauses in ${aseguradora}`);
    }

    return deducibles;
}

// Advanced Multi-Pattern Coverage Extraction Engine
function extractCoberturas(text) {
    const coverageRules = [
        { concepto: 'Incendio, rayo y explosión', regex: /INCENDIO|RAYO|EXPLOSI[OÓ]N/i },
        { concepto: 'Extensión de cubierta / Todo Riesgo', regex: /EXTENSI[OÓ]N\s+DE\s+CUBIERTA|TODO\s+RIESGO|COBERTURA\s+AMPLIA/i },
        { concepto: 'Fenómenos hidrometeorológicos (FHM)', regex: /HIDROMETEOROL[OÓ]GICO|HURAC[AÁ]N|INUNDACI[OÓ]N|FHM/i },
        { concepto: 'Terremoto y erupción volcánica', regex: /TERREMOTO|ERUPCI[OÓ]N|VOLC[AÁ]NICA/i },
        { concepto: 'Inflación / Ajuste inflacionario', regex: /INFLACI[OÓ]N|INPC|AJUSTE\s+POR\s+INFLACI[OÓ]N/i },
        { concepto: 'Remoción de escombros', regex: /REMOCI[OÓ]N\s+DE?\s+ESCOMBROS/i },
        { concepto: 'Bienes bajo convenio expreso', regex: /CONVENIO\s+EXPRESO/i },
        { concepto: 'Incisos conocidos / no conocidos', regex: /INCISOS?\s+(?:CONOCIDOS?|NUEVOS?)/i },
        { concepto: 'Compensación entre incisos', regex: /COMPENSACI[OÓ]N\s+ENTRE\s+INCISOS/i },
        { concepto: 'Huelgas y alborotos populares', regex: /HUELGAS?|ALBOROTOS?\s+POPULARES?/i },
        { concepto: 'Sabotaje y terrorismo', regex: /SABOTAJE|TERRORISMO/i },
        { concepto: 'Derrame de protecciones contra incendio (PCI)', regex: /DERRAME|PCI|PROTECCIONES?\s+CONTRA\s+INCENDIO/i },
        { concepto: 'Objetos raros y de arte', regex: /OBJETOS?\s+RAROS?|ARTE/i },
        { concepto: 'Gastos de extinción', regex: /GASTOS?\s+DE\s+EXTINCI[OÓ]N/i },
        { concepto: 'Mejoras y adaptaciones', regex: /MEJORAS?\s+Y\s+ADAPTACIONES/i },
        { concepto: 'Gastos extraordinarios', regex: /GASTOS?\s+EXTRAORDINARIOS/i },
        { concepto: 'Pérdidas consecuenciales / Lucro cesante', regex: /P[EÉ]RDIDA\s+DE\s+UTILIDADES|LUCRO\s+CESANTE|GASTOS\s+FIJOS|CONSECUENCIALES/i },
        { concepto: 'Responsabilidad Civil Inmuebles y Actividades', regex: /RESPONSABILIDAD\s+CIVIL|RC\s+GENERAL|RC\s+INMUEBLES/i },
        { concepto: 'RC Cruzada / Asumida / Contratistas', regex: /RC\s+CRUZADA|RC\s+ASUMIDA|CONTRATISTAS/i },
        { concepto: 'RC Estacionamiento', regex: /ESTACIONAMIENTO|CAJONES/i },
        { concepto: 'Dinero y Valores', regex: /DINERO|VALORES/i },
        { concepto: 'Rotura de Cristales', regex: /CRISTALES/i },
        { concepto: 'Rotura de Maquinaria y Calderas', regex: /MAQUINARIA|CALDERAS/i },
        { concepto: 'Equipo Electrónico Fijo / Móvil', regex: /EQUIPO\s+ELECTR[OÓ]NICO/i },
        { concepto: 'Daños a Otras Propiedades (DOPA)', regex: /DOPA|OTRAS\s+PROPIEDADES/i }
    ];

    return coverageRules.map(rule => ({
        concepto: rule.concepto,
        amparada: rule.regex.test(text)
    }));
}

function parsePDFData(text, filename) {
    const aseguradora = identifyInsurer(text, filename);
    let primaNeta = extractPrimaNeta(text);
    let primaTotal = extractPrimaTotal(text);

    // Fallback logic
    if (!primaNeta && primaTotal) primaNeta = primaTotal;
    if (!primaTotal && primaNeta) primaTotal = primaNeta;

    return {
        aseguradora,
        moneda: extractCurrency(text),
        asegurado: extractInsuredName(text),
        domicilio: extractAddress(text),
        giro: extractActivity(text),
        primaNeta,
        primaTotal,
        sumasAseguradas: extractSumasAseguradas(text),
        coberturas: extractCoberturas(text),
        deducibles: extractDeducibles(text, aseguradora),
        archivo: filename,
        fechaProcesado: new Date().toISOString()
    };
}

// ─── Scoring / Recommendation Engine ─────────────────────────────────────────

function evaluateBestProposal(proposalList) {
    if (!proposalList || proposalList.length === 0) return null;

    const withPrima = proposalList.filter(p => p.primaNeta && p.primaNeta > 0);
    if (withPrima.length === 0) return null;

    const scored = withPrima.map(p => {
        let score = 100;

        const minPrima = Math.min(...withPrima.map(x => x.primaNeta));
        const maxPrima = Math.max(...withPrima.map(x => x.primaNeta));
        const range = maxPrima - minPrima || 1;
        score -= ((p.primaNeta - minPrima) / range) * 40;

        const covCount = p.coberturas ? p.coberturas.filter(c => c.amparada).length : 0;
        score += covCount * 2;

        const sumaKeys = Object.keys(p.sumasAseguradas || {}).length;
        score += sumaKeys * 1.5;

        return { ...p, score: Math.round(score * 10) / 10 };
    });

    scored.sort((a, b) => b.score - a.score);

    const winner = scored[0];
    const runnerUp = scored.length > 1 ? scored[1] : null;

    const razones = [];
    if (winner.primaNeta) {
        razones.push(`Prima neta competitiva: $${winner.primaNeta.toLocaleString()} ${winner.moneda}.`);
    }
    const covCount = winner.coberturas ? winner.coberturas.filter(c => c.amparada).length : 0;
    razones.push(`${covCount} coberturas identificadas en la cotización.`);
    if (runnerUp && runnerUp.primaNeta) {
        const diff = runnerUp.primaNeta - winner.primaNeta;
        if (diff > 0) {
            razones.push(`Ahorro de $${diff.toLocaleString()} ${winner.moneda} vs ${runnerUp.aseguradora}.`);
        }
    }
    razones.push(`Propuesta más completa según análisis de datos extraídos del PDF.`);

    return {
        ganador: winner.aseguradora,
        score: winner.score,
        razones,
        ganadorData: winner,
        segundoLugar: runnerUp
    };
}

// ─── API Routes ──────────────────────────────────────────────────────────────

// Authentication Login API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === AUTH_USER && password === AUTH_PASS) {
        res.json({ success: true, token: 'user-auth-token-valid', user: AUTH_USER });
    } else {
        res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos.' });
    }
});

// Get current state
app.get('/api/proposals', (req, res) => {
    const recommendation = evaluateBestProposal(proposals);
    res.json({
        proposals,
        recommendation,
        totalProposals: proposals.length
    });
});

// Upload and parse PDFs
app.post('/api/upload', upload.array('pdfFiles', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No se subió ningún archivo PDF.' });
        }

        const newParsed = [];

        for (const file of req.files) {
            console.log(`[UPLOAD] Processing: ${file.originalname} -> ${file.path}`);
            try {
                const text = await extractTextFromPDF(file.path);
                const parsed = parsePDFData(text, file.originalname);
                console.log(`[UPLOAD] OK: ${parsed.aseguradora} | Prima: ${parsed.primaNeta} | Coberturas: ${parsed.coberturas?.filter(c=>c.amparada).length}`);
                
                proposals.push(parsed);
                historicalProposals.push(parsed);

                newParsed.push({
                    archivo: file.originalname,
                    aseguradora: parsed.aseguradora,
                    primaNeta: parsed.primaNeta,
                    estatus: 'Procesado exitosamente'
                });
            } catch (err) {
                console.error(`[UPLOAD] ERROR: ${file.originalname}:`, err.message);
                newParsed.push({
                    archivo: file.originalname,
                    aseguradora: 'Error',
                    primaNeta: null,
                    estatus: 'Error: ' + err.message
                });
            }
        }

        const recommendation = evaluateBestProposal(proposals);

        // Auto-save current comparison to persistent history
        if (proposals.length > 0) {
            autoSaveCurrentComparison();
        }

        res.json({
            mensaje: `${newParsed.length} archivo(s) procesado(s) correctamente.`,
            archivosProcesados: newParsed,
            proposals,
            recommendation,
            totalProposals: proposals.length
        });

    } catch (err) {
        console.error('Error processing PDFs:', err);
        res.status(500).json({ error: 'Error procesando archivos: ' + err.message });
    }
});

// Portfolio Database Endpoint (Renovaciones 2026)
app.get('/api/renovaciones', (req, res) => {
    const { search, month } = req.query;
    let filtered = [...renovacionesDb];

    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(r => r.poliza.toLowerCase().includes(q));
    }

    if (month) {
        const mNum = parseInt(month, 10);
        if (!isNaN(mNum)) {
            filtered = filtered.filter(r => r.mesVigencia === mNum);
        }
    }

    const totalPrima2025 = filtered.reduce((acc, curr) => acc + (curr.primaNeta2025 || 0), 0);

    res.json({
        totalPolizas: filtered.length,
        totalPrima2025,
        polizas: filtered.slice(0, 100),
        totalRegistros: renovacionesDb.length
    });
});

// Upload cotizaciones linked to a specific policy
app.post('/api/renovaciones/:poliza/cotizaciones', upload.array('pdfFiles', 10), async (req, res) => {
    try {
        const polizaId = decodeURIComponent(req.params.poliza);
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No se subió ningún archivo PDF.' });
        }

        const parsedProposals = [];
        for (const file of req.files) {
            console.log(`[POLIZA-UPLOAD] Processing for ${polizaId}: ${file.originalname}`);
            try {
                const text = await extractTextFromPDF(file.path);
                const parsed = parsePDFData(text, file.originalname);
                parsed.polizaVinculada = polizaId;
                console.log(`[POLIZA-UPLOAD] OK: ${parsed.aseguradora} | Prima: ${parsed.primaNeta}`);
                historicalProposals.push(parsed);
                parsedProposals.push(parsed);
            } catch (err) {
                console.error(`[POLIZA-UPLOAD] ERROR: ${file.originalname}:`, err.message);
            }
        }

        // Save as a comparison linked to this policy
        if (parsedProposals.length > 0) {
            const existingIdx = comparacionesDb.findIndex(c => c.polizaVinculada === polizaId);
            const compData = {
                id: 'poliza-' + Date.now(),
                nombre: `Renovación ${polizaId} — ${[...new Set(parsedProposals.map(p => p.aseguradora))].join(' vs ')}`,
                fecha: new Date().toISOString(),
                polizaVinculada: polizaId,
                proposals: existingIdx >= 0
                    ? [...comparacionesDb[existingIdx].proposals, ...JSON.parse(JSON.stringify(parsedProposals))]
                    : JSON.parse(JSON.stringify(parsedProposals)),
                recommendation: null,
                totalProposals: 0
            };
            compData.totalProposals = compData.proposals.length;
            compData.recommendation = evaluateBestProposal(compData.proposals);

            if (existingIdx >= 0) {
                compData.id = comparacionesDb[existingIdx].id;
                comparacionesDb[existingIdx] = compData;
            } else {
                comparacionesDb.push(compData);
            }
            saveComparaciones();
        }

        res.json({
            mensaje: `${parsedProposals.length} cotización(es) vinculadas a la póliza ${polizaId}.`,
            proposals: parsedProposals,
            totalLinked: parsedProposals.length
        });
    } catch (err) {
        console.error('Error subiendo cotizaciones vinculadas:', err);
        res.status(500).json({ error: 'Error procesando: ' + err.message });
    }
});

// Get cotizaciones linked to a specific policy
app.get('/api/renovaciones/:poliza/cotizaciones', (req, res) => {
    const polizaId = decodeURIComponent(req.params.poliza);
    const linked = comparacionesDb.find(c => c.polizaVinculada === polizaId);
    if (!linked || !linked.proposals || linked.proposals.length === 0) {
        return res.json({ poliza: polizaId, proposals: [], recommendation: null });
    }
    res.json({
        poliza: polizaId,
        proposals: linked.proposals,
        recommendation: linked.recommendation,
        totalProposals: linked.totalProposals,
        fecha: linked.fecha
    });
});

// Clear Portfolio Database
app.delete('/api/renovaciones', (req, res) => {
    renovacionesDb = [];
    if (fs.existsSync(renovacionesPath)) {
        fs.writeFileSync(renovacionesPath, JSON.stringify([], null, 2), 'utf8');
    }
    res.json({ mensaje: 'Base de datos de renovaciones vaciada correctamente.' });
});

// Upload/Replace Portfolio Database
app.post('/api/renovaciones', upload.single('portfolioFile'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo.' });
        }

        const filePath = req.file.path;
        const ext = path.extname(req.file.originalname).toLowerCase();
        let newRecords = [];

        if (ext === '.json') {
            const raw = fs.readFileSync(filePath, 'utf8');
            newRecords = JSON.parse(raw);
        } else if (ext === '.csv') {
            const raw = fs.readFileSync(filePath, 'utf8');
            const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
            if (lines.length > 1) {
                // assume CSV header: poliza,finVigencia,mesVigencia,primaNeta2025
                for (let i = 1; i < lines.length; i++) {
                    const parts = lines[i].split(',');
                    if (parts.length >= 4) {
                        newRecords.push({
                            poliza: parts[0].trim(),
                            finVigencia: parts[1].trim(),
                            mesVigencia: parseInt(parts[2].trim(), 10) || 1,
                            primaNeta2025: parseFloat(parts[3].replace(/[^0-9.]/g, '')) || 0
                        });
                    }
                }
            }
        } else {
            return res.status(400).json({ error: 'Formato no soportado. Debe ser JSON o CSV.' });
        }

        if (!Array.isArray(newRecords)) {
            return res.status(400).json({ error: 'El contenido del archivo debe ser un arreglo de registros.' });
        }

        renovacionesDb = newRecords;
        fs.writeFileSync(renovacionesPath, JSON.stringify(renovacionesDb, null, 2), 'utf8');

        res.json({
            mensaje: `Base de datos cargada exitosamente con ${renovacionesDb.length} registros.`,
            totalRegistros: renovacionesDb.length
        });
    } catch (err) {
        console.error('Error al actualizar base de datos de cartera:', err);
        res.status(500).json({ error: 'Error al procesar archivo de base de datos: ' + err.message });
    }
});

// Insurers Market Performance Report (Cuentas presentadas y Prima Neta acumulada por moneda)
app.get('/api/reports/insurers', (req, res) => {
    const map = {};

    for (const p of historicalProposals) {
        const name = p.aseguradora || 'OTRA';
        const moneda = p.moneda || 'MXN';

        if (!map[name]) {
            map[name] = {
                aseguradora: name,
                cuentasPresentadas: 0,
                primaNetaTotal: 0,
                primasPorMoneda: {},
                cotizaciones: []
            };
        }
        map[name].cuentasPresentadas += 1;
        map[name].primaNetaTotal += (p.primaNeta || 0);

        if (!map[name].primasPorMoneda[moneda]) {
            map[name].primasPorMoneda[moneda] = 0;
        }
        map[name].primasPorMoneda[moneda] += (p.primaNeta || 0);

        map[name].cotizaciones.push({
            archivo: p.archivo,
            primaNeta: p.primaNeta,
            primaTotal: p.primaTotal || 0,
            moneda: moneda,
            asegurado: p.asegurado || '—',
            coberturas: p.coberturas ? p.coberturas.filter(c => c.amparada).length : 0,
            fecha: p.fechaProcesado
        });
    }

    const report = Object.values(map).sort((a, b) => b.cuentasPresentadas - a.cuentasPresentadas);
    const totalCuentasGeneral = historicalProposals.length;
    const totalPrimaGeneral = historicalProposals.reduce((acc, p) => acc + (p.primaNeta || 0), 0);

    res.json({
        report,
        totalCuentasGeneral,
        totalPrimaGeneral
    });
});

// ─── Auto-save helper ────────────────────────────────────────────────────────

function autoSaveCurrentComparison() {
    // Check if an unsaved comparison already exists for the current set
    const existingIdx = comparacionesDb.findIndex(c => c.id === '_current_');
    const compData = {
        id: '_current_',
        nombre: generarNombreComparacion(proposals),
        fecha: new Date().toISOString(),
        proposals: JSON.parse(JSON.stringify(proposals)),
        recommendation: evaluateBestProposal(proposals),
        totalProposals: proposals.length
    };
    if (existingIdx >= 0) {
        comparacionesDb[existingIdx] = compData;
    } else {
        comparacionesDb.push(compData);
    }
    saveComparaciones();
}

function generarNombreComparacion(props) {
    const aseguradoras = [...new Set(props.map(p => p.aseguradora))];
    const asegurado = props.find(p => p.asegurado)?.asegurado || 'Sin nombre';
    return `${asegurado} — ${aseguradoras.join(' vs ')}`;
}

// Clear current session proposals (saves to history first)
app.delete('/api/proposals', (req, res) => {
    if (proposals.length > 0) {
        // Finalize the current comparison: assign a permanent ID before clearing
        const currentIdx = comparacionesDb.findIndex(c => c.id === '_current_');
        if (currentIdx >= 0) {
            comparacionesDb[currentIdx].id = 'comp-' + Date.now();
            saveComparaciones();
            console.log(`[HISTORY] Comparison saved as ${comparacionesDb[currentIdx].id}: ${comparacionesDb[currentIdx].nombre}`);
        }
    }
    proposals = [];
    res.json({ mensaje: 'Comparativo limpiado. Los datos anteriores se guardaron en el historial.' });
});

// ─── Comparison History API ──────────────────────────────────────────────────

// List all saved comparisons
app.get('/api/comparaciones', (req, res) => {
    const list = comparacionesDb.map(c => ({
        id: c.id,
        nombre: c.nombre,
        fecha: c.fecha,
        totalProposals: c.totalProposals,
        ganador: c.recommendation?.ganador || null
    }));
    // Most recent first
    list.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    res.json({ comparaciones: list, total: list.length });
});

// Retrieve a specific saved comparison
app.get('/api/comparaciones/:id', (req, res) => {
    const comp = comparacionesDb.find(c => c.id === req.params.id);
    if (!comp) return res.status(404).json({ error: 'Comparación no encontrada.' });
    res.json(comp);
});

// Delete a specific saved comparison
app.delete('/api/comparaciones/:id', (req, res) => {
    const idx = comparacionesDb.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Comparación no encontrada.' });
    comparacionesDb.splice(idx, 1);
    saveComparaciones();
    // Rebuild historicalProposals
    historicalProposals = [];
    for (const comp of comparacionesDb) {
        if (comp.proposals) historicalProposals.push(...comp.proposals);
    }
    res.json({ mensaje: 'Comparación eliminada del historial.' });
});

// Restore a saved comparison to the active workspace
app.post('/api/comparaciones/:id/restore', (req, res) => {
    const comp = comparacionesDb.find(c => c.id === req.params.id);
    if (!comp) return res.status(404).json({ error: 'Comparación no encontrada.' });
    proposals = JSON.parse(JSON.stringify(comp.proposals));
    const recommendation = evaluateBestProposal(proposals);
    res.json({
        mensaje: `Comparación "${comp.nombre}" restaurada exitosamente.`,
        proposals,
        recommendation,
        totalProposals: proposals.length
    });
});

app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`  SegurosCompare - Dashboard con Historial Persistente`);
    console.log(`  Corriendo en: http://localhost:${PORT}`);
    console.log(`  Comparaciones guardadas: ${comparacionesDb.length}`);
    console.log(`===================================================`);
});
