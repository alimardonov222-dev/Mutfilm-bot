import { pgTable, serial, text, boolean, timestamp, bigint } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  isBanned: boolean("is_banned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const movies = pgTable("movies", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  fileId: text("file_id").notNull(),
  fileType: text("file_type").notNull().default("video"),
  photoFileId: text("photo_file_id"),
  title: text("title").notNull(),
  year: text("year"),
  quality: text("quality"),
  imdb: text("imdb"),
  country: text("country"),
  language: text("language"),
  genre: text("genre"),
  caption: text("caption"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  code: text("code").notNull(),
  success: boolean("success").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  adminId: bigint("admin_id", { mode: "number" }).notNull().unique(),
  step: text("step").notNull().default("idle"),
  data: text("data").default("{}").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
