import { NextResponse } from "next/server";
import { getDb, setupDatabase } from "@/lib/db";
import mysql from "mysql2/promise";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await setupDatabase();
  const db = getDb();
  const [diagrams] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM plantuml_diagrams WHERE id = ?", [params.id]
  );
  if (!diagrams.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [versions] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM plantuml_versions WHERE diagram_id = ? ORDER BY version_number DESC LIMIT 1", [params.id]
  );
  return NextResponse.json({ diagram: diagrams[0], latestVersion: versions[0] ?? null });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  await setupDatabase();
  const db = getDb();
  const { name, description } = await req.json();
  await db.execute("UPDATE plantuml_diagrams SET name = ?, description = ? WHERE id = ?", [name, description ?? null, params.id]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await setupDatabase();
  const db = getDb();
  await db.execute("DELETE FROM plantuml_versions WHERE diagram_id = ?", [params.id]);
  await db.execute("DELETE FROM plantuml_diagrams WHERE id = ?", [params.id]);
  return NextResponse.json({ ok: true });
}
