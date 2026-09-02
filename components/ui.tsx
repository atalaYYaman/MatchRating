import React from "react";

// Web tarafinin tasarim sistemi bilesenleri. Mobildeki
// mobile/components/ui.tsx ile ayni API ve ayni gorsel dil; stiller
// app/globals.css icindeki siniflardan geliyor.

export function Card({
  children,
  raised,
  className = "",
  style,
}: {
  children: React.ReactNode;
  raised?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`card ${raised ? "card-raised" : ""} ${className}`} style={style}>
      {children}
    </div>
  );
}

/** Skorbord tarzi, buyuk harf, harf araligi acilmis ust baslik. */
export function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`eyebrow ${className}`}>{children}</span>;
}

export type BadgeTone = "neutral" | "brand" | "accent" | "danger";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

/** Uygulamanin her yerindeki ham puanlara skorbord gorunumu verir. */
export function ScoreBadge({
  value,
  label = "GENEL",
  size = "default",
}: {
  value: string | number;
  label?: string;
  size?: "default" | "large";
}) {
  return (
    <span className={`score-badge ${size === "large" ? "score-badge-lg" : ""}`}>
      <span className="score-badge-value">{value}</span>
      <span className="eyebrow">{label}</span>
    </span>
  );
}

export function InlineMessage({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "danger";
}) {
  return <div className={`inline-msg inline-msg-${tone}`}>{children}</div>;
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="error">{children}</p>;
}

export function Field({
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <input {...props} />
      {error && <span className="error">{error}</span>}
    </div>
  );
}

/** Sayfa basligi: kucuk ust baslik + buyuk isim. */
export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  );
}
