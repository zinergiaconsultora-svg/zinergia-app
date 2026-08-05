# Google Drive — Setup y runbook (archivo de facturas)

Archiva cada factura en el Google Drive de `zinergiaconsultora@gmail.com` mediante
OAuth con **refresh token** y scope **estricto `drive.file`** (no sensible → sin
verificación de Google, el token no caduca mientras la app esté "In production").

> Dirigido a **Admin**. Contiene credenciales sensibles. **No compartir.**

---

## 1. Crear el cliente OAuth en Google Cloud

1. [console.cloud.google.com](https://console.cloud.google.com) → crear proyecto
   `zinergia-drive` (o reutilizar uno).
2. **APIs & Services → Library →** habilitar **Google Drive API**.
3. **OAuth consent screen:**
   - User type: **External**.
   - Rellenar nombre de app, email de soporte y de contacto.
   - **Scopes:** añadir únicamente `https://www.googleapis.com/auth/drive.file`.
   - **Publicar la app** (botón "Publish app" → estado **In production**).
     Esto evita la caducidad del refresh token a los 7 días del modo Testing.
     Como `drive.file` NO es sensible, **no requiere verificación** de Google.
4. **Credentials → Create credentials → OAuth client ID:**
   - Tipo **Desktop app** (más simple para el script de generación).
   - Guardar **Client ID** y **Client secret**.

## 2. Generar el refresh token (one-time, local)

Inicia sesión **con `zinergiaconsultora@gmail.com`** al autorizar.

```bash
node scripts/google-drive-auth.mjs
# Abre la URL que imprime, autoriza con zinergiaconsultora@gmail.com,
# pega el code de vuelta. Imprime el refresh_token.
```

> El script `scripts/google-drive-auth.mjs` se entrega en la Fase 1. Usa el
> flujo OAuth `urn:ietf:wg:oauth:2.0:oob` / loopback con `access_type=offline`
> y `prompt=consent` para forzar la emisión del refresh token.

## 3. Carpeta raíz en Drive

1. Con la cuenta `zinergiaconsultora@gmail.com`, crear en "Mi unidad" la carpeta
   **`Facturas Zinergia`**.
2. Abrirla y copiar el `folderId` de la URL
   (`drive.google.com/drive/folders/<FOLDER_ID>`).

> ⚠️ **Regla operativa:** con scope `drive.file` la app solo ve los archivos que
> ella misma crea. **No reorganices ni muevas a mano** el contenido de
> `Facturas Zinergia`: la estructura (**una carpeta por comercial**, nombrada con
> su nombre, con las facturas que sube) la gestiona la app. Mover archivos a mano
> hace que la app pierda su rastro.

## 4. Endurecer la cuenta (single point of failure)

Toda la operativa cuelga de esta cuenta Gmail:

- Activar **verificación en 2 pasos (2FA)**.
- Configurar **email y teléfono de recuperación**.
- Guardar las credenciales en el gestor de secretos del equipo, no en texto plano.

## 5. Variables de entorno

En Vercel (Production **y** Preview) y en `.env.local` de Admin:

```
GOOGLE_DRIVE_CLIENT_ID=<client id>.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=<client secret>
GOOGLE_DRIVE_ROOT_FOLDER_ID=<folder id de "Facturas Zinergia">
```

El **refresh token NO va en env.** Se guarda cifrado en la tabla
`integration_credentials` (AES-256-GCM con `APP_ENCRYPTION_KEY`). Cárgalo con la
acción de servidor de re-conexión (Fase 1) o el seed inicial.

## 6. Rotación / reconexión

Si la app marca la integración como `degraded` (error `invalid_grant`):

1. El refresh token fue revocado (cambio de contraseña, revisión de seguridad de
   Google, o exceso de tokens emitidos).
2. Repetir el **paso 2** para generar un token nuevo.
3. Guardarlo con la acción de re-conexión → vuelve a `active` sin redeploy.

## 7. Límite de cuota

Gmail de consumo comparte **15 GB** entre correo, Drive y Fotos. La app alerta al
admin al **80%**. Para crecer sin límite práctico, migrar la cuenta a **Google
Workspace** (habilita Unidades compartidas + Service Account + DPA con Google).

## 8. Nota legal (RGPD)

Las facturas contienen PII (titular, DNI, CUPS, dirección). Con Gmail de consumo
**no hay Acuerdo de Encargado de Tratamiento (DPA) con Google**. Mitigaciones
aplicadas por la app: nombres de fichero **sin PII**, auditoría de subidas/borrados
y **cascada de supresión** (borrar de Drive al ejercer el derecho al olvido).
Recomendación formal: migrar a **Google Workspace EU** a medio plazo.
Ver `docs/rgpd-runbook.md`.
