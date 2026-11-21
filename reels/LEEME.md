# Reels de Tiendas Alexa (Remotion)

Seis reels verticales 1080×1920 a 30 fps con la identidad de la web (vino, crema, dorado; Cormorant Garamond y Space Grotesk) y música original.

| Reel | Duración | Uso |
|---|---|---|
| 1-AlgoViene | 8,7 s | Primera señal, sin fecha |
| 2-Closet | 12,7 s | Números del stock (piezas y únicas) |
| 3-CuentaRegresiva | 6,7 s | Fecha y hora, con tic-tac |
| 4-Anuncio | 14,7 s | El que se promociona |
| 5-Apertura | 13,3 s | Día del drop, con fotos y precios reales |
| 6-ProximoDrop | 22 s | Anuncio SIN fecha de un nuevo drop (ropa, accesorios, tenis y más), con voz en off opcional |

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

## 6-ProximoDrop (anuncio del próximo drop, con voz)
Tarjetas que caen («Ropa», «Accesorios», «Tenis», «y más…»), «drop» que pasa por detrás de un reloj real del catálogo, la web en un celular (con los botones Ropa, Tenis y Accesorios resaltados) y la marca que se arma. Todo lo que aún no existe va solo por props:
```
python3 audio/musica.py                                   # música original (escribe 6-ProximoDrop-sinvoz.wav)
pip install piper-tts                                     # una vez
python3 audio/voz.py ruta/es_MX-claude-high.onnx --velocidad 1.05   # suma la voz y crea 6-ProximoDrop.wav
node render.mjs 6-ProximoDrop --props=props-drop.json                              # con voz
node render.mjs 6-ProximoDrop --props=props-drop-sin-voz.json --salida=6-ProximoDrop-sin-voz
```
`props-drop.json`: `{"fecha":"","hora":"","incentivo":"","voz":true}`. Con fecha (por ejemplo «Martes 1») la escena del celular dice «Llega el …»; el incentivo solo sale si lo escribes y Alexa lo confirma. Los textos de la voz y sus segundos están en `audio/voz.py` (`LINEAS`) y coinciden con lo que se lee en pantalla (subtítulos). Una voz humana real suena mejor que cualquier TTS: `python3 audio/voz.py --real audio/voz-real.wav`. Licencias de recursos: `LICENCIAS.md`.
