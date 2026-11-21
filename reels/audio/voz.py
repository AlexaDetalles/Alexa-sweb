"""Voz en off del reel 6-ProximoDrop: sintetiza cada frase con Piper (TTS local y gratuito), la coloca en su segundo exacto,
baja la música mientras habla y deja public/audio/6-ProximoDrop.wav (con voz). La versión sin voz es 6-ProximoDrop-sinvoz.wav.

Requisitos (una vez):  pip install piper-tts
Modelo de voz (licencia abierta, anótala en LICENCIAS.md):
  es_MX-claude-high  (Apache-2.0)  https://huggingface.co/rhasspy/piper-voices/tree/main/es/es_MX/claude/high
  es_MX-ald-medium   (dominio público) · es_ES-davefx-medium (CC0)
Uso:   python3 audio/musica.py            # primero la música
       python3 audio/voz.py ruta/al/modelo.onnx [--velocidad 1.0]
Una voz humana real (grabada en celular y limpiada con ffmpeg) suena mejor que cualquier TTS: pon su wav en audio/voz-real.wav y usa  python3 audio/voz.py --real audio/voz-real.wav
"""
import argparse, os, subprocess, sys, tempfile, wave
import numpy as np

SR = 44100
aqui = os.path.dirname(os.path.abspath(__file__))
pub = os.path.join(aqui, '..', 'public', 'audio')

# (segundo en que empieza, texto que se dice). Lo que aparece en pantalla es lo mismo: sirve de subtítulo.
# «alexa shop punto ce ce» solo es la pronunciación; en pantalla va alexashop.cc.
LINEAS = [
    (0.15, '¿Ya viste lo que se viene?'),
    (2.10, 'Algo nuevo.'),
    (3.72, 'Ropa.'),
    (4.82, 'Accesorios.'),
    (5.92, 'Tenis.'),
    (7.00, 'Y más.'),
    (8.10, 'Un nuevo drop de Tiendas Alexa.'),
    (11.15, 'Entra a alexa shop punto ce ce,'),
    (13.20, 'y escríbenos.'),
    (14.25, 'Llega en estas semanas.'),
    (16.10, 'Elige desde tu celular,'),
    (18.10, 'y pide por WhatsApp.'),
    (20.00, 'Solo elige y pide.'),
    (21.85, 'Alexa.'),
    (22.60, 'Muy pronto.'),
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


def limpiar(ruta_in, ruta_out):
    """Remuestrea a 44,1 kHz, quita graves de ruido, compresión suave y nivel de voz estable."""
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', ruta_in, '-ar', str(SR), '-ac', '1',
                    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=1:stop_threshold=-45dB:stop_duration=0.15,highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-17:TP=-2:LRA=7', ruta_out], check=True)


def sintetizar(modelo, velocidad, tmp):
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('modelo', nargs='?')
    ap.add_argument('--velocidad', type=float, default=1.0)
    ap.add_argument('--real', help='wav con la voz ya grabada de principio a fin (22 s); se mezcla tal cual')
    a = ap.parse_args()
    musica, sr = leer(os.path.join(pub, '6-ProximoDrop-sinvoz.wav'))
    assert sr == SR
    n = len(musica)
    voz = np.zeros(n)
    with tempfile.TemporaryDirectory() as tmp:
        if a.real:
            f = os.path.join(tmp, 'real.wav'); limpiar(a.real, f)
            x, _ = leer(f); voz[:min(n, len(x))] = x[:n]
        else:
            if not a.modelo:
                sys.exit('Falta la ruta del modelo .onnx de Piper (o usa --real).')
            prev = 0
            for t, txt, f in sintetizar(a.modelo, a.velocidad, tmp):
                x, _ = leer(f)
                i = int(t * SR)
                fin = i + len(x)
                print(f'{t:5.2f}s → {fin / SR:5.2f}s  {txt}')
                if i < prev:
                    print('  ⚠ se pisa con la frase anterior: sube --velocidad o mueve el tiempo en LINEAS')
                voz[i:fin] += x[: max(0, n - i)][: fin - i] if fin <= n else x[: n - i]
                prev = fin
    # música abajo mientras hay voz (ataque rápido, salida suave)
    env = np.abs(voz)
    k = int(0.06 * SR)
    env = np.convolve(env, np.ones(k) / k, 'same')
    gate = np.clip(env / 0.02, 0, 1)
    sua = np.convolve(gate, np.hanning(int(0.35 * SR)) / np.hanning(int(0.35 * SR)).sum(), 'same')
    duck = 1 - 0.62 * np.clip(sua, 0, 1)
    with wave.open(os.path.join(pub, '6-ProximoDrop-sinvoz.wav'), 'rb') as w:
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(float).reshape(-1, 2) / 32768
    mezcla = raw * duck[:, None] * 0.8 + voz[:, None] * 1.0
    tmpf = os.path.join(pub, '_mezcla.wav')
    escribir(tmpf, mezcla)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmpf, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9', '-ar', str(SR), os.path.join(pub, '6-ProximoDrop.wav')], check=True)
    os.remove(tmpf)
    print('listo public/audio/6-ProximoDrop.wav')


if __name__ == '__main__':
    main()
