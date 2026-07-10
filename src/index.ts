import * as dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";
import { client } from "./db";
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
if (!BOT_TOKEN) throw new Error("BOT_TOKEN environment variable is not set!");

console.log("🟡 BOT_TOKEN:", BOT_TOKEN.substring(0, 10) + "...");

async function initDB(retries = 5): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`🔄 DB ulanish urinish ${i}/${retries}...`);
      await client`SELECT 1`;
      console.log("✅ DB ulandi!");
      break;
    } catch (err: any) {
      console.error(`❌ DB ulanmadi (${i}/${retries}):`, err.message);
      if (i === retries) throw err;
      const wait = i * 2000;
      console.log(`⏳ ${wait / 1000}s kutilmoqda...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL UNIQUE,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      is_banned BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS movies (
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
    )
  `);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS requests (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      code TEXT NOT NULL,
      success BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id SERIAL PRIMARY KEY,
      admin_id BIGINT NOT NULL UNIQUE,
      step TEXT NOT NULL DEFAULT 'idle',
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  console.log("✅ Jadvallar tayyor");
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
    `🛠 <b>Admin Panel</b>\n\n` +
    `/upload — Multfilm yuklash\n/stats — Statistika\n` +
    `/broadcast &lt;matn&gt; — Xabar\n/ban /unban /delete`
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
      await ctx.reply(`❓ Kod noto'g'ri. Kanaldan oling: @${ch}`);
    }
  }
});

bot.catch((err, ctx) => {
  console.error(`Bot xato [${ctx.updateType}]:`, err);
});

(async () => {
  try {
    await initDB();
    await bot.launch();
    const me = await bot.telegram.getMe();
    console.log(`🚀 Bot ishga tushdi: @${me.username}`);
    process.once("SIGINT",  () => { bot.stop("SIGINT");  process.exit(0); });
    process.once("SIGTERM", () => { bot.stop("SIGTERM"); process.exit(0); });
  } catch (err) {
    console.error("❌ Ishga tushmadi:", err);
    process.exit(1);
  }
})();
