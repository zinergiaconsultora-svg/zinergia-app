#!/usr/bin/env node
/**
 * Genera las capturas de pantalla de los manuales operativos.
 *
 * Uso:
 *   node scripts/capturas/generar-capturas.mjs            (admin y colaborador)
 *   node scripts/capturas/generar-capturas.mjs admin
 *   node scripts/capturas/generar-capturas.mjs colaborador
 *
 * Va contra **staging**, no contra producción: las credenciales y la URL salen de
 * `.env.staging.local`, el mismo fichero que usa Playwright, y ese fichero existe
 * precisamente para que las pruebas no toquen datos reales. Las imágenes de un
 * manual que va a circular no deberían llevar clientes de verdad dentro.
 *
 * El script solo navega y fotografía. No crea, edita ni borra nada.
 */

import { chromium } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

loadEnv({ path: '.env.staging.local' });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
const OUT_DIR = path.join('docs', 'manuales-operativos', 'img');
const VIEWPORT = { width: 1280, height: 900 };

if (!BASE_URL) {
    console.error('\n  Falta PLAYWRIGHT_BASE_URL en .env.staging.local\n');
    process.exit(1);
}

const perfil = (process.argv[2] ?? 'todo').toLowerCase();

function say(line = '') {
    process.stdout.write(`${line}\n`);
}

/**
 * Difumina lo que parezca un dato personal antes de fotografiar.
 *
 * Staging es un entorno de pruebas, pero nada garantiza que no haya entrado
 * nunca un dato real, y estas imágenes se reparten. Difuminar por patrón es
 * barato; retirar una guía ya distribuida, no.
 */
async function difuminarDatosPersonales(page) {
    await page.addStyleTag({
        content: '.zin-oculto{filter:blur(5px);-webkit-filter:blur(5px);}',
    });
    await page.evaluate(() => {
        const patrones = [
            /[\w.+-]+@[\w-]+\.[\w.]+/g,                    // correo
            /ES\d{4}[A-Z0-9]{14,18}/gi,                    // CUPS
            /\b\d{8}[A-Z]\b/gi,                            // DNI
            /\bES\d{2}[\s]?[\d\s]{14,20}\b/g,              // IBAN
        ];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const objetivos = [];
        let nodo;
        while ((nodo = walker.nextNode())) {
            const texto = nodo.nodeValue ?? '';
            if (patrones.some(p => { p.lastIndex = 0; return p.test(texto); })) {
                objetivos.push(nodo);
            }
        }
        for (const n of objetivos) {
            const padre = n.parentElement;
            if (padre && !padre.classList.contains('zin-oculto')) {
                padre.classList.add('zin-oculto');
            }
        }
    });
}

/**
 * Una captura de una página de error se ve igual de "correcta" en el registro que
 * una buena: el fichero se escribe y no falla nada. La primera tanda produjo doce
 * PNG de páginas 404 con un ✓ al lado de cada una. Comprobar la página antes de
 * guardarla es lo que separa "he sacado la foto" de "la foto sirve".
 */
async function paginaUtil(page) {
    const texto = (await page.innerText('body').catch(() => '')).replace(/\s+/g, ' ');
    if (/404|Página no encontrada/i.test(texto)) return 'la página devuelve 404';
    if (/Introduce tus credenciales|Iniciar Sesión/i.test(texto)) return 'ha caído en la pantalla de acceso';
    if (texto.trim().length < 40) return 'la página está vacía';
    return null;
}

async function capturar(page, nombre, { difuminar = true } = {}) {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(700);

    const problema = await paginaUtil(page);
    if (problema) {
        say(`   ✗ ${nombre}: ${problema} — no se guarda`);
        return false;
    }

    if (difuminar) await difuminarDatosPersonales(page);
    await page.screenshot({ path: path.join(OUT_DIR, `${nombre}.png`), fullPage: false });
    say(`   ✓ ${nombre}.png`);
    return true;
}

/**
 * Next compila cada ruta la primera vez que se pide, y en desarrollo eso puede
 * pasar del minuto. Un fallo aislado no debe tumbar la tanda: se anota y se sigue,
 * porque volver a empezar significa recompilarlo todo otra vez.
 */
