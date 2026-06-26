# Application Dependency Map — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive dependency map — a `asset_dependencies` table, full CRUD API, portfolio map page with 3 React Flow layouts, and a per-asset Dependencies section on the asset detail page.

**Architecture:** New `asset_dependencies` table with UNIQUE constraint on `(source, target)` pair. Four API routes (GET all, POST, PUT/DELETE by id, GET per asset). React Flow (already installed) powers the portfolio `/dependencies` page (3 tabs: force-directed, layered via dagre, domain-clustered) and the mini map on the asset detail page. All UI follows the dark-mode-first Tailwind pattern used throughout the codebase.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, mysql2 pool, React Flow v11, @dagrejs/dagre (new dep), Tailwind CSS v3 darkMode:"class", Jest 29 unit tests.

## Global Constraints

- All API routes call `await setupDatabase()` then `getDb()` — no raw pool usage.
- All write operations call `writeAudit(...)` from `@/lib/audit` with correct `tableName`, `recordId`, `action`, `performedById`, `performedByName`, `oldValues`, `newValues`.
- MySQL column names use `snake_case`; TypeScript properties use `camelCase`.
- Dates returned from DB are `Date` objects — convert with `v instanceof Date ? v.toISOString() : String(v)`.
- All UI components must include `dark:` variants on every Tailwind class that has a visible difference in dark mode.
- React Flow components must be in `"use client"` files. Import `"reactflow/dist/style.css"` once at the top of the portfolio map page.
- Unit tests: `jest.mock(...)` calls go BEFORE all imports. `mockExecute` is a `jest.fn()` returned by `getDb().execute`. `jest.clearAllMocks()` in `beforeEach`. Import route handlers AFTER mock setup.
- `@dagrejs/dagre` ships its own types — do NOT install `@types/dagre`.
- New npm dependency: `@dagrejs/dagre` (install with `npm install @dagrejs/dagre`).
- New nav item: label `"Dependency Map"`, icon `"Network"`, href `"/dependencies"`, added to the `"Assets"` group in `config/navigation.ts` after `"PlantUML Diagrams"`.
- Asset detail page adds a Dependencies section card below the PlantUML Diagrams section (consistent with existing page pattern of sequential section cards — not a tab restructure).

---

### Task 1: DB Schema + TypeScript Types

**Files:**
- Modify: `lib/db.ts` — add `asset_dependencies` table inside `runSetup()` before the closing `}`
- Modify: `types/index.ts` — add 3 new exports (`DependencyConnectionType`, `DependencyDirection`, `AssetDependency`)

**Interfaces:**
- Produces: `AssetDependency`, `DependencyConnectionType`, `DependencyDirection` — used in Tasks 2, 3, 4, 5, 6, 7

- [ ] **Step 1: Add the table to `lib/db.ts`**

Find the last statement in `runSetup()` (after the `asset_roadmap_phases` table, line ~709) and insert before the closing `}`:

```typescript
  await db.execute(`
    CREATE TABLE IF NOT EXISTS asset_dependencies (
      id              CHAR(36)     NOT NULL,
      source_asset_id CHAR(36)     NOT NULL,
      target_asset_id CHAR(36)     NOT NULL,
      type            ENUM('API','Database','File Transfer','Event / Message','UI Embed','Other')
                                   NOT NULL DEFAULT 'API',
      direction       ENUM('outbound','bidirectional')
                                   NOT NULL DEFAULT 'outbound',
      notes           TEXT         NULL,
      created_by_id   CHAR(36)     NOT NULL,
      created_by_name VARCHAR(255) NOT NULL,
      created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_dep_pair (source_asset_id, target_asset_id),
      KEY idx_dep_source (source_asset_id),
      KEY idx_dep_target (target_asset_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
```

- [ ] **Step 2: Add types to `types/index.ts`**

Append at the end of the file:

```typescript
// ---------------------------------------------------------------------------
// Asset Dependencies
// ---------------------------------------------------------------------------
export type DependencyConnectionType =
  | 'API'
  | 'Database'
  | 'File Transfer'
  | 'Event / Message'
  | 'UI Embed'
  | 'Other';

export type DependencyDirection = 'outbound' | 'bidirectional';

export interface AssetDependency {
  id: string;
  sourceAssetId: string;
  sourceAssetName: string;
  sourceAssetIcon: string | null;
  sourceAssetDomain: string | null;
  targetAssetId: string;
  targetAssetName: string;
  targetAssetIcon: string | null;
  targetAssetDomain: string | null;
  type: DependencyConnectionType;
  direction: DependencyDirection;
  notes: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add lib/db.ts types/index.ts
git commit -m "feat: add asset_dependencies table and TypeScript types"
```

---

### Task 2: API GET + POST `/api/dependencies` + unit tests

**Files:**
- Create: `app/api/dependencies/route.ts`
- Create: `__tests__/unit/api/dependencies/route.test.ts`

**Interfaces:**
- Consumes: `AssetDependency`, `DependencyConnectionType`, `DependencyDirection` from `@/types`
- Produces: `GET /api/dependencies → { dependencies: AssetDependency[] }` and `POST → { id: string }` 201

- [ ] **Step 1: Write the tests first**

Create `__tests__/unit/api/dependencies/route.test.ts`:

```typescript
import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}));
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }));

import { getDb } from '@/lib/db';
import { GET, POST } from '@/app/api/dependencies/route';

const mockExecute = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (getDb as jest.Mock).mockReturnValue({ execute: mockExecute });
});

function makePostReq(body: object) {
  return new NextRequest('http://localhost/api/dependencies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  sourceAssetId: 'asset-1',
  targetAssetId: 'asset-2',
  type: 'API',
  direction: 'outbound',
  userId: 'u1',
  userName: 'Admin',
};

const mockRow = {
  id: 'd1', type: 'API', direction: 'outbound', notes: null,
  created_by_id: 'u1', created_by_name: 'Admin',
  created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
  source_asset_id: 'asset-1', source_asset_name: 'App A',
  source_asset_icon: 'Server', source_asset_domain: 'Infra',
  target_asset_id: 'asset-2', target_asset_name: 'App B',
  target_asset_icon: 'Database', target_asset_domain: 'Data',
};

describe('GET /api/dependencies', () => {
  it('returns mapped dependencies', async () => {
    mockExecute.mockResolvedValueOnce([[mockRow]]);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.dependencies).toHaveLength(1);
    expect(data.dependencies[0]).toMatchObject({
      id: 'd1',
      sourceAssetId: 'asset-1',
      sourceAssetName: 'App A',
      targetAssetId: 'asset-2',
      targetAssetName: 'App B',
      type: 'API',
      direction: 'outbound',
    });
  });
});

describe('POST /api/dependencies', () => {
  it('returns 400 when sourceAssetId missing', async () => {
    const res = await POST(makePostReq({ ...validBody, sourceAssetId: undefined }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when targetAssetId missing', async () => {
    const res = await POST(makePostReq({ ...validBody, targetAssetId: undefined }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on self-reference', async () => {
    const res = await POST(makePostReq({ ...validBody, targetAssetId: 'asset-1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/itself/);
  });

  it('returns 400 on invalid type', async () => {
    const res = await POST(makePostReq({ ...validBody, type: 'Fax' }));
    expect(res.status).toBe(400);
  });

  it('returns 401 when userId missing', async () => {
    const res = await POST(makePostReq({ ...validBody, userId: undefined }));
    expect(res.status).toBe(401);
  });

  it('returns 409 on reverse pair', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'existing-reverse' }]]);
    const res = await POST(makePostReq(validBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/reverse/);
  });

  it('returns 409 on duplicate pair (DB constraint)', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // no reverse pair
    const dbErr = Object.assign(new Error('Duplicate entry'), { errno: 1062 });
    mockExecute.mockRejectedValueOnce(dbErr);
    const res = await POST(makePostReq(validBody));
    expect(res.status).toBe(409);
  });

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // no reverse pair
    mockExecute.mockResolvedValueOnce([{}]); // INSERT succeeds
    const res = await POST(makePostReq(validBody));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(typeof data.id).toBe('string');
  });
});
```

- [ ] **Step 2: Run tests — confirm they all FAIL (file not found)**

Run: `npx jest __tests__/unit/api/dependencies/route.test.ts --no-coverage`
Expected: FAIL — `Cannot find module '@/app/api/dependencies/route'`

- [ ] **Step 3: Create `app/api/dependencies/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { AssetDependency, DependencyConnectionType, DependencyDirection } from "@/types";

const VALID_TYPES: DependencyConnectionType[] = [
  'API', 'Database', 'File Transfer', 'Event / Message', 'UI Embed', 'Other',
];
const VALID_DIRECTIONS: DependencyDirection[] = ['outbound', 'bidirectional'];

