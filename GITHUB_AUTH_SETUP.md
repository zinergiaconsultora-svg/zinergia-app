# GitHub Push Authentication Setup

## Problema
El usuario `juan49ers-spec` no tiene permisos para hacer push al repositorio `zinergiaconsultora-svg/zinergia-app`.

## Solución 1: Usar Personal Access Token (Recomendado)

### Paso 1: Crear un Personal Access Token en GitHub
1. Ve a: https://github.com/settings/tokens
2. Click en "Generate new token" → "Generate new token (classic)"
3. Configura el token:
   - Name: "Zinergia Deploy"
   - Expiration: 90 days
   - Scopes: Selecciona `repo` (Full control of private repositories)
4. Click en "Generate token"
5. **IMPORTANTE**: Copia el token (solo se muestra una vez)

### Paso 2: Usar el Token para Push
Opción A - Cambiar la URL del remoto (temporal):
```bash
git remote set-url origin https://YOUR_TOKEN@github.com/zinergiaconsultora-svg/zinergia-app.git
git push origin main
```

Opción B - Usar el token como contraseña:
```bash
git push origin main
# Cuando pida usuario: usa tu email
# Cuando pida contraseña: pega el token (NO tu contraseña de GitHub)
```

## Solución 2: Cambiar Usuario de Git (si tienes permisos con otra cuenta)

Si tienes otra cuenta de GitHub con permisos:
```bash
git config user.name "Tu Nombre"
git config user.email "tu-email@example.com"
git push origin main
```

## Solución 3: Usar GitHub CLI

Si tienes GitHub CLI instalado:
```bash
gh auth login
git push origin main
```

## Solución 4: Pedir Acceso al Repositorio

Contacta al administrador del repositorio para que te agregue como colaborador con permisos de escritura.

## Verificar Permisos Actuales

1. Visita: https://github.com/zinergiaconsultora-svg/zinergia-app/settings/access
2. Verifica si tu usuario está en la lista de colaboradores
3. Si no está, solicita acceso

## Recomendación Inmediata

Usa la **Solución 1** con el Personal Access Token. Es la forma más rápida de resolver el problema sin cambiar configuraciones de sistema.

Después de usar el token, puedes volver a la URL original:
```bash
git remote set-url origin https://github.com/zinergiaconsultora-svg/zinergia-app.git
```
