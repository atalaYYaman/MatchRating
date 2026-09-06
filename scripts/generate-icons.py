"""
Panenka uygulama ikonlarini uretir.

Neden kod: marka ya da renk degisirse ikonlari yeniden cizmek yerine bu
dosyayi calistirmak yeter. Ikili dosyalari elle guncellemek zorunda
kalmiyoruz, tasarim kararlari da burada okunabilir duruyor.

Kullanim:  python scripts/generate-icons.py

Konsept: "Panenka" bir futbol terimi -- Antonin Panenka'nin 1976'da attigi
kasik penalti. Ikon da bunu anlatiyor: topu kasiklayan yay + top. Isim ile
gorsel ayni seyi soyluyor.

Olcek kurali: ikon 48px'te de okunmali. Bu yuzden yalnizca iki bicim var
(yay + daire); panel/pentagon detayi o boyutta cirkin bir dokuya donusur.
"""

from __future__ import annotations
import math
import os
from PIL import Image, ImageDraw

# --- Marka renkleri (lib/brand.ts ve lib/theme.ts ile ayni) ---
PITCH = (31, 92, 63)        # #1F5C3F  saha yesili
PITCH_DARK = (18, 50, 31)   # #12321F
CHALK = (245, 243, 236)     # #F5F3EC  tebesir
AMBER = (232, 163, 61)      # #E8A33D  vurgu

OUT = os.path.join(os.path.dirname(__file__), "..", "mobile", "assets")
SS = 4  # supersampling: 4 kat cizip kucultuyoruz, kenarlar yumusak olsun


def draw_mark(size: int, ball_color, arc_color, scale: float = 1.0):
    """
    Isareti seffaf zeminde cizer.
    scale: icerigin tuval icinde kapladigi oran (adaptive icon guvenli
    alani icin kucultmek gerekiyor).
    """
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    cx, cy = S / 2, S / 2
    r = S * 0.5 * scale  # icerik yaricapi

    # --- Isaret: top + hilal ---
    #
    # Ince yay denedik, ikon boyutunda cokuyordu: 40px'te lekeye donusuyor
    # ve topun kenarindan cikinti yapip hata gibi gorunuyordu. Ince cizgi
    # + daire, bu olcek icin bir sekil fazla.
    #
    # Bunun yerine iki DOLU kutle: amber bir daire, uzerine kaydirilmis
    # tebesir top. Ustteki topun altinda kalan amber, hilal olarak goruntu
    # veriyor -- topun oradan yukari kalktigini anlatiyor. Dolu kutleler
    # kucultmede dagilmaz, 40px'te de iki bicim de secilebiliyor.
    ball_r = r * 0.52
    bcx, bcy = cx + r * 0.10, cy - r * 0.10   # top: optik merkezin biraz sag ustu

    # Amber kutle, topun sol altina kaydirilmis; gorunur kalan kismi hilal.
    off = r * 0.30
    d.ellipse(
        [bcx - off - ball_r, bcy + off - ball_r,
         bcx - off + ball_r, bcy + off + ball_r],
        fill=arc_color,
    )
    # Top ustte: hilali keser.
    d.ellipse([bcx - ball_r, bcy - ball_r, bcx + ball_r, bcy + ball_r], fill=ball_color)

    return img.resize((size, size), Image.LANCZOS)


def solid(size: int, color) -> Image.Image:
    return Image.new("RGBA", (size, size), color + (255,))


def compose(size: int, bg, ball_color, arc_color, scale=1.0) -> Image.Image:
    base = solid(size, bg)
    base.alpha_composite(draw_mark(size, ball_color, arc_color, scale))
    return base


def assert_safe_zone(img: Image.Image, name: str):
    """
    Android adaptive ikonun yalnizca ortadaki %66'lik dairesi her
    launcher'da gorunur. Icerik bunu asarsa kose kirpilir; sessizce
    olmasin diye uretimde dogruluyoruz.
    """
    bbox = img.getbbox()
    if not bbox:
        raise SystemExit(f"{name}: bos gorsel")
    w, h = img.size
    cx, cy = w / 2, h / 2
    corners = [(bbox[0], bbox[1]), (bbox[2], bbox[1]),
               (bbox[0], bbox[3]), (bbox[2], bbox[3])]
    reach = max(math.hypot(px - cx, py - cy) for px, py in corners)
    limit = w * 0.33
    if reach > limit:
        raise SystemExit(
            f"{name}: icerik guvenli alani asiyor "
            f"({reach:.0f}px > {limit:.0f}px). scale degerini dusur."
        )
    print(f"    guvenli alan: {reach:.0f}px / {limit:.0f}px  tamam")


def save(img: Image.Image, name: str):
    path = os.path.normpath(os.path.join(OUT, name))
    img.save(path, "PNG")
    print(f"  {name}  {img.size[0]}x{img.size[1]}  {os.path.getsize(path) // 1024} KB")


def main():
    os.makedirs(os.path.normpath(OUT), exist_ok=True)
    print("Panenka ikonlari uretiliyor:")

    # iOS + genel ikon: yesil zemin, tebesir top, amber yay.
    save(compose(1024, PITCH, CHALK, AMBER), "icon.png")

    # Android adaptive: on plan ve arka plan AYRI dosya. On planin
    # yalnizca ortadaki %66'lik daire (yaricap = genislik*0.33) garanti
    # gorunur. 0.62 ile isaretin kosesi 351px'e cikip 338px sinirini
    # asiyordu -- bazi launcher sekillerinde kirpilirdi. 0.56 guvenli.
    # (assert_safe_zone bunu her uretimde yeniden dogruluyor.)
    fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    fg.alpha_composite(draw_mark(1024, CHALK, AMBER, scale=0.56))
    assert_safe_zone(fg, "android-icon-foreground.png")
    save(fg, "android-icon-foreground.png")
    save(solid(1024, PITCH), "android-icon-background.png")

    # Android tek renk (temali ikonlar): sistem kendi rengini uygular,
    # bizden istedigi yalnizca siluet.
    mono = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    mono.alpha_composite(draw_mark(1024, (255, 255, 255), (255, 255, 255), scale=0.56))
    assert_safe_zone(mono, "android-icon-monochrome.png")
    save(mono, "android-icon-monochrome.png")

    # Acilis ekrani: zemini app.json'daki renk verdigi icin isaret seffaf.
    splash = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    splash.alpha_composite(draw_mark(1024, CHALK, AMBER, scale=0.55))
    save(splash, "splash-icon.png")

    # Web favicon: 48px'te okunurlugu burada sinaniyor.
    save(compose(96, PITCH, CHALK, AMBER), "favicon.png")

    # Magaza icin 512'lik kopya (Play Console "uygulama simgesi" alani).
    save(compose(512, PITCH, CHALK, AMBER), "store-icon-512.png")

    print("\nTamam. Onizleme icin: mobile/assets/icon.png")


if __name__ == "__main__":
    main()
