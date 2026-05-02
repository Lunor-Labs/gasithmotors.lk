# Multi-Tenant Generic POS Platform — Implementation Plan

## Background

The current codebase (`gasithmotors.lk`) is a solid, well-structured POS system built for a vehicle parts shop. It uses **React + TypeScript + Vite**, **Supabase** (Postgres + Auth + RLS), and **Tailwind CSS**. It has a clean service/repository layer, modal-based UI, and good role separation (admin/cashier).

The goal is to transform this into a **white-label, multi-tenant SaaS POS** that can be sold to restaurants, pharmacies, clothing stores, grocery shops, vehicle parts dealers, and any other retail/service business — with each tenant fully isolated, easily onboarded, and configurable to their business type.

---

## User Review Required

> [!IMPORTANT]
> **Key Design Decision — Multi-Tenancy Model**
> There are two ways to implement multi-tenancy. Please confirm which approach you want:
>
> **Option A — Single Supabase Project, Tenant-per-Row (Recommended)**
> Every table gets a `tenant_id` column. All tenants share the same database schema. RLS policies enforce tenant isolation. Cheapest to run, easiest to manage.
>
> **Option B — Supabase Organization per Tenant**
> Each business gets their own Supabase project. Fully isolated at the infra level. More expensive and complex to manage.
>
> **Recommendation: Option A** — Row-level multi-tenancy is what Supabase is designed for, and with RLS it is completely secure.

> [!IMPORTANT]
> **Business Type Configurability**
> Two approaches for business-type-specific features (e.g., warranties for vehicle parts, expiry dates for pharmacies, table management for restaurants):
>
> **Option A — Feature Flags per Tenant (Recommended)**
> Each tenant has a config object (stored in DB) that enables/disables specific modules: `has_batches`, `has_expiry`, `has_warranty`, `has_commissions`, `has_tables`, `has_kds` (kitchen display), etc. The UI conditionally renders features based on this config.
>
> **Option B — Separate App Themes / Presets**
> Business-type presets (e.g., "Restaurant", "Pharmacy") automatically apply a curated set of feature flags at onboarding.
>
> **Recommendation: Both A + B** — Presets for fast onboarding, with per-flag overrides for customization.

> [!WARNING]
> **This plan is a PHASED approach.** Phase 1 is the foundation and is the most critical. Phases 2–4 build on top. We should get Phase 1 solid before proceeding. I recommend implementing one phase at a time.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   POS Platform (SaaS)                   │
├─────────────────────────────────────────────────────────┤
│  Super Admin Portal   │   Tenant Portal (per shop)      │
│  (Platform owner)     │   (Business owner + cashiers)   │
├─────────────────────────────────────────────────────────┤
│                  Supabase Backend                        │
│  tenants table → all business data → RLS isolation      │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1: Multi-Tenancy Foundation (Database + Auth)
*Estimated effort: 3–5 days. This is the backbone of everything else.*

### 1.1 — New `tenants` Table (Super-Tenant Registry)

A new top-level table that represents each business (shop) using the platform.

```sql
CREATE TABLE tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,        -- e.g. "gasith-motors", "city-pharmacy"
  business_name text NOT NULL,
  business_type text NOT NULL,               -- 'retail', 'restaurant', 'pharmacy', 'vehicle_parts', 'grocery', 'clothing', 'custom'
  logo_url      text,
  currency      text DEFAULT 'LKR',
  timezone      text DEFAULT 'Asia/Colombo',
  subscription_plan text DEFAULT 'trial',   -- 'trial', 'starter', 'pro', 'enterprise'
  subscription_expires_at timestamptz,
  active        boolean DEFAULT true,
  config        jsonb DEFAULT '{}',          -- Feature flags + custom settings
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
```

The `config` JSONB column stores a feature-flag object per tenant:
```json
{
  "has_batches": true,
  "has_expiry": false,
  "has_warranty": true,
  "has_commissions": true,
  "has_purchase_orders": true,
  "has_table_management": false,
  "has_kitchen_display": false,
  "has_loyalty_points": false,
  "product_label": "Products",
  "supplier_label": "Suppliers",
  "agent_label": "Referral Agents",
  "invoice_prefix": "INV",
  "receipt_footer": "Thank you for your business!"
}
```

