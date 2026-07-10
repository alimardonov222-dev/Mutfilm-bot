import { Context, Markup } from "telegraf";
import { db, users } from "../db";
import { eq } from "drizzle-orm";

export async function handleStart(ctx: Context) {
  const from = ctx.from!;
  const channelId = process.env.CHANNEL_ID || "@mutfilmUZcode";
  const channelUsername = channelId.startsWith("@") ? channelId.slice(1) : channelId;

  // Foydalanuvchini saqlash
  await db
    .insert(users)
    .values({
      telegramId: from.id,
      username: from.username || null,
      firstName: from.first_name,
      lastName: from.last_name || null,
    })
    .onConflictDoUpdate({
      target: users.telegramId,
      set: {
        username: from.username || null,
        firstName: from.first_name,
        lastName: from.last_name || null,
      },
    });

  const welcomeText = `🎬 <b>Xush kelibsiz, ${from.first_name}!</b>

Bu bot orqali siz kanalimizdan multfilm va filmlarni olishingiz mumkin.

<b>Qanday ishlatish:</b>
📌 Kanalimizga o'ting
📌 Multfilm postidagi <b>KODNI</b> nusxalang
📌 Shu kodni botga yuboring
📌 Video avtomatik yuboriladi! ✅

👇 Kanalimiz:`;

  await ctx.replyWithHTML(
    welcomeText,
    Markup.inlineKeyboard([
      [Markup.button.url("📺 Kanalga o'tish", `https://t.me/${channelUsername}`)],
    ])
  );
}
