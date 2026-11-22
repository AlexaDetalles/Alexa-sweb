"""Voz en off del reel 6-ProximoDrop. Sintetiza cada frase, la coloca en su segundo exacto, baja y «ahueca» la música mientras habla
y deja public/audio/6-ProximoDrop.wav (con voz). La versión sin voz es 6-ProximoDrop-sinvoz.wav (audio/musica_pop.py).

Locución real (la que se usa en el video publicado): voz «Cami» de ElevenLabs, ya con su tiempo.
  python3 audio/voz.py --real audio/voz-cami.mp3
Motor gratuito alternativo: Kokoro (Apache-2.0), voces en español ef_dora (mujer), em_alex y em_santa (hombre). En la prueba del 21 nov 2026 (reconocimiento de voz
sobre cada frase) ef_dora acertó el 97 % de las frases; Piper es_MX-claude-high, el 74 %, y fallaba en palabras sueltas y en leer la dirección web.
  pip install kokoro-onnx
  modelos (una vez):  https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0  → kokoro-v1.0.onnx y voices-v1.0.bin
Uso:
  python3 audio/musica_pop.py
  python3 audio/voz.py --kokoro ruta/carpeta_con_los_modelos --voz ef_dora
  python3 audio/voz.py ruta/modelo-piper.onnx            # alternativa con Piper (pip install piper-tts)
  python3 audio/voz.py --real audio/voz-real.wav         # una voz humana grabada de principio a fin (24 s)
Reglas que salieron del análisis: frases de 3 palabras o más (las palabras sueltas se entienden peor), nunca leer una dirección web en voz alta
(«entra a nuestra web»; la dirección va escrita en pantalla) y la música baja ~10 dB con un recorte de 1-4 kHz bajo la voz.
"""
import argparse, os, subprocess, sys, tempfile, wave
import numpy as np

SR = 44100
aqui = os.path.dirname(os.path.abspath(__file__))
pub = os.path.join(aqui, '..', 'public', 'audio')

# (segundo en que empieza, texto). Lo que aparece en pantalla es lo mismo: sirve de subtítulo.
LINEAS = [  # frases de la locución real (voz «Cami», ElevenLabs) y el segundo en que empieza cada una; sirven para verificar la mezcla
    (0.00, '¿Sigues buscando qué estrenar sin ver lo mismo de siempre?'),
    (4.42, 'Tenis, bolsos o ese outfit que llama la atención.'),
    (8.34, 'Encontrar tu estilo no debería ser complicado.'),
    (11.30, 'Sólo entra a AlexaShop.cc.'),
    (14.04, 'El nuevo drop pronto estará disponible en nuestra página web.'),
    (17.26, 'Piezas nuevas listas para ti.'),
    (19.48, 'Sin vueltas, pides directo por WhatsApp.'),
    (22.04, 'Sólo entra y elige Alexa.'),
]


def leer(ruta):
    with wave.open(ruta, 'rb') as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        x = np.frombuffer(w.readframes(n), dtype='<i2').astype(float) / 32768
    if ch == 2:
        x = x.reshape(-1, 2).mean(1)
    return x, sr


def escribir(ruta, s):
    with wave.open(ruta, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(s, -1, 1) * 32767).astype('<i2').tobytes())


def limpiar(ruta_in, ruta_out, recortar=True):
    """Remuestrea a 44,1 kHz, recorta silencios, quita graves de ruido, compresión suave y nivel de voz estable."""
    recorte = 'silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=1:stop_threshold=-45dB:stop_duration=0.15,' if recortar else ''
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', ruta_in, '-ar', str(SR), '-ac', '1', '-af',
                    recorte + 'highpass=f=80,acompressor=threshold=-20dB:ratio=2.5:attack=5:release=90,loudnorm=I=-17:TP=-2:LRA=9', ruta_out], check=True)


def sintetizar_piper(modelo, velocidad, tmp):
    from piper import PiperVoice
    try:
        from piper import SynthesisConfig
        cfg = SynthesisConfig(length_scale=1.0 / velocidad)
    except ImportError:
        cfg = None
    v = PiperVoice.load(modelo)
    clips = []
    for i, (t, txt) in enumerate(LINEAS):
        crudo = os.path.join(tmp, f'c{i}.wav'); fino = os.path.join(tmp, f'f{i}.wav')
        with wave.open(crudo, 'wb') as w:
            v.synthesize_wav(txt, w, syn_config=cfg) if cfg else v.synthesize_wav(txt, w)
        limpiar(crudo, fino)
        clips.append((t, txt, fino))
    return clips


