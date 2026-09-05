"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, ErrorText, Field, InlineMessage } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!email.trim()) return setError("E-posta girin.");
    setBusy(true);
    try {
      await api.post("/api/auth/password/request", { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p>
        <Link className="back-link" href="/login">← Giriş</Link>
      </p>
      <h1>Şifremi unuttum</h1>

      {sent ? (
        <InlineMessage tone="success">
          Bu adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen kutunu
          kontrol et; bağlantı 1 saat geçerli.
        </InlineMessage>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 4 }}>
            Hesabının e-posta adresini yaz, sıfırlama bağlantısı gönderelim.
          </p>
          <ErrorText>{error}</ErrorText>
          <Card>
            <Field
              label="E-posta"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@eposta.com"
            />
          </Card>
          <button className="full" onClick={submit} disabled={busy}>
            {busy ? "Gönderiliyor..." : "Sıfırlama bağlantısı gönder"}
          </button>
        </>
      )}
    </div>
  );
}
