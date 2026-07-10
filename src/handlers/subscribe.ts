import { Context, Markup } from "telegraf";

export async function checkSubscribed(ctx: Context): Promise<boolean> {
  const channelId = process.env.CHANNEL_ID || "@mutfilmUZcode";
  const channelUsername = channelId.startsWith("@") ? channelId.slice(1) : channelId;

  try {
    const member = await ctx.telegram.getChatMember(channelId, ctx.from!.id);
    const ok = ["member", "administrator", "creator"].includes(member.status);
    if (!ok) {
      await ctx.replyWithHTML(
        `⚠️ <b>Botdan foydalanish uchun kanalga a'zo bo'ling!</b>\n\n` +
          `A'zo bo'lgach, kodni qayta yuboring.`,
        Markup.inlineKeyboard([
          [Markup.button.url("📺 Kanalga a'zo bo'lish", `https://t.me/${channelUsername}`)],
        ])
      );
    }
    return ok;
  } catch {
    // Kanal ID noto'g'ri yoki bot kanalda admin emas — bloklamaslik
    return true;
  }
}
