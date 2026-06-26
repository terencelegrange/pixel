# Diagram Grid Toggle & Enterprise Icon Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a snap-to-grid toggle button to the diagram editor header and expand the Shapes panel with six new enterprise icon stencil groups (36 items total).

**Architecture:** All changes are purely client-side. `stencils.ts` gets six new `StencilGroup` entries appended after the existing three. `DiagramEditor.tsx` gets a `gridEnabled` boolean state and a header button that calls `excalidrawAPI.updateScene` to set `appState.gridSize` to either `20` or `null`.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Excalidraw, Lucide React, Tailwind CSS v3.

## Global Constraints

- `roughness: 0` on all new stencil shapes (matches existing pattern)
- All new stencil items use the existing `labeledShape()` helper — no new shape factories
- Grid size constant `GRID = 20` is unchanged
- No new dependencies — `Grid3x3` is already in `lucide-react`
- TypeScript strict — no `any` without `// eslint-disable` comment
- Run `npx tsc --noEmit` to verify types after each task

---

### Task 1: Add enterprise stencil groups to `stencils.ts`

**Files:**
- Modify: `components/diagrams/stencils.ts`

**Interfaces:**
- Consumes: existing `labeledShape()`, `baseEl()`, `StencilGroup` type
- Produces: `STENCIL_GROUPS` extended with 6 new entries — consumed by the existing Shapes tab renderer in `DiagramEditor.tsx` (no change needed there)

- [ ] **Step 1: Append the six new groups to `STENCIL_GROUPS` in `stencils.ts`**

Open `components/diagrams/stencils.ts`. After the closing `}` of the `Labels` group entry and before the closing `]` of the `STENCIL_GROUPS` array, add:

