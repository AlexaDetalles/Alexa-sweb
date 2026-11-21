"""Comprueba que la voz se entienda EN LA MEZCLA FINAL: transcribe con Whisper (reconocimiento de voz local) la ventana de cada frase de audio/voz.py
y la compara con el texto. Un acierto de 1,00 = se entendió igual. Sirve para el wav de public/audio o para el audio de un mp4 ya renderizado.
Uso:  pip install faster-whisper numpy
      python3 audio/verificar_voz.py public/audio/6-ProximoDrop.wav
      python3 audio/verificar_voz.py out/6-ProximoDrop-16x9.mp4
Nota: se pasa el audio como arreglo de numpy porque algunas versiones de PyAV fallan al abrir archivos desde faster-whisper.
"""
import difflib, os, re, subprocess, sys, unicodedata
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voz import LINEAS
from faster_whisper import WhisperModel


def norm(t):
    t = unicodedata.normalize('NFD', t.lower())
    return re.sub(r'[^a-z0-9 ]', '', ''.join(c for c in t if unicodedata.category(c) != 'Mn')).split()


def cargar(ruta):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', ruta, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(r, dtype=np.float32)


def main():
    ruta = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'public', 'audio', '6-ProximoDrop.wav')
    wm = WhisperModel('small', device='cpu', compute_type='int8')
    audio = cargar(ruta)
    tot = []
    for i, (t, txt) in enumerate(LINEAS):
        fin = LINEAS[i + 1][0] - 0.05 if i + 1 < len(LINEAS) else t + 2.2
        seg = audio[int(max(0, t - 0.2) * 16000):int(min(fin, t + 3.5) * 16000)]
        hip = ' '.join(s.text.strip() for s in wm.transcribe(seg, language='es', beam_size=5, temperature=0)[0])
        r = difflib.SequenceMatcher(None, norm(txt), norm(hip)).ratio()
        tot.append(r)
        print(f'{r:4.2f} | {txt!r:38} -> {hip!r}')
    print(f'PROMEDIO {np.mean(tot):.3f} · mínimo {min(tot):.2f}')


if __name__ == '__main__':
    main()
