"""Carrusel 'New Drop' de Tiendas Alexa. Uso: python3 build.py && node render.js
Pon fotos de producto (png/jpg) en photos/ ; si no hay, se dibujan espacios vacíos."""
import os, glob, json
R=os.path.dirname(os.path.abspath(__file__))
PH=sorted(glob.glob(R+'/photos/*.[pjw][npe][gbp]*'))
def photo(k):
    return PH[k%len(PH)] if PH else None
def card(k,x,y,w,h,rot,tape=True,z=3):
    f=photo(k)
    inner=(f'<img src="file://{f}" style="width:100%;height:100%;object-fit:cover">' if f else
           '<div class=ph0><span>FOTO</span></div>')
    t='<i class=tape></i>' if tape else ''
    return f'<div class=card style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;transform:rotate({rot}deg);z-index:{z}">{t}{inner}</div>'
CSS="""<link href="https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@600;800;900&family=Permanent+Marker&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1350px;overflow:hidden;position:relative;background:#c1121f;font-family:Montserrat}
.bg{position:absolute;inset:0;background:radial-gradient(circle at 25% 15%,#ff4d5e 0,#e63946 35%,#8b0a14 80%,#4a0409 100%)}
.dots{position:absolute;inset:0;background-image:radial-gradient(rgba(0,0,0,.28) 3px,transparent 3.5px);background-size:22px 22px;-webkit-mask-image:linear-gradient(160deg,transparent 30%,#000 100%);mask-image:linear-gradient(160deg,transparent 30%,#000 100%)}
.grain{position:absolute;inset:0;z-index:50;opacity:.38;mix-blend-mode:overlay;pointer-events:none}
.vig{position:absolute;inset:0;z-index:49;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.55) 100%)}
.t{font-family:Anton;text-transform:uppercase;position:absolute;left:0;right:0;text-align:center;line-height:.84;z-index:20;color:#fff}
.gl{text-shadow:-9px 0 0 #00e5ff,9px 0 0 #ff1f6b,0 14px 40px rgba(0,0,0,.45)}
.out{color:transparent;-webkit-text-stroke:5px #fff}
.card{position:absolute;background:#f4f1ea;padding:14px 14px 14px;box-shadow:0 30px 60px rgba(0,0,0,.55),0 0 0 1px rgba(0,0,0,.2)}
.card img,.ph0{width:100%;height:100%;display:block}
.ph0{background:repeating-linear-gradient(45deg,#2a2a2a,#2a2a2a 14px,#222 14px,#222 28px);display:flex;align-items:center;justify-content:center;color:#777;font-family:Anton;font-size:44px;letter-spacing:6px}
.tape{position:absolute;top:-22px;left:50%;width:130px;height:44px;margin-left:-65px;background:rgba(255,230,120,.8);transform:rotate(-4deg);box-shadow:0 2px 6px rgba(0,0,0,.3);z-index:5}
.strip{position:absolute;left:-60px;right:-60px;height:78px;background:#050505;color:#fff;z-index:30;display:flex;align-items:center;white-space:nowrap;font-family:Anton;font-size:44px;letter-spacing:4px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.strip b{color:#ff3b4a;margin:0 22px}
.sticker{position:absolute;z-index:40;width:190px;height:190px;border-radius:50%;background:#ffe14d;color:#050505;font-family:Anton;font-size:46px;text-align:center;line-height:.95;display:flex;align-items:center;justify-content:center;transform:rotate(14deg);box-shadow:0 14px 30px rgba(0,0,0,.5),inset 0 0 0 8px #ffe14d,inset 0 0 0 11px #050505}
.pill{position:absolute;z-index:40;background:#050505;color:#fff;font-weight:900;font-size:30px;letter-spacing:5px;padding:18px 38px;border-radius:60px;box-shadow:0 10px 24px rgba(0,0,0,.5)}
.mk{font-family:'Permanent Marker';position:absolute;left:0;right:0;text-align:center;z-index:25;color:#fff;font-size:54px;transform:rotate(-3deg);text-shadow:4px 4px 0 #050505}
.wm{position:absolute;z-index:2;left:-40px;top:420px;font-family:Anton;font-size:900px;color:rgba(0,0,0,.14);line-height:1}
</style>
<svg width=0 height=0 style="position:absolute"><filter id=g><feTurbulence type=fractalNoise baseFrequency=.8 numOctaves=3 seed=7/><feColorMatrix values="0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 1.2 -.2"/></filter></svg>"""
def strip(top,rot,txt):
    s=''.join(f'{txt}<b>✦</b>' for _ in range(8))
    return f'<div class=strip style="top:{top}px;transform:rotate({rot}deg)">{s}</div>'
def page(body): return f'<!doctype html><html><head><meta charset=utf-8>{CSS}</head><body><div class=bg></div><div class=dots></div>{body}<div class=vig></div><svg class=grain width=1080 height=1350><rect width=100% height=100% filter="url(#g)"/></svg></body></html>'
def s1():
    return page(strip(40,-3,'ALEXA')+'<div class=t style="top:150px;font-size:350px"><span class=gl>New</span><br><span class="out gl" style="text-shadow:none">Drop</span></div>'
      +card(0,70,780,300,400,-9)+card(1,390,740,300,440,3,z=4)+card(2,720,790,290,390,8)
      +'<div class=sticker style="right:60px;top:560px">NEW<br>IN</div>'
      +'<div class=pill style="left:70px;bottom:44px">ROPA · TENIS · ACCESORIOS</div><div class=pill style="right:60px;bottom:44px;background:#fff;color:#050505">➜</div>')
def s2():
    return page('<div class=wm>1</div>'+'<div class=mk style="top:110px;font-size:70px">se viene el drop</div>'
      +'<div class=t style="top:220px;font-size:330px" ><span class=gl>Martes</span></div>'
      +'<div class=t style="top:520px;font-size:600px;color:#050505;text-shadow:12px 12px 0 #fff">1PM</div>'
      +card(3,40,980,240,270,-7)+card(4,800,980,240,270,7)
      +'<div class=pill style="left:50%;margin-left:-190px;bottom:130px;font-size:28px;white-space:nowrap">⏰ NO TE LO PIERDAS</div>'
      +strip(1262,-2,"DROP DE ALEXA"))
def s3():
    return page(strip(40,3,'TIENDAS ALEXA')+'<div class=t style="top:150px;font-size:300px"><span class=gl>Tiendas</span><br><span class="out gl" style="text-shadow:none">Alexa</span></div>'
      +card(5,300,690,480,560,-3,z=5)+card(0,50,820,260,350,-10)+card(2,770,830,260,350,10)
      +'<div class=sticker style="left:50px;top:610px;transform:rotate(-12deg)">OPEN</div>'
      +'<div class=pill style="left:50%;margin-left:-215px;bottom:30px;white-space:nowrap;font-size:28px;z-index:60">@TIENDASALEXA_</div>')
for i,f in enumerate((s1,s2,s3),1): open(f'{R}/slide{i}.html','w').write(f())
print(len(PH),'fotos')