def sintetizar_kokoro(carpeta, voz, velocidad, tmp):
    from kokoro_onnx import Kokoro
    k = Kokoro(os.path.join(carpeta, 'kokoro-v1.0.onnx'), os.path.join(carpeta, 'voices-v1.0.bin'))
    clips = []
    for i, (t, txt) in enumerate(LINEAS):
        x, sr = k.create(txt, voice=voz, speed=velocidad, lang='es')
        crudo = os.path.join(tmp, f'c{i}.wav'); fino = os.path.join(tmp, f'f{i}.wav')
        with wave.open(crudo, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
            w.writeframes((np.clip(np.asarray(x), -1, 1) * 32767).astype('<i2').tobytes())
        limpiar(crudo, fino)
        clips.append((t, txt, fino))
    return clips


def filtro_fft(x, f1, f2):
    X = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1 / SR)
    m = ((fr >= f1) & (fr <= f2)).astype(float)
    m = np.convolve(m, np.hanning(41) / np.hanning(41).sum(), 'same')
    return np.fft.irfft(X * m, len(x))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('modelo', nargs='?', help='modelo .onnx de Piper')
    ap.add_argument('--kokoro', help='carpeta con kokoro-v1.0.onnx y voices-v1.0.bin')
    ap.add_argument('--voz', default='ef_dora')
    ap.add_argument('--velocidad', type=float, default=1.0)
    ap.add_argument('--real', help='wav con la voz ya grabada de principio a fin')
    ap.add_argument('--solo-voz', action='store_true', help='además escribe public/audio/_voz-sola.wav (para analizarla)')
    a = ap.parse_args()
    raw_m = os.path.join(pub, '6-ProximoDrop-sinvoz.wav')
    with wave.open(raw_m, 'rb') as w:
        assert w.getframerate() == SR
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(float).reshape(-1, 2) / 32768
    n = len(raw)
    voz = np.zeros(n)
    with tempfile.TemporaryDirectory() as tmp:
        if a.real:
            f = os.path.join(tmp, 'real.wav'); limpiar(a.real, f, recortar=False)   # sin recortar: la locución ya trae su tiempo
            x, _ = leer(f); voz[:min(n, len(x))] = x[:n]
        else:
            if a.kokoro:
                clips = sintetizar_kokoro(a.kokoro, a.voz, a.velocidad, tmp)
            elif a.modelo:
                clips = sintetizar_piper(a.modelo, a.velocidad, tmp)
            else:
                sys.exit('Falta --kokoro CARPETA, el modelo .onnx de Piper o --real.')
            prev = 0
            for t, txt, f in clips:
                x, _ = leer(f)
                i = int(t * SR); fin = min(n, i + len(x))
                print(f'{t:5.2f}s → {fin / SR:5.2f}s  {txt}')
                if i < prev:
                    print('  ⚠ se pisa con la frase anterior: mueve el tiempo en LINEAS')
                voz[i:fin] += x[: fin - i]
                prev = fin
    # compuerta de voz → la música baja ~10 dB (ataque rápido, salida suave) y pierde 1-4 kHz, donde vive la inteligibilidad
    env = np.convolve(np.abs(voz), np.ones(int(0.05 * SR)) / int(0.05 * SR), 'same')
    gate = np.clip(env / 0.015, 0, 1)
    sua = np.convolve(gate, np.hanning(int(0.30 * SR)) / np.hanning(int(0.30 * SR)).sum(), 'same')
    sua = np.clip(sua * 1.6, 0, 1)
    mus = raw.copy()
    for c in range(2):
        banda = filtro_fft(raw[:, c], 1000, 4000)
        mus[:, c] = (raw[:, c] - 0.55 * banda * sua) * (1 - 0.68 * sua)
    mezcla = mus * 0.85 + voz[:, None] * 1.15
    tmpf = os.path.join(pub, '_mezcla.wav')
    escribir(tmpf, mezcla)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmpf, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9', '-ar', str(SR), os.path.join(pub, '6-ProximoDrop.wav')], check=True)
    os.remove(tmpf)
    if a.solo_voz:
        escribir(os.path.join(pub, '_voz-sola.wav'), np.repeat(voz[:, None], 2, 1))
    print('listo public/audio/6-ProximoDrop.wav')


if __name__ == '__main__':
    main()