async function ir(page, ruta) {
    try {
        await page.goto(`${BASE_URL}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
        return true;
    } catch {
        say(`   ✗ no se pudo abrir ${ruta}`);
        return false;
    }
}

async function paso(nombre, fn) {
    try {
        await fn();
    } catch (error) {
        const mensaje = error instanceof Error ? error.message.split('\n')[0] : String(error);
        say(`   ✗ ${nombre}: ${mensaje}`);
    }
}

async function iniciarSesion(page, email, password) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/contraseña|password/i).fill(password);
    await page.getByRole('button', { name: /entrar|iniciar|sign in|login/i }).click();
    await page.waitForURL(/\/(admin|dashboard)/, { timeout: 60_000 });
}

async function capturasAdmin(browser) {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) {
        say('   · Sin credenciales de admin en .env.staging.local — me lo salto.');
        return;
    }

    const context = await browser.newContext({ viewport: VIEWPORT, locale: 'es-ES' });
    context.setDefaultTimeout(60_000);
    const page = await context.newPage();
    await iniciarSesion(page, email, password);

    await paso('panel Hoy', async () => {
        if (await ir(page, '/admin')) await capturar(page, '02-panel-hoy');
    });

    await paso('personas', async () => {
        if (!await ir(page, '/admin/agents')) return;
        await capturar(page, '01-admin-sin-franquicia');
        await capturar(page, '04-fila-colaborador');
    });

    // Se abre y se cierra con Cancelar: no se guarda ningún cambio.
    await paso('cambiar autoridad', async () => {
        // El botón se identifica por su etiqueta accesible, "Cambiar autoridad de
        // <nombre>". Buscarlo por "el último botón con un icono" dependía del orden
        // de la tabla y fallaba en silencio.
        await page.getByRole('button', { name: /Cambiar autoridad de/i }).first().click({ timeout: 20_000 });
        await page.getByRole('heading', { name: /Cambiar autoridad/i }).waitFor({ timeout: 15_000 });
        await capturar(page, '05-cambiar-autoridad');
        await page.getByRole('button', { name: /^Cancelar$/i }).click();
    });

    await paso('estructura comercial', async () => {
        await page.getByText(/Estructura comercial/i).first().click();
        await page.waitForTimeout(2000);
        await capturar(page, '03-invitar-red');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await capturar(page, '09-organigrama');
    });

    await paso('observabilidad OCR', async () => {
        if (await ir(page, '/admin/ocr')) await capturar(page, '06-observabilidad-ocr');
    });

    await paso('tarifas', async () => {
        if (await ir(page, '/dashboard/tariffs')) await capturar(page, '07-tarifas');
    });

    await paso('comisiones', async () => {
        if (await ir(page, '/admin/commissions')) await capturar(page, '08-comisiones');
    });

    await context.close();
}

async function capturasColaborador(browser) {
    const email = process.env.E2E_AGENT_EMAIL;
    const password = process.env.E2E_AGENT_PASSWORD;
    if (!email || !password) {
        say('   · Sin credenciales de colaborador en .env.staging.local — me lo salto.');
        return;
    }

    const context = await browser.newContext({ viewport: VIEWPORT, locale: 'es-ES' });
    context.setDefaultTimeout(60_000);
    const page = await context.newPage();
    await iniciarSesion(page, email, password);

    const pantallas = [
        ['c1-navegacion', '/dashboard'],
        ['c2-subir-factura', '/dashboard/simulator'],
        ['c5-propuestas', '/dashboard/proposals'],
        ['c6-clientes', '/dashboard/clients'],
        ['c7-comisiones', '/dashboard/commissions'],
        ['c8-datos-fiscales', '/dashboard/settings'],
    ];

    for (const [nombre, ruta] of pantallas) {
        await paso(nombre, async () => {
            if (await ir(page, ruta)) await capturar(page, nombre);
        });
    }

    await context.close();
}

mkdirSync(OUT_DIR, { recursive: true });

say('');
say(`  Capturando desde ${BASE_URL}`);
say(`  Destino: ${OUT_DIR}`);
say('');

const browser = await chromium.launch();

try {
    if (perfil === 'todo' || perfil === 'admin') {
        say('  Perfil administrador:');
        await capturasAdmin(browser);
        say('');
    }
    if (perfil === 'todo' || perfil === 'colaborador') {
        say('  Perfil colaborador:');
        await capturasColaborador(browser);
        say('');
    }
} finally {
    await browser.close();
}

say('  Listo.');
say('');