### 1.2 — Add `tenant_id` to All Existing Tables

Migration to add `tenant_id uuid REFERENCES tenants(id)` to:
- `user_profiles`, `products`, `product_batches`, `suppliers`, `customers`
- `referral_agents`, `sales`, `sale_items`, `returns`, `return_items`
- `purchase_orders`, `purchase_order_items`, `referral_commissions`

### 1.3 — Update All RLS Policies

All policies change from checking `role = 'admin'` to checking `auth.uid() belongs to a user_profile where tenant_id = [row's tenant_id]`. A helper function `get_tenant_id()` will return the current user's tenant.

```sql
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS uuid AS $$
  SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;
```

Then all RLS policies become:
```sql
USING (tenant_id = get_my_tenant_id())
```

### 1.4 — Tenant Config Context in Frontend

A new React context `TenantContext` that:
- Loads the current user's tenant on login
- Exposes `tenant.config` as a hook: `useTenantConfig()`
- Provides helpers like `isFeatureEnabled('has_batches')`

---

## Phase 2: Generic UI & Onboarding System
*Estimated effort: 4–6 days.*

### 2.1 — Business Type Presets

A `BUSINESS_TYPE_PRESETS` configuration map in TypeScript:

| Business Type | has_batches | has_expiry | has_warranty | has_commissions | has_tables | Product Label |
|---|---|---|---|---|---|---|
| `vehicle_parts` | ✅ | ❌ | ✅ | ✅ | ❌ | Parts |
| `pharmacy` | ✅ | ✅ | ❌ | ❌ | ❌ | Medicines |
| `restaurant` | ❌ | ✅ | ❌ | ❌ | ✅ | Menu Items |
| `grocery` | ✅ | ✅ | ❌ | ❌ | ❌ | Products |
| `clothing` | ✅ | ❌ | ❌ | ❌ | ❌ | Items |
| `custom` | configurable | configurable | configurable | configurable | configurable | Products |

### 2.2 — Onboarding Wizard (New Tenant Sign-Up Flow)

A multi-step wizard shown to brand new tenants on first login:

1. **Step 1 — Welcome**: Enter business name, slug, country, currency
2. **Step 2 — Business Type**: Choose from preset cards (Vehicle Parts, Pharmacy, Restaurant, Grocery, Clothing, Custom)
3. **Step 3 — Customize**: Fine-tune feature flags based on preset
4. **Step 4 — Brand**: Upload logo, set invoice receipt footer, invoice prefix
5. **Step 5 — Done**: Summary + button to enter the POS

### 2.3 — Conditional UI Rendering

The navigation, forms, and POS screen will conditionally render features based on `tenant.config`:

- **Batch tracking**: Only shown if `has_batches = true`
- **Expiry date**: Only shown if `has_expiry = true`
- **Warranty fields in POS**: Only shown if `has_warranty = true`
- **Referral Agents nav item**: Only shown if `has_commissions = true`
- **Purchase Orders**: Only shown if `has_purchase_orders = true`

### 2.4 — Dynamic Labels

`product_label`, `supplier_label`, `agent_label` in config drive the UI labels:
- "Products" → "Menu Items" (restaurant), "Medicines" (pharmacy), "Parts" (vehicle)
- "Suppliers" → "Food Vendors" (restaurant)

---

## Phase 3: Super Admin Portal (Platform Owner Dashboard)
*Estimated effort: 3–4 days.*

A separate protected route `/super-admin` (requires a `platform_admin` role in `user_profiles`).

### 3.1 — Tenant Management
- View all tenants (slug, business name, type, plan, status)
- Create new tenants
- Activate/deactivate tenants
- View tenant's subscription expiry
- One-click impersonate (view as tenant) for support

### 3.2 — Subscription Management
- Assign plan: `trial`, `starter`, `pro`, `enterprise`
- Set expiry date
- Block access when subscription expires

### 3.3 — Usage Analytics
- Total tenants, active, trial, expiring
- Sales volumes by tenant (for platform insights)

---

## Phase 4: Polish, Billing & Scalability
*Estimated effort: ongoing.*

### 4.1 — Self-Service Tenant Registration (Public Sign-Up Page)
A public-facing landing page + sign-up form where a new business owner can:
- Enter business details
- Pick a plan
- Complete onboarding wizard
- Start using immediately (trial mode)

