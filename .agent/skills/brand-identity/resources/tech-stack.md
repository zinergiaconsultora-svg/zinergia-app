# Preferred Tech Stack & Implementation Rules (Antigravity Style)

Cuando generes código o componentes UI para **Repaart**, **DEBES** adherirte estrictamente a las siguientes elecciones tecnológicas y principios de diseño "Antigravity".

## Core Stack

* **Framework:** React (TypeScript **MANDATORY**)
* **Styling Engine:** Tailwind CSS (Mandatory. Do not use plain CSS or styled-components unless explicitly asked.)
* **Component Library:** shadcn/ui (Use these primitives as the base, but customize them with our Antigravity tokens.)
* **Icons:** Lucide React (thin, rounded line style matching body text weight)

---

## The "Antigravity" Philosophy

**Core Principle:** Weightlessness, extreme cleanliness, whitespace, and technological sophistication. The interface should feel like it's floating in a zero-gravity environment.

**Inspiration:** Premium Apple product design, but more ethereal and futuristic. Not flat and heavy—light and levitating.

---

## Implementation Guidelines

### 1. Glassmorphism (MANDATORY for all containers)

**All containers, cards, sidebars, navigation elements are NOT solid.**

They must be made of high-quality translucent "frosted glass" panels:

```tsx
// Template for glass containers
className="bg-white/70 backdrop-blur-xl border border-white/30 rounded-2xl"
```

* **Background:** Use `bg-white/70` or equivalent translucent white
* **Backdrop Blur:** ALWAYS use `backdrop-blur-xl` (or `backdrop-blur-lg` minimum)
* **Border:** Subtle border with `border-white/30` or `border-slate-200/20`
* **Border Radius:** Use `rounded-2xl` (1.5rem) or `rounded-3xl` (1.75rem) minimum

### 2. The Floating Effect (Deep Soft Shadows)

**CRITICAL:** No element should appear attached to the background. Every card, button, and panel must have **deep, soft, extensive shadows** beneath to create the optical illusion of physical floating.

```tsx
// Shadow hierarchy
shadow-[0_8px_32px_rgba(30,41,59,0.08)]   // Light floating
shadow-[0_12px_48px_rgba(30,41,59,0.12)]  // Medium floating
shadow-[0_16px_64px_rgba(30,41,59,0.15)]  // Deep floating (modals, popups)
```

* Cards and panels should use **medium floating** shadows
* Buttons should use **light floating** shadows
* Modals and alerts should use **deep floating** shadows
* Navigation bars should cast soft shadows over main content

### 3. Typography Contrast (Apple Evolved)

**The Rule of Dramatic Contrast:** Hierarchy is based on dramatic weight contrast, NOT just thin letters.

* **Titles & Numeric Data:**
  * MUST be `font-bold` (700) or `font-semibold` (600)
  * Color: `text-slate-800` (Deep Slate Blue)
  * Large sizes with visual authority

* **Body Text, Labels, Subtitles:**
  * MUST be `font-light` (300) or `font-regular` (400)
  * Color: `text-slate-500` (medium gray) or `text-slate-400` (light gray)
  * Creates air and cleanliness

```tsx
// Title example
<h1 className="text-4xl font-bold text-slate-800">Dashboard</h1>

// Body text example
<p className="text-sm font-light text-slate-500">Your recent activity</p>
```

### 4. Component Patterns

#### Buttons

* **Shape:** MUST use `rounded-full` (pill shape) for primary actions
* **Primary Actions:**
  * Background: Gradient from Electric Blue to Purple `bg-gradient-to-r from-blue-500 to-purple-600`
  * Text: `text-white font-semibold`
  * Shadow: Light floating shadow
  * Hover: Increase shadow depth and slight scale `hover:shadow-xl hover:scale-105 transition-all duration-300`

```tsx
<button className="px-6 py-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold shadow-[0_8px_32px_rgba(30,41,59,0.08)] hover:shadow-xl hover:scale-105 transition-all duration-300">
  Let's Go
</button>
```

#### Cards

* **Material:** Glassmorphism (see section 1)
* **Padding:** Use generous padding `p-6` or `p-8` minimum
* **Shadow:** Medium floating shadow
* **Border Radius:** `rounded-2xl` or `rounded-3xl`
* **Background:** Translucent white against pale gray background for contrast

```tsx
<div className="bg-white/70 backdrop-blur-xl border border-white/30 rounded-2xl p-8 shadow-[0_12px_48px_rgba(30,41,59,0.12)]">
  {/* Card content */}
</div>
```

#### Navigation/Sidebars

* **Material:** Glassmorphism
* **Position:** Should appear to float over content
* **Shadow:** Should cast soft shadow over main content area
* **Blur:** Strong backdrop blur to show content refraction behind

#### Layout

* **Spacing:** Generous whitespace everywhere
* **Grid/Flexbox:** Use Tailwind utilities (`flex`, `grid`, `gap-6`, etc.)
* **Responsive:** Maintain floating aesthetic on all screen sizes

### 5. Color Application

* **Backgrounds:** `bg-slate-50` (very pale gray, almost white)
* **Text Primary:** `text-slate-800` (Deep Slate Blue) for titles
* **Text Secondary:** `text-slate-500` or `text-slate-400` for body/labels
* **Accent/Interactive:** Gradient `from-blue-500 to-purple-600` for buttons, active states, charts
* **Glass Containers:** `bg-white/70 backdrop-blur-xl border-white/30`

### 6. Icons

* **Style:** Thin, rounded lines (Lucide React fits perfectly)
* **Weight:** Should match body text weight (light/regular)
* **Color:** Inherit from text color or use `text-slate-500`

---

## Forbidden Patterns

❌ **NEVER DO THIS:**

* Use solid, opaque containers (all must be glassmorphism)
* Use hard/square corners (`rounded-none` or `rounded-sm`)
* Use flat shadows or no shadows (everything must float)
* Use only thin typography without contrast (must have bold titles)
* Use jQuery or Bootstrap
* Use heavy, flat, or "stuck to background" designs

✅ **ALWAYS DO THIS:**

* Glassmorphism for all containers
* Deep soft shadows for floating effect
* Dramatic typography weight contrast
* Extremely rounded corners
* Generous whitespace
* Multi-layer depth perception

---

## Layering & Depth

The interface should feel constructed in **multiple layers of floating glass**:

1. **Base Layer:** Pale gray background (`bg-slate-50`)
2. **Content Layer:** Main cards and panels (medium floating shadows)
3. **Navigation Layer:** Top nav/sidebar (floating above content with soft shadow)
4. **Modal Layer:** Alerts, dialogs, tooltips (deep floating shadows, highest elevation)

---

## Code Example: Complete Antigravity Card

```tsx
<div className="min-h-screen bg-slate-50 p-8">
  <div className="max-w-4xl mx-auto">
    {/* Antigravity Card */}
    <div className="bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl p-8 shadow-[0_12px_48px_rgba(30,41,59,0.12)]">
      
      {/* Title with Bold Contrast */}
      <h2 className="text-3xl font-bold text-slate-800 mb-2">
        Welcome to Repaart
      </h2>
      
      {/* Subtitle with Light Weight */}
      <p className="text-sm font-light text-slate-500 mb-6">
        Your premium delivery dashboard
      </p>
      
      {/* Gradient Button */}
      <button className="px-6 py-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold shadow-[0_8px_32px_rgba(30,41,59,0.08)] hover:shadow-xl hover:scale-105 transition-all duration-300">
        Get Started
      </button>
      
    </div>
  </div>
</div>
```