const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : String(v);

function mapRow(row: mysql.RowDataPacket): AssetDependency {
  return {
    id: row.id,
    sourceAssetId: row.source_asset_id,
    sourceAssetName: row.source_asset_name,
    sourceAssetIcon: row.source_asset_icon ?? null,
    sourceAssetDomain: row.source_asset_domain ?? null,
    targetAssetId: row.target_asset_id,
    targetAssetName: row.target_asset_name,
    targetAssetIcon: row.target_asset_icon ?? null,
    targetAssetDomain: row.target_asset_domain ?? null,
    type: row.type as DependencyConnectionType,
    direction: row.direction as DependencyDirection,
    notes: row.notes ?? null,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: toISO(row.created_at),
    updatedAt: toISO(row.updated_at),
  };
}

const JOIN_SQL = `
  SELECT
    d.id, d.type, d.direction, d.notes,
    d.created_by_id, d.created_by_name, d.created_at, d.updated_at,
    d.source_asset_id,
    sa.name  AS source_asset_name,
    sa.icon  AS source_asset_icon,
    sdom.name AS source_asset_domain,
    d.target_asset_id,
    ta.name  AS target_asset_name,
    ta.icon  AS target_asset_icon,
    tdom.name AS target_asset_domain
  FROM asset_dependencies d
  JOIN   assets sa   ON sa.id   = d.source_asset_id
  LEFT JOIN domains sdom ON sdom.id = sa.domain_id
  JOIN   assets ta   ON ta.id   = d.target_asset_id
  LEFT JOIN domains tdom ON tdom.id = ta.domain_id
`;

export async function GET() {
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `${JOIN_SQL} ORDER BY sa.name ASC, ta.name ASC`
    );
    return NextResponse.json({ dependencies: rows.map(mapRow) });
  } catch (err) {
    console.error("[GET /api/dependencies]", err);
    return NextResponse.json({ error: "Failed to load dependencies." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { sourceAssetId, targetAssetId, type, direction, notes, userId, userName } = body;

    if (!sourceAssetId)
      return NextResponse.json({ error: "sourceAssetId is required." }, { status: 400 });
    if (!targetAssetId)
      return NextResponse.json({ error: "targetAssetId is required." }, { status: 400 });
    if (sourceAssetId === targetAssetId)
      return NextResponse.json({ error: "An asset cannot depend on itself." }, { status: 400 });
    if (!type || !VALID_TYPES.includes(type))
      return NextResponse.json({ error: "Invalid type." }, { status: 400 });
    if (!direction || !VALID_DIRECTIONS.includes(direction))
      return NextResponse.json({ error: "direction must be outbound or bidirectional." }, { status: 400 });
    if (!userId || !userName)
      return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();

    // Check for reverse pair (DB UNIQUE KEY can't detect this automatically)
    const [rev] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM asset_dependencies WHERE source_asset_id = ? AND target_asset_id = ? LIMIT 1",
      [targetAssetId, sourceAssetId]
    );
    if (rev.length > 0) {
      return NextResponse.json(
        { error: "A dependency in the reverse direction already exists. Edit it and set direction to bidirectional instead." },
        { status: 409 }
      );
    }

    const id = randomUUID();
    try {
      await db.execute(
        `INSERT INTO asset_dependencies
           (id, source_asset_id, target_asset_id, type, direction, notes, created_by_id, created_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, sourceAssetId, targetAssetId, type, direction, notes?.trim() || null, userId, userName]
      );
    } catch (err: unknown) {
      const e = err as { errno?: number };
      if (e.errno === 1062) {
        return NextResponse.json(
          { error: "A dependency between these assets already exists." },
          { status: 409 }
        );
      }
      throw err;
    }

    await writeAudit({
      tableName: "asset_dependencies", recordId: id, action: "CREATE",
      performedById: userId, performedByName: userName,
      oldValues: null,
      newValues: { sourceAssetId, targetAssetId, type, direction, notes: notes?.trim() || null },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/dependencies]", err);
    return NextResponse.json({ error: "Failed to create dependency." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests — confirm all pass**

Run: `npx jest __tests__/unit/api/dependencies/route.test.ts --no-coverage`
Expected: 9 tests pass, 0 failures

- [ ] **Step 5: Commit**

```bash
git add app/api/dependencies/route.ts __tests__/unit/api/dependencies/route.test.ts
git commit -m "feat: add GET+POST /api/dependencies with unit tests"
```

---

### Task 3: API PUT + DELETE `/api/dependencies/[id]` + GET `/api/assets/[id]/dependencies` + tests

**Files:**
- Create: `app/api/dependencies/[id]/route.ts`
- Create: `app/api/assets/[id]/dependencies/route.ts`
- Create: `__tests__/unit/api/dependencies/id.test.ts`
- Create: `__tests__/unit/api/assets/dependencies.test.ts`

**Interfaces:**
- Consumes: `AssetDependency`, `DependencyConnectionType`, `DependencyDirection` from `@/types`
- Produces:
  - `PUT /api/dependencies/[id]` → `{ success: true }` 200, or `{ error }` 404
  - `DELETE /api/dependencies/[id]` → `{ success: true }` 200, or `{ error }` 404
  - `GET /api/assets/[id]/dependencies` → `{ downstream: AssetDependency[], upstream: AssetDependency[] }`
    - `downstream` = records where `source_asset_id = id` (this asset calls them)
    - `upstream` = records where `target_asset_id = id` (they call this asset)
    - Bidirectional handling: client merges — server returns raw directional data only

- [ ] **Step 1: Write tests for PUT + DELETE**

Create `__tests__/unit/api/dependencies/id.test.ts`:

```typescript
import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}));
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }));

import { getDb } from '@/lib/db';
import { PUT, DELETE } from '@/app/api/dependencies/[id]/route';

const mockExecute = jest.fn();
const params = { params: { id: 'dep-1' } };

beforeEach(() => {
  jest.clearAllMocks();
  (getDb as jest.Mock).mockReturnValue({ execute: mockExecute });
});

const makeReq = (method: string, body: object) =>
  new NextRequest('http://localhost/api/dependencies/dep-1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const existingRow = {
  id: 'dep-1', type: 'API', direction: 'outbound', notes: null,
  source_asset_id: 'a1', target_asset_id: 'a2',
  created_by_id: 'u1', created_by_name: 'Admin',
  created_at: new Date(), updated_at: new Date(),
};

describe('PUT /api/dependencies/[id]', () => {
  it('returns 404 when dependency not found', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // SELECT returns nothing
    const res = await PUT(
      makeReq('PUT', { type: 'API', direction: 'outbound', userId: 'u1', userName: 'Admin' }),
      params
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[existingRow]]); // SELECT found
    mockExecute.mockResolvedValueOnce([{}]);            // UPDATE
    const res = await PUT(
      makeReq('PUT', { type: 'Database', direction: 'bidirectional', notes: 'sync', userId: 'u1', userName: 'Admin' }),
      params
    );
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});

describe('DELETE /api/dependencies/[id]', () => {
  it('returns 404 when dependency not found', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // SELECT returns nothing
    const res = await DELETE(
      makeReq('DELETE', { userId: 'u1', userName: 'Admin' }),
      params
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[existingRow]]); // SELECT found
    mockExecute.mockResolvedValueOnce([{}]);            // DELETE
    const res = await DELETE(
      makeReq('DELETE', { userId: 'u1', userName: 'Admin' }),
      params
    );
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
```

- [ ] **Step 2: Write tests for per-asset GET**

Create `__tests__/unit/api/assets/dependencies.test.ts`:

```typescript
import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}));

import { getDb } from '@/lib/db';
import { GET } from '@/app/api/assets/[id]/dependencies/route';

const mockExecute = jest.fn();
const params = { params: { id: 'asset-1' } };

beforeEach(() => {
  jest.clearAllMocks();
  (getDb as jest.Mock).mockReturnValue({ execute: mockExecute });
});

const req = new NextRequest('http://localhost/api/assets/asset-1/dependencies');

const downstreamRow = {
  id: 'd1', type: 'API', direction: 'outbound', notes: null,
  created_by_id: 'u1', created_by_name: 'Admin',
  created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
  source_asset_id: 'asset-1', source_asset_name: 'App A',
  source_asset_icon: 'Server', source_asset_domain: 'Infra',
  target_asset_id: 'asset-2', target_asset_name: 'App B',
  target_asset_icon: 'Database', target_asset_domain: 'Data',
};

const upstreamRow = {
  ...downstreamRow, id: 'd2', direction: 'outbound',
  source_asset_id: 'asset-3', source_asset_name: 'App C',
  source_asset_icon: null, source_asset_domain: null,
  target_asset_id: 'asset-1', target_asset_name: 'App A',
  target_asset_icon: 'Server', target_asset_domain: 'Infra',
};