```ts
  // ── People & Roles ───────────────────────────────────────────────────────
  {
    title: "People & Roles",
    items: [
      {
        id: "person",
        label: "Person",
        emoji: "👤",
        createElement: (x, y) =>
          labeledShape("ellipse", x, y, 100, 100, "Person", "#e67700", "#fff9db"),
      },
      {
        id: "team",
        label: "Team",
        emoji: "👥",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 180, 80, "Team", "#e67700", "#fff9db", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "executive",
        label: "Executive",
        emoji: "🧑‍💼",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 80, "Executive", "#d9480f", "#fff4e6", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "external-user",
        label: "External User",
        emoji: "🧑‍🤝‍🧑",
        createElement: (x, y) =>
          labeledShape("ellipse", x, y, 100, 100, "External User", "#868e96", "#f8f9fa"),
      },
      {
        id: "admin",
        label: "Admin / Operator",
        emoji: "🛡️",
        createElement: (x, y) =>
          labeledShape("diamond", x, y, 140, 80, "Admin", "#c92a2a", "#fff5f5"),
      },
      {
        id: "customer",
        label: "Customer",
        emoji: "🤝",
        createElement: (x, y) =>
          labeledShape("ellipse", x, y, 100, 100, "Customer", "#2f9e44", "#ebfbee"),
      },
    ],
  },

  // ── Buildings & Places ───────────────────────────────────────────────────
  {
    title: "Buildings & Places",
    items: [
      {
        id: "office",
        label: "Office / HQ",
        emoji: "🏢",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 180, 100, "Office / HQ", "#0c8599", "#e3fafc", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "data-centre",
        label: "Data Centre",
        emoji: "🏭",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 200, 100, "Data Centre", "#1971c2", "#e7f5ff", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "factory",
        label: "Factory",
        emoji: "🏗️",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 200, 100, "Factory", "#495057", "#f8f9fa", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "hospital",
        label: "Hospital",
        emoji: "🏥",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 180, 100, "Hospital", "#c92a2a", "#fff5f5", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "store",
        label: "Store / Retail",
        emoji: "🏪",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 80, "Store / Retail", "#2f9e44", "#ebfbee", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "branch-office",
        label: "Branch Office",
        emoji: "🏬",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 80, "Branch Office", "#0c8599", "#e3fafc", {
            roundness: { type: 3, value: 8 },
          }),
      },
    ],
  },

  // ── Organisation ─────────────────────────────────────────────────────────
  {
    title: "Organisation",
    items: [
      {
        id: "department",
        label: "Department",
        emoji: "🗂️",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 200, 100, "Department", "#7950f2", "#f3f0ff", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "business-unit",
        label: "Business Unit",
        emoji: "🏛️",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 200, 100, "Business Unit", "#6741d9", "#f3f0ff", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "subsidiary",
        label: "Subsidiary",
        emoji: "🔗",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 180, 80, "Subsidiary", "#862e9c", "#f8f0fc", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "group-boundary",
        label: "Group Boundary",
        emoji: "⬜",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 300, 200, "Group", "#7950f2", "transparent", {
            strokeStyle: "dashed",
            strokeWidth: 1,
          }),
      },
      {
        id: "cost-centre",
        label: "Cost Centre",
        emoji: "💰",
        createElement: (x, y) =>
          labeledShape("diamond", x, y, 160, 80, "Cost Centre", "#7950f2", "#f3f0ff"),
      },
      {
        id: "third-party",
        label: "Third Party",
        emoji: "🤝",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 180, 80, "Third Party", "#868e96", "#f8f9fa", {
            strokeStyle: "dashed",
            roundness: { type: 3, value: 8 },
          }),
      },
    ],
  },

  // ── Devices ──────────────────────────────────────────────────────────────
  {
    title: "Devices",
    items: [
      {
        id: "laptop",
        label: "Laptop",
        emoji: "💻",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 80, "Laptop", "#364fc7", "#edf2ff", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "mobile",
        label: "Mobile / Phone",
        emoji: "📱",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 80, 140, "Mobile", "#364fc7", "#edf2ff", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "tablet",
        label: "Tablet",
        emoji: "📲",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 120, 160, "Tablet", "#364fc7", "#edf2ff", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "printer",
        label: "Printer",
        emoji: "🖨️",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 140, 80, "Printer", "#495057", "#f8f9fa", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "iot-device",
        label: "IoT Device",
        emoji: "📡",
        createElement: (x, y) =>
          labeledShape("ellipse", x, y, 100, 80, "IoT Device", "#0c8599", "#e3fafc"),
      },
      {
        id: "workstation",
        label: "Workstation",
        emoji: "🖥️",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 100, "Workstation", "#495057", "#f8f9fa", {
            roundness: { type: 3, value: 4 },
          }),
      },
    ],
  },

  // ── Network ───────────────────────────────────────────────────────────────
  {
    title: "Network",
    items: [
      {
        id: "router",
        label: "Router",
        emoji: "📶",
        createElement: (x, y) =>
          labeledShape("diamond", x, y, 140, 80, "Router", "#2f9e44", "#ebfbee"),
      },
      {
        id: "switch",
        label: "Switch",
        emoji: "🔀",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 60, "Switch", "#2f9e44", "#ebfbee", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "proxy",
        label: "Proxy",
        emoji: "🔄",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 60, "Proxy", "#0c8599", "#e3fafc", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "vpn-gateway",
        label: "VPN Gateway",
        emoji: "🔒",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 60, "VPN Gateway", "#1971c2", "#e7f5ff", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "wifi-ap",
        label: "Wi-Fi AP",
        emoji: "📡",
        createElement: (x, y) =>
          labeledShape("ellipse", x, y, 100, 80, "Wi-Fi AP", "#2f9e44", "#ebfbee"),
      },
      {
        id: "dns",
        label: "DNS",
        emoji: "🌐",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 140, 60, "DNS", "#495057", "#f8f9fa", {
            roundness: { type: 3, value: 4 },
          }),
      },
    ],
  },

  // ── Security ──────────────────────────────────────────────────────────────
  {
    title: "Security",
    items: [
      {
        id: "idp",
        label: "Identity Provider",
        emoji: "🪪",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 180, 80, "Identity Provider", "#c92a2a", "#fff5f5", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "auth-server",
        label: "Auth Server",
        emoji: "🔑",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 80, "Auth Server", "#c92a2a", "#fff5f5", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "waf",
        label: "WAF",
        emoji: "🛡️",
        createElement: (x, y) =>
          labeledShape("diamond", x, y, 160, 80, "WAF", "#c92a2a", "#fff5f5"),
      },
      {
        id: "secrets-vault",
        label: "Secrets Vault",
        emoji: "🔐",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 140, 80, "Secrets Vault", "#862e9c", "#f8f0fc", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "cert-authority",
        label: "Cert Authority",
        emoji: "📜",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 80, "Cert Authority", "#495057", "#f8f9fa", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "siem",
        label: "SIEM",
        emoji: "🔍",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 80, "SIEM", "#c92a2a", "#fff5f5", {
            roundness: { type: 3, value: 8 },
          }),
      },
    ],
  },
```

