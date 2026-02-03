# 📜 Zinergia Project Constitution (gemini.md)

> **Single Source of Truth** for Data Structures, Business Invariants, and Architectural Rules.
> *If code contradicts this document, the code is wrong (or this doc needs updating via consensus).*

---

## 🏗️ 1. Database Schema (Supabase)

### ⚡ Core Tables

#### `lv_zinergia_tarifas`

*Source of Truth for Energy Pricing.*

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary Key |
| `tariff_name` | `text` | Display name (e.g. "Indexada Pymes") |
| `company` | `text` | Marketer name (e.g. "Zinergia") |
| `offer_type` | `enum` | `'fixed' \| 'indexed'` |
| `is_active` | `bool` | Soft delete flag |
| `power_price_p[1-6]` | `numeric` | Price per kW/day (Daily Normalized) |
| `energy_price_p[1-6]` | `numeric` | Price per kWh |
| `fixed_fee` | `numeric` | Monthly fixed fee (€) |

#### `clients`

*CRM Entity representing a potential or active customer.*

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary Key |
| `franchise_id` | `uuid` | **RLS Scope**. Clients belong to a Franchise. |
| `owner_id` | `uuid` | Agent who owns the client. |
| `status` | `enum` | `'new', 'contacted', 'in_process', 'won', 'lost'` |

#### `proposals`

*A simulation result saved for a client.*

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary Key |
| `client_id` | `uuid` | FK to `clients` |
| `franchise_id` | `uuid` | **RLS Scope** |
| `status` | `enum` | `'draft', 'sent', 'accepted', 'rejected'` |
| `offer_snapshot` | `jsonb` | **Immutable** copy of `TariffCandidate` at creation time. |
| `calculation_data` | `jsonb` | **Immutable** copy of input `InvoiceData`. |
| `annual_savings` | `numeric` | Calculated benefit. |

---

## 🧠 2. Aletheia Engine (Business Logic)

### 📐 Invariants

1. **Annualization Rule:**
    All cost comparisons MUST be projected to 365 days.

    ```typescript
    projected_annual = (current_cost / days_invoiced) * 365
    ```

2. **Snapshot Immutability:**
    When a Proposal is created, the Tariff prices (`offer_snapshot`) MUST be saved by value, not reference. Future tariff price changes must NOT affect historical proposals.

3. **Tariff Periods:**
    - `2.0TD`: Uses **P1, P2, P3** (Power & Energy).
    - `3.0TD`: Uses **P1, P2, P3** (Current Implementation - *Verify against regulation*).
    - `6.1TD`: Uses **P1..P6**.

### 🔄 Data Flow

1. **Input:** `OCR Analysis` -> `Normalizer` -> `InvoiceData`
2. **Process:** `Engine.run(InvoiceData, ActiveTariffs)`
3. **Output:** `AletheiaResult` (Current Status vs. Top 3 Candidates)

---

## 🎨 3. Design System (Antigravity)

*See `.agent/skills/brand-identity/SKILL.md` for full details.*

- **Glassmorphism:** ALL containers must use `bg-white/X backdrop-blur-xl`.
- **Levitation:** Elements must have deep shadows (`shadow-2xl`) to appear floating.
- **Typography:** High contrast. Headers `font-bold text-slate-900`, Body `font-light text-slate-500`.

---

## 🛡️ 4. Security & Access

- **Role Based Access (RBAC):**
  - `admin`: Can see all franchises (Superadmin).
  - `agent`: Can ONLY see data within their `franchise_id`.
- **Defense in Depth:**
  - Services must verify `franchise_id` in application logic AND RLS policies.
