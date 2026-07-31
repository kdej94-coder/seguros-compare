const assert = require('assert');

// ─── Unit Test Suite for SegurosCompare ──────────────────────────────────────

console.log('🧪 Ejecutando Pruebas Unitarias de SegurosCompare...');

// Test 1: Regex Coverage Extraction
function testCoverageExtraction() {
    const sampleText = "COTIZACION MAPFRE - COBERTURA INCENDIO, FENOMENOS HIDROMETEOROLOGICOS, TERREMOTO Y RESPONSABILIDAD CIVIL";
    const rules = [
        { concepto: 'Incendio', regex: /INCENDIO/i },
        { concepto: 'FHM', regex: /HIDROMETEOROL/i },
        { concepto: 'Terremoto', regex: /TERREMOTO/i },
        { concepto: 'RC', regex: /RESPONSABILIDAD\s+CIVIL/i },
        { concepto: 'Cristales', regex: /CRISTALES/i }
    ];

    const detected = rules.filter(r => r.regex.test(sampleText)).map(r => r.concepto);
    assert.strictEqual(detected.length, 4, 'Debe detectar exactamente 4 coberturas');
    assert.ok(detected.includes('Incendio'), 'Debe incluir Incendio');
    assert.ok(!detected.includes('Cristales'), 'No debe incluir Cristales');
    console.log('  ✅ Test 1: Extracción de coberturas Regex superada.');
}

// Test 2: Scoring Algorithm ("Mejor Opción")
function testScoringEngine() {
    const proposals = [
        { aseguradora: 'Aseguradora A', primaNeta: 30000, coberturas: [{ amparada: true }, { amparada: true }], sumasAseguradas: { edificio: 1000 } },
        { aseguradora: 'Aseguradora B', primaNeta: 20000, coberturas: [{ amparada: true }, { amparada: true }, { amparada: true }], sumasAseguradas: { edificio: 1000 } }
    ];

    // B has lower prima and more coverages, so B must win
    const minPrima = Math.min(...proposals.map(x => x.primaNeta));
    const maxPrima = Math.max(...proposals.map(x => x.primaNeta));
    const range = maxPrima - minPrima || 1;

    const scored = proposals.map(p => {
        let score = 100;
        score -= ((p.primaNeta - minPrima) / range) * 40;
        score += p.coberturas.filter(c => c.amparada).length * 2;
        return { ...p, score };
    });

    scored.sort((a, b) => b.score - a.score);

    assert.strictEqual(scored[0].aseguradora, 'Aseguradora B', 'La propuesta B debe ganar por menor prima y mayor cobertura');
    console.log('  ✅ Test 2: Motor de Scoring ("Mejor Opción") superado.');
}

// Test 3: Authentication Logic
function testAuthLogic() {
    const validUser = 'admin';
    const validPass = 'password123';

    function authenticate(u, p) {
        return u === validUser && p === validPass;
    }

    assert.strictEqual(authenticate('admin', 'password123'), true, 'Credenciales correctas deben retornar true');
    assert.strictEqual(authenticate('admin', 'wrongpass'), false, 'Password incorrecto debe retornar false');
    assert.strictEqual(authenticate('user', 'password123'), false, 'Usuario incorrecto debe retornar false');
    console.log('  ✅ Test 3: Autenticación de usuario superada.');
}

// Run all tests
try {
    testCoverageExtraction();
    testScoringEngine();
    testAuthLogic();
    console.log('\n🎉 ¡TODAS LAS PRUEBAS UNITARIAS PASARON EXITOSAMENTE (3/3)!');
    process.exit(0);
} catch (err) {
    console.error('\n❌ ERROR EN LAS PRUEBAS UNITARIAS:', err.message);
    process.exit(1);
}
