# RGPD Runbook — Zinergia

Runbook operativo para cumplimiento RGPD. Cubre cifrado de PII, gestión de
claves, backups, rotación, retención y derecho al olvido.

Este documento está dirigido a **Admin** (`zinergiaconsultora@gmail.com`) y
a los operadores con acceso a la consola de Vercel y Supabase. **No compartir.**

---

## 1. Arquitectura de cifrado PII

### ¿Qué se cifra?

| Campo        | Columna cifrada (AES-GCM) | Blind index (HMAC-SHA-256) | Búsqueda? |
| ------------ | -------------------------- | --------------------------- | --------- |
| CUPS         | `clients.cups_ciphertext`  | `clients.cups_hash`         | Sí (por hash) |
| DNI/NIF/CIF  | `clients.dni_cif_ciphertext` | `clients.dni_cif_hash`    | Sí (por hash) |

- El **ciphertext** es probabilístico: la misma entrada produce cipherstext
  distinto cada vez. Imposible buscar por igualdad sobre la columna cifrada.
- El **hash** es determinista sobre el valor normalizado (mayúsculas, solo
  alfanuméricos). Se usa en `WHERE` para detectar duplicados.
- Ambos dependen de la misma pareja de secretos. **Perder los secretos
  significa perder el acceso a todos los datos de clientes.**

### Formato del ciphertext

```
v1.<iv_b64url>.<tag_b64url>.<ct_b64url>
```

El prefijo `v1.` permite rotar algoritmo/clave en el futuro manteniendo los
antiguos descifrables.

### Módulo de referencia

- Código: [`src/lib/crypto/pii.ts`](../src/lib/crypto/pii.ts)
- Tests: [`src/lib/crypto/__tests__/pii.test.ts`](../src/lib/crypto/__tests__/pii.test.ts)

---

## 2. Generación inicial de claves

```bash
node scripts/generate-encryption-keys.mjs
```

La salida tiene esta forma:

```
APP_ENCRYPTION_KEY=<base64, 32 bytes>
APP_ENCRYPTION_PEPPER=<hex, 32 bytes>
```

### Dónde guardarlas

1. **Vercel** (Production **y** Preview — no dev):
   Dashboard → Project → Settings → Environment Variables.
2. **`.env.local`** de Admin (nunca en git).
3. **Copia de seguridad física**: gestor de contraseñas de Admin
   (1Password / Bitwarden), campo "Notas seguras", etiqueta
   `Zinergia — PII Keys vYYYY-MM-DD`.

### Validación

`src/lib/env.ts` exige ambas variables en `NODE_ENV=production`. Si faltan,
el deploy falla. Test: hacer un preview deploy sin keys y comprobar que
revienta.

---

## 3. Rotación de claves

**Rotar solo si hay sospecha de compromiso.** Una rotación implica
re-cifrar y re-hashear todo el contenido de `clients`, lo cual hoy requiere
una migración custom y downtime de escritura.

### Procedimiento (de urgencia)

1. Declarar ventana de mantenimiento (banner en app).
2. Generar nuevas claves: `node scripts/generate-encryption-keys.mjs`.
3. Actualizar Vercel con las nuevas claves, **pero también** guardar las
   viejas como `APP_ENCRYPTION_KEY_PREV` / `APP_ENCRYPTION_PEPPER_PREV`.
4. Script de rotación (a escribir cuando haga falta):
   - Lee cada `clients` con las viejas claves.
   - Re-cifra con las nuevas.
   - Re-calcula hashes con el nuevo pepper.
   - Escribe en transacción.
5. Verificar `SELECT count(*) WHERE cups_ciphertext IS NOT NULL`.
6. Retirar las env vars `*_PREV`.
7. Actualizar el gestor de contraseñas; archivar las claves viejas con
   etiqueta `retired YYYY-MM-DD`.
8. Registrar rotación en `audit_logs`.

### Nunca

- No publicar las claves en Slack, email, chat de IA, o commits.
- No usar las mismas claves en preview y producción — distintos entornos,
  distintas claves.

---

## 4. Backups

### Supabase (DB)

Los backups automáticos de Supabase contienen los **ciphertexts** y los
**hashes**, pero **no las claves**. Un backup robado sin las claves es
opaco.

- **Retención Supabase (plan Free)**: 7 días de PITR.
- **Exportación manual periódica**: `pg_dump --schema-only` cada vez que
  se cambie el esquema (ya automatizado por la política de migraciones).

### Claves

Copia física en gestor de contraseñas de Admin. Revisar una vez al trimestre
que siguen siendo recuperables.

---

## 5. Retención (RGPD Art. 5.1.e)

Política aprobada para `clients` y tablas relacionadas:

| Estado cliente             | Retención                | Acción tras vencer |
| -------------------------- | ------------------------ | ------------------ |
| Contrato activo            | Mientras dure el contrato | — |
| Contrato finalizado (won)  | 5 años tras terminación  | Purge automatizado |
| Lead perdido / rechazado   | 12 meses                 | Purge automatizado |
| Lead inactivo sin avance   | 12 meses sin actividad   | Purge automatizado |

### Implementación (pendiente — Paso 6)

- Función SQL `purge_expired_clients()` ejecutada como cron Supabase diario.
- Para cada fila a purgar:
  - Escribir registro en `audit_logs` (id cliente, razón, fecha).
  - `DELETE` en cascada sobre las tablas hijas definidas en el baseline.
- Métrica visible en `/admin/ocr-metrics` o panel nuevo RGPD.

---

## 6. Derecho al olvido (RGPD Art. 17)

Procedimiento manual **hasta Paso 6**:

1. Admin recibe solicitud verificada del titular.
2. Buscar por `hashDni(dni_cliente)` en `clients`.
3. Ejecutar script `scripts/delete-client.mjs <client_id>` (pendiente):
   - Marca fila en `audit_logs` con motivo `rgpd_deletion`.
   - Borra filas dependientes (proposals, offers, notes…).
   - Borra fila principal.
4. Notificar por email al titular con fecha de ejecución.
5. Conservar el log de auditoría 5 años (obligación legal).

---

## 7. Qué hacer si...

### …se filtra el `APP_ENCRYPTION_KEY`

1. Rotar inmediatamente (sección 3).
2. Auditar accesos a `clients` en las últimas 24 h.
3. Notificar a AEPD en 72 h si hay impacto plausible sobre los afectados.

### …se filtra el `APP_ENCRYPTION_PEPPER`

Menor gravedad (no permite descifrar), pero permite a un atacante con un
diccionario de DNIs/CUPS validar presencia. Rotar en la siguiente ventana
de mantenimiento planificada.

### …un backup se escapa

Mientras las claves sigan seguras, el ciphertext es inútil. Aún así,
revisar logs y notificar si hay metadatos sensibles sin cifrar (nombres,
emails, importes) en el backup afectado.

---

## 8. TODO pendientes (no bloquean Paso 2A)

- [ ] Script `scripts/backfill-pii-encryption.mjs` (Paso 2B).
- [ ] Script `scripts/delete-client.mjs` (Paso 6).
- [ ] Cron `purge_expired_clients()` SQL (Paso 6).
- [ ] Panel `/admin/rgpd` con: pendientes de purgar, últimas eliminaciones,
      rotaciones de claves, alertas de retención (Paso 6).
- [ ] Cifrado de `clients.nombre`, `clients.email`, `clients.direccion`:
      decisión diferida. Por coste/beneficio y porque el email es identifier
      operativo, de momento no se cifran. Reevaluar si se añade un
      procesador externo no RGPD-conforme.
