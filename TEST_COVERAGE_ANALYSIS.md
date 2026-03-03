# Test Coverage Analysis — Howard Protocol V3

## Current State: Zero Formal Test Coverage

The codebase currently has **no testing framework installed**, **no test files** (`.test.ts` / `.spec.ts`), **no coverage configuration**, and **no test scripts** in `package.json`. The only test-like file is `test-blog.js`, a 20-line manual query script.

This is a significant risk given that the platform contains complex health, nutrition, and medical-advisory logic that directly affects client outcomes.

---

## Critical Areas Requiring Tests (Priority Order)

### 1. Health Score Engine — `lib/health-score-engine.ts` (Critical)

**Why:** Users see A–D grades based on this engine. Incorrect scores erode trust and could misguide health decisions.

**What to test:**
- Weighted average calculation across 5 pillars (sleep 20%, nutrition 20%, training 20%, supplements 15%, wellness 25%)
- Grade boundary thresholds: A >= 80, B >= 65, C >= 50, D < 50
- Null/missing wellness data defaulting to 50
- Lab penalty capping at -20
- Edge cases: all-zero input, all-perfect input, score exactly on boundary (80.0 → A, not B)
- Invalid inputs: `stress_level` outside 1–5 range (code does `6 - stress`, so 10 → -4)

**Potential bugs found:**
- No guard against `NaN` propagation if any pillar input is undefined
- Reversed stress formula fails silently with out-of-range values

---

### 2. Lab Status Calculator — `utils/labStatus.ts` (Critical)

**Why:** Interprets blood test results as normal/attention/alert. Incorrect classification could cause users to ignore real health issues or panic over normal values.

**What to test:**
- "Lower is better" markers (e.g., HOMA-IR: ≤2.0 normal, ≤2.5 attention, >2.5 alert)
- Range-based markers (e.g., TSH: 0.4–4.0 normal)
- "Higher is better" markers (e.g., HDL-C: ≥40 normal)
- Gender-specific thresholds (female vs male variants for ferritin, hemoglobin, etc.)
- Unknown test names → returns 'normal' by default (is this desirable?)
- Exact boundary values (e.g., HOMA-IR = 2.0 exactly)
- Invalid inputs: `NaN`, `Infinity`, negative values, string coercion

---

### 3. Nutrition Engine — `lib/nutrition-engine.ts` (Critical)

**Why:** 2,300+ lines of macro calculation logic. Drives daily calorie/protein/carb/fat targets for clients.

**What to test:**
- Katch-McArdle BMR calculation from body fat %, height, and weight
- TDEE estimation with activity multipliers
- Cut deficit and bulk surplus calculations
- Deadline-driven calculations (weight loss timeline math)
- Weekly weight trend analysis and adaptive adjustments
- Peak week carb cycling logic (male vs female differences)
- Fallback estimation when body composition data (height, body fat) is missing

**Potential bugs found:**
- `bodyWeight = 0` silently produces 0 protein target (should throw/guard)
- No cap on extreme deficit rates for very short deadlines (<7 days)
- Division-by-zero risk in `avgDailyCalories / multiplier` paths

---

### 4. Lab Nutrition Advisor — `lib/lab-nutrition-advisor.ts` (High)

**Why:** 1,400+ lines generating dietary recommendations from 30+ blood markers. References medical literature.

**What to test:**
- Alert-level lab values trigger high-severity advice
- Attention-level values trigger medium-severity advice
- Normal values are correctly skipped
- Gender-specific recommendation paths
- Goal-type variations (cut vs bulk → different food suggestions)
- Multiple triggered markers don't produce duplicate recommendations

**Potential bugs found:**
- String matching via regex: unicode dashes (`–`, `—`) vs ASCII `-` cause match failures
- `matchName()` normalizer doesn't handle tabs/newlines in test names

---

### 5. Validation Functions — `utils/validation.ts` (High)

**Why:** Guards all user input across the platform. Validation bugs = data integrity issues or XSS vectors.

**What to test:**
- `validateLabValue()`: numeric type checking, positive ranges, NaN handling
- `validateSupplement()`: name length (1–100), XSS pattern rejection (`<script>`, case-insensitive)
- `validateDate()`: future date rejection, boundary years (1900, 2100), exact-today edge case
- `validateBodyComposition()`: height (100–250 cm), weight (20–300 kg), body fat (1–60%)
- Type coercion: string `"50"` vs number `50` (both pass `isNaN` but differ in `typeof`)

**Potential bugs found:**
- `validateBodyComposition()` lacks XSS validation (present in supplement names)
- Inconsistent use of `<` vs `<=` for range boundary checks

---

### 6. CSV Parser — `lib/csv-parser.ts` (High)

**Why:** Used for data import. Silent parsing failures corrupt client data.

**What to test:**
- Standard CSV with headers and data rows
- Empty CSV / headers-only / single row
- Quoted fields containing commas (`"Smith, John"`)
- Escaped quotes (`"He said ""hello"""`)
- Inconsistent column counts across rows
- Non-numeric values fed to `parseFloat` → `NaN` fallback behavior
- Large file handling

**Potential bugs found:**
- No support for quoted fields — commas inside quotes break parsing
- `parseFloat` failures silently become `0` or `NaN` with no warning

---

### 7. Data Fetching — `utils/fetchClientData.ts` (High)

