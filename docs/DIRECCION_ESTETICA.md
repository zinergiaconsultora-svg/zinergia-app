/**
 * DIRECCIÓN ESTÉTICA: "Fintech Orgánico Premium"
 * 
 * Concepto: Un equilibrio entre tecnología financiera y elementos naturales
 * - Energía renovable (verde esmeralda)
 * - Calor humano (naranja vermilion)
 * - Confianza (azul profundo)
 * - Movimiento orgánico (formas fluidas, no rígidas)
 * 
 * Diferenciadores clave:
 * - Tipografía bold y geométrica (Space Grotesk + Outfit)
 * - Paleta única: sin indigo/slate genéricos
 * - Animaciones high-impact con staggering
 * - Depth visual: noise, gradients, glassmorphism
 * - Layouts asimétricos con intención
 */

// ============================================
// 1. TIPOGRAFÍA DISTINTIVA
// ============================================

// DISPLAY (Headings grandes)
font-family: 'Space Grotesk', sans-serif;
- Uso: H1, H2, números grandes, precios
- Carácter: Bold, geométrico, técnico pero humano
- Pesos: 700 (bold), 500 (medium)

// BODY (Textos corridos)
font-family: 'Outfit', sans-serif;
- Uso: Párrafos, labels, textos generales
- Carácter: Limpio, moderno, legible
- Pesos: 400 (regular), 500 (medium), 600 (semibold)

// MONO (Códigos, datos técnicos)
font-family: 'DM Mono', 'Fira Code', monospace;
- Uso: CUPS, números de factura, precios
- Carácter: Técnico, preciso

// ============================================
// 2. PALETA DE COLORES ÚNICA
// ============================================

// PRIMARIO (Energía Renovable)
color-emerald-500: #10b981;   // Verde principal
color-emerald-600: #059669;   // Verde oscuro (CTAs)
color-teal-500: #14b8a6;      // Verde azulado (energía)

// ACENTO (Calor/Ahorro)
color-energy-500: #ff5722;    // Naranja base (ya tienen)
color-energy-600: #f43f0a;    // Naranja intenso
color-amber-500: #f59e0b;     // Ambar (highlight)

// PROFUNDO (Confianza)
color-brand-blue: #1b2641;     // Azul profundo (ya tienen)
color-slate-900: #0f172a;     // Casi negro (textos)

// SUPERFICIE (Backgrounds, cards)
bg-stone-50: #fafaf9;         // Warm white
bg-emerald-50: #ecfdf5;       // Tint green
bg-energy-50: #fff4ed;        // Tint orange (ya tienen)

// ============================================
// 3. ANIMACIONES HIGH-IMPACT
// ============================================

// STAGGERED REVEALS (Para listas, grids)
const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,    // Retardo entre hijos
      delayChildren: 0.2,      // Retardo inicial
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.23, 1, 0.32, 1], // Bezier custom
    }
  }
};

// PAGE LOAD (Dramático)
const pageLoad = {
  initial: { opacity: 0, scale: 0.95, rotate: -2 },
  animate: { opacity: 1, scale: 1, rotate: 0 },
  transition: { duration: 0.8, ease: [0.23, 1, 0.32, 1] }
};

// MICRO-INTERACCIONES (Hover cards, buttons)
const cardHover = {
  rest: { scale: 1, rotate: 0 },
  hover: { 
    scale: 1.02, 
    rotate: 0.5,
    transition: { duration: 0.3, ease: "easeOut" }
  }
};

// ============================================
// 4. TEXTURAS Y DEPTH
// ============================================

// NOISE OVERLAY (Sutil, orgánico)
.noise-overlay {
  position: relative;
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    opacity: 0.03;
    pointer-events: none;
  }
}

// GRADIENTE ORGÁNICO (No lineal)
.gradient-organic {
  background: 
    radial-gradient(at 40% 20%, rgba(16, 185, 129, 0.15) 0px, transparent 50%),
    radial-gradient(at 80% 0%, rgba(255, 87, 34, 0.1) 0px, transparent 50%),
    radial-gradient(at 0% 50%, rgba(20, 184, 166, 0.1) 0px, transparent 50%),
    radial-gradient(at 80% 50%, rgba(245, 158, 11, 0.08) 0px, transparent 50%),
    radial-gradient(at 0% 100%, rgba(27, 38, 65, 0.1) 0px, transparent 50%),
    linear-gradient(to bottom, #fafaf9, #f5f5f4);
}

// GLASSMORPHISM MEJORADO
.glass-premium {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 4px 30px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    inset 0 -1px 0 rgba(0, 0, 0, 0.02);
}

// ============================================
// 5. LAYOUTS ASIMÉTRICOS
// ============================================

// GRID COMPUESTO (No simétrico)
.asymmetric-grid {
  display: grid;
  grid-template-columns: 
    minmax(0, 2fr)
    minmax(0, 1.5fr)
    minmax(0, 1fr);
  gap: 1.5rem;
  
  // Primer elemento más grande
  > *:first-child {
    grid-row: span 2;
  }
}

// OFFSET CARD (Romper la grilla)
.offset-card {
  position: relative;
  margin-left: -2rem;  // Desplazamiento intencional
  margin-right: 2rem;
}

// ============================================
// 6. PREFERS-REDUCED-MOTION
// ============================================

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

// ============================================
// 7. EJEMPLOS DE USO
// ============================================

// HERO SECTION
.hero-section {
  font-family: 'Space Grotesk', sans-serif;
  background: gradient-organic;
  position: relative;
  
  h1 {
    font-size: clamp(2.5rem, 5vw + 1rem, 4.5rem);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.03em;
    
    span.highlight {
      color: #ff5722;  // energy-500
      position: relative;
      
      &::after {
        content: '';
        position: absolute;
        bottom: 0.1em;
        left: 0;
        width: 100%;
        height: 0.15em;
        background: linear-gradient(90deg, #ff5722, #10b981);
        border-radius: 2px;
      }
    }
  }
}

// CARD ASIMÉTRICO
.asymmetric-card {
  background: glass-premium;
  border-radius: 1.5rem;
  padding: 2rem;
  position: relative;
  
  // Decoración orgánica
  &::before {
    content: '';
    position: absolute;
    top: -2rem;
    right: -2rem;
    width: 6rem;
    height: 6rem;
    background: radial-gradient(circle, #10b981 0%, transparent 70%);
    opacity: 0.15;
    border-radius: 50%;
    filter: blur(40px);
  }
}

// BUTTON GRADIENT
.btn-primary {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  box-shadow: 
    0 4px 15px rgba(16, 185, 129, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 
      0 8px 25px rgba(16, 185, 129, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  
  &:active {
    transform: translateY(0);
  }
}
