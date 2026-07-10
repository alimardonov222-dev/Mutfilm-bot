import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL kerak");

const isInternal = url.includes(".railway.internal");
export const client = postgres(url, {
  ssl: isInternal ? false : "require",
  max: 5,
  idle_timeout: 20,
  connect_timeout: 30,
});

export const db = drizzle(client, { schema });
export * from "./schema";
