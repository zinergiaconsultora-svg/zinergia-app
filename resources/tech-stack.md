# Tech Stack & Implementation Guidelines

**Project**: Repaart (Antigravity Design System)
**Primary Framework**: Next.js 14+ (App Router)

## Core Technologies (OBLIGATORIO)

- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS (con `design-tokens.json`)
- **Animation**: Framer Motion (`framer-motion`)
- **Icons**: Lucide React (`lucide-react`)
- **Components**: Shadcn/ui (Customized)

## Rules of Engagement

1. **No Magic Values**: Do not hardcode hex colors or arbitrary px values. Use Tailwind classes that map to our system.
   - ❌ `bg-[#1e293b]`
   - ✅ `bg-slate-900` (mapped to primary)

2. **Component Structure**:
   - Small, atomic components (Single Responsibility).
   - `export const ComponentName` (Named exports).
   - Props interface defined locally or imported from `@/types`.

3. **State Management**:
   - Server Components by default.
   - `use client` only for interactive leaves.
   - URL State (searchParams) for filters/pagination.

4. **Performance**:
   - `next/image` for all images.
   - `dynamic` imports for heavy components.
   - `Suspense` boundaries for data fetching.

5. **Code Style**:
   - Functional Programming patterns.
   - Early returns.
   - Zod for validation.
