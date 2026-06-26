import { NextResponse } from "next/server";
import { getDb, setupDatabase } from "@/lib/db";
import mysql from "mysql2/promise";

export async function POST(req: Request) {
  await setupDatabase();
  const db = getDb();
  const { assetId, pageTitle, parentPageId } = await req.json();

  // Fetch Confluence settings
  const [settingRows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT `key`, `value` FROM app_settings WHERE `key` IN ('confluence.base_url','confluence.api_token','confluence.user_email','confluence.space_key')"
  );
  const cfg: Record<string, string> = {};
  settingRows.forEach((r) => { cfg[r.key] = r.value ?? ""; });

  const baseUrl = cfg["confluence.base_url"]?.replace(/\/$/, "");
  const apiToken = cfg["confluence.api_token"];
  const userEmail = cfg["confluence.user_email"];
  const spaceKey = cfg["confluence.space_key"];

  if (!baseUrl || !apiToken || !userEmail || !spaceKey) {
    return NextResponse.json({ error: "Confluence not configured. Go to Settings → Integrations." }, { status: 400 });
  }

  // Fetch asset
  const [assets] = await db.execute<mysql.RowDataPacket[]>("SELECT * FROM assets WHERE id = ?", [assetId]);
  if (!assets.length) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  const asset = assets[0];

  // Build Confluence storage format body
  const body = `<h2>Asset Details</h2>
<table><tbody>
<tr><th>Name</th><td>${asset.name}</td></tr>
<tr><th>Short Code</th><td>${asset.short_code ?? "—"}</td></tr>
<tr><th>Type</th><td>${asset.type}</td></tr>
<tr><th>Category</th><td>${asset.category}</td></tr>
<tr><th>Lifecycle</th><td>${asset.lifecycle_status}</td></tr>
<tr><th>Business Owner</th><td>${asset.business_owner ?? "—"}</td></tr>
<tr><th>Technical Owner</th><td>${asset.technical_owner ?? "—"}</td></tr>
</tbody></table>
${asset.description ? `<h2>Description</h2><p>${asset.description}</p>` : ""}
${asset.notes ? `<h2>Notes</h2><p>${asset.notes}</p>` : ""}
<p><em>Last synced from Pixxel EA Repository.</em></p>`;

  const auth = Buffer.from(`${userEmail}:${apiToken}`).toString("base64");

  // Check if page already exists with that title in the space
  const searchRes = await fetch(
    `${baseUrl}/wiki/rest/api/content?spaceKey=${encodeURIComponent(spaceKey)}&title=${encodeURIComponent(pageTitle ?? asset.name)}&expand=version`,
    { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } }
  );
  const searchData = await searchRes.json();

  let confluenceUrl: string;

  if (searchData.results?.length > 0) {
    // Update existing page
    const existing = searchData.results[0];
    const newVersion = (existing.version?.number ?? 1) + 1;
    const updateRes = await fetch(`${baseUrl}/wiki/rest/api/content/${existing.id}`, {
      method: "PUT",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: { number: newVersion },
        title: pageTitle ?? asset.name,
        type: "page",
        body: { storage: { value: body, representation: "storage" } },
      }),
    });
    if (!updateRes.ok) {
      const err = await updateRes.text();
      return NextResponse.json({ error: `Confluence update failed: ${err}` }, { status: 500 });
    }
    confluenceUrl = `${baseUrl}/wiki/spaces/${spaceKey}/pages/${existing.id}`;
  } else {
    // Create new page
    const payload: Record<string, unknown> = {
      type: "page",
      title: pageTitle ?? asset.name,
      space: { key: spaceKey },
      body: { storage: { value: body, representation: "storage" } },
    };
    if (parentPageId) payload.ancestors = [{ id: parentPageId }];
    const createRes = await fetch(`${baseUrl}/wiki/rest/api/content`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      return NextResponse.json({ error: `Confluence create failed: ${err}` }, { status: 500 });
    }
    const created = await createRes.json();
    confluenceUrl = `${baseUrl}/wiki/spaces/${spaceKey}/pages/${created.id}`;
  }

  return NextResponse.json({ ok: true, url: confluenceUrl });
}
