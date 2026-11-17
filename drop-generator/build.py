"""Carrusel 'New Drop' de Tiendas Alexa (minimal, grano de película). 2160x2700 (2K, 4:5).
Uso: python3 build.py && node render.js
Pon fotos de producto (png/jpg/webp) en photos/ ; si no hay, se dibujan espacios vacíos."""
import os, glob
R=os.path.dirname(os.path.abspath(__file__))
PH=sorted(glob.glob(R+'/photos/*.[pjw][npe][gbp]*'))
import base64
SPECK='data:image/png;base64,'+base64.b64encode(open(R+'/speck.png','rb').read()).decode()
def photo(k): return PH[k%len(PH)] if PH else None
def card(k,x,y,w,h,rot,z=3):
    f=photo(k)
    inner=(f'<img src="file://{f}">' if f else '<div class=ph0></div>')
    return f'<div class=card style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;transform:rotate({rot}deg);z-index:{z}">{inner}</div>'
CSS="""<link href="https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@700&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1350px;overflow:hidden;position:relative;background:#4a0409;font-family:Montserrat}
.bg{position:absolute;inset:0;background:
 radial-gradient(circle at 20% 8%,#ff5a68 0,transparent 55%),
 radial-gradient(circle at 90% 95%,#2b0206 0,transparent 60%),
 linear-gradient(165deg,#f0414f 0%,#c1121f 38%,#7a0912 72%,#2f0307 100%)}
.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,rgba(255,190,150,.35),transparent 60%);mix-blend-mode:screen}
.vig{position:absolute;inset:0;z-index:49;background:radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,.6) 100%)}
.grain{position:absolute;inset:0;z-index:50;opacity:.38;mix-blend-mode:overlay;pointer-events:none;background:url(file://{R}/grain.png) 0 0/1080px 1350px}
.t{-webkit-mask-image:url({SPECK});mask-image:url({SPECK});-webkit-mask-size:512px 512px;mask-size:512px 512px;font-family:Anton;text-transform:uppercase;position:absolute;left:0;right:0;text-align:center;line-height:.86;z-index:20;
 color:#fff;drop-shadow(0 0 22px rgba(255,120,110,.55)) drop-shadow(0 18px 36px rgba(0,0,0,.45))}
.t .g{background:linear-gradient(180deg,#fff 0%,#fff 45%,#ffc9c2 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.t .o{color:transparent;-webkit-text-stroke:4px #fff}
.card{position:absolute;background:#f6f2ea;padding:12px;box-shadow:0 34px 70px rgba(0,0,0,.6),0 6px 14px rgba(0,0,0,.35)}
.card img,.ph0{width:100%;height:100%;display:block;object-fit:cover;filter:saturate(.95)}
.ph0{background:linear-gradient(160deg,#2c2c2c,#141414)}
.tag{position:absolute;left:0;right:0;text-align:center;z-index:30;color:#fff;font-weight:700;font-size:26px;letter-spacing:12px;text-transform:uppercase;text-shadow:0 2px 14px rgba(0,0,0,.5)}
</style>
"""
def page(body): return f'<!doctype html><html><head><meta charset=utf-8>{CSS.replace('{R}',R).replace('{SPECK}',SPECK)}</head><body><div class=bg></div><div class=glow></div>{body}<div class=vig></div><div class=grain></div></body></html>'
def s1():
    return page('<div class=t style="top:120px;font-size:360px"><span class=g>New</span><br><span class=o>Drop</span></div>'
      +card(0,70,800,300,420,-7)+card(1,390,760,300,460,2,z=4)+card(2,710,810,300,410,7)
      +'<div class=tag style="bottom:56px">Ropa · Tenis · Accesorios</div>')
def s2():
    return page('<div class=t style="top:150px;font-size:300px"><span class=g>Martes</span></div>'
      +'<div class=t style="top:430px;font-size:620px"><span class=g>1PM</span></div>'
      +card(3,80,990,260,300,-6)+card(4,740,990,260,300,6)
      +'<div class=tag style="bottom:70px;left:340px;right:340px">Alexa</div>')
def s3():
    return page('<div class=t style="top:110px;font-size:310px"><span class=g>Tiendas</span><br><span class=o>Alexa</span></div>'
      +card(5,320,700,440,560,-2,z=5)+card(6,60,830,260,340,-8)+card(7,760,830,260,340,8)
      +'<div class=tag style="bottom:44px">@tiendasalexa_</div>')
for i,f in enumerate((s1,s2,s3),1): open(f'{R}/slide{i}.html','w').write(f())
print(len(PH),'fotos')
