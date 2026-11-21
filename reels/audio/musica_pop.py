"""Música original del reel 6-ProximoDrop (pop animado, 24 s, 120 pulsos por minuto), sintetizada desde cero: sin muestras ni canciones de terceros.
Estructura: 12 compases de 2 s con la progresión C - G - Am - F (tres vueltas). Bombo desde el segundo 3,5 (cuando caen las tarjetas), palmas en 2 y 4,
hi-hats, bajo con síncopa, acordes cortos a contratiempo, melodía de campanita y un golpe + soplidos en cada corte de escena.
Todo está en el compás: un pulso = 15 cuadros a 30 fps (0,5 s). Los cortes de src/Drop.tsx caen en estos pulsos.
Uso:  python3 audio/musica_pop.py   → public/audio/6-ProximoDrop-sinvoz.wav (la voz se suma con audio/voz.py)
"""
import os
import wave
import numpy as np

SR = 44100
BPM = 120
PULSO = 60 / BPM          # 0,5 s
DUR = 24.0
rng = np.random.default_rng(11)


def n_(seg):
    return int(seg * SR)


def lp(x, fc, orden=2):
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + (fr / fc) ** (2 * orden)), len(x))


def hp(x, fc, orden=2):
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    r = (fr / fc) ** (2 * orden)
    return np.fft.irfft(X * r / (1 + r), len(x))


def bp(x, f1, f2):
    return hp(lp(x, f2), f1)


def ruido(n):
    return rng.standard_normal(n)


