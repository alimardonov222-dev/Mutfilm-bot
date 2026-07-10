import * as dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";
import { client } from "../src/db";
import { handleStart } from "../src/handlers/start";
import { handleMovieCode } from "../src/handlers/movie";
import {
  isAdmin,
  handleUpload,
  handleSkip,
  handleCancel,
  handleStats,
  handleBroadcast,
  handleBan,
  handleUnban,
  handleDelete,
  handleAdminMessage,
  handleAdminCallback,
} from "../src/handlers/admin";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is not set!");

let dbReady = false;

async function ensureDB() {
  if (dbReady) return;
  await client`SELECT 1`;
  await client.unsafe(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, telegram_id BIGINT NOT NULL UNIQUE,
    username TEXT, first_name TEXT, last_name TEXT,
    is_banned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT now())`);
  await client.unsafe(`CREATE TABLE IF NOT EXISTS movies (
    id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE,
    file_id TEXT NOT NULL, file_type TEXT NOT NULL DEFAULT 'video',
    photo_file_id TEXT, title TEXT NOT NULL, year TEXT, quality TEXT,
    imdb TEXT, country TEXT, language TEXT, genre TEXT, caption TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now())`);
  await client.unsafe(`CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY, user_id BIGINT NOT NULL, code TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT now())`);
  await client.unsafe(`CREATE TABLE IF NOT EXISTS admin_sessions (
    id SERIAL PRIMARY KEY, admin_id BIGINT NOT NULL UNIQUE,
    step TEXT NOT NULL DEFAULT 'idle', data TEXT NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP NOT NULL DEFAULT now())`);
  dbReady = true;
}

const bot = new Telegraf(BOT_TOKEN);

bot.command("start",     (ctx) => handleStart(ctx));
bot.command("upload",    (ctx) => handleUpload(ctx));
bot.command("skip",      (ctx) => handleSkip(ctx));
bot.command("cancel",    (ctx) => handleCancel(ctx));
bot.command("stats",     (ctx) => handleStats(ctx));
bot.command("broadcast", (ctx) => handleBroadcast(ctx));
bot.command("ban",       (ctx) => handleBan(ctx));
bot.command("unban",     (ctx) => handleUnban(ctx));
bot.command("delete",    (ctx) => handleDelete(ctx));

bot.command("help", async (ctx) => {
  const ch = (process.env.CHANNEL_ID || "@mutfilmUZcode").replace("@", "");
  await ctx.replyWithHTML(
    `📖 <b>Qo'llanma</b>\n\n` +
    `1️⃣ @${ch} kanalidan kodni oling\n` +
    `2️⃣ Kodni botga yuboring\n` +
    `3️⃣ Video keladi ✅`
  );
});

bot.command("admin", async (ctx) => {
  if (!isAdmin(ctx.from!.id)) { await ctx.reply("❌ Admin emassiz"); return; }
  await ctx.replyWithHTML(
    `🔐 <b>Admin Panel</b>\n\n` +
    `/upload — Multfilm yuklash\n/stats — Statistika\n` +
    `/broadcast <matn> — Xabar\n/ban /unban /delete`
  );
});

bot.on("callback_query", async (ctx) => {
  const handled = await handleAdminCallback(ctx);
  if (!handled) await ctx.answerCbQuery();
});

bot.on("message", async (ctx) => {
  if (await handleAdminMessage(ctx)) return;
  const msg = ctx.message as any;
  if (msg?.text && !msg.text.startsWith("/")) {
    const text = msg.text.trim();
    if (/^#?\d{1,6}$/.test(text) || /^[A-Za-z]{0,5}\d{1,6}$/.test(text)) {
      await handleMovieCode(ctx, text);
    } else {
      const ch = (process.env.CHANNEL_ID || "@mutfilmUZcode").replace("@", "");
      await ctx.reply(`❌ Kod noto'g'ri. Kanaldan oling: @${ch}`);
    }
  }
});

bot.catch((err, ctx) => {
  console.error(`Bot xato [${ctx.updateType}]:`, err);
});

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(200).json({ ok: true, message: "Mutfilm Bot is running!" });
    return;
  }
  try {
    await ensureDB();
    await bot.handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook xato:", err);
    res.status(200).json({ ok: true });
  }
}
