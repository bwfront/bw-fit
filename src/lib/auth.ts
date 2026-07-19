import "server-only";

import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { schema, user } from "@/db/schema";

const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
const secret = process.env.BETTER_AUTH_SECRET
  ?? (isProductionBuild ? "kraftbuch-build-time-placeholder-never-used-at-runtime" : undefined)
  ?? (process.env.NODE_ENV !== "production" ? "kraftbuch-local-development-secret-only-2026" : undefined);

if (!secret) throw new Error("BETTER_AUTH_SECRET fehlt. Erzeuge einen Wert mit: openssl rand -base64 32");

export const auth = betterAuth({
  appName: "bw-fit",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],
  secret,
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          const [result] = await db.select({ count: count() }).from(user);
          if (result.count > 0) throw new APIError("FORBIDDEN", { message: "bw-fit hat bereits einen Besitzer." });
        },
      },
    },
  },
  advanced: {
    cookiePrefix: "kraftbuch",
    useSecureCookies: process.env.BETTER_AUTH_URL?.startsWith("https://") ?? false,
  },
});
