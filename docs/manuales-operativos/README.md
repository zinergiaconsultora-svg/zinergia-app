# Manuales operativos y documentación contractual

Documentación de operación de Zinergia: cómo se usa la aplicación, qué firma cada parte y con qué reglas se paga.

> `docs/` estuvo en el `.gitignore` hasta el 05/08/2026, lo que hacía que los archivos
> nuevos no se versionaran nunca. Ya está corregido: cualquier documento añadido aquí se
> guarda en el repositorio con normalidad.

---

## Documentos

| Documento | Para quién | Estado |
|---|---|---|
| [Guía del Administrador](./guia-administrador.md) | El técnico que lleva altas, facturas y propuestas | Completa · faltan 9 capturas |
| [Guía del Colaborador](./guia-colaborador.md) | Comerciales de la red | Completa · faltan 8 capturas |
| [DocuSeal — instalación y uso](./docuseal-guia-instalacion-uso.md) | Quien gestione las firmas | Completa · instalación local funcionando |
| [Política de Decomisiones](./politica-decomisiones-PLANTILLA.md) | Anexo II del contrato | **Plantilla** · faltan valores por comercializadora |
| [Contrato de colaborador — revisión](./contrato-colaborador-revision-y-anexos.md) | El abogado | Completa · 6 observaciones |

## Capturas

Las guías marcan cada imagen con `[CAPTURA n]` y llevan al final una tabla con la ruta exacta y qué encuadrar. Se hacen con Win+Mayús+S desde la aplicación en producción; la del colaborador requiere iniciar sesión con una cuenta de colaborador.

## Pendiente de decisión de negocio

| # | Decisión | Bloquea |
|---|---|---|
| 1 | Antigüedad máxima de factura: **2 meses (contrato actual) o 6 (recomendado)** | Que contrato, guías y validación de la app digan lo mismo |
| 2 | Valores de decomisión por comercializadora | Publicar el Anexo II y cargar `commission_decommission_policies` |
| 3 | Importes de comisión de GANA PYME | Reactivar las 2 tarifas desactivadas |
| 4 | Tratamiento de servicios de ajuste por tarifa | Que el comparador deje de avisar de "no configurado" |
| 5 | Precio de compensación de excedentes | Comparar correctamente clientes con autoconsumo |
| 6 | Revisión legal del contrato y sus anexos | Dar de alta colaboradores con contrato firmado |
| 7 | Redacción del paquete de cliente del RD 88/2026 | Vender a residencial y autónomos conforme a la norma |

## Contexto normativo

El **[RD 88/2026, de 11 de febrero](https://www.boe.es/buscar/act.php?id=BOE-A-2026-3212)** exige poder **acreditar cada fase del consentimiento** del cliente, no solo haberle informado. Para residencial y autónomos eso se traduce en un paquete de tres documentos firmados antes de tramitar el alta (consentimiento expreso, contrato de asesoramiento energético y política de privacidad), con certificado de evidencias archivado.

Está detallado en la [revisión del contrato](./contrato-colaborador-revision-y-anexos.md), sección 8.
