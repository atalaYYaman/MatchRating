import { brand } from "@/lib/brand";

// Saglayicidan bagimsiz e-posta katmani.
//
// RESEND_API_KEY tanimliysa Resend uzerinden gonderir. Tanimli degilse
// gondermeyi denemez: gelistirmede icerigi konsola yazar, uretimde ise
// "yapilandirilmamis" doner. Boylece anahtar gelene kadar tum akis
// (token uretimi, link, sayfalar) calisir ve test edilebilir kalir;
// saglayici degisirse yalnizca bu dosya degisir.

export type MailResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "failed"; detail?: string };

type Mail = { to: string; subject: string; html: string; text: string };

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(mail: Mail): Promise<MailResult> {
  if (!isMailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `\n[mail] Saglayici yok, gonderilmedi.\n  Kime: ${mail.to}\n  Konu: ${mail.subject}\n  ${mail.text}\n`
      );
    }
    return { sent: false, reason: "not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: brand.mailFrom,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    });
    if (!res.ok) {
      return { sent: false, reason: "failed", detail: `HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: "failed", detail: String(err) };
  }
}

// Tek bir sade sablon: marka basligi + mesaj + buton. Icerik brand.ts'ten
// beslendigi icin isim degisince e-postalar da kendiliginden degisir.
export function renderMail(opts: {
  heading: string;
  intro: string;
  buttonLabel: string;
  buttonUrl: string;
  footer: string;
}): { html: string; text: string } {
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#F5F3EC;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#16231C">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="font-weight:800;font-size:20px;letter-spacing:-0.01em;color:#1F5C3F">${brand.name}</div>
    <div style="background:#fff;border:1px solid #DEDACE;border-radius:14px;padding:24px;margin-top:16px">
      <h1 style="margin:0 0 12px;font-size:20px">${opts.heading}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#5A635D">${opts.intro}</p>
      <a href="${opts.buttonUrl}" style="display:inline-block;background:#1F5C3F;color:#FBFAF6;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">${opts.buttonLabel}</a>
      <p style="margin:20px 0 0;font-size:13px;color:#8B948E">${opts.footer}</p>
      <p style="margin:12px 0 0;font-size:12px;color:#8B948E;word-break:break-all">${opts.buttonUrl}</p>
    </div>
  </div></body></html>`;

  const text = `${brand.name}\n\n${opts.heading}\n\n${opts.intro}\n\n${opts.buttonUrl}\n\n${opts.footer}`;
  return { html, text };
}
