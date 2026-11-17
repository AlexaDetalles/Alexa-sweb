"""Recorta y retoca las fotos de originals/ -> photos/ (01..08, una por marco de la plantilla).
Uso: python3 prep_photos.py && python3 build.py && node render.js"""
import os
from PIL import Image, ImageOps, ImageEnhance, ImageFilter
R=os.path.dirname(os.path.abspath(__file__))
# slot -> (original, aspecto ancho/alto del marco, centro x, centro y, zoom>=1)
SLOTS={
 1:('05',276/396,.45,.52,1.0),  # slide1 izq  - tenis Columbia
 2:('02',276/436,.46,.55,1.0),  # slide1 centro - Reebok
 3:('06',276/386,.46,.52,1.0),  # slide1 der  - tenis US Polo
 4:('01',236/276,.45,.50,1.0),  # slide2 izq  - jeans negro
 5:('08',236/276,.50,.52,1.0),  # slide2 der  - bolso US Polo
 6:('09',416/536,.50,.50,1.0),  # slide3 centro - Skaisite
 7:('04',236/316,.50,.50,1.0),  # slide3 izq  - pantalón gris
 8:('07',236/316,.50,.50,1.0),  # slide3 der  - camiseta negra
}
for slot,(src,asp,cx,cy,zoom) in SLOTS.items():
    im=ImageOps.exif_transpose(Image.open(f'{R}/originals/{src}.jpg')).convert('RGB')
    W,H=im.size
    h=min(H,W/asp)/zoom; w=h*asp
    x0=min(max(cx*W-w/2,0),W-w); y0=min(max(cy*H-h/2,0),H-h)
    im=im.crop((int(x0),int(y0),int(x0+w),int(y0+h)))
    im=im.resize((900,int(900/asp)),Image.LANCZOS)
    im=ImageOps.autocontrast(im,cutoff=.1)
    im=ImageEnhance.Contrast(im).enhance(1.02)
    im=ImageEnhance.Color(im).enhance(1.0)
    im=im.filter(ImageFilter.UnsharpMask(1.4,70,3))
    im.save(f'{R}/photos/{slot:02d}.jpg',quality=93)
print('listo',len(SLOTS))
