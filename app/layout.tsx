import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MatchRating",
  description: "Takım arkadaşlarını oyla, dengeli takımlar oluştur.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
