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
