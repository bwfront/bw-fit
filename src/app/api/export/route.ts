import { getBackupPayload } from "@/lib/data";
import { requireOwner } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireOwner();
  const payload = getBackupPayload();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="kraftbuch-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
