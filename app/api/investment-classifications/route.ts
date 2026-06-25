import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

function rowToClassification(row: mysql.RowDataPacket) {
  const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
  return {
    id:            row.id,
    name:          row.name,
    color:         row.color,
    sortOrder:     row.sort_order ?? null,
    createdById:   row.created_by_id,
    createdByName: row.created_by_name,
    createdAt:     toISO(row.created_at)!,
    updatedAt:     toISO(row.updated_at)!,
  };
}

export async function GET() {
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM investment_classifications ORDER BY sort_order ASC, name ASC"
    );
    return NextResponse.json({ classifications: rows.map(rowToClassification) });
  } catch (err) {
    console.error("[GET /api/investment-classifications]", err);
    return NextResponse.json({ error: "Failed to load investment classifications." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, color, sortOrder, userId, userName } = body;

    if (!name?.trim())  return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!color?.trim()) return NextResponse.json({ error: "Color is required." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const id = randomUUID();

    await db.execute(
      `INSERT INTO investment_classifications (id, name, color, sort_order, created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), color.trim(), sortOrder ?? null, userId, userName]
    );

    await writeAudit({
      tableName: "investment_classifications", recordId: id, action: "CREATE",
      performedById: userId, performedByName: userName,
      oldValues: null,
      newValues: { name: name.trim(), color: color.trim(), sortOrder: sortOrder ?? null },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/investment-classifications]", err);
    return NextResponse.json({ error: "Failed to create investment classification." }, { status: 500 });
  }
}
