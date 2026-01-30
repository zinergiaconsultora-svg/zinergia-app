#!/bin/bash

# =============================================
# ZINERGIA - SUPABASE SETUP AUTOMATIZADO
# =============================================
# Ejecutar: npm run supabase:setup
# =============================================

echo "🚀 Configurando Supabase para Zinergia..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI no está instalado${NC}"
    echo "Instálalo con: npm install -g supabase"
    echo ""
    echo "O ejecuta el script manualmente en:"
    echo "https://jycwgzdrysesfcxgrxwg.supabase.co > SQL Editor"
    exit 1
fi

# Check if user is logged in
echo -e "${YELLOW}📋 Verificando autenticación...${NC}"
if ! supabase projects list &> /dev/null; then
    echo -e "${RED}❌ No estás autenticado en Supabase${NC}"
    echo "Ejecuta: supabase login"
    exit 1
fi

echo -e "${GREEN}✅ Autenticado correctamente${NC}"
echo ""

# List projects
echo -e "${YELLOW}📋 Buscando proyecto...${NC}"
PROJECTS=$(supabase projects list)

# Find the project with the correct URL
PROJECT_REF=$(echo "$PROJECTS" | grep "jycwgzdrysesfcxgrxwg" | awk '{print $1}')

if [ -z "$PROJECT_REF" ]; then
    echo -e "${RED}❌ No se encontró el proyecto jycwgzdrysesfcxgrxwg${NC}"
    echo "Proyectos disponibles:"
    echo "$PROJECTS"
    exit 1
fi

echo -e "${GREEN}✅ Proyecto encontrado: $PROJECT_REF${NC}"
echo ""

# Execute SQL script
echo -e "${YELLOW}📋 Ejecutando script SQL...${NC}"
echo ""

if [ -f "supabase_setup_consolidated.sql" ]; then
    supabase db execute --project-ref "$PROJECT_REF" --file supabase_setup_consolidated.sql
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Script ejecutado correctamente${NC}"
        echo ""
        echo "🎉 Instalación completada!"
        echo ""
        echo "📊 Verificación:"
        echo "   Ve a: https://jycwgzdrysesfcxgrxwg.supabase.co"
        echo "   SQL Editor > Select * from lv_zinergia_tarifas"
        echo ""
        echo "📱 Para verificar en la app:"
        echo "   npm run dev"
        echo "   Abre: http://localhost:3000/dashboard/simulator"
        echo ""
    else
        echo -e "${RED}❌ Error al ejecutar el script${NC}"
        echo "Por favor, ejecútalo manualmente en el dashboard de Supabase"
        exit 1
    fi
else
    echo -e "${RED}❌ No se encontró el archivo supabase_setup_consolidated.sql${NC}"
    echo "Asegúrate de estar en el directorio correcto"
    exit 1
fi
