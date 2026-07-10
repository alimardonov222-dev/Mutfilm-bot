import { Context } from "telegraf";
import { db, movies, users, requests } from "../db";
import { eq } from "drizzle-orm";
import { checkSubscribed } from "./subscribe";

// Rate limiting: user_id -> [timestamp]
const rateLimitMap = new Map<number, number[]>();

function isRateLimited(userId: number): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 daqiqa
  const maxRequests = 10;

  const timestamps = (rateLimitMap.get(userId) || []).filter(
    (ts) => now - ts < windowMs
  );

  if (timestamps.length >= maxRequests) {
    rateLimitMap.set(userId, timestamps);
    return true;
  }

  timestamps.push(now);
  rateLimitMap.set(userId, timestamps);
  return false;
}

export async function handleMovieCode(ctx: Context, code: string) {
  const from = ctx.from!;
  const userId = from.id;

  // Kanalga a'zolikni tekshirish
  const subscribed = await checkSubscribed(ctx);
  if (!subscribed) return;

  // Taqiqlangan foydalanuvchilarni tekshirish
  const user = await db.query.users.findFirst({
    where: eq(users.telegramId, userId),
  });

  if (user?.isBanned) {
    await ctx.reply("❌ Siz taqiqlangansiz. Admin bilan bog'laning.");
    return;
  }

  // Rate limiting
  if (isRateLimited(userId)) {
    await ctx.reply("⏳ Juda tez yuborayapsiz! Iltimos, 1 daqiqa kuting.");
    return;
  }

  const normalizedCode = code.trim().toUpperCase().replace(/^#/, "");

  // Bazadan film qidirish
  const movie = await db.query.movies.findFirst({
    where: eq(movies.code, normalizedCode),
  });

  if (!movie) {
    await ctx.reply(
      `❌ <b>${code}</b> kodi topilmadi.\n\n` +
        `📌 Kanalimizdan to'g'ri kodni oling:\n@${(process.env.CHANNEL_ID || "@mutfilmUZcode").replace("@", "")}`,
      { parse_mode: "HTML" }
    );

    await db.insert(requests).values({
      userId,
      code: normalizedCode,
      success: false,
    });
    return;
  }

  // So'rovni saqlash
  await db.insert(requests).values({
    userId,
    code: normalizedCode,
    success: true,
  });

  const caption = movie.caption || buildCaption(movie);

  try {
    // Poster bor bo'lsa avval poster yuborish
    if (movie.photoFileId) {
      await ctx.replyWithPhoto(movie.photoFileId, {
        caption,
        parse_mode: "HTML",
      });
    }

    // Video yuborish
    if (movie.fileType === "video" || movie.fileType === "document") {
      if (movie.photoFileId) {
        await ctx.replyWithVideo(movie.fileId);
      } else {
        await ctx.replyWithVideo(movie.fileId, {
          caption,
          parse_mode: "HTML",
        });
      }
    } else {
      await ctx.replyWithDocument(movie.fileId, {
        caption: movie.photoFileId ? undefined : caption,
        parse_mode: movie.photoFileId ? undefined : "HTML",
      });
    }
  } catch (err) {
    console.error("Video yuborishda xato:", err);
    await ctx.reply("❌ Videoni yuborishda xato yuz berdi. Keyinroq urinib ko'ring.");
  }
}

function buildCaption(movie: typeof movies.$inferSelect): string {
  const lines: string[] = [];
  lines.push(`🎬 <b>${movie.title}</b>`);
  if (movie.year) lines.push(`📅 Yil: ${movie.year}`);
  if (movie.quality) lines.push(`🖥 Sifat: ${movie.quality}`);
  if (movie.imdb) lines.push(`⭐️ IMDb: ${movie.imdb}`);
  if (movie.country) lines.push(`🌍 Davlat: ${movie.country}`);
  if (movie.language) lines.push(`🔊 Audio: ${movie.language}`);
  if (movie.genre) lines.push(`🎭 Janr: ${movie.genre}`);
  lines.push(`\n📌 Kod: <code>${movie.code}</code>`);
  return lines.join("\n");
}
