"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, ErrorText, Eyebrow, InlineMessage } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { useActiveGroup } from "@/lib/active-group";

const KINDS = [
  { key: "sorun", label: "Bir sorun var", hint: "Çalışmayan ya da yanlış çalışan bir şey" },
  { key: "oneri", label: "Önerim var", hint: "Eklenmesini veya değişmesini istediğin şey" },
  { key: "diger", label: "Diğer", hint: "Aklındaki başka her şey" },
] as const;

type Kind = (typeof KINDS)[number]["key"];

export default function FeedbackPage() {
  const { activeGroup } = useActiveGroup();
  const [kind, setKind] = useState<Kind>("sorun");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (message.trim().length < 5) {
      setError("Biraz daha ayrıntı yazar mısın?");
      return;
    }
    setSending(true);
    try {
      await api.post("/api/feedback", {
        kind,
        message: message.trim(),
        groupId: activeGroup?.id ?? null,
        app: "web",
      });
      setSent(true);
      setMessage("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <p>
        <Link className="back-link" href="/profile">← Profil</Link>
      </p>
      <h1>Geri bildirim</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Takıldığın, bozuk bulduğun ya da eklenmesini istediğin bir şey varsa yaz.
        Doğrudan bize ulaşır.
      </p>

      {sent && (
        <InlineMessage tone="success">
          Teşekkürler, ulaştı. İstersen bir tane daha yazabilirsin.
        </InlineMessage>
      )}

      <ErrorText>{error}</ErrorText>

      <Card>
        <Eyebrow>NE HAKKINDA?</Eyebrow>
        <div style={{ marginTop: 8 }}>
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              className={`option-row ${kind === k.key ? "option-row-on" : ""}`}
              onClick={() => setKind(k.key)}
            >
              <span className="grow">
                <strong>{k.label}</strong>
                <div className="muted">{k.hint}</div>
              </span>
              <span>{kind === k.key ? "✓" : ""}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <Eyebrow>MESAJIN</Eyebrow>
        <div className="field" style={{ marginTop: 8 }}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            maxLength={2000}
            placeholder="Ne oldu? Mümkünse hangi ekranda olduğunu da yaz."
            style={{ width: "100%", resize: "vertical" }}
          />
        </div>
        <p className="muted" style={{ margin: 0, fontSize: "var(--text-caption)" }}>
          {message.length}/2000 · Adın ve e-postan mesajla birlikte iletilir ki
          gerekirse sana dönebilelim.
        </p>
      </Card>

      <button className="full" onClick={submit} disabled={sending}>
        {sending ? "Gönderiliyor..." : "Gönder"}
      </button>
    </div>
  );
}
