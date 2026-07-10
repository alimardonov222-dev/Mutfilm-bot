import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL muhit o'zgaruvchisi kerak.");
}

// Railway internal URL uchun SSL shart emas, tashqi URL uchun avtomatik
const isInternal = connectionString.includes(".railway.internal");
const client = postgres(connectionString, {
  ssl: isInternal ? false : "require",
  max: 3,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema });
export * from "./schema";
