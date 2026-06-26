# Diagram Editor: Snap-to-Grid Toggle & Enterprise Icon Library

**Date:** 2026-06-22
**Status:** Approved

---

## Overview

Extend the Excalidraw-based diagram editor with two features:

1. **Snap-to-Grid toggle** — a header button to turn grid snapping on or off
2. **Enterprise Icon Library** — six new stencil groups (people, buildings, org, devices, network, security) added to the existing Shapes tab

---

## 1. Snap-to-Grid Toggle

### Current state

`initialData.appState` already passes `gridSize: 20` to Excalidraw, so grid snap is silently on by default. There is no UI control visible to the user.

### Design

- Add a `gridEnabled` boolean to `DiagramEditor` state, defaulting to `true`.
- Add a **Grid** toggle button in the header, between the version label and the Save button.
- Button appearance: grid icon (Lucide `Grid3x3`) + "Grid" label. Active state uses `bg-slate-100 text-slate-800 ring-1 ring-slate-300`; inactive uses muted text with no ring.
- On click: toggle `gridEnabled`, then call:
  ```ts
  excalidrawAPI.updateScene({
    appState: { gridSize: nextEnabled ? GRID : null }
  });
  ```
- `GRID` constant stays at `20` (unchanged).
- No persistence — grid state resets to on when the page is refreshed (consistent with Excalidraw's own behaviour).

### Constraints

- Only enabled when `excalidrawAPI` is non-null (button disabled while canvas is loading).

---

## 2. Enterprise Icon Library

### Current state

The Shapes tab renders `STENCIL_GROUPS` from `stencils.ts`. Current groups: **General** (8 items), **AWS** (10 items), **Labels** (1 item).

All stencils follow the `labeledShape()` helper pattern: a named shape (rectangle / ellipse / diamond) with a centred text label bound to it, placed at a grid-snapped offset near the viewport centre.

### New stencil groups

Six groups are added to `stencils.ts`, each with six items. All new stencils use `roughness: 0` and the `labeledShape()` helper, consistent with existing stencils.

#### People & Roles (colour palette: amber/yellow)

| ID | Label | Shape | Stroke | Fill |
|---|---|---|---|---|
| `person` | Person | ellipse 100×100 | `#e67700` | `#fff9db` |
| `team` | Team | rectangle 180×80 | `#e67700` | `#fff9db` |
| `executive` | Executive | rectangle 160×80 | `#d9480f` | `#fff4e6` |
| `external-user` | External User | ellipse 100×100 | `#868e96` | `#f8f9fa` |
| `admin` | Admin / Operator | diamond 140×80 | `#c92a2a` | `#fff5f5` |
| `customer` | Customer | ellipse 100×100 | `#2f9e44` | `#ebfbee` |

#### Buildings & Places (colour palette: teal/cyan)

| ID | Label | Shape | Stroke | Fill |
|---|---|---|---|---|
| `office` | Office / HQ | rectangle 180×100 | `#0c8599` | `#e3fafc` |
| `data-centre` | Data Centre | rectangle 200×100 | `#1971c2` | `#e7f5ff` |
| `factory` | Factory | rectangle 200×100 | `#495057` | `#f8f9fa` |
| `hospital` | Hospital | rectangle 180×100 | `#c92a2a` | `#fff5f5` |
| `store` | Store / Retail | rectangle 160×80 | `#2f9e44` | `#ebfbee` |
| `branch-office` | Branch Office | rectangle 160×80 | `#0c8599` | `#e3fafc` |

#### Organisation (colour palette: violet/purple)

| ID | Label | Shape | Stroke | Fill |
|---|---|---|---|---|
| `department` | Department | rectangle 200×100 | `#7950f2` | `#f3f0ff` |
| `business-unit` | Business Unit | rectangle 200×100 | `#6741d9` | `#f3f0ff` |
| `subsidiary` | Subsidiary | rectangle 180×80 | `#862e9c` | `#f8f0fc` |
| `group-boundary` | Group Boundary | rectangle 300×200 dashed strokeWidth 1 transparent fill | `#7950f2` | `transparent` |
| `cost-centre` | Cost Centre | diamond 160×80 | `#7950f2` | `#f3f0ff` |
| `third-party` | Third Party | rectangle 180×80 dashed | `#868e96` | `#f8f9fa` |

#### Devices (colour palette: slate/indigo)

| ID | Label | Shape | Stroke | Fill |
|---|---|---|---|---|
| `laptop` | Laptop | rectangle 160×80 | `#364fc7` | `#edf2ff` |
| `mobile` | Mobile / Phone | rectangle 80×140 | `#364fc7` | `#edf2ff` |
| `tablet` | Tablet | rectangle 120×160 | `#364fc7` | `#edf2ff` |
| `printer` | Printer | rectangle 140×80 | `#495057` | `#f8f9fa` |
| `iot-device` | IoT Device | ellipse 100×80 | `#0c8599` | `#e3fafc` |
| `workstation` | Workstation | rectangle 160×100 | `#495057` | `#f8f9fa` |

#### Network (colour palette: green/teal)

| ID | Label | Shape | Stroke | Fill |
|---|---|---|---|---|
| `router` | Router | diamond 140×80 | `#2f9e44` | `#ebfbee` |
| `switch` | Switch | rectangle 160×60 | `#2f9e44` | `#ebfbee` |
| `proxy` | Proxy | rectangle 160×60 | `#0c8599` | `#e3fafc` |
| `vpn-gateway` | VPN Gateway | rectangle 160×60 | `#1971c2` | `#e7f5ff` |
| `wifi-ap` | Wi-Fi AP | ellipse 100×80 | `#2f9e44` | `#ebfbee` |
| `dns` | DNS | rectangle 140×60 | `#495057` | `#f8f9fa` |

#### Security (colour palette: red/dark)

| ID | Label | Shape | Stroke | Fill |
|---|---|---|---|---|
| `idp` | Identity Provider | rectangle 180×80 | `#c92a2a` | `#fff5f5` |
| `auth-server` | Auth Server | rectangle 160×80 | `#c92a2a` | `#fff5f5` |
| `waf` | WAF | diamond 160×80 | `#c92a2a` | `#fff5f5` |
| `secrets-vault` | Secrets Vault | rectangle 140×80 | `#862e9c` | `#f8f0fc` |
| `cert-authority` | Cert Authority | rectangle 160×80 | `#495057` | `#f8f9fa` |
| `siem` | SIEM | rectangle 160×80 | `#c92a2a` | `#fff5f5` |

### Shapes tab UX

No change to the tab layout. The new groups appear below the existing three (General, AWS, Labels), in order: People & Roles → Buildings & Places → Organisation → Devices → Network → Security. The left panel is already scrollable so no layout changes are needed.

---

## Files Changed

| File | Change |
|---|---|
| `components/diagrams/stencils.ts` | Add 6 new `StencilGroup` entries (36 stencil items) |
| `components/diagrams/DiagramEditor.tsx` | Add `gridEnabled` state + Grid toggle button in header |

---

## Out of Scope

- SVG/image-based icons (all stencils remain shape+label, consistent with existing approach)
- Grid size selector (fixed at 20px)
- Persistence of grid toggle state
- Search/filter within the Shapes tab
