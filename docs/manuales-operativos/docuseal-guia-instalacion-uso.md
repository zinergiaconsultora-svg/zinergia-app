# DocuSeal — guía de uso paso a paso (instalación gratuita)

**Estado:** instalado y funcionando en tu ordenador · 2026-08-05
**Acceso:** http://localhost:3000

---

## Qué tienes instalado

| | |
|---|---|
| Dónde corre | Contenedor Docker `docuseal` en tu PC |
| URL | `http://localhost:3000` |
| Datos | Volumen Docker `docuseal_data` (sobrevive a reinicios) |
| Arranque | Automático al iniciar Docker Desktop (`--restart unless-stopped`) |
| Coste | 0 € (versión open source, licencia AGPL) |

**Qué incluye la versión gratuita:** constructor de plantillas sobre PDF, 12 tipos de campo, varios firmantes por documento, firma en 14 idiomas, PDF firmado y verificable, registro de evidencias, API y webhooks.

**Qué NO incluye (es de pago):** formularios embebidos dentro de tu app, marca blanca (el firmante ve "DocuSeal" en la página), verificación por SMS, campos condicionales.

---

## PASO 1 — Crear tu cuenta de administrador (2 minutos, solo la primera vez)

1. Abre el navegador y entra en **http://localhost:3000**
2. Verás la pantalla de configuración inicial: introduce tu **nombre, email y una contraseña**
3. Pulsa crear cuenta → entras al panel de DocuSeal

> Esa cuenta es el administrador del DocuSeal. Guarda la contraseña donde guardes las demás.

## PASO 2 — Configurar el idioma y (opcional) el correo

1. Arriba a la derecha → icono de ajustes (**Settings**)
2. En **Account** puedes poner el nombre "Zinergia" y el idioma **Español**
3. **Email (SMTP)** — importante entenderlo:
   - **Sin configurar SMTP**, DocuSeal no puede enviar emails. No pasa nada para empezar: cada envío genera un **enlace de firma que puedes copiar** y mandar tú por WhatsApp/email.
   - **Si quieres que DocuSeal envíe los emails él solo**: Settings → **SMTP** y mete los datos de tu correo (por ejemplo, con Gmail: servidor `smtp.gmail.com`, puerto `587`, tu email, y una "contraseña de aplicación" generada en tu cuenta de Google).

## PASO 3 — Crear tu primera plantilla: el contrato de colaboración

1. En el panel, pulsa **"New Template" / "Nueva plantilla"**
2. **Sube el contrato en PDF** (exporta el Word a PDF primero: Archivo → Guardar como → PDF)
3. Se abre el editor visual. A la derecha tienes los tipos de campo; **arrástralos** sobre el documento:
   - **Texto** → sobre los huecos de [NOMBRE Y APELLIDOS], [DNI], [Dirección]
   - **Fecha** → sobre el hueco de la fecha
   - **Firma** → en el recuadro "POR EL COLABORADOR"
4. Cada campo pertenece a un **firmante** ("First Party", "Second Party"…). Configura dos:
   - **Empresa** (tú) — tu firma
   - **Colaborador** — sus datos y su firma
5. Pulsa **Save**

> Truco: si en el Word escribes etiquetas como `{{Nombre}}`, `{{DNI}}`, `{{Firma}}`, DocuSeal puede crear los campos solo. Para 2-3 plantillas, arrastrarlos a mano es igual de rápido.

## PASO 4 — Enviar el contrato a firmar

1. Abre la plantilla → **"Send" / "Enviar"**
2. Escribe el **nombre y email del colaborador**
3. (Opcional) Rellena tú de antemano los campos que ya conoces — nombre, DNI — para que él solo tenga que firmar
4. Dos formas de hacérselo llegar:
   - **Con SMTP configurado**: DocuSeal le envía el email automáticamente
   - **Sin SMTP**: pulsa **"Copy link"** y pásale el enlace por donde quieras
5. El colaborador abre el enlace, rellena lo que falte y **firma con el dedo o el ratón** (igual que el flujo de Energilandia que viste en su manual)

## PASO 5 — Recoger el resultado

Cuando firme, en el panel el envío pasa a **Completed**:

- **PDF firmado** descargable, con las firmas incrustadas
- **Audit Log / registro de evidencias**: quién firmó, cuándo, desde qué IP — el equivalente al "Certificado de evidencias de firma" de Energilandia
- Guarda ambos en el expediente del colaborador (más adelante lo automatizamos hacia la app vía webhook)

---

## Las 3 plantillas que te recomiendo crear (en este orden)

1. **Contrato de colaboración** — cuando el abogado devuelva la versión corregida
2. **Pack cliente RD 88/2026** (los 3 documentos, como Energilandia): consentimiento expreso para oferta personalizada + contrato de asesoramiento energético + política de privacidad. *Los textos hay que redactarlos con tu abogado — la estructura ya la tenemos de su manual.*
3. **Consentimiento SIPS** — para cuando se active el SIPS; la app ya tiene preparada la fuente "documento firmado"

---

## Límite importante de esta instalación (léelo)

**Esto corre en TU ordenador.** Sirve perfectamente para: crear las plantillas, probar el flujo completo tú mismo, y firmar cosas con alguien que esté contigo.

**Un firmante externo NO puede abrir un enlace `localhost`.** El día que empieces a mandar contratos de verdad, hay que mover DocuSeal a un servidor público:

- **Railway / Render** (~5-10 €/mes): se despliega la misma imagen Docker en unos minutos, con dominio propio (p. ej. `firmas.zinergia.es`) y HTTPS
- Los datos migran copiando el volumen `docuseal_data`
- Ese día decidimos también si interesa el plan de pago (embebido + marca blanca + SMS)

**Avísame cuando llegue ese momento y lo monto yo.**

---

## Comandos útiles (por si algo falla)

```bash
docker ps --filter name=docuseal        # ¿está corriendo?
docker restart docuseal                 # reiniciar
docker logs docuseal --tail 50          # ver errores
docker run --rm -v docuseal_data:/data -v "%cd%":/backup alpine tar czf /backup/docuseal-backup.tgz /data   # copia de seguridad
```

Si el PC se reinicia, DocuSeal arranca solo cuando arranque Docker Desktop.
