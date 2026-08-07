<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — Faraja Frontend (Next.js 16)

Frontend of the Faraja Solution Loans microfinance system. Read the root `../AGENTS.md` for role, money/locale rules, and project-wide conventions — this file adds the **design system, which is the priority here**. When in doubt: match the existing pages, then ask.

## Design system — the standard

The product look: **clean white cards on a light `#F8FAFC` canvas, generous rounded corners, primary blue CTAs, orange accents, compact typography with tiny uppercase labels.** Pages must look like they belong to one product.

### Brand tokens (from `app/globals.css` — use the CSS variables, not raw hex)

| Token | Value | Use |
|---|---|---|
| Primary (Faraja Blue) | `#0D44A2` (`bg-primary`) | CTAs, active nav, links, emphasis, focus rings |
| Primary hover | `#0A3682` | CTA hover |
| Accent (Faraja Orange) | `#F57424` (`bg-accent`) | "Due today", warnings/highlights, brand marks |
| Background | `#F8FAFC` (`bg-[#F8FAFC]`) | Page canvas (main area) |
| Surface | `white` / `dark:bg-zinc-900` | Cards, sidebar, topbar |
| Border | `zinc-200` / `dark:zinc-800` | Card borders |
| Text | `zinc-900` / `zinc-500` secondary / `zinc-400` tertiary | |

Status colors (canonical, use everywhere): **amber** = Pending · **blue (primary)** = Approved · **emerald** = Disbursed/Paid · **rose** = Rejected/Overdue/Arrears · **orange (accent)** = Due today · **zinc** = Closed/neutral.

Chart palette (recharts): blue `#0D44A2`, orange `#F57424`, emerald `#10B981`, rose `#F43F5E`, amber `#F59E0B`. (CSS `--chart-*` vars are still grayscale — migrate them to these when touched.)

### Layout (from `app/(dashboard)/layout.tsx` — do not redesign)

- **Sidebar** (`components/layout/sidebar.tsx`): fixed `w-72`, white, user card (avatar + name + role + **Authority Limit**), nav items `rounded-2xl` — active item = `bg-primary text-white shadow-md`, "Apply for Loan" button, branch + logout footer. Mobile = drawer with overlay.
- **Topbar** (`components/layout/topbar.tsx`): `h-14 sm:h-16`, white, border-b, page title from route, search (`hidden md:block`), branch selector, notifications, user menu, logout.
- **Main**: `bg-[#F8FAFC] p-4 sm:p-6 overflow-y-auto`, max width `max-w-5xl mx-auto` for dense pages (schedule).
- Dark mode: always provide `dark:` variants via the `.dark` class. `text-zinc-900 dark:text-zinc-50` pattern.

### Standard page anatomy (every new page follows this)

1. **Header card** — white card (`rounded-[20px] sm:rounded-[24px] border border-zinc-200 shadow-sm p-4 sm:p-5`), title `text-lg sm:text-xl font-black tracking-tight` + subtitle `text-xs text-zinc-400`, action buttons top-right.
2. **KPI row** — `grid grid-cols-2 sm:grid-cols-4 gap-2.5`, small white tiles: label `text-[10px] font-bold uppercase tracking-wider text-zinc-400`, value `text-xl font-black`.
3. **Main card** — white card with filter row (search input + selects) and a table. Table: header `text-[10px] uppercase tracking-wider font-bold text-zinc-400`, rows `text-xs`/`text-sm`, `border-b border-zinc-100`.
4. **Detail views** — `Sheet` drawer, never separate routes.
5. **States** — loading: `Loader2 animate-spin`; empty: centered icon + `text-xs text-zinc-400`; error: message + retry. Never blank.

### Component & radius rules

| Element | Standard |
|---|---|
| Cards / panels / tiles | `rounded-[20px] sm:rounded-[24px]`, `border border-zinc-200 dark:border-zinc-800`, `shadow-sm` |
| Buttons | Primary: `bg-primary hover:bg-[#0A3682] text-white`; ghost: `hover:bg-zinc-100`; radius `rounded-xl`/`rounded-2xl`, `h-9`-ish |
| Inputs / selects / search | `rounded-lg`–`xl`, `border-zinc-200`, `bg-zinc-50`, focus ring `ring-primary/20` |
| Badges / chips / status pills | `rounded-lg`, `px-2 py-0.5`, `text-[10px] font-bold` with `-50`/`border-200` + `-700` color pairs |
| Icons | `lucide-react`, `size-4`/`size-5` |

**No other arbitrary radii** (`rounded-[18px]`, `[28px]`, `[32px]` are banned in new code; migrate when touching files).

### Mobile-first (non-negotiable)

