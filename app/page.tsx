import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/home");

  return (
    <div>
      <h1>MatchRating ⚽</h1>
      <p>
        Takımını kur, arkadaşlarını davet et, birbirinizi 6 yetenek üzerinden
        oylayın; MatchRating rastgele ve dengeli takımlar oluştursun.
      </p>
      <div className="row">
        <Link href="/login"><button>Giriş Yap</button></Link>
        <Link href="/register"><button className="secondary">Kayıt Ol</button></Link>
      </div>
    </div>
  );
}
