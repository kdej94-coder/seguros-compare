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

// Store for parsed proposals — starts EMPTY
let proposals = [];

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
    const combined = (text + ' ' + filename).toUpperCase();
    if (combined.includes('MAPFRE')) return 'MAPFRE';
    if (combined.includes('GNP')) return 'GNP';
    if (combined.includes('INBURSA')) return 'INBURSA';
    if (combined.includes('CHUBB')) return 'CHUBB';
    if (combined.includes('TOKIO')) return 'TOKIO MARINE';
    if (combined.includes('AXA')) return 'AXA';
    if (combined.includes('ZURICH')) return 'ZURICH';
    if (combined.includes('HDI')) return 'HDI';
    if (combined.includes('AFIRME')) return 'AFIRME';
    if (combined.includes('QUALITAS') || combined.includes('QUÁLITAS')) return 'QUALITAS';
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
        /(?:ASEGURADO|Nombre del Asegurado)[:\s]+([^\n]+)/i,
        /(?:CONTRATANTE)[:\s]+([^\n]+)/i
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return m[1].trim();
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
        /Prima\s+Neta\s*\$?\s*([\d,]+(?:\.\d+)?)/i,
        /PRIMA\s+NETA[:\s]*\$?\s*([\d,]+(?:\.\d+)?)/i,
        /PRIMA\s+TOTAL\s+NETA[:\s]*\$?\s*([\d,]+(?:\.\d+)?)/i
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) {
            const val = extractNumber(m[1]);
            if (val && val > 100 && val < 1000000) return val;
        }
    }
    return null;
}

function extractPrimaTotal(text) {
    const patterns = [
        /Prima\s+Total\s*\$?\s*([\d,]+(?:\.\d+)?)/i,
        /PRIMA\s+TOTAL[:\s]*\$?\s*([\d,]+(?:\.\d+)?)/i
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) {
            const val = extractNumber(m[1]);
            if (val && val > 100 && val < 2000000) return val;
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
    return {
        aseguradora: identifyInsurer(text, filename),
        moneda: extractCurrency(text),
        asegurado: extractInsuredName(text),
        domicilio: extractAddress(text),
        giro: extractActivity(text),
        primaNeta: extractPrimaNeta(text),
        primaTotal: extractPrimaTotal(text),
        sumasAseguradas: extractSumasAseguradas(text),
        coberturas: extractCoberturas(text),
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

// Clear all data
app.delete('/api/proposals', (req, res) => {
    proposals = [];
    res.json({ mensaje: 'Datos eliminados. El comparativo está vacío.' });
});

app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`  SegurosCompare - Dashboard con Login y PDF Engine`);
    console.log(`  Corriendo en: http://localhost:${PORT}`);
    console.log(`===================================================`);
});
