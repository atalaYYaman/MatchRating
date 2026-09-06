"""
Play Store gorsellerini uretir.

Uretebildiklerimiz: uygulama simgesi (512), one cikan grafik (1024x500) ve
ekran goruntusu SABLONLARI -- yani cihaz cercevesi + baslik seridi.

Uretemedigimiz: ekranlarin kendisi. Onlar gercek cihazdan cekilmeli;
uydurma arayuz gorseli koymak hem magaza kurallarina aykiri hem de
kullaniciyi yanildir. Bu yuzden sablon, ekran goruntusunu icine
yerlestirecegin bos bir cerceve olarak uretiliyor:

    python scripts/generate-store-assets.py --shot ekran1.png --title "..." --out cikti.png

Kullanim:
    python scripts/generate-store-assets.py            # simge + one cikan grafik
    python scripts/generate-store-assets.py --shot ...  # tek ekran goruntusu cerceveleme
"""

from __future__ import annotations
import argparse
import os
from PIL import Image, ImageDraw, ImageFont

PITCH = (31, 92, 63)
PITCH_DARK = (18, 50, 31)
CHALK = (245, 243, 236)
AMBER = (232, 163, 61)
INK = (22, 35, 28)

HERE = os.path.dirname(__file__)
ASSETS = os.path.normpath(os.path.join(HERE, "..", "mobile", "assets"))
OUT = os.path.normpath(os.path.join(HERE, "..", "store"))


def font(size: int, bold: bool = False):
    """Sistem fontu; bulunamazsa Pillow'un varsayilanina duser."""
    for name in (
        "seguisb.ttf" if bold else "segoeui.ttf",
        "arialbd.ttf" if bold else "arial.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def centered(d: ImageDraw.ImageDraw, text: str, f, cx: int, y: int, fill):
    box = d.textbbox((0, 0), text, font=f)
    d.text((cx - (box[2] - box[0]) / 2, y), text, font=f, fill=fill)
    return box[3] - box[1]


def feature_graphic() -> Image.Image:
    """
    Play Store 'one cikan grafik': 1024x500. Magaza listesinin ustunde
    cikar. Kalabalik olmamali; isim + tek cumle yeter.
    """
    W, H = 1024, 500
    img = Image.new("RGB", (W, H), PITCH)
    d = ImageDraw.Draw(img)

    # Zemine derinlik: sagdan giren genis, yumusak bir koyu kutle.
    # (Ilk surumde ikonu kare zeminiyle koymustuk; kendi yesili sayfa
    # yesiliyle ayni oldugu icin koyu alanin uzerinde yuvarlak kare
    # silueti cikip kusur gibi duruyordu. Artik zeminsiz isaret koyuyoruz.)
    d.ellipse([W * 0.55, -H * 0.45, W * 1.45, H * 1.45], fill=PITCH_DARK)

    # Isaret: seffaf zeminli surum (splash-icon), kare tile yok.
    mark = Image.open(os.path.join(ASSETS, "splash-icon.png")).convert("RGBA")
    m = 300
    mark = mark.resize((m, m), Image.LANCZOS)
    # Sag kenardan guvenli pay: magaza bazi yerlesimlerde kenari kirpiyor,
    # ayrica 0.70*W + m tuvali asiyordu ve top kirpilmis cikiyordu.
    mx = W - m - 120
    img.paste(mark, (mx, (H - m) // 2), mark)
    assert mx + m <= W - 60, "isaret sag kenara cok yakin"

    d.text((64, 148), "Panenka", font=font(86, True), fill=CHALK)
    d.text((66, 264), "Halı saha takımın için", font=font(34), fill=(190, 208, 197))
    d.text((66, 310), "puanlama ve denk kadro", font=font(34), fill=(190, 208, 197))
    return img


def shot_frame(shot_path: str, title: str, subtitle: str | None) -> Image.Image:
    """
    Ekran goruntusunu marka cercevesine oturtur: ustte baslik, altta
    telefon govdesi. Play Store telefon goruntusu icin 1080x1920 uretir.
    """
    W, H = 1080, 1920
    img = Image.new("RGB", (W, H), PITCH)
    d = ImageDraw.Draw(img)
    d.ellipse([-W * 0.4, H * 0.55, W * 1.4, H * 1.9], fill=PITCH_DARK)

    y = 96
    y += centered(d, title, font(62, True), W // 2, y, CHALK) + 46
    if subtitle:
        y += centered(d, subtitle, font(36), W // 2, y, (200, 214, 205)) + 40

    shot = Image.open(shot_path).convert("RGB")
    # Telefon govdesi: genislik sabit, yukseklik oranla
    target_w = int(W * 0.74)
    target_h = int(shot.height * (target_w / shot.width))
    shot = shot.resize((target_w, target_h), Image.LANCZOS)

    # Koseleri yuvarla
    radius = int(target_w * 0.07)
    mask = Image.new("L", (target_w, target_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, target_w - 1, target_h - 1],
                                           radius=radius, fill=255)
    px, py = (W - target_w) // 2, y + 30

    # Ince cerceve
    d.rounded_rectangle([px - 6, py - 6, px + target_w + 5, py + target_h + 5],
                        radius=radius + 6, outline=CHALK, width=5)
    img.paste(shot, (px, py), mask)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shot", help="Cerceveye oturtulacak ekran goruntusu")
    ap.add_argument("--title", default="")
    ap.add_argument("--subtitle", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)

    if args.shot:
        img = shot_frame(args.shot, args.title, args.subtitle)
        out = args.out or os.path.join(OUT, "screenshot.png")
        img.save(out, "PNG")
        print(f"  {out}  {img.size[0]}x{img.size[1]}")
        return

    fg = feature_graphic()
    fg.save(os.path.join(OUT, "feature-graphic-1024x500.png"), "PNG")
    print(f"  feature-graphic-1024x500.png  1024x500")

    icon = Image.open(os.path.join(ASSETS, "icon.png")).convert("RGB").resize(
        (512, 512), Image.LANCZOS)
    icon.save(os.path.join(OUT, "app-icon-512.png"), "PNG")
    print("  app-icon-512.png  512x512")

    print(f"\nCikti: {OUT}")
    print("Ekran goruntuleri icin: --shot ile tek tek cerceveleyin.")


if __name__ == "__main__":
    main()
