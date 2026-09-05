import { brand } from "@/lib/brand";
import { renderMail, sendMail } from "@/lib/mailer";
import { issueToken } from "@/lib/authTokens";

// Link'in tabani: uretimde canli adres, gelistirmede yerel sunucu.
function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || brand.url;
}

export async function sendVerificationMail(userId: string, email: string, name: string) {
  const token = await issueToken(userId, "dogrulama");
  const url = `${baseUrl()}/dogrula/${token}`;
  const { html, text } = renderMail({
    heading: `Hoş geldin ${name}`,
    intro: `${brand.name} hesabını doğrulamak için aşağıdaki bağlantıya tıkla. Bağlantı 48 saat geçerli.`,
    buttonLabel: "Hesabımı doğrula",
    buttonUrl: url,
    footer: "Bu hesabı sen açmadıysan bu e-postayı yok sayabilirsin.",
  });
  return sendMail({ to: email, subject: `${brand.name} hesabını doğrula`, html, text });
}

export async function sendPasswordResetMail(userId: string, email: string, name: string) {
  const token = await issueToken(userId, "sifirlama");
  const url = `${baseUrl()}/sifre-sifirla/${token}`;
  const { html, text } = renderMail({
    heading: "Şifreni sıfırla",
    intro: `Merhaba ${name}, yeni bir şifre belirlemek için aşağıdaki bağlantıya tıkla. Bağlantı 1 saat geçerli.`,
    buttonLabel: "Yeni şifre belirle",
    buttonUrl: url,
    footer: "Bu isteği sen yapmadıysan hiçbir şey yapmana gerek yok; şifren değişmez.",
  });
  return sendMail({ to: email, subject: `${brand.name} şifre sıfırlama`, html, text });
}