describe('GET /api/assets/[id]/dependencies', () => {
  it('returns downstream array (source_asset_id = id)', async () => {
    mockExecute.mockResolvedValueOnce([[downstreamRow]]); // downstream
    mockExecute.mockResolvedValueOnce([[]]);              // upstream (none)
    const res = await GET(req, params);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.downstream).toHaveLength(1);
    expect(data.downstream[0].sourceAssetId).toBe('asset-1');
  });

  it('returns upstream array (target_asset_id = id)', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // downstream (none)
    mockExecute.mockResolvedValueOnce([[upstreamRow]]); // upstream
    const res = await GET(req, params);
    const data = await res.json();
    expect(data.upstream).toHaveLength(1);
    expect(data.upstream[0].targetAssetId).toBe('asset-1');
  });

  it('returns bidirectional in both arrays', async () => {
    const bidiDown = { ...downstreamRow, direction: 'bidirectional' };
    mockExecute.mockResolvedValueOnce([[bidiDown]]); // downstream (bidi)
    mockExecute.mockResolvedValueOnce([[]]);          // upstream (none)
    const res = await GET(req, params);
    const data = await res.json();
    expect(data.downstream).toHaveLength(1);
    // Bidirectional also appears in upstream (client-side dedup handled by consumer)
    expect(data.upstream).toHaveLength(1);
    expect(data.upstream[0].direction).toBe('bidirectional');
  });

  it('returns empty arrays when no dependencies', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // downstream
    mockExecute.mockResolvedValueOnce([[]]); // upstream
    const res = await GET(req, params);
    const data = await res.json();
    expect(data.downstream).toHaveLength(0);
    expect(data.upstream).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests — confirm they FAIL**

Run: `npx jest __tests__/unit/api/dependencies/id.test.ts __tests__/unit/api/assets/dependencies.test.ts --no-coverage`
Expected: FAIL — module not found errors

- [ ] **Step 4: Create `app/api/dependencies/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { DependencyConnectionType, DependencyDirection } from "@/types";

const VALID_TYPES: DependencyConnectionType[] = [
  'API', 'Database', 'File Transfer', 'Event / Message', 'UI Embed', 'Other',
];
const VALID_DIRECTIONS: DependencyDirection[] = ['outbound', 'bidirectional'];

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { type, direction, notes, userId, userName } = body;

    if (!type || !VALID_TYPES.includes(type))
      return NextResponse.json({ error: "Invalid type." }, { status: 400 });
    if (!direction || !VALID_DIRECTIONS.includes(direction))
      return NextResponse.json({ error: "direction must be outbound or bidirectional." }, { status: 400 });
    if (!userId || !userName)
      return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_dependencies WHERE id = ? LIMIT 1",
      [params.id]
    );
    const current = rows[0];
    if (!current)
      return NextResponse.json({ error: "Dependency not found." }, { status: 404 });

    await db.execute(
      "UPDATE asset_dependencies SET type = ?, direction = ?, notes = ? WHERE id = ?",
      [type, direction, notes?.trim() || null, params.id]
    );

    await writeAudit({
      tableName: "asset_dependencies", recordId: params.id, action: "UPDATE",
      performedById: userId, performedByName: userName,
      oldValues: { type: current.type, direction: current.direction, notes: current.notes },
      newValues: { type, direction, notes: notes?.trim() || null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/dependencies/:id]", err);
    return NextResponse.json({ error: "Failed to update dependency." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const { userId, userName } = await req.json() as { userId?: string; userName?: string };

    if (!userId || !userName)
      return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_dependencies WHERE id = ? LIMIT 1",
      [params.id]
    );
    const current = rows[0];
    if (!current)
      return NextResponse.json({ error: "Dependency not found." }, { status: 404 });

    await db.execute("DELETE FROM asset_dependencies WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "asset_dependencies", recordId: params.id, action: "DELETE",
      performedById: userId, performedByName: userName,
      oldValues: {
        sourceAssetId: current.source_asset_id,
        targetAssetId: current.target_asset_id,
        type: current.type,
        direction: current.direction,
      },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/dependencies/:id]", err);
    return NextResponse.json({ error: "Failed to delete dependency." }, { status: 500 });
  }
}
```

- [ ] **Step 5: Create `app/api/assets/[id]/dependencies/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { AssetDependency, DependencyConnectionType, DependencyDirection } from "@/types";

const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : String(v);

function mapRow(row: mysql.RowDataPacket): AssetDependency {
  return {
    id: row.id,
    sourceAssetId: row.source_asset_id,
    sourceAssetName: row.source_asset_name,
    sourceAssetIcon: row.source_asset_icon ?? null,
    sourceAssetDomain: row.source_asset_domain ?? null,
    targetAssetId: row.target_asset_id,
    targetAssetName: row.target_asset_name,
    targetAssetIcon: row.target_asset_icon ?? null,
    targetAssetDomain: row.target_asset_domain ?? null,
    type: row.type as DependencyConnectionType,
    direction: row.direction as DependencyDirection,
    notes: row.notes ?? null,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: toISO(row.created_at),
    updatedAt: toISO(row.updated_at),
  };
}

const JOIN_SQL = (whereClause: string) => `
  SELECT
    d.id, d.type, d.direction, d.notes,
    d.created_by_id, d.created_by_name, d.created_at, d.updated_at,
    d.source_asset_id,
    sa.name   AS source_asset_name,
    sa.icon   AS source_asset_icon,
    sdom.name AS source_asset_domain,
    d.target_asset_id,
    ta.name   AS target_asset_name,
    ta.icon   AS target_asset_icon,
    tdom.name AS target_asset_domain
  FROM asset_dependencies d
  JOIN   assets sa   ON sa.id   = d.source_asset_id
  LEFT JOIN domains sdom ON sdom.id = sa.domain_id
  JOIN   assets ta   ON ta.id   = d.target_asset_id
  LEFT JOIN domains tdom ON tdom.id = ta.domain_id
  WHERE ${whereClause}
  ORDER BY sa.name ASC, ta.name ASC
`;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const db = getDb();

    const [downstreamRows] = await db.execute<mysql.RowDataPacket[]>(
      JOIN_SQL("d.source_asset_id = ?"), [params.id]
    );
    const [upstreamRows] = await db.execute<mysql.RowDataPacket[]>(
      JOIN_SQL("d.target_asset_id = ?"), [params.id]
    );

    // Bidirectional records appear in both lists
    const bidiFromDownstream = downstreamRows.filter((r) => r.direction === 'bidirectional');
    const bidiFromUpstream = upstreamRows.filter((r) => r.direction === 'bidirectional');

    return NextResponse.json({
      downstream: [...downstreamRows, ...bidiFromUpstream].map(mapRow),
      upstream:   [...upstreamRows,   ...bidiFromDownstream].map(mapRow),
    });
  } catch (err) {
    console.error("[GET /api/assets/:id/dependencies]", err);
    return NextResponse.json({ error: "Failed to load dependencies." }, { status: 500 });
  }
}
```

- [ ] **Step 6: Run tests — confirm all pass**

Run: `npx jest __tests__/unit/api/dependencies/id.test.ts __tests__/unit/api/assets/dependencies.test.ts --no-coverage`
Expected: 8 tests pass, 0 failures

- [ ] **Step 7: Run full test suite to check for regressions**

Run: `npx jest --no-coverage`
Expected: All previously passing tests still pass

- [ ] **Step 8: Commit**

```bash
git add "app/api/dependencies/[id]/route.ts" app/api/assets/[id]/dependencies/route.ts __tests__/unit/api/dependencies/id.test.ts __tests__/unit/api/assets/dependencies.test.ts
git commit -m "feat: add PUT/DELETE /api/dependencies/[id] and GET /api/assets/[id]/dependencies"
```

---

### Task 4: Install dagre + Shared React Flow Components

**Files:**
- Install: `@dagrejs/dagre` npm package
- Create: `components/dependencies/DependencyNode.tsx`
- Create: `components/dependencies/DependencyEdge.tsx`

**Interfaces:**
- Produces:
  - `DependencyNodeData` interface (exported from DependencyNode.tsx): `{ name, shortCode, icon, domain, lifecycleStatus, isCenter? }`
  - `DependencyEdgeData` interface (exported from DependencyEdge.tsx): `{ type, direction, notes, dependencyId }`
  - Both components are default exports used in Tasks 6 and 7

No unit tests for React Flow components (visual correctness verified manually).

- [ ] **Step 1: Install @dagrejs/dagre**

Run: `npm install @dagrejs/dagre`
Expected: package.json updated, no peer dep errors

- [ ] **Step 2: Create `components/dependencies/DependencyNode.tsx`**

```typescript
"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { AssetIcon } from "@/components/assets/AssetModal";

const DOMAIN_COLOURS = [
  "border-violet-400 dark:border-violet-500",
  "border-sky-400 dark:border-sky-500",
  "border-emerald-400 dark:border-emerald-500",
  "border-amber-400 dark:border-amber-500",
  "border-rose-400 dark:border-rose-500",
  "border-teal-400 dark:border-teal-500",
  "border-indigo-400 dark:border-indigo-500",
  "border-orange-400 dark:border-orange-500",
];

function domainBorderColour(domainName: string | null): string {
  if (!domainName) return "border-slate-300 dark:border-slate-600";
  let hash = 0;
  for (let i = 0; i < domainName.length; i++) {
    hash = (hash * 31 + domainName.charCodeAt(i)) & 0xffff;
  }
  return DOMAIN_COLOURS[hash % DOMAIN_COLOURS.length];
}

const LIFECYCLE_DOT: Record<string, string> = {
  Proposed:         "bg-slate-400",
  Approved:         "bg-blue-500",
  "In Development": "bg-amber-500",
  Production:       "bg-emerald-500",
  Sunset:           "bg-orange-500",
  Retired:          "bg-red-500",
};

export interface DependencyNodeData {
  name: string;
  shortCode: string | null;
  icon: string | null;
  domain: string | null;
  lifecycleStatus: string | null;
  isCenter?: boolean;
}

function DependencyNode({ data, selected }: NodeProps<DependencyNodeData>) {
  const dotColour = data.lifecycleStatus ? (LIFECYCLE_DOT[data.lifecycleStatus] ?? "bg-slate-400") : "bg-slate-300";

  return (
    <div
      className={[
        "relative rounded-xl border-2 bg-white dark:bg-slate-900 px-3 py-2 shadow-sm",
        "min-w-[150px] max-w-[190px] cursor-pointer",
        domainBorderColour(data.domain),
        selected ? "ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-slate-950" : "",
        data.isCenter ? "ring-2 ring-brand-400 ring-offset-2 dark:ring-offset-slate-950 shadow-md" : "",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-slate-300 dark:!bg-slate-600 !border-none"
      />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
          <AssetIcon
            name={data.icon || "Server"}
            className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold leading-tight text-slate-800 dark:text-slate-100">
            {data.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {data.shortCode && (
              <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                {data.shortCode}
              </span>
            )}
            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotColour}`} />
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-slate-300 dark:!bg-slate-600 !border-none"
      />
    </div>
  );
}

