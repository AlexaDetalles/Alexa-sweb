"""Música original de los reels de Tiendas Alexa, sintetizada desde cero (sin muestras ni canciones de terceros).
Sirve para anuncios de Meta sin problemas de derechos de música.

Tempo fijo: 90 pulsos por minuto = un pulso cada 20 cuadros a 30 fps. Los cortes de escena y las líneas de texto
de reels/src/Reels.tsx caen en esos pulsos, y cada «ping» de este archivo coincide con una línea de texto que aparece.

Uso:  python3 audio/musica.py        → escribe public/audio/<reel>.wav (el reel 6 sale como 6-ProximoDrop-sinvoz.wav; audio/voz.py le suma la voz y crea 6-ProximoDrop.wav) (y los mismos .mp3 en out/audio/)
"""
import os
import subprocess
import wave
import numpy as np

SR = 44100
FPS = 30
rng = np.random.default_rng(7)


def T(f):  # cuadros → segundos
    return f / FPS


def lp(x, fc, orden=4):
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + (fr / fc) ** orden), len(x))


def hp(x, fc):
    return x - lp(x, fc, 2)


def ruido(n):
    return rng.standard_normal(n)


class Mezcla:
    """Dos canales secos y un bus «mojado» que recibe reverberación."""

    def __init__(self, frames):
        self.n = int(T(frames) * SR) + SR  # un segundo de cola
        self.L = np.zeros(self.n)
        self.R = np.zeros(self.n)
        self.wet = np.zeros(self.n)

    def poner(self, x, t, amp=1.0, pan=0.0, mojado=False):
        i = int(t * SR)
        if i >= self.n:
            return
        x = x[: self.n - i] * amp
        if mojado:
            self.wet[i : i + len(x)] += x
        else:
            self.L[i : i + len(x)] += x * (1 - max(pan, 0))
            self.R[i : i + len(x)] += x * (1 + min(pan, 0))

    def terminar(self, ruta, reverb=0.55):
        ir_n = int(2.6 * SR)
        t = np.arange(ir_n) / SR
        irs = []
        for _ in range(2):
            ir = lp(ruido(ir_n), 4500) * np.exp(-t / 0.75)
            ir[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
            irs.append(ir / np.sqrt((ir**2).sum()))
        nfft = 1 << int(np.ceil(np.log2(self.n + ir_n)))
        W = np.fft.rfft(self.wet, nfft)
        wl = np.fft.irfft(W * np.fft.rfft(irs[0], nfft), nfft)[: self.n]
        wr = np.fft.irfft(W * np.fft.rfft(irs[1], nfft), nfft)[: self.n]
        L = self.L + reverb * wl
        R = self.R + reverb * wr
        s = np.stack([L, R], 1)
        fin = int(0.9 * SR)
        s[-fin:] *= np.linspace(1, 0, fin)[:, None] ** 2
        s[: int(0.04 * SR)] *= np.linspace(0, 1, int(0.04 * SR))[:, None]
        s *= 0.9 / np.abs(s).max()
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        with wave.open(ruta, 'wb') as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((s * 32767).astype('<i2').tobytes())


# ---------- sonidos ----------
def zumbido(dur):
    t = np.arange(int(dur * SR)) / SR
    x = np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 110.3 * t) + 0.3 * np.sin(2 * np.pi * 82.4 * t + 1)
    x *= 0.75 + 0.25 * np.sin(2 * np.pi * t / 5.3)
    return lp(x, 380)


def colchon(dur, notas, ataque=1.4, soltar=0.9):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f in notas:
        for det in (0.9985, 1.0015):
            for k in range(1, 9):
                x += np.sin(2 * np.pi * f * det * k * t + k) / k
    x = lp(x, 950)
    env = np.minimum(1, t / ataque) * np.minimum(1, (dur - t) / soltar).clip(0, 1)
    return x * env * 0.12


def bombo(vol=1.0):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    fase = 2 * np.pi * (42 * t + (95 - 42) * 0.045 * (1 - np.exp(-t / 0.045)))
    x = np.sin(fase) * np.exp(-t / 0.2)
    x += 0.25 * lp(ruido(n), 700) * np.exp(-t / 0.012)
    return x * vol


def latido(vol=1.0):
    # «lub-dub»: dos golpes graves seguidos
    x = np.zeros(int(0.8 * SR))
    a = bombo(1.0)
    b = bombo(0.55)
    x[: len(a)] += a
    j = int(0.22 * SR)
    x[j : j + len(b)] += b[: len(x) - j]
    return x * vol


