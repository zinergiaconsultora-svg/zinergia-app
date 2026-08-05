#!/usr/bin/env node
/**
 * One-time helper to mint a Google Drive refresh token for the factura archiver.
 *
 * Flow (loopback / "Desktop app" OAuth client):
 *   1. Starts a temporary local server on http://localhost:53682.
 *   2. Opens the Google consent screen — log in with zinergiaconsultora@gmail.com.
 *   3. Captures the authorization code on the redirect.
 *   4. Exchanges it for a refresh token and prints it.
 *
 * The token is then stored ENCRYPTED via the app's saveDriveRefreshToken() (or
 * the re-connect server action), never in plain env. Scope is strictly drive.file.
 *
 * Usage:
 *   GOOGLE_DRIVE_CLIENT_ID=... GOOGLE_DRIVE_CLIENT_SECRET=... node scripts/google-drive-auth.mjs
 */

import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Missing GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET in the environment.');
    process.exit(1);
}

const state = randomBytes(16).toString('hex');
const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPE,
        access_type: 'offline',
        prompt: 'consent', // force refresh_token issuance every run
        state,
    }).toString();

function openBrowser(url) {
    const cmd =
        process.platform === 'win32' ? `start "" "${url}"`
        : process.platform === 'darwin' ? `open "${url}"`
        : `xdg-open "${url}"`;
    exec(cmd, () => undefined);
}

async function exchangeCode(code) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
        }),
    });
    return res.json();
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, REDIRECT_URI);
    if (!url.searchParams.get('code')) {
        res.writeHead(400).end('Missing code');
        return;
    }
    if (url.searchParams.get('state') !== state) {
        res.writeHead(400).end('State mismatch — aborting for safety.');
        server.close();
        process.exit(1);
    }

    const tokens = await exchangeCode(url.searchParams.get('code'));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(
        '<h2>✅ Listo. Puedes cerrar esta pestaña y volver a la terminal.</h2>',
    );

    if (tokens.refresh_token) {
        console.log('\n────────────────────────────────────────────');
        console.log('REFRESH TOKEN (guárdalo cifrado, no en .env):\n');
        console.log(tokens.refresh_token);
        console.log('\n────────────────────────────────────────────');
    } else {
        console.error('\n⚠️ No se recibió refresh_token. Respuesta:', tokens);
        console.error('Revoca el acceso previo en https://myaccount.google.com/permissions y repite.');
    }
    server.close();
    process.exit(tokens.refresh_token ? 0 : 1);
});

server.listen(PORT, () => {
    console.log(`\nAbriendo el consentimiento de Google. Inicia sesión con zinergiaconsultora@gmail.com.`);
    console.log(`Si no se abre solo, visita:\n${authUrl}\n`);
    openBrowser(authUrl);
});
