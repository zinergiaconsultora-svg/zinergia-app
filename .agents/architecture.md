# Memoria Muscular Arquitectónica (Architecture State)

Este documento contiene las Reglas Inmutables y Pilares Tecnológicos del proyecto. 
Todo agente (Antigravity u OpenCode) DEBE revisar y obedecer este archivo antes de modificar el código.

## 1. Stack Tecnológico
- Frontend/Backend: [COMPLETAR]
- Estilos: [COMPLETAR]
- Base de Datos: [COMPLETAR]

## 2. Reglas Estructurales Mínimas
1. **Inmutabilidad:** Los datos que fluyen entre módulos son inmutables.
2. **Separación de Responsabilidades (SoC):** La UI no llama a la BD directamente.
3. **Manejo de Errores:** Try/catch en capas. Capturar e informar con contexto.
4. **Early Returns:** Cero `else` si es posible. Validar fallos primero.
5. **Componentización:** Limitar a 200 líneas. Extraer si se usa >2 veces.

## 3. Comandos de Auto-Curación
Comando estándar de validación del proyecto (Lint & Test):
- Ejecutar: `npm run lint` o `npx tsc --noEmit`
*(OpenCode debe auto-ejecutarlos localmente tras generar código para auto-curarse).*
