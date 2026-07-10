import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL environment variable is not set!");

// Log masked URL for debugging
const maskedUrl = url.replace(/:([^:@]+)@/, ":***@");
console.log("📌 DATABASE_URL:", maskedUrl);

const isInternal = url.includes(".railway.internal");
console.log("🔌 SSL mode:", isInternal ? "disabled (internal)" : "require (external)");

export const client = postgres(url, {
  ssl: isInternal ? false : { rejectUnauthorized: false },
  max: 3,
  idle_timeout: 20,
  connect_timeout: 30,
  connection: { application_name: "mutfilm-bot" },
});

export const db = drizzle(client, { schema });
export * from "./schema";
