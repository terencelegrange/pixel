import { NextResponse } from "next/server";
import { getDb, setupDatabase } from "@/lib/db";
import mysql from "mysql2/promise";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await setupDatabase();
  const db = getDb();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(`
    SELECT pd.id, pd.name, pd.updated_at AS updatedAt,
           pda.matched_on AS matchedOn,
           COALESCE(MAX(pv.version_number), 0) AS latestVersion
    FROM plantuml_diagram_assets pda
    JOIN plantuml_diagrams pd ON pd.id = pda.diagram_id
    LEFT JOIN plantuml_versions pv ON pv.diagram_id = pd.id
    WHERE pda.asset_id = ?
    GROUP BY pd.id, pd.name, pd.updated_at, pda.matched_on
    ORDER BY pd.updated_at DESC
  `, [params.id]);
  return NextResponse.json({ diagrams: rows });
}
