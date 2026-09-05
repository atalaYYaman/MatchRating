"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Card, ErrorText, Field, InlineMessage } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (password.length < 8) return setError("Şifre en az 8 karakter olmalı.");
    if (password !== again) return setError("Şifreler eşleşmiyor.");
    setBusy(true);
    try {
      await api.post("/api/auth/password/reset", { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Şifre değiştirilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Yeni şifre belirle</h1>

      {done ? (
        <>
          <InlineMessage tone="success">
            Şifren değiştirildi. Yeni şifrenle giriş yapabilirsin.
          </InlineMessage>
          <Link href="/login">
            <button className="full">Giriş yap</button>
          </Link>
        </>
      ) : (
        <>
          <ErrorText>{error}</ErrorText>
          <Card>
            <Field
              label="Yeni şifre"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="En az 8 karakter"
            />
            <Field
              label="Yeni şifre (tekrar)"
              type="password"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
            />
          </Card>
          <button className="full" onClick={submit} disabled={busy}>
            {busy ? "Kaydediliyor..." : "Şifreyi değiştir"}
          </button>
        </>
      )}
    </div>
  );
}
