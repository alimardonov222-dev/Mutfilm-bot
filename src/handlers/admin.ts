import { Context, Markup } from "telegraf";
import { db, movies, users, adminSessions } from "../db";
import { eq, count, desc } from "drizzle-orm";

function getAdminIds(): number[] {
  const ids = process.env.ADMIN_IDS || "";
  return ids
    .split(",")
    .map((id) => parseInt(id.trim()))
    .filter((id) => !isNaN(id));
}

export function isAdmin(userId: number): boolean {
  return getAdminIds().includes(userId);
}

// Admin sessiyasini olish
async function getSession(adminId: number) {
  let session = await db.query.adminSessions.findFirst({
    where: eq(adminSessions.adminId, adminId),
  });
  if (!session) {
    await db.insert(adminSessions).values({
      adminId,
      step: "idle",
      data: "{}",
    });
    session = { id: 0, adminId, step: "idle", data: "{}", updatedAt: new Date() };
  }
  return session;
}

// Admin sessiyasini yangilash
async function updateSession(adminId: number, step: string, data: object) {
  await db
    .insert(adminSessions)
    .values({ adminId, step, data: JSON.stringify(data) })
    .onConflictDoUpdate({
      target: adminSessions.adminId,
      set: { step, data: JSON.stringify(data), updatedAt: new Date() },
    });
}

async function resetSession(adminId: number) {
  await updateSession(adminId, "idle", {});
}

// Navbatdagi kodni hisoblash
async function getNextCode(): Promise<string> {
  const result = await db
    .select({ id: movies.id })
    .from(movies)
    .orderBy(desc(movies.id))
    .limit(1);
  const lastId = result[0]?.id || 0;
  return String(lastId + 1).padStart(3, "0");
}

// /upload buyrug'i
export async function handleUpload(ctx: Context) {
  const from = ctx.from!;
  if (!isAdmin(from.id)) {
    await ctx.reply("❌ Siz admin emassiz!");
    return;
  }

  await resetSession(from.id);
  await updateSession(from.id, "wait_photo", {});

  await ctx.replyWithHTML(
    `📤 <b>Yangi multfilm yuklash</b>\n\n` +
      `Qadam 1/8: 🖼 <b>Posterni yuboring</b>\n` +
      `(Posterni o'tkazib yuborish uchun /skip yuboring)`
  );
}

// /cancel buyrug'i — upload jarayonini bekor qilish
export async function handleCancel(ctx: Context) {
  const from = ctx.from!;
  if (!isAdmin(from.id)) return;

  const session = await getSession(from.id);
  if (session.step === "idle") {
    await ctx.reply("ℹ️ Hozir hech qanday jarayon yo'q.");
    return;
  }

  await resetSession(from.id);
  await ctx.reply("🚫 Yuklash bekor qilindi.");
}

// /skip buyrug'i (poster o'tkazish)
export async function handleSkip(ctx: Context) {
  const from = ctx.from!;
  if (!isAdmin(from.id)) return;

  const session = await getSession(from.id);
  if (session.step !== "wait_photo") return;

  const data = JSON.parse(session.data);
  data.photoFileId = null;
  await updateSession(from.id, "wait_video", data);

  await ctx.replyWithHTML(`Qadam 2/8: 🎬 <b>Videoni yuboring</b>`);
}

// /stats buyrug'i
export async function handleStats(ctx: Context) {
  const from = ctx.from!;
  if (!isAdmin(from.id)) {
    await ctx.reply("❌ Siz admin emassiz!");
    return;
  }

  const [userCount] = await db.select({ count: count() }).from(users);
  const [movieCount] = await db.select({ count: count() }).from(movies);
  const [bannedCount] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.isBanned, true));

  await ctx.replyWithHTML(
    `📊 <b>Bot statistikasi</b>\n\n` +
      `👤 Jami foydalanuvchilar: <b>${userCount.count}</b>\n` +
      `🚫 Taqiqlangan: <b>${bannedCount.count}</b>\n` +
      `🎬 Jami multfilmlar: <b>${movieCount.count}</b>`
  );
}

// /broadcast buyrug'i
export async function handleBroadcast(ctx: Context) {
  const from = ctx.from!;
  if (!isAdmin(from.id)) {
    await ctx.reply("❌ Siz admin emassiz!");
    return;
  }

  const text = (ctx.message as any)?.text?.replace("/broadcast", "").trim();
  if (!text) {
    await ctx.reply("❌ Xabar matni kiriting!\nMisol: /broadcast Yangi multfilm qo'shildi!");
    return;
  }

  const allUsers = await db.select({ telegramId: users.telegramId }).from(users).where(eq(users.isBanned, false));

  let sent = 0;
  let failed = 0;

  await ctx.reply(`📡 ${allUsers.length} ta foydalanuvchiga yuborilmoqda...`);

  for (const user of allUsers) {
    try {
      await (ctx as any).telegram.sendMessage(user.telegramId, text, { parse_mode: "HTML" });
      sent++;
      await new Promise((r) => setTimeout(r, 35)); // Flood limit
    } catch {
      failed++;
    }
  }

  await ctx.replyWithHTML(
    `✅ <b>Broadcast tugadi</b>\n\n` +
      `✔️ Yuborildi: ${sent}\n` +
      `❌ Xato: ${failed}`
  );
}

