# Estado y pendientes

**Actualizado:** 2026-08-06

> ## Modelo nuevo: en producción desde el 06/08/2026
>
> Un administrador y colaboradores. Cada colaborador con **su propio porcentaje**
> de comisión, más un **extra en euros** opcional por operación. Se pueden **dar de
> baja y reactivar**, y ya **no necesitan franquicia**.
>
> Aplicado y verificado desde fuera: el administrador sigue canónico (12 de 12
> comprobaciones), las funciones de comisión rechazan a quien no es
> administración, y la caché del SIPS caduca a 7 días.
>
> **Lo que queda de la simplificación** son las fases 3, 4 y 5 del
> [plan](./plan-simplificar-modelo.md): quitar la franquicia de las pantallas,
> colgar a los colaboradores del administrador, y retirar el rol. Ninguna urge:
> las franquicias ya no molestan a nadie.
>
> **Para comprobar producción en cualquier momento:**
> ```bash
> powershell -ExecutionPolicy Bypass -File supabase/scripts/profile_authority_contract_gate.ps1 -ConfirmProduction
> node scripts/produccion/verificar-modelo.mjs
> ```

Qué está hecho, qué falta, y quién puede desbloquear cada cosa. Si vuelves a esto después de un tiempo, empieza por aquí.

---

## Bloquea a Zinergia, no al código

Esto es lo que separa a la aplicación de operar de verdad. **Nada de esto lo puede resolver el desarrollo**: son datos y decisiones de negocio.

| # | Qué falta | De dónde sale | Qué desbloquea |
|---|---|---|---|
| 1 | **Valores de decomisión** por comercializadora: días de aguante, cuánto se devuelve y desde cuándo se cuenta | Contratos con LOGOS, Plenitude, NATURGY y GANA | Que la app sepa qué comisiones le pueden retirar. **Hoy no hay ninguna regla configurada.** La herramienta de carga ya está lista: rellenar `scripts/decomisiones/plantilla-decomisiones.csv` y ejecutar `npm run decomisiones` |
| 2 | **Revisión letrada** del contrato v2.1 y sus anexos | Abogado | Dar de alta colaboradores con contrato firmado. Lo urgente: si es contrato de agencia (Ley 12/1992) y los textos del RD 88/2026 |
| 3 | **Textos del paquete de cliente** del RD 88/2026: consentimiento expreso, contrato de asesoramiento energético y política de privacidad | Abogado | Vender a residencial y autónomos conforme a la norma. **Es obligación legal, no una mejora** |
| 4 | **Comisiones de GANA PYME** | Contrato con GANA | Reactivar las 2 tarifas desactivadas a propósito |
| 5 | **Servicios de ajuste** por tarifa: incluido en el precio, facturado aparte o con techo | Anexos de cada comercializadora | Que el comparador deje de avisar de "tratamiento no configurado" |
| 6 | **Precio de compensación de excedentes** | Anexos de cada comercializadora | Comparar bien a clientes con autoconsumo. Hoy está a 0 en todo el catálogo |

---

## Trabajo técnico pendiente

| Qué | Por qué | Estado |
|---|---|---|
| ~~Caché SIPS a producción~~ | | ✅ aplicado el 06/08 |
| **Fases 3, 4 y 5** de la simplificación | Quitar la franquicia de las pantallas, colgar a los colaboradores del administrador, retirar el rol | Pendiente, sin urgencia |
| **La comisión al invitar** | Hoy se pone cuando configuras a la persona, no en la propia invitación. Meterla ahí toca la provisión de perfiles, que es maquinaria delicada | Pendiente, decisión de producto |
| **Validación de antigüedad de factura (3 meses)** | Decidido y escrito en contrato y guías, pero **la app no lo comprueba** | Más barata de lo documentado al principio: la fecha **ya viene extraída** por el OCR (el control de duplicados la usa); falta solo la comprobación |
| **DocuSeal en un servidor público** | Está instalado en local, con el contrato de colaboración subido. Un firmante externo no puede abrir un enlace `localhost` | ~5-10 €/mes en Railway o Render, más la integración por API |
| **Etiqueta "Franquicias activas"** | Cuenta personas con rol de franquicia, no franquicias. Marca 0 aunque exista Zinergia Central | Cambio de una línea |
| **Vocabulario "AGENTE" vs "Colaborador"** | La misma persona aparece con dos nombres según la pantalla | Cosmético, pero confunde al leer la guía |
| **UUID en el diálogo de autoridad** | Los recuadros ACTUAL y PROPUESTA muestran identificadores largos donde los desplegables muestran nombres | Cosmético |
| **Capturas de los pasos 3 y 4** de la guía del colaborador | Confirmar lo leído por OCR, y la comparativa. Solo existen con una factura real en curso | Necesita una factura de prueba en staging |

---

## Cómo se aplican migraciones

Aprendido a base de tropezar: **`db push` aplica los ficheros del disco, no los que hay en GitHub.** Antes de aplicar, siempre:

```bash
git checkout main
git pull
```

Y luego, para staging:

```bash
powershell -ExecutionPolicy Bypass -File scripts/profile-authority/verify-staging-migrations.ps1 -Apply
```

Sin `-Apply` solo simula. El script se niega a ejecutarse si detecta el proyecto de producción.

---

## Herramientas que dejamos hechas

| Comando | Para qué |
|---|---|
| `npm run decomisiones fichero.csv` | Carga políticas de decomisión. Sin `--aplicar` solo comprueba y avisa en qué línea falla |
| `node scripts/capturas/generar-capturas.mjs` | Regenera las capturas de los manuales desde staging. Necesita el servidor de staging encendido (`npm run dev:staging`) |
| `node scripts/staging/comparar-esquema.mjs` | Qué tablas y funciones espera el código y le faltan a staging |
| `node scripts/staging/diagnosticar-perfiles.mjs` | Si los usuarios de prueba existen y con qué autoridad |
| `node scripts/staging/comprobar-cache-sips.mjs` | Si la caducidad de 7 días de la caché SIPS está aplicada |
| `python scripts/generar-contrato-colaboracion.py salida.docx` | Regenera el contrato de colaboración |

---

## Documentos

- [Guía del Administrador](./guia-administrador.md) — con capturas
- [Guía del Colaborador](./guia-colaborador.md) — con capturas y glosario
- [DocuSeal: instalación y uso](./docuseal-guia-instalacion-uso.md)
- [Política de Decomisiones](./politica-decomisiones-PLANTILLA.md) — plantilla, pendiente de valores
- [Revisión del contrato](./contrato-colaborador-revision-y-anexos.md) — para el abogado
