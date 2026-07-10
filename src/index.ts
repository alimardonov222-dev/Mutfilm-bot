import * as dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { handleStart } from "./handlers/start";
import { handleMovieCode } from "./handlers/movie";
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
} from "./handlers/admin";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN environment variable is required");
}

const bot = new Telegraf(BOT_TOKEN);

async function initDB() {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL UNIQUE,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    is_banned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`);

  await db.execute(sql`CREATE TABLE IF NOT EXISTS movies (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    file_id TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'video',
    photo_file_id TEXT,
    title TEXT NOT NULL,
    year TEXT,
    quality TEXT,
    imdb TEXT,
    country TEXT,
    language TEXT,
    genre TEXT,
    caption TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`);

  await db.execute(sql`CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    code TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`);

  await db.execute(sql`CREATE TABLE IF NOT EXISTS admin_sessions (
    id SERIAL PRIMARY KEY,
    admin_id BIGINT NOT NULL UNIQUE,
    step TEXT NOT NULL DEFAULT 'idle',
    data TEXT NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`);

  console.log("✅ Database tayyor");
}

bot.command("start", (ctx) => handleStart(ctx));

bot.command("help", async (ctx) => {
  const channelId = process.env.CHANNEL_ID || "@mutfilmUZcode";
  const channelUsername = channelId.startsWith("@") ? channelId.slice(1) : channelId;
  await ctx.replyWithHTML(
    `📖 <b>Qo'llanma</b>\n\n` +
    `1️⃣ @${channelUsername} kanalidan multfilm postini toping\n` +
    `2️⃣ Postdagi <b>raqamli kodni</b> nusxalang\n` +
    `3️⃣ Kodni botga yuboring\n` +
    `4️⃣ Video avtomatik keladi ✅`
  );
});

bot.command("upload", (ctx) => handleUpload(ctx));
bot.command("skip", (ctx) => handleSkip(ctx));
bot.command("cancel", (ctx) => handleCancel(ctx));
bot.command("stats", (ctx) => handleStats(ctx));
bot.command("broadcast", (ctx) => handleBroadcast(ctx));
bot.command("ban", (ctx) => handleBan(ctx));
bot.command("unban", (ctx) => handleUnban(ctx));
bot.command("delete", (ctx) => handleDelete(ctx));

bot.command("admin", async (ctx) => {
  if (!isAdmin(ctx.from!.id)) {
    await ctx.reply("❌ Siz admin emassiz!");
    return;
  }
  await ctx.replyWithHTML(
    `🛠 <b>Admin Panel</b>\n\n` +
      `📤 /upload — Yangi multfilm yuklash\n` +
      `📊 /stats — Bot statistikasi\n` +
      `📡 /broadcast &lt;matn&gt; — Hammaga xabar\n` +
      `🚫 /ban &lt;user_id&gt; — Foydalanuvchini bloklash\n` +
      `✅ /unban &lt;user_id&gt; — Blokdan chiqarish\n` +
      `🗑 /delete &lt;KOD&gt; — Multfilmni o'chirish`
  );
});

bot.on("callback_query", async (ctx) => {
  const handled = await handleAdminCallback(ctx);
  if (!handled) await ctx.answerCbQuery("❌ Noma'lum amal");
});

bot.on("message", async (ctx) => {
  const msg = ctx.message as any;
  const adminHandled = await handleAdminMessage(ctx);
  if (adminHandled) return;

  if (msg.text && !msg.text.startsWith("/")) {
    const text = msg.text.trim();
    if (/^#?\d{1,6}$/.test(text) || /^[A-Z]{0,5}\d{1,6}$/i.test(text)) {
      await handleMovieCode(ctx, text);
    } else {
      await ctx.replyWithHTML(
        `❓ Kod topilmadi.\n\n` +
          `📌 Kanalimizdan kodni oling: @${(process.env.CHANNEL_ID || "@mutfilmUZcode").replace("@", "")}\n` +
          `📲 Kodni botga yuboring, video keladi!`
      );
    }
  }
});

bot.catch((err, ctx) => {
  console.error(`Xato [${ctx.updateType}]:`, err);
});

(async () => {
  try {
    await initDB();
    await bot.launch();
    const botInfo = await bot.telegram.getMe();
    console.log(`🤖 Bot ishga tushdi: @${botInfo.username}`);
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (err) {
    console.error("Bot ishga tushmadi:", err);
    process.exit(1);
  }
})();
