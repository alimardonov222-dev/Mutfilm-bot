import { Telegraf } from "telegraf";
import { db, client } from "../src/db";
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

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

// DB jadvallarni bir marta yaratish (module darajasida)
let dbReady = false;
let dbError: Error | null = null;

const dbInitPromise: Promise<void> = (async () => {
  try {
    await client`SELECT 1`;
    await client.unsafe(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL UNIQUE,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      is_banned BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    )`);
    await client.unsafe(`CREATE TABLE IF NOT EXISTS movies (
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
    await client.unsafe(`CREATE TABLE IF NOT EXISTS requests (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      code TEXT NOT NULL,
      success BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    )`);
    await client.unsafe(`CREATE TABLE IF NOT EXISTS admin_sessions (
      id SERIAL PRIMARY KEY,
      admin_id BIGINT NOT NULL UNIQUE,
      step TEXT NOT NULL DEFAULT 'idle',
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    )`);
    dbReady = true;
    console.log("✅ DB jadvallar tayyor");
  } catch (err) {
    dbError = err as Error;
    console.error("❌ DB init xato:", err);
  }
})();

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

// Xatolarni tutish va foydalanuvchiga xabar berish
bot.catch((err, ctx) => {
  console.error(`❌ Bot xato [${ctx.updateType}]:`, err);
  const chat = (ctx as any).chat || (ctx as any).message?.chat;
  if (chat?.id) {
    ctx.reply("⚠️ Xato yuz berdi. Qayta urinib ko'ring.")
      .catch((e) => console.error("Reply yuborishda xato:", e));
  }
});

export default async function handler(req: any, res: any) {
  // GET: holat tekshirish
  if (req.method !== "POST") {
    res.status(200).json({
      ok: true,
      message: "Mutfilm Bot is running!",
      dbReady,
      dbError: dbError?.message || null,
    });
    return;
  }

  // 1. Webhook secret tekshirish (Telegram autentifikatsiyasi)
  if (WEBHOOK_SECRET) {
    const incoming = req.headers["x-telegram-bot-api-secret-token"];
    if (incoming !== WEBHOOK_SECRET) {
      console.warn("❌ Noto'g'ri webhook secret:", incoming);
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }
  }

  // 2. DB tayyor bo'lishini kutamiz (max 8 sekund)
  if (!dbReady) {
    await Promise.race([
      dbInitPromise,
      new Promise((resolve) => setTimeout(resolve, 8000)),
    ]);
  }

  // 3. DB tayyor bo'lmasa — log va o'tkazib yuboramiz
  if (!dbReady) {
    console.error("❌ DB tayyor emas, update o'tkazib yuborildi. Xato:", dbError?.message);
    res.status(200).json({ ok: true }); // Telegram qayta urinmasligi uchun 200
    return;
  }

  // 4. Bot update ni qayta ishlash
  try {
    await bot.handleUpdate(req.body);
  } catch (err) {
    console.error("❌ handleUpdate xato:", err);
  }

  res.status(200).json({ ok: true });
}
