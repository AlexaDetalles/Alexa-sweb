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
DUR = 26.0
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
# ---------- diseño de sonido de las transiciones (los tiempos son los de K en src/Drop.tsx) ----------
def barrido(dur, f0, f1, ancho=1.6):
    """Soplo de ruido cuya frecuencia central viaja de f0 a f1 (un «whoosh»)."""
    n = n_(dur)
    t = np.arange(n) / SR
    p = t / dur
    x = ruido(n)
    out = np.zeros(n)
    trozos = 14
    for i in range(trozos):
        a_, b_ = int(n * i / trozos), int(n * (i + 1) / trozos)
        fc = f0 * (f1 / f0) ** ((i + 0.5) / trozos)
        out[a_:b_] = bp(x, fc / ancho, fc * ancho)[a_:b_]
    return out * np.sin(np.pi * p) ** 1.5


def tic(f=3200, dur=0.04):
    n = n_(dur)
    t = np.arange(n) / SR
    return (hp(ruido(n), 2500) * np.exp(-t / 0.006) + 0.5 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.01))


def pop(f=520, dur=0.18):
    n = n_(dur)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * (f + 260 * np.exp(-t / 0.03)) * t) * np.exp(-t / 0.06)


def chispas(dur=0.5):
    n = n_(dur)
    x = np.zeros(n)
    for i in range(7):
        a_ = n_(0.05 * i)
        f = [1568, 2093, 2637, 3136, 2349, 3520, 2794][i]
        seg = np.sin(2 * np.pi * f * np.arange(n - a_) / SR) * np.exp(-np.arange(n - a_) / SR / 0.09)
        x[a_:] += seg * (0.9 - 0.1 * i)
    return x


