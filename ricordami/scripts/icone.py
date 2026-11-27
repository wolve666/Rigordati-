"""Genera tutte le icone di RicordaMi da icone/sorgente.png (1254×1254, sfondo trasparente).
   python3 scripts/icone.py     (serve Pillow)"""
from pathlib import Path
from PIL import Image, ImageDraw

R = Path(__file__).resolve().parent.parent
src = Image.open(R / 'icone/sorgente.png').convert('RGBA')
FONDO = (46, 44, 44, 255)  # il grigio scuro della piastrella
tessera = src.crop(src.split()[3].point(lambda v: 255 if v > 200 else 0).getbbox())  # senza ombra

def tonda(im, lato):  # versione "any": l'immagine com'è, con la sua ombra
    return im.resize((lato, lato), Image.LANCZOS)

def piena(lato, quota, fondo=True):  # piastrella al centro, su fondo pieno (maskable, adattiva)
    c = Image.new('RGBA', (lato, lato), FONDO if fondo else (0, 0, 0, 0))
    l = round(lato * quota)
    t = tessera.resize((l, round(l * tessera.height / tessera.width)), Image.LANCZOS)
    c.alpha_composite(t, ((lato - t.width) // 2, (lato - t.height) // 2))
    return c

def cerchio(im):
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).ellipse((0, 0, im.width - 1, im.height - 1), fill=255)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0)); out.paste(im, mask=m); return out

I = R / 'icone'
tonda(src, 192).save(I / 'icona-192.png'); tonda(src, 512).save(I / 'icona-512.png'); tonda(src, 64).save(I / 'icona-64.png')
piena(192, .80).save(I / 'icona-maskable-192.png'); piena(512, .80).save(I / 'icona-maskable-512.png')
piena(180, .92).convert('RGB').save(I / 'apple-180.png')

res = R / 'android/app/src/main/res'
for cartella, k in {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}.items():
    d = res / f'mipmap-{cartella}'
    tonda(src, round(48 * k)).save(d / 'ic_launcher.png')
    cerchio(piena(round(48 * k), .78)).save(d / 'ic_launcher_round.png')
    a = round(108 * k)  # icona adattiva: 108dp, di cui sempre visibili i 72 centrali
    Image.new('RGBA', (a, a), FONDO).save(d / 'ic_launcher_background.png')
    piena(a, 64 / 108, fondo=False).save(d / 'ic_launcher_foreground.png')
print('icone generate')