export default memo(DependencyNode);
```

- [ ] **Step 3: Create `components/dependencies/DependencyEdge.tsx`**

```typescript
"use client";

import { memo } from "react";
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from "reactflow";
import { DependencyConnectionType, DependencyDirection } from "@/types";

export interface DependencyEdgeData {
  type: DependencyConnectionType;
  direction: DependencyDirection;
  notes: string | null;
  dependencyId: string;
}

const TYPE_COLOURS: Record<DependencyConnectionType, string> = {
  "API":             "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "Database":        "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "File Transfer":   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "Event / Message": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "UI Embed":        "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "Other":           "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

function DependencyEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, selected,
}: EdgeProps<DependencyEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const strokeColour = selected ? "#6366f1" : "#94a3b8";
  const strokeWidth = selected ? 2 : 1.5;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: strokeColour, strokeWidth }}
        markerEnd={`url(#dep-arrow-${id})`}
        markerStart={data?.direction === "bidirectional" ? `url(#dep-arrow-start-${id})` : undefined}
      />

      {/* Inline SVG markers — one per edge to allow per-edge colour */}
      <svg style={{ position: "absolute", top: 0, left: 0, overflow: "visible", width: 0, height: 0 }}>
        <defs>
          <marker id={`dep-arrow-${id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={strokeColour} />
          </marker>
          {data?.direction === "bidirectional" && (
            <marker id={`dep-arrow-start-${id}`} markerWidth="8" markerHeight="8" refX="2" refY="3" orient="auto-start-reverse">
              <path d="M0,0 L0,6 L8,3 z" fill={strokeColour} />
            </marker>
          )}
        </defs>
      </svg>

      {data && (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
            }}
            className="absolute nodrag nopan"
          >
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${TYPE_COLOURS[data.type]}`}>
              {data.type}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(DependencyEdge);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add components/dependencies/DependencyNode.tsx components/dependencies/DependencyEdge.tsx package.json package-lock.json
git commit -m "feat: add DependencyNode/Edge React Flow components and dagre dependency"
```

---

### Task 5: AddDependencyModal + DependencyPanel Components

**Files:**
- Create: `components/dependencies/AddDependencyModal.tsx`
- Create: `components/dependencies/DependencyPanel.tsx`

**Interfaces:**
- Consumes: `AssetDependency`, `DependencyConnectionType`, `DependencyDirection` from `@/types`; `Asset` from `@/types`
- Produces:
  - `AddDependencyModal` (default export): props `{ open, onClose, onCreated, lockedSourceAssetId?, lockedSourceAssetName?, allAssets, userId, userName }`
  - `DependencyPanel` (default export): props `{ dependency, onClose, onUpdated, onDeleted, userId, userName }`

No unit tests — visual/interaction correctness verified manually.

- [ ] **Step 1: Create `components/dependencies/AddDependencyModal.tsx`**

```typescript
"use client";

import { FormEvent, useState, useMemo } from "react";
import { X, Plus } from "lucide-react";
import { Asset, DependencyConnectionType, DependencyDirection } from "@/types";

const CONN_TYPES: DependencyConnectionType[] = [
  "API", "Database", "File Transfer", "Event / Message", "UI Embed", "Other",
];
const DIRECTIONS: DependencyDirection[] = ["outbound", "bidirectional"];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  allAssets: Pick<Asset, "id" | "name" | "shortCode">[];
  lockedSourceAssetId?: string;
  lockedSourceAssetName?: string;
  userId: string;
  userName: string;
}

