import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL muhit o'zgaruvchisi kerak. Railway da PostgreSQL qo'shing.");
}

const client = postgres(connectionString, { ssl: { rejectUnauthorized: false } });
export const db = drizzle(client, { schema });
export * from "./schema";