### 4.2 — Subscription Enforcement
- Trial: 30 days, limited to 100 products and 1 user
- Starter: Unlimited products, 3 users
- Pro: Unlimited + advanced reports + API access

### 4.3 — White-Label Theming
Per-tenant primary color, logo in sidebar/invoice. Currently hardcoded as `#0f172a` dark theme — this moves to `tenant.config.theme_color`.

### 4.4 — Invoice & Receipt Customization
- Custom invoice prefix (e.g., `INV-`, `RX-`, `ORD-`)
- Custom receipt footer text
- Optional: logo on printed receipt

### 4.5 — Expanded Business-Type Features (Future)
- **Restaurant**: Table management, kitchen display system (KDS), menu categories
- **Pharmacy**: Prescription tracking, drug batch alerts, FIFO batch selection
- **Loyalty Points**: Earn/redeem points system

---

## Proposed Changes (Phase 1 & 2)

### Database Layer

#### [NEW] `supabase/migrations/[timestamp]_add_multi_tenancy.sql`
- Add `tenants` table with `config` JSONB
- Add `tenant_id` FK to all existing tables
- Drop old RLS policies; recreate with `tenant_id = get_my_tenant_id()`
- Add `get_my_tenant_id()` helper function
- Add `platform_admin` role to `user_profiles.role` CHECK constraint

---

### Frontend Core

#### [MODIFY] [App.tsx](file:///home/dinesh-s/Documents/Dinesh/gasithmotors.lk/src/App.tsx)
- Wrap app in new `TenantProvider`
- Add onboarding wizard route for new tenants
- Add super-admin portal route

#### [NEW] `src/contexts/TenantContext.tsx`
- Loads tenant + config on auth
- Exposes `useTenant()` hook

#### [NEW] `src/config/businessTypes.ts`
- `BUSINESS_TYPE_PRESETS` map
- TypeScript types for `TenantConfig`

#### [NEW] `src/components/onboarding/OnboardingWizard.tsx`
- 5-step wizard for new tenants

#### [MODIFY] [Layout.tsx](file:///home/dinesh-s/Documents/Dinesh/gasithmotors.lk/src/components/Layout.tsx)
- Replace hardcoded "GASITH Motors" brand with tenant name/logo from context
- Filter navigation items by `tenant.config` feature flags
- Dynamic labels from config

#### [MODIFY] [Settings.tsx](file:///home/dinesh-s/Documents/Dinesh/gasithmotors.lk/src/components/Settings.tsx)
- Add new "Business Settings" tab: edit tenant config, logo, labels
- Add feature flag toggle UI (admin-only)

---

### Services Layer

#### [NEW] `src/services/tenantService.ts`
- `getTenantById()`, `updateTenantConfig()`, `createTenant()`

#### [MODIFY] All existing services
- Pass `tenant_id` filter to all Supabase queries (or rely on RLS)

---

## Open Questions

> [!IMPORTANT]
> 1. **Multi-tenancy model**: Confirm Option A (row-level, same DB) vs Option B (separate projects)?
> 2. **Super Admin Portal**: Do you (the platform owner) want a separate dashboard to manage all tenants?
> 3. **Public sign-up**: Should businesses be able to self-onboard from a public URL, or will you manually create tenants for now?
> 4. **Repository name**: Should we rename the repo/project away from `gasithmotors.lk` to a generic platform name (e.g., `posflow`, `clearpos`, `tillpro`)?
> 5. **Existing data**: Should we migrate the existing Gasith Motors data as the first tenant, or start fresh?
> 6. **PurchaseOrders.tsx** relies heavily on batch tracking — in restaurant mode, should Purchase Orders be replaced with a simpler "Stock Receiving" flow?

---

## Verification Plan

### Phase 1 Verification
- Apply migration to Supabase → confirm all tables have `tenant_id`
- Create two test tenants → confirm RLS isolation (tenant A cannot see tenant B's data)
- Login as each tenant's user → confirm correct isolation in all views

### Phase 2 Verification
- Create a "pharmacy" tenant → confirm batch/expiry fields visible, warranty hidden
- Create a "restaurant" tenant → confirm menu item labels, table management visible
- Run through onboarding wizard end-to-end
- Confirm dynamic sidebar labels update per config

