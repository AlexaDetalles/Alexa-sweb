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

## 6-ProximoDrop (anuncio del próximo drop, con la voz real)
Sale en 9:16 (`6-ProximoDrop`) y en 16:9 (`6-ProximoDrop-16x9`), a 60 fps, 25,2 s. Va guiado por la **locución real** (voz «Cami» de ElevenLabs, `audio/voz-cami.mp3`): cada escena y cada animación caen en la palabra que se dice (los tiempos están en `K`, en `src/Drop.tsx`). Usa las fotos reales de las prendas del drop (`public/img/drop/`) y la marca de la tienda (Vino, Dorado, Crema; Cormorant Garamond y Space Grotesk).

Escenas: «¿Sigues buscando qué estrenar sin ver lo mismo de siempre?» (la misma foto repetida, con glitch) · «Tenis, bolsos o ese outfit…» (una foto por palabra) · «Encontrar tu estilo no debería ser complicado» («complicado» se tacha) · «Sólo entra a AlexaShop.cc» (la dirección se escribe con la voz, celular con la web real) · «El nuevo drop pronto estará disponible…» (ventana con las prendas, sello PRONTO) · «Piezas nuevas listas para ti» (mosaico con palomitas y corazón) · «Sin vueltas, pides directo por WhatsApp» (la línea con vueltas se endereza hasta el chat) · «Sólo entra y elige Alexa» (iris y logo).

Transiciones (sin cortes secos; verificado midiendo el movimiento cuadro a cuadro): barrido líquido, cinta de satén, empuje, ventana que desliza con desenfoque, mosaico que gira, iris. Se inspiran en el análisis de un anuncio de referencia; no se usó su metraje, personajes, audio ni textos.
```
python3 audio/musica_pop.py                                   # música original (pop, 120 BPM) → 6-ProximoDrop-sinvoz.wav
pip install kokoro-onnx faster-whisper                        # una vez
python3 audio/voz.py --real audio/voz-cami.mp3                # mezcla la locución real con la música → 6-ProximoDrop.wav
python3 audio/verificar_voz.py public/audio/6-ProximoDrop.wav # comprueba que se entienda (objetivo: ≥ 0,95)
node render.mjs 6-ProximoDrop-16x9 --props=props-drop.json --salida=6-ProximoDrop-16x9     # ≈2-3 min
node render.mjs 6-ProximoDrop-16x9 --props=props-drop-sin-voz.json --salida=6-ProximoDrop-16x9-sin-voz
node render.mjs 6-ProximoDrop --props=props-drop.json --salida=6-ProximoDrop-9x16
```
Modelos de Kokoro (una vez): `kokoro-v1.0.onnx` y `voices-v1.0.bin` de https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0. Voces en español: `ef_dora` (mujer, la mejor en la prueba), `em_alex`, `em_santa`.
`props-drop.json`: `{"fecha":"","hora":"","incentivo":"","voz":true}`. Con fecha (por ejemplo «Martes 1») la escena de la ventana dice «Llega el …»; el incentivo solo sale si lo escribes y Alexa lo confirma. Los textos de la voz y sus segundos están en `audio/voz.py` (`LINEAS`) y coinciden con lo que se lee en pantalla. Una voz humana real suena mejor: `python3 audio/voz.py --real audio/voz-real.wav`. Licencias: `LICENCIAS.md`.

### Qué salió del análisis de la voz (21 nov 2026)
Se transcribió cada frase con reconocimiento de voz y se comparó con el texto. Piper `es_MX-claude-high` acertó el 74 % (fallaba en palabras sueltas como «Accesorios», «Tenis», «Y más» y al leer la dirección web); Kokoro `ef_dora`, el 97 %, y sobre la mezcla final con la música, el 100 % (15 de 15 frases). Reglas: frases de 3 palabras o más, no leer direcciones web en voz alta, la música baja ~10 dB y pierde 1-4 kHz bajo la voz.

**Imágenes que mejorarían el video** (para un generador premium): `IMAGENES-PARA-MEJORAR-EL-VIDEO.md`.

## Video 6 · «Se viene un nuevo drop» (v5, con las 8 fotos de producto)
- Fotos usadas: las 8 que mandó la tienda (bolsos, tenis y slings), recortadas con BiRefNet y guardadas en `public/img/prod/` (`*-orig.jpg` = original, `<id>.webp` = recorte). Reemplazan a las fotos de celular de `public/img/drop/`.
- Son fotos de productos de terceros (Nike, Levi's, Reebok, New Balance, US Polo): mostrarlas solo si la tienda realmente los vende.
- Transiciones nuevas: zoom con onda de choque, cinta de satén con tenis, empuje vertical, barrido con desenfoque, zoom al mosaico, barrido líquido, iris.
- Render: `node render.mjs 6-ProximoDrop-16x9 --props=props-drop.json --salida=6-ProximoDrop-16x9` (y `6-ProximoDrop` para 9:16). Tarda ~10 min cada uno.