This product is used in the field on phones — **mobile is the primary experience, desktop is the enhancement.** Every page ships mobile-first: build the mobile layout first, then layer `sm:`/`md:`/`lg:` variants on top. `pnpm dev` default viewport is mobile; verify at 375px before anything else.

1. **Layout hierarchy:** single column on mobile (header card → KPIs → main card → details). Use `grid-cols-2 sm:grid-cols-4` for KPIs (never 4 cramped tiles on a phone), `grid-cols-1 md:grid-cols-3` for split layouts. The calendar page (`/schedule`) is the reference: week-strip view on mobile (`md:hidden`), month grid on `md:`+.
2. **Touch targets:** interactive elements ≥ 40px tall (`h-10`+ buttons/inputs, `p-2`+ for icon buttons). Tappable calendar days are full-width cells with visible selection state.
3. **No horizontal scrolling pages:** don't ship a page that scrolls sideways; tables that must be wide (`overflow-x-auto`) are the exception — otherwise convert to stacked card lists on mobile.
4. **Navigation:** sidebar is a drawer on mobile (`components/layout/sidebar.tsx` handles it) — new nav items automatically appear in the drawer; keep labels short.
5. **Inputs:** use full-width inputs; native `<select>`/`<input type="date">` where mobile keyboards/pickers help; mobile-friendly `captureMode` for camera captures (`clients` page is the reference).
6. **Gesture patterns:** swipe to change calendar weeks; tap targets must be the primary action — no hover-dependent UI (hover only enhances desktop).
7. **Verify via the user, not a browser** — never run automated browser checks yourself; after the build/lint pass, ask the user to manually check the calendar week strip, drawers, modals, and tables at mobile width (375px) and end-to-end.

### Design hard rules

1. **Only real Tailwind classes.** `zinc-150`, `zinc-650`, `zinc-850` do NOT exist — use `zinc-200`, `zinc-600`, `zinc-800` instead. (13 files currently violate this — fix whenever a file is touched.)
2. **Status badges come from a shared component** — `components/ui/status-badge.tsx` with one canonical status → style map. Do NOT hand-roll per-page `STATUS_CFG` maps in new code; migrate pages to the shared component as they're touched. Extend the map with new statuses (Almost Due / Due / Arrears / Past Maturity / Defaulter) when loan statuses grow.
3. **Money is formatted one way** — shared helper `formatKES()` in `app/lib/format.ts`: `Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 })` → `KES 12,500`. Never hardcode `"KES "` strings, never bare `.toLocaleString()`. Add `formatDate()` (en-KE) alongside. Migrate the 54 existing call sites as files are touched.
4. **No hardcoded demo data.** No fallback numbers (`|| 24500000`), fake activity logs, or fake save timers in new code. Dashboard/settings still violate this — leave until explicitly tasked.
5. **Consistency over cleverness.** New UI copies the structure of the nearest existing page (loans/repayments are good templates) rather than inventing new patterns.
6. **Design changes are business decisions.** Any change to brand tokens, layout structure, page anatomy, colors, naming, or copy in the user interface requires explicit user approval first. Propose, don't ship.

## Conventions

- Next.js 16 App Router, pages are `"use client"`, single-file, no `route.ts`.
- All HTTP via `features/*/api.ts` (canonical module: `features/clients/api.ts`) using the axios instance from `app/lib/api.ts`. Never call axios from a page. Add typed API functions there.
- Data: TanStack Query (`useQuery`/`useMutation` + `useQueryClient`), forms: react-hook-form + zod, toasts: `sonner`, tables: plain tables or TanStack Table, charts: recharts.
- No `any`, `async/await`, small components, file-local `// ── Section ──` divider comments like existing pages.
- Reuse `components/ui/*` primitives (button, input, select, sheet, dialog, badge, card...) — don't rebuild them.
- JWT: cookie `faraja_token` (`app/lib/auth.ts`); layout guards `/dashboard` routes and redirects to `/login?expired=true` on 401.
- **No self-verification in a browser.** Do NOT launch browsers or automated UI checks. When you finish important UI changes: run `pnpm build` + `pnpm lint`, then ask the user to do a manual end-to-end check (give them the run commands and what to look for).

## Commands

```bash
pnpm dev      # :3000
pnpm build    # MUST pass — this is what Vercel runs
pnpm lint     # eslint (84 pre-existing issues; fix only what you introduced)
```

## Boundaries

- Do not redesign existing pages/layout unless explicitly asked.
- No dependency additions without approval (`package.json`/`pnpm-lock.yaml`).
- No commits unless asked. Don't touch backend files from this frontend context.
- Business decisions (statuses, labels, colors, wording, fee/rate display) go to the user — always.

---
*Keep this file in sync with the design system: when tokens or anatomy change, update here and the root `../AGENTS.md`.*
