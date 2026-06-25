import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, color, sortOrder, userId, userName } = body;

    if (!name?.trim())  return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!color?.trim()) return NextResponse.json({ error: "Color is required." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM investment_classifications WHERE id = ? LIMIT 1", [params.id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Classification not found." }, { status: 404 });
    const current = rows[0];

    await db.execute(
      "UPDATE investment_classifications SET name = ?, color = ?, sort_order = ? WHERE id = ?",
      [name.trim(), color.trim(), sortOrder ?? null, params.id]
    );

    await writeAudit({
      tableName: "investment_classifications", recordId: params.id, action: "UPDATE",
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name, color: current.color, sortOrder: current.sort_order },
      newValues: { name: name.trim(), color: color.trim(), sortOrder: sortOrder ?? null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/investment-classifications/[id]]", err);
    return NextResponse.json({ error: "Failed to update investment classification." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { userId, userName } = body as { userId?: string; userName?: string };
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM investment_classifications WHERE id = ? LIMIT 1", [params.id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Classification not found." }, { status: 404 });
    const current = rows[0];

    const [phases] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM asset_roadmap_phases WHERE classification_id = ? LIMIT 1", [params.id]
    );
    if (phases.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete: this classification is in use by one or more roadmap phases." },
        { status: 409 }
      );
    }

    await db.execute("DELETE FROM investment_classifications WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "investment_classifications", recordId: params.id, action: "DELETE",
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name, color: current.color },
      newValues: null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/investment-classifications/[id]]", err);
    return NextResponse.json({ error: "Failed to delete investment classification." }, { status: 500 });
  }
}