def construir():
    p = Pista()
    compases = int(DUR / (4 * PULSO))
    for c in range(compases):
        t0 = c * 4 * PULSO
        raiz, acorde_ = PROG[c % 4]
        ncomp = c % 4
        for k in (0, 3, 6):                                    # acordes a contratiempo
            tt = t0 + k * PULSO / 2
            p.poner(acorde([NOTA[n] for n in acorde_], PULSO * 0.8), tt, 0.20, pan=0.15 if k == 3 else -0.1, ducked=True)
            p.poner(acorde([NOTA[n] for n in acorde_], PULSO * 0.8), tt, 0.22, mojado=True)
        for k, dur in ((0, 0.4), (3, 0.3), (4, 0.4), (7, 0.25)):   # bajo
            p.poner(bajo(NOTA[raiz] * (2 if k == 7 else 1), dur), t0 + k * PULSO / 2, 0.55, ducked=True)
        if t0 >= 2.0:                                          # melodía de campanita
            for k, nota in enumerate(MELODIA[ncomp]):
                if nota:
                    p.poner(campanita(NOTA[nota]), t0 + k * PULSO / 2, 0.14, pan=0.25)
                    p.poner(campanita(NOTA[nota]), t0 + k * PULSO / 2, 0.11, mojado=True)
    pasos = int(DUR / (PULSO / 2))
    for i in range(pasos):
        t = i * PULSO / 2
        calma = 0.55 if 11.9 <= t < 15.3 else 1.0              # el bombo baja cuando se escribe y se arma la tarjeta
        if t >= 1.0 and i % 2 == 0:
            p.poner(bombo(), t, 0.95 * calma)
            p.duck(t)
        if i % 4 == 2 and t >= 1.0:
            p.poner(palma(), t, 0.42 * calma)
        if t >= 0.5:
            p.poner(hat(abierto=(i % 4 == 3)), t, (0.13 if i % 2 else 0.17) * calma, pan=0.2 if i % 2 else -0.2)

    def sw(t0, dur, f0, f1, amp=0.3):
        p.poner(barrido(dur, f0, f1), t0, amp, mojado=True)

    def palabra(t0, nota=420, amp=0.16):
        p.poner(pop(nota, 0.12), t0, amp)

    # ---- 1 · «¿Sigues buscando qué estrenar sin ver lo mismo de siempre?» (cada palabra en su segundo)
    p.poner(impacto(), 0.0, 0.2)
    for t0 in (0.0, 0.44, 0.84, 1.88, 2.48, 2.72, 2.86, 3.18):
        palabra(t0, 380)
    p.poner(campanita(NOTA['E5']), 1.26, 0.18, mojado=True); palabra(1.26, 520, 0.2)
    p.poner(campanita(NOTA['A5']), 3.4, 0.2, mojado=True); palabra(3.4, 560, 0.2)
    for tt in np.arange(2.3, 3.0, 0.035):                         # la foto que se repite
        p.poner(tic(2400, 0.02), tt, 0.05, pan=0.3)
    gl = ruido(n_(0.34)) * np.abs(np.sin(np.arange(n_(0.34)) / SR * 90)) ** 2                 # glitch en «siempre»
    p.poner(bp(gl, 1800, 9000), 3.38, 0.3)
    sw(3.5, 0.8, 6500, 700, 0.34)                                 # barrido líquido
    # ---- 2 · «Tenis, bolsos o ese outfit que llama la atención.»
    for t0, nt in ((4.42, 520), (5.34, 620), (6.38, 740)):
        p.poner(pop(nt, 0.2), t0, 0.32); p.poner(impacto(), t0, 0.28); p.poner(tic(3000), t0 + 0.18, 0.12)
    sw(6.7, 0.6, 500, 3500, 0.2); p.poner(chispas(), 6.88, 0.2, mojado=True); p.poner(campanita(NOTA['C6']), 6.9, 0.18, mojado=True)
    for tt in (4.84, 5.76, 6.8):                                  # destellos al aterrizar cada grupo
        p.poner(chispas(), tt, 0.16, mojado=True)
    sw(6.18, 0.62, 500, 4600, 0.34)                               # se abre el círculo hacia la calle
    sw(7.9, 0.95, 400, 5200, 0.42)                                # cinta de satén
    p.poner(impacto(), 8.3, 0.5); p.poner(chispas(), 8.35, 0.16, mojado=True)
    # ---- 3 · «Encontrar tu estilo no debería ser complicado.»
    for t0 in (8.34, 8.78, 9.28, 9.72, 10.16, 10.34):
        palabra(t0, 400)
    palabra(8.9, 560, 0.22); p.poner(campanita(NOTA['G5']), 8.92, 0.16, mojado=True)
    sw(10.6, 0.35, 2500, 6000, 0.26)                              # el tachón dorado
    sw(10.9, 0.6, 600, 3600, 0.3)                                 # empuje hacia arriba
    # ---- 4 · «Sólo entra a AlexaShop.cc.»
    sw(11.0, 0.75, 500, 3000, 0.25)
    for t0 in (11.3, 11.62, 11.9):
        palabra(t0, 440)
    for i in range(9):
        p.poner(tic(2800 + 90 * i, 0.025), 12.18 + i * 0.087, 0.12, pan=0.2)
    for i in range(3):
        p.poner(tic(3600 + 120 * i, 0.025), 12.98 + i * 0.1, 0.12, pan=0.2)
    p.poner(pop(480, 0.2), 13.4, 0.3); p.poner(campanita(NOTA['C6']), 13.42, 0.2, mojado=True)
    # ---- 5 · «El nuevo drop pronto estará disponible en nuestra página web.»
    sw(12.95, 0.5, 900, 2600, 0.12)                               # el cursor viaja
    sw(13.85, 0.75, 5200, 500, 0.4)
    palabra(14.04, 420)
    p.poner(impacto(), 14.32, 0.5); p.poner(campanita(NOTA['E5'] * 2), 14.34, 0.2, mojado=True); p.poner(chispas(), 14.4, 0.14, mojado=True)
    p.poner(impacto(), 14.66, 0.6); p.poner(tic(1800, 0.05), 14.68, 0.3)   # el sello «PRONTO»
    palabra(15.06, 400); palabra(16.08, 400)
    sw(16.95, 0.5, 3500, 700, 0.22)
    # ---- 6 · «Piezas nuevas listas para ti.»
    for i in range(6):
        p.poner(pop(420 + 55 * i, 0.15), 17.26 + 0.14 * i, 0.26)
    palabra(17.58, 470)
    for i in range(6):
        p.poner(tic(3400 + 140 * i, 0.03), 17.84 + 0.12 * i, 0.16)
    p.poner(chispas(0.7), 18.72, 0.24, mojado=True); p.poner(campanita(NOTA['E5'] * 2), 18.74, 0.2, mojado=True); p.poner(impacto(), 18.74, 0.3)
    # ---- 7 · «Sin vueltas, pides directo por WhatsApp.»
    sw(19.05, 0.75, 6500, 700, 0.34)
    palabra(19.48, 420); palabra(19.68, 480); palabra(20.48, 440); palabra(20.7, 560, 0.22)
    sw(19.6, 0.8, 1200, 2200, 0.1)                                # la línea que se dibuja
    sw(20.55, 0.6, 700, 3800, 0.34)                               # se endereza
    p.poner(pop(520, 0.2), 20.3, 0.28)
    sw(20.55, 0.55, 700, 4200, 0.3)                               # el bolso vuela al chat
    for i in range(8):                                            # ola de saltitos en el mosaico
        p.poner(pop(500 + 40 * i, 0.1), 18.78 + 0.06 * i, 0.14)
    for i in range(35):
        p.poner(tic(2900 + 40 * (i % 7), 0.02), 20.6 + i * 0.02, 0.07, pan=0.2)
    p.poner(pop(700, 0.2), 21.32, 0.3); p.poner(chispas(), 21.34, 0.18, mojado=True); p.poner(campanita(NOTA['C6']), 21.36, 0.18, mojado=True)
    # ---- 8 · «Sólo entra y elige Alexa.»
    sw(21.8, 0.65, 400, 5000, 0.4)
    p.poner(impacto(), 22.4, 0.5)
    for t0 in (22.04, 22.34, 22.7, 23.02):
        palabra(t0, 440, 0.18)
    for i, nt in enumerate(['A4', 'C5', 'E5', 'A5', 'C6']):
        p.poner(campanita(NOTA[nt]), 23.4 + 0.08 * i, 0.2, pan=-0.3 + 0.15 * i)
    p.poner(impacto(), 23.85, 0.5)
    for tt, a_ in ((24.05, 0.22), (24.18, 0.12)):
        p.poner(pop(300, 0.1), tt, a_)
    p.poner(chispas(0.7), 23.9, 0.2, mojado=True)
    p.poner(campanita(NOTA['G5']), 24.15, 0.2, mojado=True)
    p.poner(tic(3000), 24.4, 0.14)
    p.poner(acorde([NOTA['C4'], NOTA['E4'], NOTA['G4'], NOTA['C5']], 3.2, 3200), 22.4, 0.26, mojado=True)
    return p


def random_f(x):
    return float(np.sin(x * 977.13) * 0.5 + 0.5)


if __name__ == '__main__':
    aqui = os.path.dirname(os.path.abspath(__file__))
    destino = os.path.join(aqui, '..', 'public', 'audio', '6-ProximoDrop-sinvoz.wav')
    construir().terminar(destino)
    print('listo', os.path.normpath(destino))