- [ ] **Step 2: Verify TypeScript types**

```bash
cd c:/Development/pixel && npx tsc --noEmit
```

Expected: no errors. If you see `Type '"dashed"' is not assignable`, check that `strokeStyle` is inside the `extra` object (third arg), not at the top level.

- [ ] **Step 3: Commit**

```bash
git -C c:/Development/pixel add components/diagrams/stencils.ts
git -C c:/Development/pixel commit -m "feat(diagrams): add 6 enterprise stencil groups (people, buildings, org, devices, network, security)"
```

---

### Task 2: Add snap-to-grid toggle button to `DiagramEditor.tsx`

**Files:**
- Modify: `components/diagrams/DiagramEditor.tsx`

**Interfaces:**
- Consumes: `excalidrawAPI.updateScene({ appState: { gridSize: number | null } })`, `GRID` constant (already defined at top of file)
- Produces: visible Grid toggle button in header; `gridEnabled` state controls Excalidraw grid snap

- [ ] **Step 1: Add `Grid3x3` to the lucide-react import**

Find the existing lucide-react import line (line 8):

```ts
import {
  ArrowLeft, Save, History, Search, Plus, RotateCcw,
  Check, Loader2,
} from "lucide-react";
```

Replace with:

```ts
import {
  ArrowLeft, Save, History, Search, Plus, RotateCcw,
  Check, Loader2, Grid3x3,
} from "lucide-react";
```

- [ ] **Step 2: Add `gridEnabled` state after the existing canvas state block**

Find this line (after the `isSaving` / `saveError` / `saveSuccess` state declarations):

```ts
  // ── Excalidraw API ref ───────────────────────────────────────────────────
```

Insert before it:

```ts
  // ── Grid toggle ───────────────────────────────────────────────────────────
  const [gridEnabled, setGridEnabled] = useState(true);
```

- [ ] **Step 3: Add the grid toggle handler after the `onCanvasChange` callback**

Find:

```ts
  // ── Place an asset node on canvas ─────────────────────────────────────────
```

Insert before it:

```ts
  // ── Grid toggle ───────────────────────────────────────────────────────────
  const handleGridToggle = useCallback(() => {
    if (!excalidrawAPI) return;
    const next = !gridEnabled;
    setGridEnabled(next);
    excalidrawAPI.updateScene({
      appState: { gridSize: next ? GRID : null },
    });
  }, [excalidrawAPI, gridEnabled]);

```

- [ ] **Step 4: Add the Grid button to the header**

Find this block in the header JSX (the right-side save controls):

```tsx
        {saveError && (
          <span className="text-xs text-red-600">{saveError}</span>
        )}
```

Insert this button immediately before that block:

```tsx
        <button
          onClick={handleGridToggle}
          disabled={!excalidrawAPI}
          title={gridEnabled ? "Disable grid snap" : "Enable grid snap"}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            gridEnabled
              ? "bg-slate-100 text-slate-800 ring-1 ring-slate-300"
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <Grid3x3 className="h-4 w-4" />
          Grid
        </button>

```

- [ ] **Step 5: Verify TypeScript types**

```bash
cd c:/Development/pixel && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Smoke-test in browser**

Start the dev server if not already running:

```bash
cd c:/Development/pixel && npm run dev
```

Open `http://localhost:3000/diagrams`, open any diagram. Verify:

1. Header shows a **Grid** button with a grid icon, visually active (light grey background, ring)
2. Clicking **Grid** toggles it to inactive state (no ring, muted text) and removes grid snap from the canvas — shapes placed via the left panel no longer snap
3. Clicking **Grid** again re-enables snap
4. The **Shapes** tab in the left panel now shows all 9 groups scrolling correctly: General, AWS, Labels, People & Roles, Buildings & Places, Organisation, Devices, Network, Security
5. Clicking any new stencil (e.g. "Office / HQ" from Buildings, "Person" from People) places a correctly-coloured, labelled shape on the canvas

- [ ] **Step 7: Commit**

```bash
git -C c:/Development/pixel add components/diagrams/DiagramEditor.tsx
git -C c:/Development/pixel commit -m "feat(diagrams): add snap-to-grid toggle button to editor header"
```
