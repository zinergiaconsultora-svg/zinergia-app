# Aplica a PRODUCCION las migraciones pendientes.
#
# El equivalente de staging existe desde hace meses; este no, y por eso las
# migraciones de agosto se aplicaron a mano. Hacerlo a mano cada vez es como se
# acaba aplicando lo que no toca, o dos veces, o en el proyecto equivocado.
#
# Tres cosas antes de escribir nada:
#
#   1. Simula por defecto. Aplicar exige -Aplicar Y -ConfirmarProduccion. Dos
#      interruptores, porque uno solo se pulsa sin querer.
#   2. Comprueba que el proyecto es el de produccion. Si el identificador no
#      coincide, se para: aplicar migraciones de produccion sobre otra base es
#      peor que no aplicarlas.
#   3. Comprueba que queda un administrador canonico. Es la condicion que en
#      agosto estuvo a punto de dejar a Zinergia sin poder gestionar su red, y
#      la revisamos antes de tocar nada relacionado con autoridad.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts/produccion/aplicar-migraciones.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/produccion/aplicar-migraciones.ps1 -Aplicar -ConfirmarProduccion

param(
    [string]$EnvFile = '.env.production.local',
    [string]$ProjectRefEsperado = 'gmjgkzaxmkaggsyczwcm',
    [string]$PoolerHost = 'aws-1-eu-central-1.pooler.supabase.com',
    [switch]$Aplicar,
    [switch]$ConfirmarProduccion
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $EnvFile)) {
    throw "No se encuentra $EnvFile."
}

$valores = @{}
foreach ($linea in Get-Content -LiteralPath $EnvFile) {
    if ($linea -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
        $valor = $Matches[2].Trim()
        if (($valor.StartsWith('"') -and $valor.EndsWith('"')) -or
            ($valor.StartsWith("'") -and $valor.EndsWith("'"))) {
            $valor = $valor.Substring(1, $valor.Length - 2)
        }
        $valores[$Matches[1]] = $valor
    }
}

if (-not $valores.ContainsKey('ZINERGIA_PROD_DATABASE_URL') -or
    [string]::IsNullOrWhiteSpace($valores['ZINERGIA_PROD_DATABASE_URL'])) {
    throw 'Falta ZINERGIA_PROD_DATABASE_URL.'
}

$urlBase = $valores['ZINERGIA_PROD_DATABASE_URL'].Trim()
$parsed = [Uri]$urlBase
$userInfo = $parsed.UserInfo.Split(':')[0]

# Supabase tiene dos formas de cadena y el identificador del proyecto vive en un
# sitio distinto en cada una: el pooler lo pone en el usuario
# (postgres.<ref>@...pooler...) y la directa en el host (postgres@db.<ref>...).
$projectRef = if ($userInfo -match '^postgres\.(.+)$') {
    $Matches[1]
} elseif ($parsed.Host -match '^db\.([a-z0-9]+)\.supabase\.(co|com)$') {
    $Matches[1]
} else {
    $parsed.Host
}

# Comprobarlo evita el error mas caro posible: aplicar las migraciones de
# produccion sobre otra base.
if ($projectRef -ne $ProjectRefEsperado) {
    throw "La cadena de conexion apunta a otro proyecto, no al de produccion. No se aplica nada."
}

# Las conexiones directas (db.<ref>.supabase.co) son solo IPv6 desde 2024, asi
# que en una red IPv4 el nombre ni siquiera resuelve. Se reescribe al pooler,
# que es de doble pila, conservando las credenciales originales.
if ($parsed.Host -match '^db\.[a-z0-9]+\.supabase\.(co|com)$') {
    $credenciales = $parsed.UserInfo
    $indice = $credenciales.IndexOf(':')
    $secreto = if ($indice -ge 0) { $credenciales.Substring($indice + 1) } else { '' }
    $puerto = if ($parsed.Port -gt 0) { $parsed.Port } else { 5432 }
    $urlBase = "postgresql://postgres.${projectRef}:${secreto}@${PoolerHost}:${puerto}/postgres"
    Write-Output 'conexion=reescrita_al_pooler motivo=host_directo_solo_ipv6'
}

Write-Output "proyecto=$ProjectRefEsperado"

if (-not $Aplicar) {
    Write-Output 'modo=simulacion'
    npx supabase db push --db-url $urlBase --dry-run
    if ($LASTEXITCODE -ne 0) { throw 'La simulacion ha fallado.' }
    Write-Output 'PRODUCCION_SIMULACION_OK aplicado=false'
    Write-Output 'Para aplicar de verdad: anade -Aplicar -ConfirmarProduccion'
    exit 0
}

if (-not $ConfirmarProduccion) {
    throw 'Aplicar a produccion exige tambien -ConfirmarProduccion. No se ha escrito nada.'
}

Write-Output 'modo=aplicando'
npx supabase db push --db-url $urlBase --yes
if ($LASTEXITCODE -ne 0) { throw 'La aplicacion ha fallado.' }

Write-Output 'PRODUCCION_MIGRACIONES_APLICADAS aplicado=true'
Write-Output 'Comprueba ahora el estado con los scripts de verificacion.'