class Pista:
    def __init__(self):
        self.n = n_(DUR + 1.5)
        self.L = np.zeros(self.n)
        self.R = np.zeros(self.n)
        self.bus_duck = np.zeros(self.n)    # cuanto «aprieta» el bombo a bajo y acordes
        self.ducked = np.zeros((2, self.n))  # bajo y acordes: pasan por el sidechain
        self.wet = np.zeros(self.n)

    def poner(self, x, t, amp=1.0, pan=0.0, ducked=False, mojado=False):
        i = n_(t)
        if i >= self.n or i < 0:
            return
        x = x[: self.n - i] * amp
        if mojado:
            self.wet[i:i + len(x)] += x
        elif ducked:
            self.ducked[0, i:i + len(x)] += x * (1 - max(pan, 0))
            self.ducked[1, i:i + len(x)] += x * (1 + min(pan, 0))
        else:
            self.L[i:i + len(x)] += x * (1 - max(pan, 0))
            self.R[i:i + len(x)] += x * (1 + min(pan, 0))

    def duck(self, t):
        """Un bombo en t: baja bajo y acordes unos milisegundos (bombeo)."""
        i = n_(t)
        d = n_(0.28)
        env = 1 - np.exp(-np.arange(d) / n_(0.09))
        seg = self.bus_duck[i:i + d]
        self.bus_duck[i:i + len(seg)] = np.maximum(seg, 1 - env[: len(seg)])

    def terminar(self, ruta, reverb=0.35):
        gain = 1 - 0.7 * np.clip(self.bus_duck, 0, 1)
        L = self.L + self.ducked[0] * gain
        R = self.R + self.ducked[1] * gain
        ir_n = n_(1.6)
        t = np.arange(ir_n) / SR
        irs = []
        for _ in range(2):
            ir = lp(ruido(ir_n), 5000) * np.exp(-t / 0.4)
            ir[: n_(0.01)] *= np.linspace(0, 1, n_(0.01))
            irs.append(ir / np.sqrt((ir ** 2).sum()))
        nfft = 1 << int(np.ceil(np.log2(self.n + ir_n)))
        W = np.fft.rfft(self.wet, nfft)
        L = L + reverb * np.fft.irfft(W * np.fft.rfft(irs[0], nfft), nfft)[: self.n]
        R = R + reverb * np.fft.irfft(W * np.fft.rfft(irs[1], nfft), nfft)[: self.n]
        s = np.stack([L, R], 1)
        s[: n_(0.02)] *= np.linspace(0, 1, n_(0.02))[:, None]
        fin = n_(1.0)
        s[-fin:] *= np.linspace(1, 0, fin)[:, None] ** 2
        s *= 0.89 / np.abs(s).max()
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        with wave.open(ruta, 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((s * 32767).astype('<i2').tobytes())


# ---------- sonidos ----------
def bombo():
    n = n_(0.4)
    t = np.arange(n) / SR
    fase = 2 * np.pi * (46 * t + (130 - 46) * 0.035 * (1 - np.exp(-t / 0.035)))
    x = np.sin(fase) * np.exp(-t / 0.17)
    x += 0.35 * lp(ruido(n), 1800) * np.exp(-t / 0.006)
    return x


def palma():
    n = n_(0.35)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for d in (0.0, 0.012, 0.024):
        i = n_(d)
        seg = bp(ruido(n - i), 900, 3200) * np.exp(-np.arange(n - i) / SR / 0.012)
        x[i:] += seg
    cola = bp(ruido(n), 900, 3000) * np.exp(-t / 0.09) * 0.35
    return (x + cola) * 0.9


def hat(abierto=False):
    n = n_(0.22 if abierto else 0.06)
    t = np.arange(n) / SR
    return hp(ruido(n), 7000) * np.exp(-t / (0.07 if abierto else 0.012))


def bajo(f, dur):
    n = n_(dur)
    t = np.arange(n) / SR
    saw = 2 * ((f * t) % 1) - 1
    x = lp(saw, 420) * 0.7 + np.sin(2 * np.pi * f * t) * 0.8
    env = np.minimum(1, t / 0.006) * np.exp(-t / (dur * 0.9)) * np.minimum(1, (dur - t) / 0.03).clip(0, 1)
    return x * env


def acorde(freqs, dur, brillo=2600):
    n = n_(dur)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for det in (0.996, 1.004):
            x += 2 * (((f * det) * t) % 1) - 1
    x = lp(x, brillo) / (2 * len(freqs))
    env = np.minimum(1, t / 0.008) * np.exp(-t / (dur * 0.7)) * np.minimum(1, (dur - t) / 0.04).clip(0, 1)
    return x * env


def campanita(f, dur=0.5):
    n = n_(dur)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2.0 * f * t) * np.exp(-t / 0.12) + 0.15 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t / 0.06)
    return x * np.exp(-t / 0.18) * np.minimum(1, t / 0.003)


def soplido(dur=0.3, sube=True):
    n = n_(dur)
    t = np.arange(n) / SR
    p = t / dur
    x = bp(ruido(n), 700, 7000) * (p ** 1.6 if sube else (1 - p) ** 1.6)
    return x


def impacto():
    n = n_(1.4)
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * (42 + 50 * np.exp(-t / 0.08)) * t) * np.exp(-t / 0.5)
    cuerpo = lp(ruido(n), 1200) * np.exp(-t / 0.12)
    return sub + 0.5 * cuerpo