// /ban buyrug'i
export async function handleBan(ctx: Context) {
  const from = ctx.from!;
  if (!isAdmin(from.id)) return;

  const args = (ctx.message as any)?.text?.split(" ");
  const targetId = parseInt(args?.[1]);
  if (!targetId) {
    await ctx.reply("❌ Format: /ban <user_id>");
    return;
  }

  await db.update(users).set({ isBanned: true }).where(eq(users.telegramId, targetId));
  await ctx.reply(`✅ ${targetId} taqiqlandi.`);
}

// /unban buyrug'i
export async function handleUnban(ctx: Context) {
  const from = ctx.from!;
  if (!isAdmin(from.id)) return;

  const args = (ctx.message as any)?.text?.split(" ");
  const targetId = parseInt(args?.[1]);
  if (!targetId) {
    await ctx.reply("❌ Format: /unban <user_id>");
    return;
  }

  await db.update(users).set({ isBanned: false }).where(eq(users.telegramId, targetId));
  await ctx.reply(`✅ ${targetId} taqiqdan chiqarildi.`);
}

// /delete buyrug'i — kodni o'chirish
export async function handleDelete(ctx: Context) {
  const from = ctx.from!;
  if (!isAdmin(from.id)) return;

  const args = (ctx.message as any)?.text?.split(" ");
  const code = args?.[1]?.toUpperCase();
  if (!code) {
    await ctx.reply("❌ Format: /delete <KOD>");
    return;
  }

  const deleted = await db.delete(movies).where(eq(movies.code, code)).returning();
  if (deleted.length > 0) {
    await ctx.reply(`✅ "${code}" kodi o'chirildi.`);
  } else {
    await ctx.reply(`❌ "${code}" kodi topilmadi.`);
  }
}

// Admin upload jarayonini boshqarish (foto, video, nom, yil ...)
export async function handleAdminMessage(ctx: Context): Promise<boolean> {
  const from = ctx.from!;
  if (!isAdmin(from.id)) return false;

  const session = await getSession(from.id);
  if (session.step === "idle") return false;

  const msg = ctx.message as any;
  const data = JSON.parse(session.data);

  switch (session.step) {
    case "wait_photo": {
      if (msg.photo) {
        const photo = msg.photo[msg.photo.length - 1];
        data.photoFileId = photo.file_id;
        await updateSession(from.id, "wait_video", data);
        await ctx.replyWithHTML(`✅ Poster saqlandi!\n\nQadam 2/8: 🎬 <b>Videoni yuboring</b>`);
      } else if (msg.document && msg.document.mime_type?.startsWith("image/")) {
        data.photoFileId = msg.document.file_id;
        await updateSession(from.id, "wait_video", data);
        await ctx.replyWithHTML(`✅ Poster saqlandi!\n\nQadam 2/8: 🎬 <b>Videoni yuboring</b>`);
      } else {
        await ctx.reply("❌ Rasm yuboring! (Yoki o'tkazib yuborish uchun /skip)");
      }
      return true;
    }

    case "wait_video": {
      if (msg.video) {
        data.fileId = msg.video.file_id;
        data.fileType = "video";
      } else if (msg.document) {
        data.fileId = msg.document.file_id;
        data.fileType = "document";
      } else {
        await ctx.reply("❌ Video yuboring!");
        return true;
      }
      await updateSession(from.id, "wait_title", data);
      await ctx.replyWithHTML(`✅ Video saqlandi!\n\nQadam 3/8: 📝 <b>Multfilm nomini yuboring</b>\nMisol: Shrek 2-qism`);
      return true;
    }

    case "wait_title": {
      data.title = msg.text?.trim();
      if (!data.title) { await ctx.reply("❌ Nom kiriting!"); return true; }
      await updateSession(from.id, "wait_year", data);
      await ctx.replyWithHTML(`✅ Nom: ${data.title}\n\nQadam 4/8: 📅 <b>Yilni yuboring</b>\nMisol: 2021`);
      return true;
    }

    case "wait_year": {
      data.year = msg.text?.trim();
      await updateSession(from.id, "wait_quality", data);
      await ctx.replyWithHTML(
        `✅ Yil: ${data.year}\n\nQadam 5/8: 🖥 <b>Sifatni tanlang</b>`,
        Markup.inlineKeyboard([
          [Markup.button.callback("360p", "q_360p"), Markup.button.callback("480p", "q_480p")],
          [Markup.button.callback("720p | HDRip", "q_720p_hdrip"), Markup.button.callback("1080p | BluRay", "q_1080p_bluray")],
          [Markup.button.callback("4K | HDR", "q_4k_hdr")],
        ])
      );
      return true;
    }

    case "wait_imdb": {
      data.imdb = msg.text?.trim();
      await updateSession(from.id, "wait_country", data);
      await ctx.replyWithHTML(`✅ IMDb: ${data.imdb}\n\nQadam 7/8: 🌍 <b>Davlatni yuboring</b>\nMisol: AQSh, Britaniya`);
      return true;
    }

    case "wait_country": {
      data.country = msg.text?.trim();
      await updateSession(from.id, "wait_language", data);
      await ctx.replyWithHTML(
        `✅ Davlat: ${data.country}\n\nQadam 8/8: 🔊 <b>Audio tilini tanlang</b>`,
        Markup.inlineKeyboard([
          [Markup.button.callback("O'zbek", "lang_uzb"), Markup.button.callback("Rus", "lang_rus")],
          [Markup.button.callback("O'zbek + Rus", "lang_uzb_rus"), Markup.button.callback("Ingliz", "lang_eng")],
        ])
      );
      return true;
    }

    case "wait_genre": {
      data.genre = msg.text?.trim();
      await saveMovie(ctx, from.id, data);
      return true;
    }

    case "wait_quality": {
      await ctx.reply("⬆️ Yuqoridagi tugmalardan birini tanlang!");
      return true;
    }

    case "wait_language": {
      await ctx.reply("⬆️ Yuqoridagi tugmalardan birini tanlang!");
      return true;
    }

    default: {
      return true;
    }
  }
}

