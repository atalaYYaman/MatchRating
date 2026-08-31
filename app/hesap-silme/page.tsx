export const metadata = {
  title: "Hesap Silme - MatchRating",
};

export default function DeleteAccountPage() {
  return (
    <div className="card" style={{ maxWidth: 720, margin: "40px auto", lineHeight: 1.6 }}>
      <h1>Hesap ve Veri Silme</h1>

      <p>
        MatchRating hesabını ve hesabınla ilişkili tüm verileri (isim, e-posta, üye olduğun
        takımlar, verdiğin ve aldığın oylar) silmemizi istiyorsan aşağıdaki adımı izle.
      </p>

      <h2>Nasıl talep edilir</h2>
      <p>
        Hesabına kayıtlı e-posta adresinden{" "}
        <a href="mailto:info@otlak.com.tr?subject=Hesap%20Silme%20Talebi">
          info@otlak.com.tr
        </a>{" "}
        adresine "Hesap Silme Talebi" konulu bir e-posta gönder. Talebin en geç 30 gün
        içinde işleme alınır ve hesabınla ilişkili tüm kişisel veriler kalıcı olarak
        silinir.
      </p>

      <h2>Ne silinir</h2>
      <ul>
        <li>Hesap bilgilerin (isim, e-posta, şifre)</li>
        <li>Üyesi olduğun takımlardaki üyelik kayıtların</li>
        <li>Verdiğin ve senin hakkında verilen yetenek/mevki oyları</li>
      </ul>

      <p>
        Not: Kurduğun bir takımın tek yöneticisiysen, takımın tamamen silinmesini de talep
        edebilirsin; aksi halde takım diğer üyelerle birlikte var olmaya devam eder, sadece
        seninle ilgili veriler kaldırılır.
      </p>
    </div>
  );
}
