# Reels de Tiendas Alexa (Remotion)

Cinco reels verticales 1080×1920 a 30 fps con la identidad de la web (vino, crema, dorado; Cormorant Garamond y Space Grotesk) y música original.

| Reel | Duración | Uso |
|---|---|---|
| 1-AlgoViene | 8,7 s | Primera señal, sin fecha |
| 2-Closet | 12,7 s | Números del stock (piezas y únicas) |
| 3-CuentaRegresiva | 6,7 s | Fecha y hora, con tic-tac |
| 4-Anuncio | 14,7 s | El que se promociona |
| 5-Apertura | 13,3 s | Día del drop, con fotos y precios reales |

## Uso
```
npm install
python3 audio/musica.py            # genera la música (public/audio/*.wav y out/audio/*.mp3)
node render.mjs                    # los 5 videos en out/
node render.mjs 4-Anuncio --foto=60   # un cuadro suelto para revisar
node render.mjs 4-Anuncio --props=props.json   # otra fecha o números
npm run studio                     # editor visual
```
`props.json` de ejemplo: `{"dia":"Martes 1","hora":"1:00 PM","incentivo":"Las primeras 10 compras: envoltura de regalo gratis","piezas":143,"unicas":124}`.
Para Apertura (también lleva `incentivo`): `{"piezas":[{"img":"img/mi-foto.webp","nombre":"Tenis Nike","precio":"L1,200"}]}` (la foto va en `public/img/`).

## Sincronía
90 pulsos por minuto: un pulso cada 20 cuadros. Los tiempos `at` de `src/Reels.tsx` coinciden con los sonidos de `audio/musica.py`. Si mueves uno, mueve el otro.
