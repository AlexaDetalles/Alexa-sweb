# Reels de Tiendas Alexa (Remotion)

Seis reels (el 6 también en horizontal 1920×1080) a 30 fps con la identidad de la web (vino, crema, dorado; Cormorant Garamond y Space Grotesk) y música original.

| Reel | Duración | Uso |
|---|---|---|
| 1-AlgoViene | 8,7 s | Primera señal, sin fecha |
| 2-Closet | 12,7 s | Números del stock (piezas y únicas) |
| 3-CuentaRegresiva | 6,7 s | Fecha y hora, con tic-tac |
| 4-Anuncio | 14,7 s | El que se promociona |
| 5-Apertura | 13,3 s | Día del drop, con fotos y precios reales |
| 6-ProximoDrop · 6-ProximoDrop-16x9 | 25,5 s a 60 fps | Anuncio SIN fecha de un nuevo drop (ropa, accesorios, tenis y más), estilo «pop» de bloques planos, con voz en off opcional |

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
Sale en 9:16 (`6-ProximoDrop`, 1080×1920) y en 16:9 (`6-ProximoDrop-16x9`, 1920×1080, como el video de referencia), a 60 fps. Está construido a partir del análisis, fotograma a fotograma, de un anuncio conceptual de referencia; se imitó la manera de mover las cosas, no su contenido (ni su metraje, personajes, audio o textos).

**Transiciones** (todas en `src/Drop.tsx`; no hay un solo corte seco: cada escena entra mientras la anterior se va):
barrido líquido con franja translúcida · letras en escalera con desenfoque · fundido a foto que se encoge hasta una ventana redondeada · texto que pasa por detrás de un recorte de producto · cinta de satén que cruza la pantalla · colina que se deforma sin parar con una mascota que rebota y levanta polvo · tarjetas que nacen de un destello, giran y se disuelven · palabras que se suman y recentran la línea · un punto que se vuelve icono y el icono que se vuelve la interfaz · máquina de escribir · tarjeta que se arma pieza por pieza (borde que se traza, precio que sube) · ventana que entra deslizando con desenfoque de movimiento · celular que sube con la web real desplazándose por dentro y el diseño que se espeja · palabras que saltan · iris circular · marca que se arma, con el tacón cayendo como el punto del logo.

Los tiempos de cada momento están en `K` (`src/Drop.tsx`); `audio/musica_pop.py` y `audio/voz.py` usan esos mismos números. Todo lo que aún no existe va solo por props.
```
python3 audio/musica_pop.py                                   # música original (pop, 120 BPM) → 6-ProximoDrop-sinvoz.wav
pip install kokoro-onnx faster-whisper                        # una vez
python3 audio/voz.py --kokoro RUTA_MODELOS --voz ef_dora      # voz natural + mezcla → 6-ProximoDrop.wav
python3 audio/verificar_voz.py public/audio/6-ProximoDrop.wav # comprueba que se entienda (objetivo: ≥ 0,95)
node render.mjs 6-ProximoDrop-16x9 --props=props-drop.json --salida=6-ProximoDrop-16x9     # ≈2-3 min
node render.mjs 6-ProximoDrop-16x9 --props=props-drop-sin-voz.json --salida=6-ProximoDrop-16x9-sin-voz
node render.mjs 6-ProximoDrop --props=props-drop.json --salida=6-ProximoDrop-9x16
```
Modelos de Kokoro (una vez): `kokoro-v1.0.onnx` y `voices-v1.0.bin` de https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0. Voces en español: `ef_dora` (mujer, la mejor en la prueba), `em_alex`, `em_santa`.
`props-drop.json`: `{"fecha":"","hora":"","incentivo":"","voz":true}`. Con fecha (por ejemplo «Martes 1») la escena de la ventana dice «Llega el …»; el incentivo solo sale si lo escribes y Alexa lo confirma. Los textos de la voz y sus segundos están en `audio/voz.py` (`LINEAS`) y coinciden con lo que se lee en pantalla. Una voz humana real suena mejor: `python3 audio/voz.py --real audio/voz-real.wav`. Licencias: `LICENCIAS.md`.

### Qué salió del análisis de la voz (21 nov 2026)
Se transcribió cada frase con reconocimiento de voz y se comparó con el texto. Piper `es_MX-claude-high` acertó el 74 % (fallaba en palabras sueltas como «Accesorios», «Tenis», «Y más» y al leer la dirección web); Kokoro `ef_dora`, el 97 %, y sobre la mezcla final con la música, el 100 % (15 de 15 frases). Reglas: frases de 3 palabras o más, no leer direcciones web en voz alta, la música baja ~10 dB y pierde 1-4 kHz bajo la voz.