**Why:** Core data layer between Supabase and the UI. Bugs here affect every client portal page.

**What to test:**
- Client found with valid `expires_at` in the future
- Client not found → error thrown
- Client expired (exact-today edge case: `expires_at = today`)
- Partial query failures (client found but lab query fails → console.warn only)
- Empty result sets (no supplement logs, no body composition records)

**Potential bugs found:**
- `expires_at` = today: `new Date() < new Date("2026-03-03")` is `false` → throws expired error even though the day hasn't ended

---

### 8. Custom Hooks (Medium)

**`useDashboardStats.ts` (264 lines):**
- 20+ `useMemo` calculations for streaks, compliance rates, and trend data
- Streak calculation with date math (off-by-one risks)
- Division by zero when `totalSupplements = 0` in compliance rate

**`useLocalStorage.ts`:**
- SSR safety (server-side rendering without `window`)
- JSON parse errors with corrupted localStorage data

---

### 9. API Routes (Medium)

28 API route handlers with no tests. Priority targets:

| Route | Why |
|-------|-----|
| `api/body-composition/route.ts` (421 lines) | Complex validation + Supabase transactions |
| `api/lab-results/route.ts` | Medical data persistence |
| `api/ebook/checkout/route.ts` | Payment flow (ECPay integration) |
| `api/admin/login/route.ts` | Authentication security |
| `api/nutrition-suggestions/route.ts` | AI-generated health advice |

**What to test:** Request validation, authentication checks, error responses, Supabase mock interactions.

---

### 10. Large Interactive Components (Lower)

| Component | Lines | Why |
|-----------|-------|-----|
| `SelfManagedNutrition.tsx` | 739 | Complex form state + macro calculations |
| `TrainingLog.tsx` | 624 | Multi-step form submission |
| `NutritionLog.tsx` | 513 | Compliance tracking UI |
| `BodyComposition.tsx` | 488 | Measurement input + history |
| `DailyWellness.tsx` | 463 | Mood/sleep/stress input forms |

**What to test:** Form validation, submission handling, error states, loading states.

---

## Recommended Test Setup

### Framework: Vitest + React Testing Library

Vitest is recommended over Jest for this Next.js project because it offers faster execution, native ESM/TypeScript support, and better integration with the Vite ecosystem.

**Dependencies to add:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitejs/plugin-react
```

**Suggested `package.json` scripts:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Directory Structure
```
__tests__/
├── lib/
│   ├── health-score-engine.test.ts
│   ├── nutrition-engine.test.ts
│   ├── lab-nutrition-advisor.test.ts
│   ├── csv-parser.test.ts
│   └── supplement-engine.test.ts
├── utils/
│   ├── labStatus.test.ts
│   ├── validation.test.ts
│   └── fetchClientData.test.ts
├── hooks/
│   ├── useDashboardStats.test.ts
│   └── useLocalStorage.test.ts
├── api/
│   ├── body-composition.test.ts
│   ├── lab-results.test.ts
│   └── admin-login.test.ts
└── components/
    ├── SelfManagedNutrition.test.tsx
    ├── TrainingLog.test.tsx
    └── HealthAnalysis.test.tsx
```

---

## Coverage Targets

| Area | Current | Target | Estimated Test Count |
|------|---------|--------|---------------------|
| `lib/` (calculation engines) | 0% | 90% | ~300 tests |
| `utils/` (validation, data fetching) | 0% | 85% | ~120 tests |
| `hooks/` (custom hooks) | 0% | 75% | ~50 tests |
| API routes | 0% | 70% | ~150 tests |
| Components | 0% | 50% | ~100 tests |
| **Overall** | **0%** | **~75%** | **~720 tests** |

---

## Implementation Roadmap

### Phase 1 — Foundation (Week 1)
- Install Vitest + React Testing Library
- Configure `vitest.config.ts` with path aliases and jsdom environment
- Write tests for `utils/labStatus.ts` (~50 tests)
- Write tests for `utils/validation.ts` (~40 tests)
- Write tests for `lib/csv-parser.ts` (~20 tests)

### Phase 2 — Critical Logic (Week 2–3)
- Write tests for `lib/health-score-engine.ts` (~40 tests)
- Write tests for `lib/nutrition-engine.ts` (~100 tests)
- Write tests for `lib/lab-nutrition-advisor.ts` (~60 tests)
- Write tests for `lib/supplement-engine.ts` (~30 tests)

### Phase 3 — Data Layer (Week 3–4)
- Set up Supabase mocks
- Write tests for `utils/fetchClientData.ts` (~30 tests)
- Write tests for priority API routes (~80 tests)
- Write tests for custom hooks (~50 tests)

### Phase 4 — UI (Week 4+)
- Write component tests for large form components (~100 tests)
- Add snapshot tests for complex rendered output
- Consider Playwright for E2E flows (client login → data entry → score display)

---

## Summary

The codebase contains sophisticated health and nutrition logic with **zero test coverage**. The highest-risk areas are the calculation engines (`health-score-engine`, `nutrition-engine`, `labStatus`) because they directly influence health advice shown to users. Several potential bugs were identified during this analysis (null handling, boundary conditions, string matching fragility, division-by-zero risks) that would be caught by even basic unit tests.

The recommended approach is to start with pure function unit tests for `lib/` and `utils/` (highest value, lowest setup cost), then expand to API routes and components.
