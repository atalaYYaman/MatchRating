"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, InlineMessage } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { brand } from "@/lib/brand";

export default function VerifyPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<"bekliyor" | "tamam" | "hata">("bekliyor");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .post("/api/auth/verify", { token })
      .then(() => setState("tamam"))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Doğrulanamadı.");
        setState("hata");
      });
  }, [token]);

  return (
    <div>
      <h1>E-posta doğrulama</h1>
      {state === "bekliyor" && <p className="muted">Doğrulanıyor...</p>}

      {state === "tamam" && (
        <>
          <InlineMessage tone="success">
            Hesabın doğrulandı. {brand.name}&apos;ya hoş geldin.
          </InlineMessage>
          <Link href="/home">
            <button className="full">Ana sayfaya git</button>
          </Link>
        </>
      )}

      {state === "hata" && (
        <>
          <Card>
            <p style={{ margin: 0 }}>{error}</p>
          </Card>
          <Link href="/profile">
            <button className="secondary full">Profile git</button>
          </Link>
        </>
      )}
    </div>
  );
}
