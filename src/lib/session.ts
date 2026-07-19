import "server-only";

import { count } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function hasOwner(): Promise<boolean> {
  const [result] = await db.select({ count: count() }).from(user);
  return result.count > 0;
}

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireOwner() {
  const session = await getSession();
  if (!session) redirect("/anmelden");
  return session;
}