// Callback query handler (sifat, audio tanlash)
export async function handleAdminCallback(ctx: Context): Promise<boolean> {
  const from = ctx.from!;
  if (!isAdmin(from.id)) return false;

  const callbackData = (ctx.callbackQuery as any)?.data as string;
  const session = await getSession(from.id);
  const data = JSON.parse(session.data);

  if (callbackData?.startsWith("q_") && session.step === "wait_quality") {
    const qualityMap: Record<string, string> = {
      q_360p: "360p",
      q_480p: "480p",
      q_720p_hdrip: "720p | HDRip",
      q_1080p_bluray: "1080p | BluRay",
      q_4k_hdr: "4K | HDR",
    };
    data.quality = qualityMap[callbackData] || callbackData;
    await updateSession(from.id, "wait_imdb", data);
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(`✅ Sifat: ${data.quality}\n\nQadam 6/8: ⭐️ <b>IMDb reytingini yuboring</b>\nMisol: 7.5/10`);
    return true;
  }

  if (callbackData?.startsWith("lang_") && session.step === "wait_language") {
    const langMap: Record<string, string> = {
      lang_uzb: "O'zbek",
      lang_rus: "Rus",
      lang_uzb_rus: "O'zbek | Rus",
      lang_eng: "Ingliz",
    };
    data.language = langMap[callbackData] || callbackData;
    await updateSession(from.id, "wait_genre", data);
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      `✅ Audio: ${data.language}\n\nBonus: 🎭 <b>Janrlarni yuboring</b>\nMisol: #animatsiya #komediya #oilaviy`
    );
    return true;
  }

  return false;
}

async function saveMovie(ctx: Context, adminId: number, data: any) {
  const code = await getNextCode();

  const captionLines = [
    `🎬 <b>${data.title}</b>`,
    data.year ? `📅 Yil: ${data.year}` : null,
    data.quality ? `🖥 Sifat: ${data.quality}` : null,
    data.imdb ? `⭐️ IMDb: ${data.imdb}` : null,
    data.country ? `🌍 Davlat: ${data.country}` : null,
    data.language ? `🔊 Audio: ${data.language}` : null,
    data.genre ? `🎭 Janr: ${data.genre}` : null,
    ``,
    `📌 Kod: <code>${code}</code>`,
  ].filter((l) => l !== null);

  const caption = captionLines.join("\n");

  await db.insert(movies).values({
    code,
    fileId: data.fileId,
    fileType: data.fileType || "video",
    photoFileId: data.photoFileId || null,
    title: data.title,
    year: data.year || null,
    quality: data.quality || null,
    imdb: data.imdb || null,
    country: data.country || null,
    language: data.language || null,
    genre: data.genre || null,
    caption,
  });

  await resetSession(adminId);

  await ctx.replyWithHTML(
    `✅ <b>Multfilm saqlandi!</b>\n\n` +
      `📋 Nom: ${data.title}\n` +
      `🔑 Kod: <code>${code}</code>\n\n` +
      `Kanal postiga qo'shing:\n` +
      `📲 Kodni olish: <code>${code}</code>`
  );

  // Kanal postini yuborish
  const channelId = process.env.CHANNEL_ID || "@mutfilmUZcode";
  try {
    if (data.photoFileId) {
      await (ctx as any).telegram.sendPhoto(channelId, data.photoFileId, {
        caption,
        parse_mode: "HTML",
      });
    }
    await (ctx as any).telegram.sendVideo(channelId, data.fileId, {
      caption: data.photoFileId ? undefined : caption,
      parse_mode: data.photoFileId ? undefined : "HTML",
    });
  } catch (err) {
    console.error("Kanalga yuborishda xato:", err);
    await ctx.reply("⚠️ Kanalga avtomatik yuborishda xato. Botni kanalda admin qilib qo'ying.");
  }
}