export default function AddDependencyModal({
  open, onClose, onCreated, allAssets,
  lockedSourceAssetId, lockedSourceAssetName,
  userId, userName,
}: Props) {
  const [sourceId, setSourceId] = useState(lockedSourceAssetId ?? "");
  const [targetId, setTargetId] = useState("");
  const [type, setType] = useState<DependencyConnectionType>("API");
  const [direction, setDirection] = useState<DependencyDirection>("outbound");
  const [notes, setNotes] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredSources = useMemo(() =>
    allAssets.filter((a) =>
      a.id !== targetId &&
      `${a.name} ${a.shortCode ?? ""}`.toLowerCase().includes(sourceSearch.toLowerCase())
    ), [allAssets, sourceSearch, targetId]);

  const filteredTargets = useMemo(() =>
    allAssets.filter((a) =>
      a.id !== sourceId &&
      `${a.name} ${a.shortCode ?? ""}`.toLowerCase().includes(targetSearch.toLowerCase())
    ), [allAssets, targetSearch, sourceId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!sourceId) { setError("Source asset is required."); return; }
    if (!targetId) { setError("Target asset is required."); return; }
    setIsSaving(true);
    try {
      const res = await fetch("/api/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceAssetId: sourceId, targetAssetId: targetId, type, direction, notes: notes.trim() || null, userId, userName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");
      onCreated();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  }

  function resetForm() {
    setSourceId(lockedSourceAssetId ?? "");
    setTargetId("");
    setType("API");
    setDirection("outbound");
    setNotes("");
    setSourceSearch("");
    setTargetSearch("");
    setError(null);
  }

  function handleClose() {
    onClose();
    resetForm();
  }

  if (!open) return null;

  const selectCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200";
  const inputCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-500";
  const labelCls = "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70" onClick={handleClose} />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Plus className="h-4 w-4 text-brand-500" />
            Add Dependency
          </h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Source asset */}
          <div>
            <label className={labelCls}>Source Asset (caller)</label>
            {lockedSourceAssetId ? (
              <div className="h-9 flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                {lockedSourceAssetName}
              </div>
            ) : (
              <>
                <input
                  className={`${inputCls} mb-1`}
                  placeholder="Search assets..."
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                />
                <select className={selectCls} value={sourceId} onChange={(e) => setSourceId(e.target.value)} required>
                  <option value="">Select source asset…</option>
                  {filteredSources.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.shortCode ? ` (${a.shortCode})` : ""}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          {/* Target asset */}
          <div>
            <label className={labelCls}>Target Asset (dependency)</label>
            <input
              className={`${inputCls} mb-1`}
              placeholder="Search assets..."
              value={targetSearch}
              onChange={(e) => setTargetSearch(e.target.value)}
            />
            <select className={selectCls} value={targetId} onChange={(e) => setTargetId(e.target.value)} required>
              <option value="">Select target asset…</option>
              {filteredTargets.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.shortCode ? ` (${a.shortCode})` : ""}</option>
              ))}
            </select>
          </div>

          {/* Type + Direction */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Connection Type</label>
              <select className={selectCls} value={type} onChange={(e) => setType(e.target.value as DependencyConnectionType)}>
                {CONN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Direction</label>
              <select className={selectCls} value={direction} onChange={(e) => setDirection(e.target.value as DependencyDirection)}>
                {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. REST API, authenticated via OAuth2…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-500"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={handleClose} className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/dependencies/DependencyPanel.tsx`**

```typescript
"use client";

import { useState } from "react";
import { X, Pencil, Trash2, Check, ArrowRight, ArrowLeftRight } from "lucide-react";
import { AssetDependency, DependencyConnectionType, DependencyDirection } from "@/types";

const CONN_TYPES: DependencyConnectionType[] = [
  "API", "Database", "File Transfer", "Event / Message", "UI Embed", "Other",
];
const DIRECTIONS: DependencyDirection[] = ["outbound", "bidirectional"];

const TYPE_BADGE: Record<DependencyConnectionType, string> = {
  "API":             "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "Database":        "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "File Transfer":   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "Event / Message": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "UI Embed":        "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "Other":           "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

interface Props {
  dependency: AssetDependency;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  userId: string;
  userName: string;
}

export default function DependencyPanel({
  dependency, onClose, onUpdated, onDeleted, userId, userName,
}: Props) {
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [editType, setEditType] = useState<DependencyConnectionType>(dependency.type);
  const [editDirection, setEditDirection] = useState<DependencyDirection>(dependency.direction);
  const [editNotes, setEditNotes] = useState(dependency.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setPanelError(null);
    try {
      const res = await fetch(`/api/dependencies/${dependency.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: editType, direction: editDirection, notes: editNotes.trim() || null, userId, userName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      onUpdated();
      setMode("view");
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsSaving(true);
    setPanelError(null);
    try {
      const res = await fetch(`/api/dependencies/${dependency.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      onDeleted();
      onClose();
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Delete failed.");
      setIsSaving(false);
    }
  }

  const selectCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200";

  return (
    <div className="flex h-full flex-col border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dependency</span>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Connection summary */}
      <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100 flex-wrap">
          <span className="truncate max-w-[110px]">{dependency.sourceAssetName}</span>
          {dependency.direction === "bidirectional"
            ? <ArrowLeftRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
            : <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
          }
          <span className="truncate max-w-[110px]">{dependency.targetAssetName}</span>
        </div>
        <div className="mt-2 flex gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_BADGE[dependency.type]}`}>
            {dependency.type}
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {dependency.direction}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {mode === "view" && (
          <>
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">Notes</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {dependency.notes ?? <span className="italic text-slate-300 dark:text-slate-600">No notes</span>}
              </p>
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              Added by {dependency.createdByName}
            </div>
          </>
        )}

        {mode === "edit" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Connection Type</label>
              <select className={selectCls} value={editType} onChange={(e) => setEditType(e.target.value as DependencyConnectionType)}>
                {CONN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Direction</label>
              <select className={selectCls} value={editDirection} onChange={(e) => setEditDirection(e.target.value as DependencyDirection)}>
                {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
              />
            </div>
            {panelError && <p className="text-xs text-red-600 dark:text-red-400">{panelError}</p>}
          </div>
        )}

        {mode === "confirmDelete" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Delete the dependency between{" "}
              <span className="font-medium">{dependency.sourceAssetName}</span> and{" "}
              <span className="font-medium">{dependency.targetAssetName}</span>?
            </p>
            {panelError && <p className="text-xs text-red-600 dark:text-red-400">{panelError}</p>}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        {mode === "view" && (
          <div className="flex gap-2">
            <button
              onClick={() => setMode("edit")}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button
              onClick={() => { setPanelError(null); setMode("confirmDelete"); }}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        )}

        {mode === "edit" && (
          <div className="flex gap-2">
            <button
              onClick={() => { setMode("view"); setPanelError(null); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Check className="h-3 w-3" /> {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        )}

        {mode === "confirmDelete" && (
          <div className="flex gap-2">
            <button
              onClick={() => { setMode("view"); setPanelError(null); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isSaving ? "Deleting…" : "Confirm Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/dependencies/AddDependencyModal.tsx components/dependencies/DependencyPanel.tsx
git commit -m "feat: add AddDependencyModal and DependencyPanel components"
```

---

### Task 6: Portfolio Map Page + Navigation

**Files:**
- Create: `app/(dashboard)/dependencies/page.tsx`
- Modify: `config/navigation.ts`

**Interfaces:**
- Consumes: `DependencyNode` (default export from `components/dependencies/DependencyNode.tsx`), `DependencyNodeData` (named from same), `DependencyEdge` (default from `components/dependencies/DependencyEdge.tsx`), `DependencyEdgeData` (named from same), `AddDependencyModal` (default from `components/dependencies/AddDependencyModal.tsx`), `DependencyPanel` (default from `components/dependencies/DependencyPanel.tsx`), `AssetDependency` from `@/types`, `GET /api/dependencies`, `GET /api/assets`
- Produces: Route `/dependencies` with 3-tab React Flow map

- [ ] **Step 1: Add nav item to `config/navigation.ts`**

In the `"Assets"` group, after the `"PlantUML Diagrams"` entry, add:

```typescript
{
  label: "Dependency Map",
  href: "/dependencies",
  icon: "Network",
},
```

The Assets group items array should be:
```typescript
items: [
  { label: "Asset Registry",     href: "/assets",           icon: "Server"       },
  { label: "My Assets",          href: "/assets/my-assets", icon: "UserCheck"    },
  { label: "Diagrams",           href: "/diagrams",         icon: "GitBranch"    },
  { label: "PlantUML Diagrams",  href: "/plantuml",         icon: "FileCode2"    },
  { label: "Dependency Map",     href: "/dependencies",     icon: "Network"      },
  { label: "Projects",           href: "/projects",         icon: "FolderKanban" },
],
```

- [ ] **Step 2: Create `app/(dashboard)/dependencies/page.tsx`**

This is a large file. Write it completely:

```typescript
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  Node, Edge, NodeTypes, EdgeTypes,
  Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "@dagrejs/dagre";
import { Network, Plus, Search, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AssetDependency, DependencyConnectionType } from "@/types";
import DependencyNode, { DependencyNodeData } from "@/components/dependencies/DependencyNode";
import DependencyEdge, { DependencyEdgeData } from "@/components/dependencies/DependencyEdge";
import AddDependencyModal from "@/components/dependencies/AddDependencyModal";
import DependencyPanel from "@/components/dependencies/DependencyPanel";

// ---------------------------------------------------------------------------
// React Flow node/edge type registrations
// ---------------------------------------------------------------------------
const nodeTypes: NodeTypes = { dependencyNode: DependencyNode };
const edgeTypes: EdgeTypes = { dependencyEdge: DependencyEdge };

// ---------------------------------------------------------------------------
// Layout algorithms
// ---------------------------------------------------------------------------
const NODE_W = 190;
const NODE_H = 56;

function computeForceLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const pos = new Map(nodes.map((n) => [
    n.id,
    { x: (Math.random() - 0.5) * 600, y: (Math.random() - 0.5) * 400 },
  ]));

  const SPRING_K = 120;
  const REPULSION = 6000;
  const ITERATIONS = 80;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = new Map(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
    const cooling = 1 - (iter / ITERATIONS) * 0.85;

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const pi = pos.get(nodes[i].id)!;
        const pj = pos.get(nodes[j].id)!;
        const dx = pj.x - pi.x || 0.01;
        const dy = pj.y - pi.y || 0.01;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = REPULSION / (dist * dist);
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        forces.get(nodes[i].id)!.x -= fx;
        forces.get(nodes[i].id)!.y -= fy;
        forces.get(nodes[j].id)!.x += fx;
        forces.get(nodes[j].id)!.y += fy;
      }
    }

    // Spring attraction along edges
    for (const edge of edges) {
      const ps = pos.get(edge.source);
      const pt = pos.get(edge.target);
      if (!ps || !pt) continue;
      const dx = pt.x - ps.x;
      const dy = pt.y - ps.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = ((dist - SPRING_K) / dist) * 0.1;
      forces.get(edge.source)!.x += dx * f;
      forces.get(edge.source)!.y += dy * f;
      forces.get(edge.target)!.x -= dx * f;
      forces.get(edge.target)!.y -= dy * f;
    }

    // Apply with cooling
    for (const n of nodes) {
      const f = forces.get(n.id)!;
      const p = pos.get(n.id)!;
      p.x += f.x * cooling;
      p.y += f.y * cooling;
    }
  }

  return nodes.map((n) => ({ ...n, position: pos.get(n.id)! }));
}

function computeLayeredLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", ranksep: 140, nodesep: 60 });
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } };
  });
}

function computeDomainLayout(nodes: Node[]): Node[] {
  if (nodes.length === 0) return nodes;
  const COLS = 3;
  const CELL_W = 210;
  const CELL_H = 90;
  const PAD = 40;
  const LABEL_H = 36;
  const GAP = 32;

  const groups = new Map<string, Node[]>();
  for (const n of nodes) {
    const domain = (n.data as DependencyNodeData).domain ?? "No Domain";
    if (!groups.has(domain)) groups.set(domain, []);
    groups.get(domain)!.push(n);
  }

  const positioned: Node[] = [];
  let groupX = 0;

  for (const [domain, domNodes] of Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const cols = Math.min(domNodes.length, COLS);
    const rows = Math.ceil(domNodes.length / COLS);
    const gW = cols * CELL_W + PAD * 2;
    const gH = rows * CELL_H + PAD * 2 + LABEL_H;

    // Group background node
    positioned.push({
      id: `group-${domain}`,
      type: "group",
      position: { x: groupX, y: 0 },
      style: { width: gW, height: gH, background: "rgba(100,116,139,0.04)", border: "1.5px dashed #e2e8f0", borderRadius: 12 },
      data: { label: domain },
      className: "dep-group-node",
      selectable: false,
      draggable: false,
    });

    // Asset child nodes
    domNodes.forEach((n, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      positioned.push({
        ...n,
        position: { x: PAD + col * CELL_W, y: LABEL_H + PAD + row * CELL_H },
        parentNode: `group-${domain}`,
        extent: "parent" as const,
        draggable: false,
      });
    });

    groupX += gW + GAP;
  }

  return positioned;
}

// ---------------------------------------------------------------------------
// Dependency → RF node/edge builders
// ---------------------------------------------------------------------------
type AssetMeta = {
  id: string; name: string; shortCode: string | null; icon: string | null;
  domain: string | null; lifecycleStatus: string | null;
};

function buildGraph(
  deps: AssetDependency[],
  assetMeta: Map<string, AssetMeta>
): { nodes: Node<DependencyNodeData>[]; edges: Edge<DependencyEdgeData>[] } {
  const seenNodes = new Set<string>();
  const nodes: Node<DependencyNodeData>[] = [];

  function addNode(assetId: string) {
    if (seenNodes.has(assetId)) return;
    seenNodes.add(assetId);
    const meta = assetMeta.get(assetId);
    nodes.push({
      id: assetId,
      type: "dependencyNode",
      position: { x: 0, y: 0 },
      data: {
        name: meta?.name ?? assetId,
        shortCode: meta?.shortCode ?? null,
        icon: meta?.icon ?? null,
        domain: meta?.domain ?? null,
        lifecycleStatus: meta?.lifecycleStatus ?? null,
      },
    });
  }

  deps.forEach((d) => { addNode(d.sourceAssetId); addNode(d.targetAssetId); });

  const edges: Edge<DependencyEdgeData>[] = deps.map((d) => ({
    id: d.id,
    source: d.sourceAssetId,
    target: d.targetAssetId,
    type: "dependencyEdge",
    data: { type: d.type, direction: d.direction, notes: d.notes, dependencyId: d.id },
  }));

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
type LayoutTab = "force" | "layered" | "domain";

export default function DependenciesPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [deps, setDeps] = useState<AssetDependency[]>([]);
  const [assetMeta, setAssetMeta] = useState<Map<string, AssetMeta>>(new Map());
  const [allAssets, setAllAssets] = useState<AssetMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [layoutTab, setLayoutTab] = useState<LayoutTab>("force");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DependencyConnectionType | "">("");
  const [domainFilter, setDomainFilter] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [depsRes, assetsRes] = await Promise.all([
        fetch("/api/dependencies"),
        fetch("/api/assets"),
      ]);
      const [depsData, assetsData] = await Promise.all([depsRes.json(), assetsRes.json()]);
      if (!depsRes.ok) throw new Error(depsData.error ?? "Failed to load dependencies.");
      setDeps(depsData.dependencies ?? []);
      const meta = new Map<string, AssetMeta>();
      for (const a of assetsData.assets ?? []) {
        meta.set(a.id, {
          id: a.id, name: a.name, shortCode: a.shortCode ?? null,
          icon: a.icon ?? null, domain: a.domainName ?? null,
          lifecycleStatus: a.lifecycleStatus ?? null,
        });
      }
      setAssetMeta(meta);
      setAllAssets(assetsData.assets ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Domains for filter ─────────────────────────────────────────────────────
  const domains = useMemo(() => {
    const s = new Set<string>();
    allAssets.forEach((a) => { if (a.domain) s.add(a.domain); });
    return Array.from(s).sort();
  }, [allAssets]);

  // ── Filtered deps ──────────────────────────────────────────────────────────
  const filteredDeps = useMemo(() => {
    return deps.filter((d) => {
      if (typeFilter && d.type !== typeFilter) return false;
      if (domainFilter) {
        const srcDomain = assetMeta.get(d.sourceAssetId)?.domain;
        const tgtDomain = assetMeta.get(d.targetAssetId)?.domain;
        if (srcDomain !== domainFilter && tgtDomain !== domainFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const srcName = assetMeta.get(d.sourceAssetId)?.name?.toLowerCase() ?? "";
        const tgtName = assetMeta.get(d.targetAssetId)?.name?.toLowerCase() ?? "";
        if (!srcName.includes(q) && !tgtName.includes(q)) return false;
      }
      return true;
    });
  }, [deps, typeFilter, domainFilter, search, assetMeta]);

  // ── Rebuild graph whenever filters or layout tab change ────────────────────
  useEffect(() => {
    const { nodes: rawNodes, edges: rawEdges } = buildGraph(filteredDeps, assetMeta);

    let layoutNodes: Node<DependencyNodeData>[];
    if (layoutTab === "force") {
      layoutNodes = computeForceLayout(rawNodes, rawEdges) as Node<DependencyNodeData>[];
    } else if (layoutTab === "layered") {
      layoutNodes = computeLayeredLayout(rawNodes, rawEdges) as Node<DependencyNodeData>[];
    } else {
      layoutNodes = computeDomainLayout(rawNodes) as Node<DependencyNodeData>[];
    }

    setNodes(layoutNodes);
    setEdges(rawEdges);
    setSelectedEdgeId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredDeps, layoutTab, assetMeta]);

  // ── Selected edge dependency ───────────────────────────────────────────────
  const selectedDep = selectedEdgeId
    ? deps.find((d) => d.id === selectedEdgeId) ?? null
    : null;

  const nodesDraggable = layoutTab === "force";

  const CONN_TYPES: DependencyConnectionType[] = [
    "API", "Database", "File Transfer", "Event / Message", "UI Embed", "Other",
  ];
  const selectCls = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200";

  return (
    <div className="flex flex-col gap-0" style={{ height: "calc(100vh - 130px)", minHeight: 500 }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-t-xl border border-b-0 border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets…"
            className="h-9 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 w-44 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-500"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Type filter */}
        <select className={selectCls} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as DependencyConnectionType | "")}>
          <option value="">All types</option>
          {CONN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Domain filter */}
        <select className={selectCls} value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
          <option value="">All domains</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Layout tab switcher */}
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
          {(["force", "layered", "domain"] as LayoutTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setLayoutTab(tab)}
              className={[
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                layoutTab === tab
                  ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
              ].join(" ")}
            >
              {tab === "force" ? "Force" : tab === "layered" ? "Layered" : "Domain"}
            </button>
          ))}
        </div>

        {/* Add button */}
        {user && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add Dependency
          </button>
        )}
      </div>

      {/* ── Graph + Side Panel ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden rounded-b-xl border border-slate-200 dark:border-slate-700">
        <div className={`flex-1 ${selectedDep ? "mr-0" : ""}`}>
          {isLoading ? (
            <div className="flex h-full items-center justify-center bg-white dark:bg-slate-900">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            </div>
          ) : fetchError ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-white dark:bg-slate-900 text-red-500">
              <p className="text-sm">{fetchError}</p>
              <button onClick={fetchAll} className="text-xs underline">Retry</button>
            </div>
          ) : filteredDeps.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900">
              <Network className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                {deps.length === 0 ? "No dependencies yet" : "No results match your filters"}
              </p>
              {deps.length === 0 && user && (
                <button
                  onClick={() => setAddOpen(true)}
                  className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline dark:text-brand-400"
                >
                  <Plus className="h-3.5 w-3.5" /> Add the first dependency
                </button>
              )}
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodesDraggable={nodesDraggable}
              nodesConnectable={false}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              onNodeClick={(_e, node) => {
                if (!node.id.startsWith("group-")) {
                  router.push(`/assets/${node.id}`);
                }
              }}
              onEdgeClick={(_e, edge) => {
                setSelectedEdgeId((prev) => (prev === edge.id ? null : edge.id));
              }}
              onPaneClick={() => setSelectedEdgeId(null)}
              className="bg-slate-50 dark:bg-slate-950"
            >
              <Background color="#e2e8f0" className="dark:[&_line]:stroke-slate-800" />
              <Controls className="dark:[&_button]:bg-slate-800 dark:[&_button]:text-slate-200 dark:[&_button]:border-slate-700" />
              <MiniMap
                nodeColor={(n) => {
                  if (n.id.startsWith("group-")) return "transparent";
                  return "#6366f1";
                }}
                className="dark:bg-slate-900 dark:[&_.react-flow__minimap-mask]:fill-slate-950/60"
              />
            </ReactFlow>
          )}
        </div>

        {/* Side panel */}
        {selectedDep && user && (
          <div className="w-80 flex-shrink-0">
            <DependencyPanel
              dependency={selectedDep}
              onClose={() => setSelectedEdgeId(null)}
              onUpdated={() => { fetchAll(); setSelectedEdgeId(null); }}
              onDeleted={() => { fetchAll(); setSelectedEdgeId(null); }}
              userId={user.id}
              userName={user.name}
            />
          </div>
        )}
      </div>

      {/* Add Dependency Modal */}
      {user && (
        <AddDependencyModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onCreated={fetchAll}
          allAssets={allAssets}
          userId={user.id}
          userName={user.name}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Start dev server and verify the page loads**

Run: `npm run dev` (port 3000 or per project config)
Navigate to `/dependencies`. Verify:
- Toolbar renders with search, type filter, domain filter, layout tabs, Add Dependency button
- Empty state shows "No dependencies yet" with Add button (if no data)
- If seed data exists: nodes and edges render, clicking a node navigates to `/assets/[id]`, clicking an edge opens the side panel

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dependencies/page.tsx" config/navigation.ts
git commit -m "feat: add Dependency Map portfolio page with 3-tab React Flow layout"
```

---

### Task 7: Asset Detail Dependencies Section

**Files:**
- Modify: `app/(dashboard)/assets/[id]/page.tsx`

Add a Dependencies section card below the PlantUML Diagrams section (before the Audit History section), following the existing section card pattern.

**Interfaces:**
- Consumes: `GET /api/assets/[id]/dependencies`, `DependencyNode`, `DependencyEdge`, `AddDependencyModal`, `AssetDependency` from `@/types`
- Produces: Dependencies section on `/assets/[id]` with mini React Flow map + editable list

- [ ] **Step 1: Add imports to `app/(dashboard)/assets/[id]/page.tsx`**

At the top of the file, add `Network` to the lucide imports:
```typescript
// In the existing lucide-react import line, add:
Network,
```

Also add these new imports after the existing imports:
```typescript
import ReactFlow, { Node, Edge, NodeTypes, EdgeTypes, Background, useNodesState, useEdgesState } from "reactflow";
import "reactflow/dist/style.css";
import { AssetDependency } from "@/types";
import DependencyNode, { DependencyNodeData } from "@/components/dependencies/DependencyNode";
import DependencyEdge, { DependencyEdgeData } from "@/components/dependencies/DependencyEdge";
import AddDependencyModal from "@/components/dependencies/AddDependencyModal";
```

- [ ] **Step 2: Add state variables to AssetDetailPage component**

Inside `AssetDetailPage`, after the existing state declarations, add:
```typescript
const [depData, setDepData] = useState<{ downstream: AssetDependency[]; upstream: AssetDependency[] }>({
  downstream: [], upstream: [],
});
const [depNodes, setDepNodes, onDepNodesChange] = useNodesState<DependencyNodeData>([]);
const [depEdges, setDepEdges, onDepEdgesChange] = useEdgesState<DependencyEdgeData>([]);
const [depAddOpen, setDepAddOpen] = useState(false);
const [depDeleteId, setDepDeleteId] = useState<string | null>(null);
const [isDeletingDep, setIsDeletingDep] = useState(false);
```

- [ ] **Step 3: Fetch dependency data in `fetchAll`**

In the `fetchAll` function, add `/api/assets/${id}/dependencies` to the `Promise.all`:

```typescript
// Add to the Promise.all array:
fetch(`/api/assets/${id}/dependencies`),

// Add to the destructuring:
depRes,  // at end of array

// After the Promise.all resolves, add:
depRes.json(),  // at end

// Store result:
const depDataResult = await depRes.json();
setDepData({ downstream: depDataResult.downstream ?? [], upstream: depDataResult.upstream ?? [] });
```

Then after `setDepData`, build the mini-map nodes/edges:
```typescript
// Build mini-map graph for dependency section
buildDepMiniMap(depDataResult.downstream ?? [], depDataResult.upstream ?? [], id, assetData.asset);
```

- [ ] **Step 4: Add buildDepMiniMap helper before AssetDetailPage**

Add this function before the `AssetDetailPage` component definition:

```typescript
// Re-use dep node/edge types for the mini map on the asset detail page
const DEP_NODE_TYPES: NodeTypes = { dependencyNode: DependencyNode };
const DEP_EDGE_TYPES: EdgeTypes = { dependencyEdge: DependencyEdge };
```

And add `buildDepMiniMap` as a function inside the component (or use a `useCallback`):

```typescript
function buildDepMiniMap(
  downstream: AssetDependency[],
  upstream: AssetDependency[],
  currentId: string,
  currentAsset: { name: string; icon: string | null; shortCode: string | null; lifecycleStatus: string; domainName: string | null }
) {
  const miniNodes: Node<DependencyNodeData>[] = [];
  const miniEdges: Edge<DependencyEdgeData>[] = [];
  const seenIds = new Set<string>();
  const upstreamX = -240;
  const centerX = 0;
  const downstreamX = 240;

  // Centre node (current asset)
  miniNodes.push({
    id: currentId,
    type: "dependencyNode",
    position: { x: centerX - 95, y: 0 },
    data: {
      name: currentAsset.name,
      shortCode: currentAsset.shortCode,
      icon: currentAsset.icon,
      domain: currentAsset.domainName ?? null,
      lifecycleStatus: currentAsset.lifecycleStatus,
      isCenter: true,
    },
  });
  seenIds.add(currentId);

  // Downstream nodes (we call them) — right side
  const downstreamUniq = downstream.filter((d) => {
    const otherId = d.sourceAssetId === currentId ? d.targetAssetId : d.sourceAssetId;
    return !seenIds.has(otherId);
  });
  downstreamUniq.forEach((d, i) => {
    const otherId = d.sourceAssetId === currentId ? d.targetAssetId : d.sourceAssetId;
    const otherName = d.sourceAssetId === currentId ? d.targetAssetName : d.sourceAssetName;
    const otherIcon = d.sourceAssetId === currentId ? d.targetAssetIcon : d.sourceAssetIcon;
    const otherDomain = d.sourceAssetId === currentId ? d.targetAssetDomain : d.sourceAssetDomain;
    seenIds.add(otherId);
    miniNodes.push({
      id: otherId, type: "dependencyNode",
      position: { x: downstreamX - 95, y: i * 80 - ((downstreamUniq.length - 1) * 80) / 2 },
      data: { name: otherName, shortCode: null, icon: otherIcon, domain: otherDomain, lifecycleStatus: null },
    });
    miniEdges.push({
      id: `down-${d.id}`, source: currentId, target: otherId, type: "dependencyEdge",
      data: { type: d.type, direction: d.direction, notes: d.notes, dependencyId: d.id },
    });
  });

  // Upstream nodes (they call us) — left side
  const upstreamUniq = upstream.filter((d) => {
    const otherId = d.targetAssetId === currentId ? d.sourceAssetId : d.targetAssetId;
    return !seenIds.has(otherId);
  });
  upstreamUniq.forEach((d, i) => {
    const otherId = d.targetAssetId === currentId ? d.sourceAssetId : d.targetAssetId;
    const otherName = d.targetAssetId === currentId ? d.sourceAssetName : d.targetAssetName;
    const otherIcon = d.targetAssetId === currentId ? d.sourceAssetIcon : d.targetAssetIcon;
    const otherDomain = d.targetAssetId === currentId ? d.sourceAssetDomain : d.targetAssetDomain;
    seenIds.add(otherId);
    miniNodes.push({
      id: otherId, type: "dependencyNode",
      position: { x: upstreamX - 95, y: i * 80 - ((upstreamUniq.length - 1) * 80) / 2 },
      data: { name: otherName, shortCode: null, icon: otherIcon, domain: otherDomain, lifecycleStatus: null },
    });
    miniEdges.push({
      id: `up-${d.id}`, source: otherId, target: currentId, type: "dependencyEdge",
      data: { type: d.type, direction: d.direction, notes: d.notes, dependencyId: d.id },
    });
  });

  setDepNodes(miniNodes);
  setDepEdges(miniEdges);
}
```

The function references `setDepNodes` and `setDepEdges` which are in scope (component-level state). Move it inside the component or make it a `useCallback`.

- [ ] **Step 5: Add handleDeleteDep function**

Add inside the `AssetDetailPage` component:

```typescript
async function handleDeleteDep(depId: string) {
  if (!user) return;
  setIsDeletingDep(true);
  try {
    const res = await fetch(`/api/dependencies/${depId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, userName: user.name }),
    });
    if (res.ok) {
      setDepDeleteId(null);
      await fetchAll();
    }
  } finally {
    setIsDeletingDep(false);
  }
}
```

- [ ] **Step 6: Add the Dependencies section to JSX**

In the JSX, between the PlantUML Diagrams section (`{assetPlantUMLDiagrams.length > 0 && (...)`) and the Audit History section, add:

```typescript
{/* ── Dependencies ──────────────────────────────────────────────────────── */}
<div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-3">
    <div className="flex items-center gap-2">
      <Network className="h-4 w-4 text-slate-400 dark:text-slate-500" />
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Dependencies
      </h2>
    </div>
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
        {depData.downstream.length + depData.upstream.length} connection{depData.downstream.length + depData.upstream.length !== 1 ? "s" : ""}
      </span>
      {user && (
        <button
          onClick={() => setDepAddOpen(true)}
          className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      )}
    </div>
  </div>

  {/* Mini map */}
  {(depData.downstream.length > 0 || depData.upstream.length > 0) && (
    <div className="border-b border-slate-100 dark:border-slate-800" style={{ height: 240 }}>
      <ReactFlow
        nodes={depNodes}
        edges={depEdges}
        nodeTypes={DEP_NODE_TYPES}
        edgeTypes={DEP_EDGE_TYPES}
        onNodesChange={onDepNodesChange}
        onEdgesChange={onDepEdgesChange}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        onNodeClick={(_e, node) => router.push(`/assets/${node.id}`)}
        className="bg-slate-50 dark:bg-slate-950"
      >
        <Background color="#e2e8f0" className="dark:[&_line]:stroke-slate-800" />
      </ReactFlow>
    </div>
  )}

  {/* Downstream list */}
  {depData.downstream.length > 0 && (
    <div>
      <div className="px-5 py-2 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Downstream — We depend on
        </span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {depData.downstream.map((d) => {
          const otherId = d.sourceAssetId === id ? d.targetAssetId : d.sourceAssetId;
          const otherName = d.sourceAssetId === id ? d.targetAssetName : d.sourceAssetName;
          return (
            <div key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <Link href={`/assets/${otherId}`} className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 truncate">
                {otherName}
              </Link>
              <span className="text-xs text-slate-400 dark:text-slate-500">{d.type}</span>
              <span className="text-xs text-slate-300 dark:text-slate-600">{d.direction}</span>
              {d.notes && <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[120px]" title={d.notes}>{d.notes}</span>}
              {user && (
                depDeleteId === d.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Delete?</span>
                    <button onClick={() => handleDeleteDep(d.id)} disabled={isDeletingDep} className="text-xs text-red-600 hover:underline dark:text-red-400 disabled:opacity-50">Yes</button>
                    <button onClick={() => setDepDeleteId(null)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">No</button>
                  </div>
                ) : (
                  <button onClick={() => setDepDeleteId(d.id)} className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  )}

  {/* Upstream list */}
  {depData.upstream.length > 0 && (
    <div>
      <div className="px-5 py-2 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Upstream — Depends on us
        </span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {depData.upstream.map((d) => {
          const otherId = d.targetAssetId === id ? d.sourceAssetId : d.targetAssetId;
          const otherName = d.targetAssetId === id ? d.sourceAssetName : d.targetAssetName;
          return (
            <div key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <Link href={`/assets/${otherId}`} className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 truncate">
                {otherName}
              </Link>
              <span className="text-xs text-slate-400 dark:text-slate-500">{d.type}</span>
              <span className="text-xs text-slate-300 dark:text-slate-600">{d.direction}</span>
              {d.notes && <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[120px]" title={d.notes}>{d.notes}</span>}
            </div>
          );
        })}
      </div>
    </div>
  )}

  {/* Empty state */}
  {depData.downstream.length === 0 && depData.upstream.length === 0 && (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400 dark:text-slate-500">
      <Network className="h-8 w-8 text-slate-300 dark:text-slate-600" />
      <p className="text-sm">No dependencies recorded yet</p>
      {user && (
        <button onClick={() => setDepAddOpen(true)} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
          Add first dependency
        </button>
      )}
    </div>
  )}
</div>

{/* Add dependency modal for this asset */}
{user && (
  <AddDependencyModal
    open={depAddOpen}
    onClose={() => setDepAddOpen(false)}
    onCreated={fetchAll}
    allAssets={allAssets.map((a) => ({ id: a.id, name: a.name, shortCode: null }))}
    lockedSourceAssetId={id}
    lockedSourceAssetName={asset.name}
    userId={user.id}
    userName={user.name}
  />
)}
```

Note: The `allAssets` variable above refers to the existing `vendors` list being repurposed... wait, actually the asset detail page doesn't fetch all assets. Add a fetch for all assets.

Add to the `fetchAll` Promise.all in the asset detail page:
```typescript
fetch("/api/assets"),  // for the dependency modal asset list
```

And after the Promise.all resolves, add:
```typescript
const allAssetsData = await allAssetsRes.json();
// Store in state - add this state variable:
// const [allAssets, setAllAssets] = useState<Pick<Asset, "id" | "name">[]>([]);
setAllAssets(allAssetsData.assets ?? []);
```

Add `allAssets` state at the top of the component:
```typescript
const [allAssets, setAllAssets] = useState<Pick<Asset, "id" | "name" | "shortCode">[]>([]);
```

Also add `Plus` to the lucide imports if not already present.

- [ ] **Step 7: Add `DEP_NODE_TYPES` and `DEP_EDGE_TYPES` constants**

Before the `AssetDetailPage` function definition, add:
```typescript
import DependencyNode from "@/components/dependencies/DependencyNode";
import DependencyEdge from "@/components/dependencies/DependencyEdge";
import type { NodeTypes, EdgeTypes } from "reactflow";

const DEP_NODE_TYPES: NodeTypes = { dependencyNode: DependencyNode };
const DEP_EDGE_TYPES: EdgeTypes = { dependencyEdge: DependencyEdge };
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 9: Run full test suite**

Run: `npx jest --no-coverage`
Expected: All previously passing tests still pass (target: 212+16 = 228 tests)

- [ ] **Step 10: Start dev server and test asset detail page**

Navigate to any asset detail page. Verify:
- Dependencies section appears between PlantUML Diagrams and Audit History
- "Add" button opens AddDependencyModal with source asset pre-filled and locked
- After adding a dependency: mini map appears showing the connected assets, downstream/upstream lists populate
- Delete trash icon shows inline "Delete? Yes / No" confirmation
- Clicking a node in the mini map navigates to that asset

- [ ] **Step 11: Commit**

```bash
git add "app/(dashboard)/assets/[id]/page.tsx"
git commit -m "feat: add Dependencies section to asset detail page with mini map and list"
```

---

## Implementation Checklist (Self-Review)

- [x] DB: `asset_dependencies` table added to `lib/db.ts` — Task 1
- [x] Types: `DependencyConnectionType`, `DependencyDirection`, `AssetDependency` — Task 1
- [x] API: `GET /api/dependencies` — Task 2
- [x] API: `POST /api/dependencies` with self-ref/reverse/duplicate validation — Task 2
- [x] API: `PUT /api/dependencies/[id]` — Task 3
- [x] API: `DELETE /api/dependencies/[id]` — Task 3
- [x] API: `GET /api/assets/[id]/dependencies` — Task 3
- [x] Tests: 16 unit tests across 3 test files — Tasks 2 & 3
- [x] Install: `@dagrejs/dagre` — Task 4
- [x] Component: `DependencyNode.tsx` — Task 4
- [x] Component: `DependencyEdge.tsx` — Task 4
- [x] Component: `AddDependencyModal.tsx` — Task 5
- [x] Component: `DependencyPanel.tsx` — Task 5
- [x] Page: `/dependencies` with 3-tab layout — Task 6
- [x] Nav: "Dependency Map" in Assets group — Task 6
- [x] Asset detail: Dependencies section — Task 7
