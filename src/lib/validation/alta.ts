/**
 * Validators for the ATR alta/cambio process.
 * All functions are pure — no side effects, no async, no external deps.
 */

// ─── CUPS ────────────────────────────────────────────────────────────────────
// Official Spanish CUPS standard (REE/UNESA):
//   ES + 16-digit core + 2 control letters (+ optional 1-2 suffix chars).
// Control: the 16-digit core is taken as a decimal number, mod 529, and the
// quotient/remainder of dividing that by 23 index the control table below
// (the same 23-letter table used for DNI control letters).

const CUPS_CONTROL = 'TRWAGMYFPDXBNJZSQVHLCKE'; // 23 chars

// String-based modular arithmetic — avoids BigInt (ES2017 target).
function modN(numStr: string, n: number): number {
    let r = 0;
    for (let i = 0; i < numStr.length; i++) {
        r = (r * 10 + parseInt(numStr[i], 10)) % n;
    }
    return r;
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export function validateCUPS(cups: string): ValidationResult {
    const clean = cups.toUpperCase().replace(/\s/g, '');

    if (!clean.startsWith('ES')) {
        return { valid: false, error: 'El CUPS debe comenzar por ES' };
    }

    // ES + 16-digit core + 2 control letters + optional suffix (border/type: 1 letter + 1 digit)
    if (!/^ES\d{16}[A-Z]{2}([A-Z]\d|[A-Z0-9]{0,2})?$/.test(clean)) {
        return { valid: false, error: 'Formato CUPS inválido (ES + 16 dígitos + 2 letras de control)' };
    }

    const core = clean.slice(2, 18);
    const c1 = clean[18];
    const c2 = clean[19];

    const R = modN(core, 529);
    const idx1 = Math.floor(R / 23);
    const idx2 = R % 23;

    if (c1 !== CUPS_CONTROL[idx1] || c2 !== CUPS_CONTROL[idx2]) {
        return { valid: false, error: `Dígitos de control incorrectos (esperado: ${CUPS_CONTROL[idx1]}${CUPS_CONTROL[idx2]})` };
    }

    return { valid: true };
}

// ─── IBAN ────────────────────────────────────────────────────────────────────
// ISO 13616 — mod 97 after rearranging and converting letters to numbers.

export function validateIBAN(iban: string): ValidationResult {
    const clean = iban.toUpperCase().replace(/\s|-/g, '');

    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(clean)) {
        return { valid: false, error: 'Formato IBAN inválido' };
    }

    const rearranged = clean.slice(4) + clean.slice(0, 4);
    const numStr = rearranged.replace(/[A-Z]/g, c => (c.charCodeAt(0) - 55).toString());

    if (modN(numStr, 97) !== 1) {
        return { valid: false, error: 'IBAN incorrecto (fallo mod-97)' };
    }

    return { valid: true };
}

// ─── DNI ─────────────────────────────────────────────────────────────────────
// 8 digits + 1 check letter (mod 23 table).

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

export function validateDNI(dni: string): ValidationResult {
    const clean = dni.toUpperCase().replace(/\s/g, '');

    if (!/^\d{8}[A-Z]$/.test(clean)) {
        return { valid: false, error: 'Formato DNI inválido (8 dígitos + letra)' };
    }

    const num = parseInt(clean.slice(0, 8), 10);
    const expected = DNI_LETTERS[num % 23];

    if (clean[8] !== expected) {
        return { valid: false, error: `Letra de control incorrecta (esperada: ${expected})` };
    }

    return { valid: true };
}

// ─── NIE ─────────────────────────────────────────────────────────────────────
// X/Y/Z + 7 digits + check letter. Replace first letter with 0/1/2, then DNI logic.

const NIE_PREFIX: Record<string, string> = { X: '0', Y: '1', Z: '2' };

export function validateNIE(nie: string): ValidationResult {
    const clean = nie.toUpperCase().replace(/\s/g, '');

    if (!/^[XYZ]\d{7}[A-Z]$/.test(clean)) {
        return { valid: false, error: 'Formato NIE inválido (X/Y/Z + 7 dígitos + letra)' };
    }

    const substituted = NIE_PREFIX[clean[0]] + clean.slice(1, 8);
    const num = parseInt(substituted, 10);
    const expected = DNI_LETTERS[num % 23];

    if (clean[8] !== expected) {
        return { valid: false, error: `Letra de control incorrecta (esperada: ${expected})` };
    }

    return { valid: true };
}

// ─── CIF ─────────────────────────────────────────────────────────────────────
// Spanish company tax ID. Letter + 7 digits + control (digit or letter).

const CIF_CONTROL_LETTERS = 'JABCDEFGHI';
// These org types always use letter as control
const CIF_LETTER_ONLY = 'PQSW';
// These org types always use digit as control
const CIF_DIGIT_ONLY = 'ABEH';

export function validateCIF(cif: string): ValidationResult {
    const clean = cif.toUpperCase().replace(/\s/g, '');

    if (!/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(clean)) {
        return { valid: false, error: 'Formato CIF inválido' };
    }

    const digits = clean.slice(1, 8);
    let evenSum = 0;
    let oddAcc = 0;

    for (let i = 0; i < 7; i++) {
        const n = parseInt(digits[i], 10);
        if (i % 2 === 0) {
            // odd position (1-based: 1,3,5,7) — double it, then sum digits if ≥ 10
            const doubled = n * 2;
            oddAcc += doubled >= 10 ? doubled - 9 : doubled;
        } else {
            evenSum += n;
        }
    }

    const total = (evenSum + oddAcc) % 10;
    const controlDigit = total === 0 ? 0 : 10 - total;
    const controlLetter = CIF_CONTROL_LETTERS[controlDigit];
    const last = clean[8];
    const orgType = clean[0];

    if (CIF_LETTER_ONLY.includes(orgType)) {
        if (last !== controlLetter)
            return { valid: false, error: `Control CIF incorrecto (esperada letra: ${controlLetter})` };
    } else if (CIF_DIGIT_ONLY.includes(orgType)) {
        if (last !== controlDigit.toString())
            return { valid: false, error: `Control CIF incorrecto (esperado dígito: ${controlDigit})` };
    } else {
        if (last !== controlLetter && last !== controlDigit.toString())
            return { valid: false, error: `Control CIF incorrecto (esperado: ${controlLetter} o ${controlDigit})` };
    }

    return { valid: true };
}

// ─── Composite: NIF (DNI, NIE o CIF) ────────────────────────────────────────

export function validateNIF(nif: string): ValidationResult {
    const clean = nif.toUpperCase().replace(/\s/g, '');

    if (/^\d{8}[A-Z]$/.test(clean)) return validateDNI(clean);
    if (/^[XYZ]\d{7}[A-Z]$/.test(clean)) return validateNIE(clean);
    if (/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(clean)) return validateCIF(clean);

    return { valid: false, error: 'NIF/DNI/NIE/CIF no reconocido' };
}
