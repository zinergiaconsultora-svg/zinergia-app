# Zinergia — CRM Energético

## What it is
CRM and energy tariff comparison platform for Spanish energy consultants. Agents upload electricity invoices, the system OCRs them, compares against available tariffs, generates savings proposals, and tracks the full lead-to-client lifecycle.

## Who uses it
- **Energy agents** (field consultants): Upload invoices, manage clients, generate proposals, track commissions
- **Franchise admins**: Oversee agents, manage leads pipeline, configure offers catalog, view business metrics
- **End clients**: View public proposals via shareable links

## Register
product

## Visual direction
Professional energy SaaS. Clean, data-dense dashboard UI. Indigo/emerald accent palette on light backgrounds. Not a marketing site — it's a working tool used daily by agents in the field (often mobile).

## Tech stack
- Next.js 15, React, TypeScript, Tailwind CSS
- Supabase (Postgres + Auth + Storage)
- Nunito Sans font family (300-700 weights), tuned for a rounded Apple-like product UI
- PWA enabled, mobile-first

## Key surfaces
- Login page (public, `/`)
- Agent dashboard (`/dashboard`) — overview cards, recent activity
- Simulator (`/dashboard/simulator`) — invoice upload + OCR flow
- Leads pipeline (`/admin/leads`) — admin view with filters, bulk actions, detail drawer
- Client detail (`/dashboard/clients/[id]`) — tabs for documents, proposals, activities
- Proposal PDF — generated via @react-pdf/renderer
- Public proposal page (`/p/[token]`)

## Brand colors
- Primary: Indigo `#4f46e5`
- Success/CTA: Emerald `#059669`
- Background: White / Slate-50
- Text: Slate-900 / Slate-500
- Dark mode: Slate-950 background