def tic(f=2600, dur=0.05):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = hp(ruido(n), 3000) * np.exp(-t / 0.008) + 0.5 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012)
    return x


def ping(f, dur=0.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3.01 * f * t)
    return x * np.exp(-t / 0.22) * np.minimum(1, t / 0.003)


def campana(f, dur=3.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for r, a, d in [(1, 1, 1.4), (2.0, 0.45, 1.0), (2.76, 0.35, 0.7), (4.07, 0.18, 0.5), (5.4, 0.1, 0.35)]:
        x += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d)
    return x * np.minimum(1, t / 0.004)


def subida(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    barrido = np.sin(2 * np.pi * np.cumsum(180 * (2 ** (p * 3.2))) / SR)
    soplo = hp(lp(ruido(n), 7000), 500) * (0.2 + p**2)
    return (0.5 * barrido + soplo) * p**1.8


def golpe():
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * (36 + 40 * np.exp(-t / 0.12)) * t) * np.exp(-t / 0.7)
    cuerpo = lp(ruido(n), 900) * np.exp(-t / 0.18)
    return sub + 0.5 * cuerpo


def papel(dur=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    return lp(hp(ruido(n), 400), 3200) * np.sin(np.pi * p) ** 2


# frecuencias
A3, Cs4, C4, E4, B4 = 220.0, 277.18, 261.63, 329.63, 493.88
G4, A4, Cs5, E5, G5, A5 = 392.0, 440.0, 554.37, 659.25, 783.99, 880.0
Am = [A3, C4, E4, B4]
AM = [A3, Cs4, E4, B4]


def base(m, frames, zum=0.28):
    m.poner(zumbido(T(frames) + 1), 0, zum)


def pulsos(m, desde, hasta, cada=20, vol=0.62, doble=True):
    for f in range(desde, hasta, cada):
        m.poner(latido(1.0) if doble else bombo(1.0), T(f), vol)


def cuenta(m, f0, ini=0, fin=40, n=14, vol=0.16):
    """Tics que acompañan al número mientras sube (misma curva de frenado que en pantalla)."""
    for k in range(1, n + 1):
        x = 1 - (1 - k / n) ** (1 / 3)
        m.poner(tic(1800 + 90 * k), T(f0 + ini + x * (fin - ini)), vol, pan=(-0.3 if k % 2 else 0.3))


# ---------- los 5 reels ----------
def reel1():
    F = 260
    m = Mezcla(F)
    base(m, F)
    m.poner(colchon(T(120) + 0.5, Am), 0, 1, mojado=True)
    m.poner(colchon(T(140) + 0.9, AM, ataque=0.5, soltar=1.6), T(120), 1, mojado=True)
    pulsos(m, 20, 120, 40)  # latido cada dos pulsos
    m.poner(subida(T(40)), T(80), 0.35, mojado=True)
    pulsos(m, 120, 260, 20, 0.5)
    for f, nota in [(13, A4), (23, E5)]:
        m.poner(ping(nota), T(f), 0.3, mojado=True)
    m.poner(golpe(), T(120), 0.75)
    m.poner(campana(A5), T(120), 0.18, mojado=True)
    m.poner(ping(Cs5), T(133), 0.3, mojado=True)  # «Muy pronto.»
    m.poner(ping(E5), T(153), 0.25, mojado=True)
    m.poner(campana(Cs5), T(160), 0.22, mojado=True)  # marca
    m.poner(campana(A5), T(166), 0.18, mojado=True)
    m.poner(ping(E5), T(193), 0.25, mojado=True)  # alexashop.cc
    return m


def reel2():
    F = 380
    m = Mezcla(F)
    base(m, F)
    m.poner(colchon(T(280) + 0.5, Am), 0, 1, mojado=True)
    m.poner(colchon(T(100) + 1.0, AM, ataque=0.5, soltar=1.8), T(280), 1, mojado=True)
    pulsos(m, 20, 280, 40 if False else 20, 0.5)
    for f, nota in [(13, A4), (23, E5)]:
        m.poner(ping(nota), T(f), 0.28, mojado=True)
    for ini, base_nota in [(80, A4), (180, C4 * 2)]:
        cuenta(m, ini)
        m.poner(campana(E5), T(ini + 40), 0.24, mojado=True)
        m.poner(ping(base_nota), T(ini + 43), 0.25, mojado=True)
    m.poner(subida(T(40)), T(240), 0.35, mojado=True)
    m.poner(golpe(), T(280), 0.75)
    m.poner(ping(Cs5), T(293), 0.3, mojado=True)
    m.poner(ping(E5), T(303), 0.3, mojado=True)
    pulsos(m, 280, 380, 20, 0.4, doble=False)
    m.poner(campana(Cs5), T(330), 0.24, mojado=True)
    m.poner(campana(A5), T(336), 0.18, mojado=True)
    m.poner(ping(E5), T(353), 0.25, mojado=True)  # alexashop.cc
    return m


def reel3():
    F = 200
    m = Mezcla(F)
    base(m, F, 0.22)
    m.poner(colchon(T(200) + 0.9, AM, ataque=1.0, soltar=1.5), 0, 1, mojado=True)
    for i, f in enumerate(range(0, 200, 20)):  # reloj: tic-tac en cada pulso
        m.poner(tic(2300 if i % 2 == 0 else 1700), T(f), 0.22, pan=(-0.25 if i % 2 == 0 else 0.25))
    pulsos(m, 20, 200, 40, 0.4, doble=False)
    m.poner(ping(A4), T(13), 0.28, mojado=True)   # «Closet 001 abre»
    m.poner(ping(Cs5), T(23), 0.3, mojado=True)   # «Martes 24»
    m.poner(campana(E5), T(43), 0.26, mojado=True)  # hora
    m.poner(ping(A5), T(63), 0.25, mojado=True)   # incentivo
    m.poner(ping(E5), T(83), 0.25, mojado=True)   # alexashop.cc
    m.poner(campana(Cs5), T(100), 0.2, mojado=True)
    return m


def reel4():
    F = 440
    m = Mezcla(F)
    base(m, F)
    m.poner(colchon(T(320) + 0.5, Am), 0, 1, mojado=True)
    m.poner(colchon(T(120) + 1.0, AM, ataque=0.4, soltar=1.8), T(320), 1, mojado=True)
    pulsos(m, 20, 320, 20, 0.5)
    for f, nota in [(13, A4), (23, E5)]:
        m.poner(ping(nota), T(f), 0.28, mojado=True)
    for ini in (80, 160):
        cuenta(m, ini)
        m.poner(campana(E5), T(ini + 40), 0.22, mojado=True)
    for f, nota in [(253, A4), (273, E5)]:  # «Una pieza.» / «Sin repetir.»
        m.poner(ping(nota), T(f), 0.3, mojado=True)
    m.poner(subida(T(40)), T(280), 0.35, mojado=True)
    m.poner(golpe(), T(320), 0.75)
    m.poner(ping(A4), T(333), 0.3, mojado=True)
    m.poner(ping(Cs5), T(343), 0.3, mojado=True)
    m.poner(campana(E5), T(363), 0.24, mojado=True)
    m.poner(ping(A5), T(383), 0.25, mojado=True)   # incentivo
    m.poner(ping(E5), T(403), 0.25, mojado=True)   # alexashop.cc
    pulsos(m, 320, 440, 20, 0.4, doble=False)
    return m


def reel5():
    F = 400
    m = Mezcla(F)
    base(m, F, 0.18)
    m.poner(colchon(T(F) + 0.5, AM, ataque=0.3, soltar=1.8), 0, 1, mojado=True)
    m.poner(golpe(), 0, 0.7)
    for f in range(0, F, 20):  # aquí sí hay bombo en cada pulso: es el reel de «ya abrimos»
        m.poner(bombo(1.0), T(f), 0.55)
        m.poner(tic(3200, 0.04), T(f + 10), 0.18, pan=0.3 if (f // 20) % 2 else -0.3)
    for f, nota in [(13, E5), (23, A5)]:
        m.poner(ping(nota), T(f), 0.3, mojado=True)
    for i, nota in enumerate([A4, Cs5, E5]):
        ini = 60 + i * 80
        m.poner(papel(), T(ini), 0.35, mojado=True)
        m.poner(campana(nota * 2 if i == 2 else nota), T(ini + 6), 0.2, mojado=True)
        m.poner(ping(nota), T(ini + 23), 0.25, mojado=True)
        m.poner(ping(nota * 1.5), T(ini + 33), 0.2, mojado=True)
    m.poner(ping(A5), T(313), 0.25, mojado=True)
    m.poner(ping(E5), T(333), 0.25, mojado=True)
    m.poner(campana(Cs5), T(350), 0.22, mojado=True)
    return m


def reel6():
    """6-ProximoDrop · 22 s. Cada sonido cae en el cuadro donde aparece su texto o tarjeta (ver src/Drop.tsx)."""
    F = 660
    m = Mezcla(F)
    base(m, F, 0.22)
    m.poner(colchon(T(300) + 0.5, Am), 0, 1, mojado=True)
    m.poner(colchon(T(360) + 1.0, AM, ataque=0.4, soltar=1.8), T(300), 1, mojado=True)
    pulsos(m, 20, 180, 20, 0.5)
    pulsos(m, 200, 540, 20, 0.45, doble=False)
    # 1 · gancho
    m.poner(ping(E5), T(6), 0.28, mojado=True)
    m.poner(ping(A5), T(16), 0.28, mojado=True)
    # 2 · cuatro tarjetas que caen (cada aterrizaje: golpe seco + nota que sube)
    m.poner(subida(T(14)), T(60), 0.25, mojado=True)
    for f, nota in [(74, A4), (94, Cs5), (114, E5), (134, A5)]:
        m.poner(bombo(1.0), T(f), 0.7)
        m.poner(papel(0.2), T(f - 6), 0.3, mojado=True)
        m.poner(ping(nota), T(f + 2), 0.3, mojado=True)
    # 3 · «drop» detrás del reloj
    m.poner(subida(T(30)), T(156), 0.4, mojado=True)
    m.poner(ping(E5), T(184), 0.26, mojado=True)
    m.poner(golpe(), T(188), 0.7)
    m.poner(papel(0.5), T(198), 0.3, mojado=True)
    m.poner(campana(E5), T(206), 0.24, mojado=True)
    m.poner(ping(A4), T(232), 0.22, mojado=True)
    # 4 · celular
    m.poner(subida(T(18)), T(290), 0.3, mojado=True)
    m.poner(ping(A4), T(304), 0.28, mojado=True)
    m.poner(ping(Cs5), T(312), 0.28, mojado=True)
    m.poner(papel(0.4), T(310), 0.3, mojado=True)
    for f, nota in [(352, E5), (366, A5), (380, E5)]:   # los tres aros de las categorías
        m.poner(tic(3200, 0.05), T(f), 0.3)
        m.poner(ping(nota), T(f), 0.22, mojado=True)
    # 5 · llamado a la acción
    m.poner(ping(A4), T(444), 0.28, mojado=True)
    m.poner(ping(E5), T(452), 0.28, mojado=True)
    m.poner(ping(Cs5), T(464), 0.26, mojado=True)
    m.poner(campana(E5), T(480), 0.24, mojado=True)    # el botón aparece
    m.poner(tic(2400, 0.06), T(510), 0.4)              # el botón se oprime
    # 6 · la marca se arma
    m.poner(golpe(), T(540), 0.55)
    m.poner(ping(A4), T(546), 0.26, mojado=True)
    for i, nota in enumerate([A4, Cs5, E5, A5, Cs5 * 2]):
        m.poner(ping(nota), T(558 + i * 4), 0.24, mojado=True)
    m.poner(campana(E5), T(578), 0.24, mojado=True)
    m.poner(ping(A5), T(598), 0.28, mojado=True)      # «Muy pronto.»
    m.poner(campana(A4), T(604), 0.22, mojado=True)
    m.poner(ping(E5), T(626), 0.22, mojado=True)
    return m


if __name__ == '__main__':
    aqui = os.path.dirname(os.path.abspath(__file__))
    destino = os.path.join(aqui, '..', 'public', 'audio')
    mp3 = os.path.join(aqui, '..', 'out', 'audio')
    os.makedirs(mp3, exist_ok=True)
    for nombre, fn in [('1-AlgoViene', reel1), ('2-Closet', reel2), ('3-CuentaRegresiva', reel3), ('4-Anuncio', reel4), ('5-Apertura', reel5), ('6-ProximoDrop-sinvoz', reel6)]:
        ruta = os.path.join(destino, nombre + '.wav')
        fn().terminar(ruta)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', ruta, '-b:a', '192k', os.path.join(mp3, nombre + '.mp3')], check=True)
        print('listo', nombre)
