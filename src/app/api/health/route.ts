import { sqlite } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    sqlite.prepare("SELECT 1").get();
    return Response.json({ status: "ok", database: "ok", time: new Date().toISOString() });
  } catch {
    return Response.json({ status: "error", database: "error" }, { status: 503 });
  }
}