NOTA = {'C2': 65.41, 'F2': 87.31, 'G2': 98.0, 'A2': 110.0, 'C3': 130.81, 'F3': 174.61, 'G3': 196.0, 'A3': 220.0,
        'B3': 246.94, 'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.0, 'A4': 440.0,
        'B4': 493.88, 'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.0, 'C6': 1046.5}
PROG = [  # (raíz del bajo, acorde)
    ('C2', ['C4', 'E4', 'G4']),
    ('G2', ['B3', 'D4', 'G4']),
    ('A2', ['A3', 'C4', 'E4']),
    ('F2', ['A3', 'C4', 'F4']),
]
MELODIA = [  # 8 corcheas por compás
    ['E5', None, 'G5', None, 'E5', 'D5', 'C5', None],
    ['D5', None, 'G5', None, 'D5', None, 'B4', None],
    ['C5', None, 'E5', None, 'A5', 'G5', 'E5', None],
    ['C5', None, 'F5', None, 'E5', 'D5', 'C5', None],
]
CORTES = [1.0, 2.0, 3.5, 8.0, 9.0, 11.0, 12.0, 13.0, 14.0, 16.0, 18.0, 20.0, 21.0]


def construir():
    p = Pista()
    compases = int(DUR / (4 * PULSO))
    for c in range(compases):
        t0 = c * 4 * PULSO
        raiz, acorde_ = PROG[c % 4]
        ncomp = c % 4
        # acordes a contratiempo (x . . x . . x .)
        for k in (0, 3, 6):
            tt = t0 + k * PULSO / 2
            if tt < 3.5 and k == 6:
                continue
            p.poner(acorde([NOTA[n] for n in acorde_], PULSO * 0.8), tt, 0.20, pan=0.15 if k == 3 else -0.1, ducked=True)
            p.poner(acorde([NOTA[n] for n in acorde_], PULSO * 0.8), tt, 0.22, mojado=True)
        # bajo (desde el bombo)
        if t0 >= 0.0:
            for k, dur in ((0, 0.4), (3, 0.3), (4, 0.4), (7, 0.25)):
                f = NOTA[raiz] * (2 if k == 7 else 1)
                p.poner(bajo(f, dur), t0 + k * PULSO / 2, 0.55, ducked=True)
        # melodía
        if t0 >= 2.0:
            for k, nota in enumerate(MELODIA[ncomp]):
                if nota:
                    p.poner(campanita(NOTA[nota]), t0 + k * PULSO / 2, 0.15, pan=0.25, mojado=False)
                    p.poner(campanita(NOTA[nota]), t0 + k * PULSO / 2, 0.12, mojado=True)
    # percusión
    pasos = int(DUR / (PULSO / 2))
    for i in range(pasos):
        t = i * PULSO / 2
        if t >= 1.0 and i % 2 == 0:
            p.poner(bombo(), t, 0.95)
            p.duck(t)
        if i % 4 == 2 and t >= 1.0:                       # palmas en 2 y 4
            p.poner(palma(), t, 0.42)
        if t >= 0.5:
            p.poner(hat(abierto=(i % 4 == 3)), t, 0.13 if i % 2 else 0.17, pan=0.2 if i % 2 else -0.2)
    # sonido en cada corte de escena
    for c in CORTES:
        p.poner(soplido(0.25, True), c - 0.25, 0.22, mojado=True)
        p.poner(campanita(NOTA['C6'], 0.25), c, 0.1, pan=-0.2)
    p.poner(impacto(), 0.0, 0.25)
    p.poner(impacto(), 3.5, 0.45)
    p.poner(impacto(), 8.0, 0.4)
    p.poner(impacto(), 21.0, 0.7)                         # entra la marca
    # final: acorde largo de C con campanitas que suben
    p.poner(acorde([NOTA['C4'], NOTA['E4'], NOTA['G4'], NOTA['C5']], 2.6, 3200), 21.0, 0.30, ducked=False)
    p.poner(acorde([NOTA['C4'], NOTA['E4'], NOTA['G4'], NOTA['C5']], 2.6, 3200), 21.0, 0.28, mojado=True)
    for i, n in enumerate(['C5', 'E5', 'G5', 'C6']):
        p.poner(campanita(NOTA[n], 0.6), 21.35 + i * 0.1, 0.2, pan=0.2 * (i - 1.5) / 1.5)
    p.poner(campanita(NOTA['G5'], 0.8), 22.5, 0.22, mojado=True)   # «Muy pronto.»
    return p


if __name__ == '__main__':
    aqui = os.path.dirname(os.path.abspath(__file__))
    destino = os.path.join(aqui, '..', 'public', 'audio', '6-ProximoDrop-sinvoz.wav')
    construir().terminar(destino)
    print('listo', os.path.normpath(destino))
