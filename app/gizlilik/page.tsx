import { brand } from "@/lib/brand";
export const metadata = {
  title: `Gizlilik Politikası - ${brand.name}`,
};

export default function PrivacyPage() {
  return (
    <div className="card" style={{ maxWidth: 720, margin: "40px auto", lineHeight: 1.6 }}>
      <h1>Gizlilik Politikası</h1>
      <p>Son güncelleme: 31 Ağustos 2026</p>

      <p>
        {brand.name}, kullanıcıların takım kurup arkadaşlarını davet ettiği, birbirlerini
        futbol yeteneği üzerinden oyladığı ve bu oylara göre dengeli takımlar oluşturduğu
        bir uygulamadır. Bu sayfa, uygulamayı kullanırken hangi verilerin toplandığını ve
        nasıl kullanıldığını açıklar.
      </p>

      <h2>Topladığımız veriler</h2>
      <ul>
        <li>Hesap oluştururken: isim, e-posta adresi, şifre (şifrelenmiş olarak saklanır).</li>
        <li>
          Uygulama kullanımı sırasında: dahil olduğun takımlar, takım arkadaşlarına verdiğin
          yetenek/mevki oyları ve sana verilen oylar.
        </li>
      </ul>

      <h2>Verileri nasıl kullanıyoruz</h2>
      <p>
        Bu veriler yalnızca uygulamanın temel işlevi olan takım oluşturma ve oylama
        özelliklerini çalıştırmak için kullanılır. Verilerini reklam amacıyla satmıyor veya
        üçüncü taraflarla paylaşmıyoruz. Uygulama şu anda reklam veya analitik SDK'sı
        içermemektedir.
      </p>

      <h2>Verilerin saklanması</h2>
      <p>
        Veriler Vercel Postgres üzerinde, endüstri standardı güvenlik önlemleriyle saklanır.
        Şifreler geri döndürülemez şekilde (bcrypt ile) hash'lenerek tutulur, düz metin
        olarak hiçbir yerde saklanmaz.
      </p>

      <h2>Verilerin silinmesi</h2>
      <p>
        Hesabının ve verilerinin silinmesini istersen{" "}
        <a href="/hesap-silme">hesap silme sayfasına</a> göz atabilirsin.
      </p>

      <h2>İletişim</h2>
      <p>
        Sorularınız için: <a href="mailto:info@otlak.com.tr">info@otlak.com.tr</a>
      </p>
    </div>
  );
}
