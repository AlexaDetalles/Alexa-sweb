import React, {useId} from 'react';
import {AbsoluteFill, Audio, Img, random, staticFile, useCurrentFrame, useVideoConfig, continueRender, delayRender} from 'remotion';

// «6-ProximoDrop» · 25,2 s · 60 fps · anuncio SIN fecha del próximo drop de Tiendas Alexa (16:9 y 9:16).
//
// Guiado por la locución real (voz «Cami», ElevenLabs): cada escena y cada efecto caen en la palabra que se dice.
// Productos reales recortados (tenis y bolsos del drop) sobre la marca de la tienda (Vino, Dorado, Crema; Cormorant Garamond y Space Grotesk).
//
// Caja de efectos: vuelos en arco con desenfoque de movimiento direccional (filtro SVG), resortes con rebote, destellos dorados al aterrizar,
// micro-temblor de cámara en los golpes, cambio de enfoque («llama la atención»), brillo que recorre cada producto, sombra y reflejo de piso,
// carrusel 3D, parallax con profundidad de campo, partículas, texto que sube desde una máscara, dorado con brillo animado.
// Transiciones sin cortes: zoom a través con onda de choque, cinta de satén con un tenis que la cruza, empuje vertical, barrido lateral con desenfoque,
// zoom hacia el mosaico, barrido líquido, iris. Inspiradas en el análisis de un anuncio de referencia; no se usó nada de su metraje ni de sus textos.
// Lo que aún no existe (fecha, hora, incentivo) solo sale si viene en props.json.

export type DropProps = {fecha: string; hora: string; incentivo: string; voz: boolean};
export const dropPorDefecto: DropProps = {fecha: '', hora: '', incentivo: '', voz: true};
export const DROP_FPS = 60;
export const DROP_SEG = 25.2;
export const DROP_FRAMES = Math.round(DROP_FPS * DROP_SEG);

/** Momentos clave en segundos (los de la locución). audio/musica_pop.py usa estos mismos tiempos. */
export const K = {
  barrido: 3.55, tenis: 4.42, bolsos: 5.34, outfit: 6.38, llama: 6.88,
  cinta: 7.95, estilo: 8.34, complicado: 10.34, tachon: 10.65, empuje: 10.95,
  celular: 11.0, web: 12.18, punto: 12.98, clic: 13.4,
  ventana: 13.95, drop: 14.32, pronto: 14.66, disponible: 15.06, pagina: 16.08, ventanaFin: 17.0,
  piezas: 17.26, listas: 17.84, parati: 18.72,
  vueltas: 19.48, pides: 20.48, directo: 20.7, whatsapp: 21.32,
  iris: 21.85, alexa: 23.4,
};

const P = {wine: '#782f3a', wineDark: '#55202a', deep: '#3b1220', night: '#1b1114', paper: '#f7f1e8', ink: '#261a1c', gold: '#d2a851', goldSoft: '#efdcab', cream: '#f7ead7', card: '#fffdf9', tint: '#f0e6d8', line: '#e3d7c7', muted: '#6f6259', rose: '#f6d3da'};
const SERIF = "'Cormorant Alexa', Georgia, 'Times New Roman', serif";
const SANS = "'Space Alexa', Arial, sans-serif";

if (typeof document !== 'undefined' && !(window as any).__fuentesAlexa6) {
  (window as any).__fuentesAlexa6 = true;
  const espera = delayRender('fuentes de Alexa');
  Promise.all([
    new FontFace('Cormorant Alexa', `url(${staticFile('fonts/cormorant-garamond-latin-wght-normal.woff2')})`, {weight: '300 700', style: 'normal'}),
    new FontFace('Cormorant Alexa', `url(${staticFile('fonts/cormorant-garamond-latin-wght-italic.woff2')})`, {weight: '300 700', style: 'italic'}),
    new FontFace('Space Alexa', `url(${staticFile('fonts/space-grotesk-400.ttf')})`, {weight: '400'}),
    new FontFace('Space Alexa', `url(${staticFile('fonts/space-grotesk-700.ttf')})`, {weight: '700'}),
  ].map((d) => d.load())).then((ls) => ls.forEach((f) => (document as any).fonts.add(f))).catch((e) => console.error('Fuente', e)).finally(() => continueRender(espera));
}

// ---------- productos (recortes con transparencia) ----------
type PId = 'bolso-negro' | 'bolso-beige' | 'sling-reebok' | 'sling-verde' | 'tenis-gris' | 'tenis-levis' | 'tenis-nb' | 'tenis-nike';
const AR: Record<PId, number> = {'bolso-negro': 825 / 890, 'bolso-beige': 885 / 1066, 'sling-reebok': 781 / 1015, 'sling-verde': 729 / 945, 'tenis-gris': 841 / 651, 'tenis-levis': 1500 / 838, 'tenis-nb': 1200 / 690, 'tenis-nike': 1500 / 661};
const src = (id: PId) => staticFile(`img/prod/${id}.webp`);

// ---------- tiempo, curvas y tamaño ----------
const cl = (x: number) => Math.min(1, Math.max(0, x));
const eOut = (x: number) => 1 - Math.pow(1 - cl(x), 3);
const eOut5 = (x: number) => 1 - Math.pow(1 - cl(x), 5);
const eExpo = (x: number) => (cl(x) >= 1 ? 1 : 1 - Math.pow(2, -10 * cl(x)));
const eInOut = (x: number) => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const eInOut5 = (x: number) => { x = cl(x); return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2; };
const eBack = (x: number, s = 1.9) => { x = cl(x); const c3 = s + 1; return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const pr = (t: number, a: number, d: number, e: (x: number) => number = eOut) => e((t - a) / d);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** Resorte amortiguado: 0 antes de `at`, sube con rebote natural y se asienta en 1. */
const spr = (t: number, at: number, damp = 7, freq = 13) => { const x = t - at; return x <= 0 ? 0 : 1 - Math.exp(-damp * x) * Math.cos(freq * x); };
const useD = () => {
  const {width, height} = useVideoConfig();
  return {w: width, h: height, L: width > height, k: Math.min(width, height) / 1080};
};
const FRAME = 1 / 60;

// ---------- desenfoque de movimiento direccional (filtro SVG) ----------
const MB: React.FC<{sx: number; sy: number; children: React.ReactNode; style?: React.CSSProperties}> = ({sx, sy, children, style}) => {
  const id = 'mb' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const on = sx > 0.5 || sy > 0.5;
  return (
    <div style={{...(style ?? {position: 'absolute', left: 0, top: 0, width: '100%', height: '100%'}), filter: on ? `url(#${id})` : undefined}}>
      {on ? <svg width="0" height="0" style={{position: 'absolute'}}><filter id={id} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={`${sx.toFixed(2)} ${sy.toFixed(2)}`} /></filter></svg> : null}
      {children}
    </div>
  );
};

// ---------- texto ----------
const H: React.FC<{s: number; color?: string; italic?: boolean; weight?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({s, color = P.ink, italic, weight = 600, style, children}) => {
  const {k} = useD();
  return <div style={{fontFamily: SERIF, fontWeight: weight, fontStyle: italic ? 'italic' : 'normal', fontSize: s * k, lineHeight: 1.0, letterSpacing: '-0.012em', color, whiteSpace: 'pre', ...style}}>{children}</div>;
};
/** Dorado con brillo que recorre el texto. */
const Oro: React.FC<{s: number; t: number; italic?: boolean; weight?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({s, t, italic = true, weight = 500, style, children}) => (
  <H s={s} italic={italic} weight={weight} color="transparent" style={{backgroundImage: 'linear-gradient(100deg,#b8892d 0%,#f3dc91 38%,#d2a851 50%,#a47a22 78%,#e8c870 100%)', backgroundSize: '260% 100%', backgroundPosition: `${(t * 55) % 260}% 0`, WebkitBackgroundClip: 'text', backgroundClip: 'text', ...style}}>{children}</H>
);
const Lab: React.FC<{s: number; color?: string; track?: number; weight?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({s, color = P.ink, track = 0.22, weight = 700, style, children}) => {
  const {k} = useD();
  return <div style={{fontFamily: SANS, fontWeight: weight, fontSize: s * k, lineHeight: 1.1, letterSpacing: `${track}em`, textTransform: 'uppercase', color, whiteSpace: 'pre', ...style}}>{children}</div>;
};
/** Palabra que entra en su segundo: rebote, desenfoque y desplazamiento. */
const Pal: React.FC<{t: number; at: number; dur?: number; dx?: number; dy?: number; blur?: number; rebote?: boolean; style?: React.CSSProperties; children: React.ReactNode}> = ({t, at, dur = 0.5, dx = 0, dy = 50, blur = 12, rebote = true, style, children}) => {
  const {k} = useD();
  const p = pr(t, at, dur, rebote ? eBack : eOut);
  const b = (1 - cl((t - at) / dur)) * blur;
  return <div style={{display: 'inline-block', opacity: cl((t - at) / (dur * 0.45)), transform: `translate(${(1 - p) * dx * k}px, ${(1 - p) * dy * k}px)`, filter: b > 0.3 ? `blur(${b}px)` : undefined, ...style}}>{children}</div>;
};
/** Texto que sube desde una máscara (look editorial). */
const Rev: React.FC<{t: number; at: number; dur?: number; children: React.ReactNode}> = ({t, at, dur = 0.7, children}) => {
  const p = pr(t, at, dur, eExpo);
  return (
    <div style={{overflow: 'hidden', display: 'inline-block', paddingTop: '0.12em', marginTop: '-0.12em', paddingBottom: '0.2em', marginBottom: '-0.2em', paddingRight: '0.08em'}}>
      <div style={{transform: `translateY(${(1 - p) * 118}%) rotate(${(1 - p) * 3}deg)`, transformOrigin: '0 100%', opacity: t >= at ? 1 : 0}}>{children}</div>
    </div>
  );
};
const Capa: React.FC<{t: number; de: number; hasta: number; children: React.ReactNode; style?: React.CSSProperties}> = ({t, de, hasta, children, style}) =>
  t >= de && t < hasta ? <AbsoluteFill style={style}>{children}</AbsoluteFill> : null;

// ---------- bordes, estrellas, partículas, ambiente ----------
type Pt = [number, number];
const poly = (pts: Pt[]) => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`;
const borde = (h: number, x0: number, amp: number, fase: number, inclina = 0, n = 56): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const y = -30 + ((h + 60) * i) / n;
    pts.push([x0 + inclina * (y - h / 2) + amp * Math.sin(y / (h * 0.17) + fase) + amp * 0.5 * Math.sin(y / (h * 0.065) - fase * 1.7), y]);
  }
  return pts;
};
const Estrella: React.FC<{s: number; c?: string}> = ({s, c = P.gold}) => (
  <svg viewBox="0 0 24 24" width={s} height={s}><path d="M12 1 L14 10 L23 12 L14 14 L12 23 L10 14 L1 12 L10 10 Z" fill={c} /></svg>
);
const Corazon: React.FC<{s: number; c?: string}> = ({s, c = P.gold}) => (
  <svg viewBox="0 0 24 24" width={s} height={s}><path d="M12 21 C5 15 2 12 2 8 C2 5 4.5 3 7 3 C9 3 11 4 12 6 C13 4 15 3 17 3 C19.5 3 22 5 22 8 C22 12 19 15 12 21 Z" fill={c} /></svg>
);
/** Ráfaga de destellos dorados que sale de un punto. */
const Destellos: React.FC<{t: number; t0: number; x: number; y: number; n?: number; fuerza?: number; vida?: number; colores?: string[]}> = ({t, t0, x, y, n = 24, fuerza = 520, vida = 1.1, colores = [P.gold, P.goldSoft, '#fff']}) => {
  const {k} = useD();
  const a = t - t0;
  if (a < 0 || a > vida + 0.5) return null;
  return (
    <>
      {Array.from({length: n}).map((_, i) => {
        const ang = random(`d${t0}${i}a`) * Math.PI * 2;
        const v = (0.35 + random(`d${t0}${i}v`) * 0.9) * fuerza * k;
        const life = vida * (0.6 + random(`d${t0}${i}l`) * 0.5);
        const q = a / life;
        if (q >= 1) return null;
        const px = x + Math.cos(ang) * v * a * (1 - 0.35 * q);
        const py = y + Math.sin(ang) * v * a * (1 - 0.35 * q) + 0.5 * 520 * k * a * a;
        const sz = (7 + random(`d${t0}${i}s`) * 13) * k;
        const c = colores[i % colores.length];
        return <div key={i} style={{position: 'absolute', left: px - sz / 2, top: py - sz / 2, opacity: (1 - q) * (0.55 + 0.45 * Math.sin(a * 40 + i)), transform: `rotate(${a * 200 * (i % 2 ? 1 : -1)}deg) scale(${1 - 0.5 * q})`}}>{i % 3 === 0 ? <div style={{width: sz * 0.55, height: sz * 0.55, borderRadius: '50%', background: c, margin: sz * 0.22}} /> : <Estrella s={sz} c={c} />}</div>;
      })}
    </>
  );
};
/** Luces desenfocadas que suben despacio (bokeh). */
const Bokeh: React.FC<{t: number; n?: number; color?: string; alfa?: number}> = ({t, n = 14, color = P.gold, alfa = 0.28}) => {
  const {w, h, k} = useD();
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: n}).map((_, i) => {
        const r = (30 + random(`b${i}s`) * 90) * k;
        const x = random(`b${i}x`) * w;
        const y0 = random(`b${i}y`) * h;
        const v = (10 + random(`b${i}v`) * 26) * k;
        const y = ((y0 - v * t) % (h + 2 * r) + (h + 2 * r)) % (h + 2 * r) - r;
        return <div key={i} style={{position: 'absolute', left: x + Math.sin(t * 0.5 + i) * 24 * k - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: `radial-gradient(circle, ${color} 0%, rgba(0,0,0,0) 70%)`, opacity: alfa * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 2))}} />;
      })}
    </AbsoluteFill>
  );
};
/** Temblor de cámara con caída exponencial en cada golpe. */
const temblor = (t: number, golpes: [number, number][]) => {
  let x = 0, y = 0;
  for (const [t0, amp] of golpes) {
    const a = t - t0;
    if (a > 0 && a < 0.6) { const d = Math.exp(-a * 9) * amp; x += Math.sin(a * 83) * d; y += Math.cos(a * 71) * d; }
  }
  return [x, y];
};

// ---------- producto con vuelo, brillo, sombra ----------
const Prod: React.FC<{id: PId; w: number; brillo?: number; style?: React.CSSProperties}> = ({id, w, brillo = -1, style}) => {
  const {k} = useD();
  const wd = w * k, ht = wd / AR[id];
  return (
    <div style={{position: 'relative', width: wd, height: ht, ...style}}>
      <Img src={src(id)} style={{width: '100%', height: '100%', display: 'block'}} />
      {brillo >= 0 && brillo <= 1 ? (
        <div style={{position: 'absolute', inset: 0, WebkitMaskImage: `url(${src(id)})`, maskImage: `url(${src(id)})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
          backgroundImage: 'linear-gradient(105deg, rgba(255,255,255,0) 46%, rgba(255,255,255,.3) 50%, rgba(255,255,255,0) 54%)', backgroundSize: '300% 100%', backgroundPosition: `${lerp(120, -20, brillo)}% 0`, mixBlendMode: 'screen'}} />
      ) : null}
    </div>
  );
};
type Vuelo = {id: PId; w: number; rot: number; dx: number; dy: number; at: number; from: [number, number]; arc?: number; rotFrom?: number; fase?: number};
/** Un producto que vuela en arco, aterriza con rebote, flota y recibe un brillo. */
const ProdVuelo: React.FC<{t: number; cx: number; cy: number; v: Vuelo; sombra?: boolean; opacidad?: number}> = ({t, cx, cy, v, sombra = true, opacidad = 1}) => {
  const {k} = useD();
  const f = (tt: number) => spr(tt, v.at, 6.2, 12.5);
  const s = f(t), s0 = f(t - FRAME);
  const lin = cl((t - v.at) / 0.55);
  const arcA = (tt: number) => (v.arc ?? 120) * k * Math.sin(Math.PI * cl((tt - v.at) / 0.55));
  const arc = arcA(t);
  const x = v.dx * k + v.from[0] * k * (1 - s);
  const y = v.dy * k + v.from[1] * k * (1 - s) - arc;
  const vx = Math.abs(v.from[0] * k * (s - s0)) * 0.55;
  const vy = Math.abs(v.from[1] * k * (s - s0) - (arc - arcA(t - FRAME))) * 0.55;
  const fase = v.fase ?? 0;
  const flota = Math.sin(t * 1.7 + fase) * 9 * k * Math.min(1, s);
  const rot = v.rot + (1 - s) * (v.rotFrom ?? -30) + Math.sin(t * 1.1 + fase) * 1.4 * Math.min(1, s);
  const aterriza = v.at + 0.4;
  const pulso = t > aterriza ? Math.exp(-(t - aterriza) * 7) : 0;
  const ht = (v.w * k) / AR[v.id];
  return (
    <div style={{position: 'absolute', left: cx + x - (v.w * k) / 2, top: cy + y - ht / 2 + flota, opacity: opacidad * cl((t - v.at) / 0.07)}}>
      {sombra ? <div style={{position: 'absolute', left: '8%', bottom: -ht * 0.04, width: '84%', height: ht * 0.09, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(60,20,28,.55) 0%, rgba(60,20,28,0) 70%)', transform: `scale(${1 + 0.35 * pulso})`, opacity: 0.8 * cl((t - (v.at + 0.28)) / 0.2)}} /> : null}
      <MB sx={vx} sy={vy}>
        <div style={{transform: `rotate(${rot}deg) scale(${0.55 + 0.45 * Math.min(1, s * 1.1) + 0.04 * pulso})`}}>
          <Prod id={v.id} w={v.w} brillo={cl((t - (v.at + 0.55)) / 0.8)} />
        </div>
      </MB>
    </div>
  );
};

// ---------- tomas de video de la chica (secuencias de cuadros a 24 fps, ilustración 3D generada con IA para la campaña) ----------
// Se guardan como cuadros webp para que el render sea exacto cuadro a cuadro; entre dos cuadros se funde el siguiente (cámara lenta suave).
type TomaId = 'cama' | 'calle' | 'mano' | 'closet' | 'bolsa';
// x, y, w, h: recorte dentro del cuadro original de 1280×720 (las tomas con fondo ocupan el cuadro entero)
const TOMA: Record<TomaId, {x: number; y: number; w: number; h: number}> = {
  cama: {x: 0, y: 0, w: 1280, h: 720}, calle: {x: 0, y: 0, w: 1280, h: 720}, mano: {x: 0, y: 0, w: 1280, h: 720},
  closet: {x: 0, y: 0, w: 1280, h: 720}, bolsa: {x: 0, y: 0, w: 1280, h: 720},
};
const cuadroToma = (t: number, t0: number, vel: number) => {
  const f = Math.max(0, Math.min(47, (t - t0) * 24 * vel));
  const i = Math.min(46, Math.floor(f));
  return {i, fr: f - i};
};
const urlToma = (id: TomaId, i: number) => staticFile(`img/chica/${id}/${String(i).padStart(2, '0')}.webp`);
/** Dibuja la toma (cuadro i fundido con i+1) llenando su caja. */
const Toma: React.FC<{id: TomaId; t: number; t0: number; vel: number; style?: React.CSSProperties}> = ({id, t, t0, vel, style}) => {
  const {i, fr} = cuadroToma(t, t0, vel);
  const im: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: '100%', height: '100%'};
  return (
    <div style={{position: 'absolute', ...style}}>
      <Img src={urlToma(id, i)} style={im} />
      {fr > 0.02 ? <Img src={urlToma(id, i + 1)} style={{...im, opacity: fr}} /> : null}
    </div>
  );
};
/** Toma con fondo: a pantalla completa en 16:9; en 9:16 dentro de una tarjeta, con la misma toma desenfocada de fondo. */
const TomaFondo: React.FC<{id: TomaId; t: number; t0: number; vel: number; fx: number; ax?: number; zoom?: number; tarjeta?: {x: number; y: number; w: number; h: number}; children?: React.ReactNode}> = ({id, t, t0, vel, fx, ax = 0.5, zoom = 1, tarjeta, children}) => {
  const {w, h, L, k} = useD();
  const caja = L || !tarjeta ? {x: 0, y: 0, w, h} : tarjeta;
  const H0 = Math.max(caja.h, (caja.w * 9) / 16) * zoom, W0 = (H0 * 16) / 9;
  const left = Math.min(0, Math.max(caja.w - W0, caja.w * ax - fx * W0));
  const top = (caja.h - H0) / 2;
  const dentro = <Toma id={id} t={t} t0={t0} vel={vel} style={{left, top, width: W0, height: H0}} />;
  if (L || !tarjeta) return <AbsoluteFill style={{overflow: 'hidden'}}>{dentro}{children}</AbsoluteFill>;
  const Hb = h * 1.05, Wb = (Hb * 16) / 9;
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: P.night}}>
      <div style={{position: 'absolute', inset: 0, filter: `blur(${34 * k}px) brightness(.55) saturate(1.2)`, transform: 'scale(1.1)'}}>
        <Toma id={id} t={t} t0={t0} vel={vel} style={{left: w / 2 - fx * Wb, top: (h - Hb) / 2, width: Wb, height: Hb}} />
      </div>
      <div style={{position: 'absolute', left: caja.x, top: caja.y, width: caja.w, height: caja.h, borderRadius: 44 * k, overflow: 'hidden', boxShadow: `0 ${40 * k}px ${90 * k}px rgba(0,0,0,.45), 0 0 0 ${4 * k}px rgba(210,168,81,.85)`}}>
        {dentro}
        {children}
      </div>
    </AbsoluteFill>
  );
};
/** Recorte (fondo transparente) con alto en px de pantalla, anclado por su borde inferior. */
const Recorte: React.FC<{id: TomaId; t: number; t0: number; vel: number; alto: number; cx: number; base: number; style?: React.CSSProperties}> = ({id, t, t0, vel, alto, cx, base, style}) => {
  const m = TOMA[id];
  const s = alto / m.h, ww = m.w * s;
  return <Toma id={id} t={t} t0={t0} vel={vel} style={{left: cx - ww / 2, top: base - alto, width: ww, height: alto, ...style}} />;
};
// esquinas de la pantalla verde en cada cuadro de la toma «mano» (detectadas con croma, en px del cuadro de 1280×720)
const PANTALLA: Pt[][] = [[[418,114],[649,84],[811,587],[566,625]],[[418,114],[649,84],[811,587],[566,625]],[[418,114],[649,84],[811,587],[566,625]],[[420,112],[649,84],[809,589],[566,625]],[[420,112],[649,84],[811,586],[568,627]],[[420,112],[647,82],[811,586],[568,627]],[[420,112],[653,86],[811,586],[568,627]],[[420,112],[653,86],[809,588],[568,627]],[[422,110],[651,84],[813,583],[568,626]],[[422,110],[649,82],[813,583],[566,623]],[[418,112],[655,86],[813,583],[568,625]],[[418,112],[651,82],[813,583],[568,625]],[[420,110],[649,80],[811,584],[570,626]],[[422,108],[657,86],[811,584],[566,621]],[[418,110],[651,80],[813,581],[568,623]],[[420,108],[649,78],[813,581],[568,623]],[[422,106],[653,80],[811,583],[566,619]],[[422,106],[651,78],[813,580],[566,619]],[[421,106],[649,76],[813,580],[568,621]],[[420,106],[653,78],[813,579],[568,621]],[[422,104],[651,76],[813,579],[566,617]],[[422,104],[655,78],[813,579],[568,619]],[[424,102],[653,76],[813,578],[568,619]],[[420,104],[651,74],[815,575],[570,620]],[[420,104],[655,76],[813,577],[568,617]],[[422,102],[653,74],[813,577],[568,617]],[[422,102],[653,74],[813,577],[570,619]],[[424,100],[657,76],[813,577],[568,615]],[[424,100],[655,74],[813,576],[568,615]],[[420,102],[653,72],[813,576],[570,617]],[[422,100],[653,72],[813,576],[570,617]],[[422,100],[651,70],[815,573],[572,618]],[[422,100],[657,74],[815,573],[568,613]],[[422,100],[657,74],[815,573],[568,613]],[[422,100],[655,72],[815,573],[568,613]],[[422,100],[655,72],[815,573],[568,613]],[[422,100],[657,74],[815,573],[572,618]],[[422,100],[651,70],[815,573],[572,619]],[[422,100],[653,72],[813,576],[570,617]],[[422,100],[653,72],[813,576],[570,617]],[[421,102],[655,74],[813,576],[568,615]],[[424,100],[657,76],[813,577],[568,615]],[[422,102],[653,74],[813,577],[570,619]],[[422,102],[655,76],[813,577],[568,617]],[[422,102],[651,74],[815,575],[568,617]],[[420,104],[653,76],[813,578],[570,620]],[[420,104],[655,78],[813,578],[570,621]],[[422,104],[651,76],[813,579],[568,619]]];
/** Homografía: lleva el rectángulo W×H a un cuadrilátero (sup-izq, sup-der, inf-der, inf-izq) → matrix3d de CSS. */
const homografia = (W: number, H: number, q: Pt[]) => {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den, hh = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0;
  return `matrix3d(${a / W},${d / W},0,${g / W},${b / H},${e / H},0,${hh / H},0,0,1,0,${c},${f},0,1)`;
};

// =====================================================================================================
// 1 · «¿Sigues buscando qué estrenar sin ver lo mismo de siempre?» (0 – 4,3 s)
// =====================================================================================================
type PalT = [string, number, boolean?];
const Hook: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const lineas: PalT[][] = [[['¿Sigues', 0.0], ['buscando', 0.44]], [['qué', 0.84], ['estrenar', 1.26, true]], [['sin', 1.88], ['ver', 2.48], ['lo', 2.72], ['mismo', 2.86]], [['de', 3.18], ['siempre?', 3.4, true]]];
  const s = L ? 132 : 116;
  const glitch = t > 3.38 && t < 3.66;
  const destello = Math.max(0, 1 - Math.abs(t - 3.42) * 9);
  const [sx, sy] = temblor(t, [[3.4, 9 * k]]);
  const tarjeta = {x: 60 * k, y: 0.055 * h, w: w - 120 * k, h: 0.53 * h};
  const kb = 1.06 + 0.05 * pr(t, 0, 4.4, eInOut);   // empuje lento de cámara
  const sep = glitch ? (random(`hg${Math.floor(t * 30)}`) - 0.5) * 26 * k : 0;
  const fondo = (id: string, extra?: React.CSSProperties) => (
    <AbsoluteFill key={id} style={{transform: `scale(${kb})`, transformOrigin: L ? '30% 40%' : '50% 30%', ...extra}}>
      <TomaFondo id="cama" t={t} t0={0} vel={0.55} fx={0.27} ax={L ? 0.3 : 0.5} zoom={L ? 1 : 1.12} tarjeta={tarjeta} />
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{background: P.night, transform: `translate(${sx}px, ${sy}px)`}}>
      {fondo('a', {opacity: pr(t, 0, 0.5)})}
      {glitch ? <>{fondo('r', {left: sep, mixBlendMode: 'screen', opacity: 0.45, filter: 'sepia(1) hue-rotate(-50deg) saturate(4)'})}{fondo('b', {left: -sep, mixBlendMode: 'screen', opacity: 0.35, filter: 'sepia(1) hue-rotate(170deg) saturate(3)'})}</> : null}
      {L ? <AbsoluteFill style={{background: 'linear-gradient(270deg, rgba(27,17,20,.9) 0%, rgba(27,17,20,.72) 38%, rgba(27,17,20,0) 68%)'}} />
        : <AbsoluteFill style={{background: `linear-gradient(180deg, rgba(27,17,20,0) 52%, ${P.night} 64%)`}} />}
      <Bokeh t={t} n={10} alfa={0.18} />
      <AbsoluteFill style={L
        ? {display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 0.56 * w, gap: 2 * k}
        : {display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', paddingLeft: 80 * k, paddingTop: 0.64 * h, gap: 0}}>
        {lineas.map((ln, i) => (
          <div key={i} style={{display: 'flex', gap: 0.24 * s * k, alignItems: 'baseline'}}>
            {ln.map(([txt, at, acento], j) => (
              <Rev key={j} t={t} at={at} dur={0.65}>
                {acento ? <Oro s={s * 1.05} t={t}>{txt}</Oro> : <H s={s} color={P.cream}>{txt}</H>}
              </Rev>
            ))}
          </div>
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#fff', opacity: destello * 0.4}} />
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 2 · «Tenis, bolsos o ese outfit que llama la atención.» (3,5 – 9 s): tres grupos de producto que vuelan
// =====================================================================================================
const Grupos: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const e = L ? 0.8 : 0.8;
  const grupos: {cx: number; cy: number; at: number; etiqueta: string; items: Vuelo[]}[] = [
    {cx: L ? 0.19 : 0.5, cy: L ? 0.45 : 0.2, at: K.tenis, etiqueta: 'Tenis', items: [
      {id: 'tenis-nb', w: 500 * e, rot: -8, dx: -10, dy: -70, at: K.tenis, from: [-1100, 260], arc: 170, rotFrom: -35, fase: 0},
      {id: 'tenis-nike', w: 400 * e, rot: 7, dx: 130, dy: 140, at: K.tenis + 0.12, from: [700, 760], arc: 120, rotFrom: 40, fase: 1.4},
      {id: 'tenis-gris', w: 330 * e, rot: -12, dx: -130, dy: 150, at: K.tenis + 0.24, from: [-600, 800], arc: 100, rotFrom: -40, fase: 2.5}]},
    {cx: 0.5, cy: L ? 0.45 : 0.5, at: K.bolsos, etiqueta: 'Bolsos', items: [
      {id: 'bolso-negro', w: 400 * e, rot: 3, dx: 0, dy: -70, at: K.bolsos, from: [0, -1000], arc: 0, rotFrom: 18, fase: 0.6},
      {id: 'bolso-beige', w: 320 * e, rot: -9, dx: -170, dy: 120, at: K.bolsos + 0.12, from: [-800, 520], arc: 140, rotFrom: -45, fase: 1.9},
      {id: 'sling-reebok', w: 215 * e, rot: 8, dx: 165, dy: 100, at: K.bolsos + 0.24, from: [800, 560], arc: 130, rotFrom: 45, fase: 3}]},
    {cx: L ? 0.81 : 0.5, cy: L ? 0.45 : 0.8, at: K.outfit, etiqueta: 'Outfit', items: [
      {id: 'sling-verde', w: 280 * e, rot: -6, dx: -45, dy: -70, at: K.outfit, from: [600, -900], arc: 0, rotFrom: 25, fase: 0.3},
      {id: 'tenis-levis', w: 430 * e, rot: 9, dx: 40, dy: 130, at: K.outfit + 0.14, from: [1100, 420], arc: 150, rotFrom: 38, fase: 2.1}]},
  ];
  const foco = pr(t, K.llama, 0.55, eInOut);
  const [sx, sy] = temblor(t, [[K.tenis + 0.4, 6 * k], [K.bolsos + 0.4, 6 * k], [K.outfit + 0.4, 6 * k], [K.llama + 0.1, 8 * k]]);
  const pan = (t - K.barrido) * -9 * k;
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <div style={{position: 'absolute', inset: 0, transform: `translate(${sx}px, ${sy}px)`}}>
        <div style={{position: 'absolute', left: -0.15 * w, top: -0.25 * h, width: 0.7 * w, height: 0.7 * w, borderRadius: '50%', background: 'radial-gradient(circle, rgba(246,211,218,.8) 0%, rgba(246,211,218,0) 70%)', transform: `translate(${pan * 0.6}px, 0)`}} />
        <div style={{position: 'absolute', right: -0.2 * w, bottom: -0.35 * h, width: 0.8 * w, height: 0.8 * w, borderRadius: '50%', background: 'radial-gradient(circle, rgba(210,168,81,.28) 0%, rgba(210,168,81,0) 70%)', transform: `translate(${-pan * 0.6}px, 0)`}} />
        <div style={{position: 'absolute', left: -0.05 * w + pan * 1.4, top: 0.3 * h, opacity: 0.06 * pr(t, K.barrido + 0.3, 0.8)}}><H s={L ? 520 : 400} color={P.wine} italic weight={500}>nuevo</H></div>
        <Bokeh t={t} n={10} color={P.gold} alfa={0.22} />
        {grupos.map((g, gi) => {
          const cx = g.cx * w + pan * (0.8 + 0.2 * gi), cy = g.cy * h;
          const esFoco = gi === 2;
          const atenua = esFoco ? 1 : 1 - 0.5 * foco;
          return t < g.at ? null : (
            <div key={gi} style={{position: 'absolute', inset: 0, opacity: atenua, filter: !esFoco && foco > 0.05 ? `blur(${foco * 5}px)` : undefined, transform: esFoco ? `scale(${1 + 0.07 * foco})` : undefined, transformOrigin: `${g.cx * 100}% 50%`}}>
              {esFoco ? <div style={{position: 'absolute', left: cx - 420 * k, top: cy - 380 * k, width: 840 * k, height: 840 * k, borderRadius: '50%', opacity: foco, background: 'radial-gradient(circle, rgba(210,168,81,.6) 0%, rgba(210,168,81,0) 65%)', transform: `scale(${0.6 + 0.5 * foco})`}} /> : null}
              {g.items.map((v, i) => <ProdVuelo key={i} t={t} cx={cx} cy={cy} v={v} />)}
              {g.items.map((v, i) => <Destellos key={'d' + i} t={t} t0={v.at + 0.42} x={cx + v.dx * k} y={cy + v.dy * k + (v.w * k) / AR[v.id] * 0.4} n={i === 0 ? 22 : 12} fuerza={i === 0 ? 520 : 360} />)}
              <div style={{position: 'absolute', left: cx, top: cy + (L ? 330 : 290) * k, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 * k}}>
                <div style={{width: 3 * k, height: 54 * k * pr(t, g.at + 0.25, 0.4, eOut), background: P.gold}} />
                <Pal t={t} at={g.at + 0.3} dur={0.45} dy={24} blur={6}>
                  <div style={{background: P.wine, borderRadius: 99, padding: `${12 * k}px ${38 * k}px`, boxShadow: `0 ${12 * k}px ${28 * k}px rgba(85,32,42,.32)`}}><Lab s={26} color={P.cream}>{g.etiqueta}</Lab></div>
                </Pal>
              </div>
            </div>
          );
        })}
        {(() => {
          const cxs = (L ? 0.81 : 0.5) * w + pan;
          const cys = (L ? 0.45 : 0.8) * h;
          const q = cl((t - K.llama) / 1.1);
          return q > 0 && q < 1 ? <div style={{position: 'absolute', left: cxs - 330 * k * (0.4 + q), top: cys - 330 * k * (0.4 + q), width: 660 * k * (0.4 + q), height: 660 * k * (0.4 + q), borderRadius: '50%', border: `${6 * k * (1 - q)}px solid ${P.gold}`, opacity: 1 - q}} /> : null;
        })()}
        <Destellos t={t} t0={K.llama} x={(L ? 0.81 : 0.5) * w + pan} y={(L ? 0.45 : 0.8) * h} n={30} fuerza={620} vida={1.3} />
      </div>
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 2b · «…ese outfit que llama la atención.» (6,3 – 8,9 s): se abre un círculo desde el grupo «Outfit» hacia la calle
// =====================================================================================================
const T_CALLE = 6.26;
const Calle: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const foco = pr(t, K.llama, 0.6, eInOut);
  const tarjeta = {x: 60 * k, y: 0.05 * h, w: w - 120 * k, h: 0.66 * h};
  const gx = w / 2, gy = L ? 0.5 * h : tarjeta.y + tarjeta.h * 0.5;
  const s = L ? 112 : 104;
  const pal: [string, number, boolean?][] = [['que', 6.7], ['llama', 6.88, true], ['la', 7.08], ['atención', 7.2, true]];
  const q = cl((t - K.llama) / 1.1);
  return (
    <AbsoluteFill style={{background: P.night}}>
      <AbsoluteFill style={{transform: `scale(${1.12 - 0.08 * pr(t, T_CALLE, 1.2, eOut5) + 0.05 * foco})`, transformOrigin: `50% ${L ? 45 : 35}%`}}>
        <TomaFondo id="calle" t={t} t0={T_CALLE} vel={0.78} fx={0.5} zoom={L ? 1 : 1.08} tarjeta={tarjeta} />
      </AbsoluteFill>
      {/* foco de luz: el resto se oscurece y ella queda iluminada */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse ${L ? 26 : 46}% ${L ? 60 : 40}% at 50% ${(gy / h) * 100}%, rgba(27,17,20,0) 40%, rgba(27,17,20,.62) 100%)`, opacity: foco}} />
      {L ? <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(27,17,20,0) 62%, rgba(27,17,20,.75) 100%)'}} /> : null}
      {q > 0 && q < 1 ? <div style={{position: 'absolute', left: gx - 420 * k * (0.5 + q), top: gy - 420 * k * (0.5 + q), width: 840 * k * (0.5 + q), height: 840 * k * (0.5 + q), borderRadius: '50%', border: `${7 * k * (1 - q)}px solid ${P.gold}`, opacity: 1 - q}} /> : null}
      <Destellos t={t} t0={K.llama} x={gx} y={gy} n={30} fuerza={640} vida={1.3} />
      <div style={{position: 'absolute', left: 0, right: 0, top: L ? undefined : tarjeta.y + tarjeta.h + 46 * k, bottom: L ? 0.07 * h : undefined, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 * k}}>
        <Pal t={t} at={T_CALLE + 0.25} dur={0.45} dy={24} blur={6}>
          <div style={{background: P.wine, borderRadius: 99, padding: `${12 * k}px ${38 * k}px`, boxShadow: `0 ${12 * k}px ${28 * k}px rgba(0,0,0,.35)`}}><Lab s={26} color={P.cream}>Outfit</Lab></div>
        </Pal>
        <div style={{display: 'flex', gap: 0.22 * s * k, alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'center', maxWidth: w - 100 * k}}>
          {pal.map(([txt, at, oro], i) => <Rev key={i} t={t} at={at} dur={0.6}>{oro ? <Oro s={s * 1.06} t={t}>{txt}</Oro> : <H s={s} color={P.cream}>{txt}</H>}</Rev>)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 3 · «Encontrar tu estilo no debería ser complicado.» (8 – 11,5 s): profundidad de campo con productos desenfocados
// =====================================================================================================
const Estilo: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const s = L ? 140 : 128;
  const lineas: PalT[][] = [[['Encontrar', 8.34]], [['tu', 8.78], ['estilo', 8.9, true]], [['no', 9.28], ['debería', 9.72]], [['ser', 10.16], ['complicado.', 10.34]]];
  const sube = spr(t, 8.15, 5.5, 9);
  const tacha = pr(t, K.tachon, 0.32, eInOut);
  const apaga = pr(t, K.tachon + 0.15, 0.4, eOut);
  const a = t - 8;
  const fondo: {id: PId; w: number; x: number; y: number; rot: number; blur: number; op: number; par: number}[] = [
    {id: 'bolso-negro', w: 880, x: 0.8, y: 0.3, rot: -14, blur: 16, op: 0.5, par: 22},
    {id: 'tenis-nb', w: 980, x: 0.1, y: 0.82, rot: 10, blur: 20, op: 0.42, par: -16},
    {id: 'tenis-nike', w: 700, x: 0.62, y: 0.88, rot: -6, blur: 11, op: 0.55, par: 30},
    {id: 'bolso-beige', w: 520, x: 0.1, y: 0.12, rot: 16, blur: 9, op: 0.5, par: -26},
  ];
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 40%, #5e1f30 0%, ${P.deep} 55%, ${P.night} 100%)`}}>
      <AbsoluteFill style={{transform: `scale(${1 + a * 0.018})`}}>
        {fondo.map((f, i) => (
          <div key={i} style={{position: 'absolute', left: f.x * w - (f.w * k) / 2 + a * f.par * k, top: f.y * h - (f.w * k) / AR[f.id] / 2 + Math.sin(a * 0.9 + i) * 14 * k, opacity: f.op * pr(t, 8.0 + i * 0.1, 0.6), filter: `blur(${f.blur * k}px)`, transform: `rotate(${f.rot + a * (i % 2 ? 1.6 : -1.6)}deg)`}}>
            <Prod id={f.id} w={f.w} />
          </div>
        ))}
        <Bokeh t={t} n={14} alfa={0.3} />
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(27,17,20,.35) 0%, rgba(27,17,20,.55) 100%)'}} />
        {/* ella, recortada, decide entre dos blusas */}
        <div style={{position: 'absolute', left: (L ? 0.73 : 0.5) * w - 0.5 * w, top: 0, width: w, height: h, transform: `translateY(${(1 - Math.min(1.02, sube)) * 160 * k}px)`, opacity: cl(sube * 1.6)}}>
          <div style={{position: 'absolute', left: 0.5 * w - (L ? 520 : 470) * k, top: h - (L ? 0.95 : 0.52) * h, width: (L ? 1040 : 940) * k, height: (L ? 0.95 : 0.52) * h, borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 55%, rgba(210,168,81,.32) 0%, rgba(210,168,81,0) 65%)'}} />
          <Recorte id="closet" t={t} t0={8.0} vel={0.56} alto={(L ? 0.95 : 0.52) * h} cx={0.5 * w} base={h + 2} style={{filter: `drop-shadow(0 0 ${30 * k}px rgba(210,168,81,.28))`}} />
        </div>
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', justifyContent: L ? 'center' : 'flex-start', alignItems: L ? 'flex-start' : 'center', paddingLeft: (L ? 150 : 0) * k, paddingTop: L ? 0 : 0.08 * h, gap: 4 * k}}>
          {lineas.map((ln, i) => (
            <div key={i} style={{display: 'flex', gap: 0.24 * s * k, alignItems: 'baseline'}}>
              {ln.map(([txt, at, acento], j) => {
                const esC = txt === 'complicado.';
                return (
                  <Rev key={j} t={t} at={at} dur={0.7}>
                    <div style={{position: 'relative', opacity: esC ? 1 - 0.62 * apaga : 1}}>
                      {acento ? <Oro s={s * 1.2} t={t}>{txt}</Oro> : <H s={s} color={P.cream}>{txt}</H>}
                      {esC ? <div style={{position: 'absolute', left: -8 * k, top: '56%', height: 7 * k, width: `calc(${tacha * 100}% + ${16 * k}px)`, background: P.gold, borderRadius: 9 * k, boxShadow: `0 0 ${24 * k}px rgba(210,168,81,.9)`}} /> : null}
                    </div>
                  </Rev>
                );
              })}
            </div>
          ))}
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 4 · «Sólo entra a AlexaShop.cc.» (11 – 14,8 s): celular en perspectiva, productos flotando, cursor que hace clic
// =====================================================================================================
const Celular: React.FC<{x: number; y: number; scrollA: number; scrollB: number; mezcla: number; giro: number}> = ({x, y, scrollA, scrollB, mezcla, giro}) => {
  const {k, L} = useD();
  const pw = (L ? 400 : 520) * k, ph = pw * (1688 / 780), r = pw / 780;
  return (
    <div style={{position: 'absolute', left: x - pw / 2 - 14 * k, top: y, width: pw + 28 * k, height: ph + 28 * k, perspective: 1600 * k}}>
      <div style={{width: '100%', height: '100%', borderRadius: 70 * k, background: '#0c0708', padding: 14 * k, transform: `rotateY(${giro}deg) rotateX(${giro * 0.12}deg)`, boxShadow: `0 ${50 * k}px ${90 * k}px rgba(27,17,20,.38)`, transformStyle: 'preserve-3d'}}>
        <div style={{position: 'relative', width: pw, height: ph, borderRadius: 58 * k, overflow: 'hidden', background: '#fff'}}>
          <Img src={staticFile('img/inicio-larga.webp')} style={{position: 'absolute', left: 0, top: -scrollA * r, width: pw, height: 'auto', opacity: 1 - mezcla}} />
          <Img src={staticFile('img/catalogo-larga.webp')} style={{position: 'absolute', left: 0, top: -scrollB * r, width: pw, height: 'auto', opacity: mezcla}} />
          <div style={{position: 'absolute', inset: 0, background: `linear-gradient(115deg, rgba(255,255,255,0) 35%, rgba(255,255,255,${0.22 * Math.max(0, 1 - Math.abs(giro) / 20)}) 50%, rgba(255,255,255,0) 65%)`}} />
          <div style={{position: 'absolute', left: '50%', top: 12 * k, width: 120 * k, height: 34 * k, marginLeft: -60 * k, borderRadius: 40 * k, background: '#0c0708'}} />
        </div>
      </div>
    </div>
  );
};
const Web: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const pw = (L ? 400 : 520) * k, ph = pw * (1688 / 780);
  const sube = spr(t, K.celular, 6.5, 11);
  const yFinal = L ? 0.5 * h - (ph + 28 * k) / 2 : 0.46 * h;
  const x = L ? 0.27 * w : w / 2;
  const n = t < K.punto ? Math.floor(cl((t - K.web) / 0.78) * 9) : 9 + Math.floor(cl((t - K.punto) / 0.3) * 3.01);
  const url = 'alexashop.cc'.slice(0, t < K.web ? 0 : n);
  const listo = t >= K.punto + 0.3;
  const clic = pr(t, K.clic, 0.5, eBack);
  const giro = lerp(38, 0, eOut5(pr(t, K.celular, 1.1)));
  const scrollA = lerp(0, 700, pr(t, 11.7, 1.6, eInOut));
  const mezcla = pr(t, 13.0, 0.5, eInOut);
  const scrollB = lerp(0, 1300, pr(t, 13.2, 1.2, eInOut));
  const tx = L ? 0.5 * w : 0;
  const [sx, sy] = temblor(t, [[K.clic, 7 * k]]);
  const flot: {id: PId; w: number; x: number; y: number; rot: number; at: number; fase: number}[] = L
    ? [{id: 'bolso-negro', w: 230, x: 0.45, y: 0.15, rot: 12, at: 11.45, fase: 0.5}, {id: 'tenis-nike', w: 300, x: 0.44, y: 0.86, rot: -10, at: 11.6, fase: 1.7}, {id: 'sling-verde', w: 180, x: 0.08, y: 0.14, rot: -12, at: 11.75, fase: 2.6}]
    : [{id: 'bolso-negro', w: 230, x: 0.86, y: 0.5, rot: 12, at: 11.45, fase: 0.5}, {id: 'tenis-nike', w: 300, x: 0.18, y: 0.88, rot: -10, at: 11.6, fase: 1.7}];
  const cq = pr(t, 12.95, 0.5, eInOut);
  const cx0 = 0.5 * w + 420 * k, cy0 = (L ? 0.62 : 0.36) * h + 160 * k;
  const cxT = L ? 0.5 * w + 300 * k : w / 2 + 80 * k, cyT = L ? 0.5 * h + 70 * k : 0.28 * h + 70 * k;
  return (
    <AbsoluteFill style={{background: P.paper, transform: `translate(${sx}px, ${sy}px)`}}>
      <div style={{position: 'absolute', right: -0.1 * w, top: -0.2 * h, width: 0.6 * w, height: 0.6 * w, borderRadius: '50%', background: 'radial-gradient(circle, rgba(246,211,218,.75) 0%, rgba(246,211,218,0) 70%)'}} />
      <Bokeh t={t} n={8} alfa={0.2} />
      <div style={{position: 'absolute', left: tx, right: 0, top: L ? 0 : 0.08 * h, bottom: L ? 0 : 0.62 * h, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: L ? 'flex-start' : 'center', gap: 28 * k}}>
        <div style={{display: 'flex', gap: 0.24 * 150 * k, alignItems: 'baseline'}}>
          <Rev t={t} at={11.3}><H s={L ? 150 : 130}>Sólo</H></Rev>
          <Rev t={t} at={11.62}><H s={L ? 150 : 130}>entra</H></Rev>
          <Rev t={t} at={11.9}><H s={L ? 150 : 130} italic weight={500}>a</H></Rev>
        </div>
        {t >= K.web - 0.05 ? (
          <div style={{position: 'relative'}}>
            {[0, 1, 2].map((r) => {
              const q = cl((t - K.clic - r * 0.1) / 0.6);
              return q > 0 && q < 1 ? <div key={r} style={{position: 'absolute', left: '50%', top: '50%', width: (460 + q * 380) * k, height: (130 + q * 240) * k, transform: 'translate(-50%,-50%)', borderRadius: 99, border: `${5 * k}px solid ${P.gold}`, opacity: (1 - q) * 0.75}} /> : null;
            })}
            <div style={{background: P.wine, borderRadius: 99, padding: `${26 * k}px ${64 * k}px`, boxShadow: `0 ${24 * k}px ${54 * k}px rgba(120,47,58,.42)`, transform: `scale(${(0.7 + 0.3 * pr(t, K.web - 0.05, 0.35, eBack)) * (1 - 0.06 * Math.sin(clic * Math.PI))})`, display: 'flex', alignItems: 'center', minWidth: 620 * k, justifyContent: 'center'}}>
              <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 96 * k, color: '#fff', letterSpacing: '-0.01em', whiteSpace: 'pre'}}>{url}<span style={{color: P.gold, opacity: !listo && Math.floor(t * 5) % 2 === 0 ? 1 : 0}}>|</span></div>
            </div>
          </div>
        ) : null}
      </div>
      <Celular x={x} y={lerp(h + 60 * k, yFinal, Math.min(1.05, sube))} scrollA={scrollA} scrollB={scrollB} mezcla={mezcla} giro={giro} />
      {flot.map((f, i) => {
        const s = spr(t, f.at, 6, 11);
        return t < f.at ? null : (
          <div key={i} style={{position: 'absolute', left: f.x * w - (f.w * k) / 2 + (1 - s) * (f.x < 0.5 ? -400 : 400) * k, top: f.y * h - (f.w * k) / AR[f.id] / 2 + Math.sin(t * 1.5 + f.fase) * 12 * k, transform: `rotate(${f.rot + Math.sin(t + f.fase) * 3}deg) scale(${0.5 + 0.5 * Math.min(1, s)})`, filter: 'drop-shadow(0 18px 18px rgba(85,32,42,.3))'}}>
            <Prod id={f.id} w={f.w} brillo={cl((t - f.at - 0.4) / 0.9)} />
          </div>
        );
      })}
      {t > 12.9 && t < 14.3 ? (
        <div style={{position: 'absolute', left: lerp(cx0, cxT, cq), top: lerp(cy0, cyT, cq), transform: `scale(${1 - 0.15 * Math.sin(clic * Math.PI)})`, opacity: cl((t - 12.9) / 0.15) * (1 - pr(t, 13.9, 0.3))}}>
          <svg viewBox="0 0 24 24" width={58 * k} height={58 * k}><path d="M4 2 L4 19 L8.6 15 L11.6 22 L14.4 20.8 L11.4 14 L17.5 14 Z" fill="#fff" stroke={P.ink} strokeWidth="1.4" strokeLinejoin="round" /></svg>
        </div>
      ) : null}
      <Destellos t={t} t0={K.clic} x={L ? 0.5 * w + 300 * k : w / 2} y={L ? 0.5 * h + 70 * k : 0.28 * h + 60 * k} n={20} fuerza={420} />
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 5 · «El nuevo drop pronto estará disponible en nuestra página web.» (13,9 – 17,4 s): carrusel 3D con reflejo
// =====================================================================================================
const Escenario: React.FC<{t: number; fecha: string; hora: string}> = ({t, fecha, hora}) => {
  const {w, h, L, k} = useD();
  const orden: PId[] = ['tenis-nb', 'bolso-negro', 'tenis-nike', 'bolso-beige', 'tenis-levis', 'sling-reebok', 'tenis-gris', 'sling-verde'];
  const R = (L ? 700 : 520) * k;
  const caja = {w: (L ? 430 : 360) * k, h: (L ? 380 : 320) * k};
  const giro = 150 * (1 - eOut5(pr(t, K.ventana, 1.7))) + 26 * (t - K.ventana);
  const pulso = spr(t, K.pronto, 5.5, 16);
  const tembl = t > K.pronto + 0.25 && t < K.pronto + 0.7 ? Math.sin((t - K.pronto) * 95) * 3 * k : 0;
  const [sx, sy] = temblor(t, [[K.drop, 9 * k], [K.pronto, 11 * k]]);
  const cy = (L ? 0.45 : 0.4) * h;
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 38%, #4a1626 0%, ${P.deep} 45%, ${P.night} 100%)`, transform: `translate(${sx}px, ${sy}px)`}}>
      {[0, 1].map((i) => (
        <div key={i} style={{position: 'absolute', left: (i ? 0.7 : 0.3) * w - 0.2 * w, top: -0.2 * h, width: 0.4 * w, height: 1.4 * h, background: 'linear-gradient(180deg, rgba(255,226,170,.22) 0%, rgba(255,226,170,0) 80%)', transform: `rotate(${(i ? -1 : 1) * (18 + 8 * Math.sin(t * 0.8 + i * 2))}deg)`, transformOrigin: '50% 0', filter: `blur(${24 * k}px)`}} />
      ))}
      <Bokeh t={t} n={12} alfa={0.3} />
      <div style={{position: 'absolute', left: 0, right: 0, top: cy + caja.h * 0.5, bottom: 0, background: 'linear-gradient(180deg, rgba(210,168,81,.16) 0%, rgba(27,17,20,0) 70%)'}} />
      <div style={{position: 'absolute', left: w / 2 - R * 1.15, top: cy + caja.h * 0.5 - 40 * k, width: R * 2.3, height: R * 0.5, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(210,168,81,.28) 0%, rgba(210,168,81,0) 70%)'}} />
      <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, perspective: 2800 * k, perspectiveOrigin: `50% ${L ? 38 : 34}%`}}>
        <div style={{position: 'absolute', left: w / 2, top: cy, width: 0, height: 0, transformStyle: 'preserve-3d', transform: `rotateY(${giro}deg)`}}>
          {orden.map((id, i) => {
            const horiz = AR[id] > 1;
            const est: React.CSSProperties = {maxWidth: '100%', maxHeight: '100%', width: horiz ? '100%' : 'auto', height: horiz ? 'auto' : '100%', objectFit: 'contain'};
            return (
              <div key={id} style={{position: 'absolute', left: -caja.w / 2, top: -caja.h / 2, width: caja.w, height: caja.h, transform: `rotateY(${i * 45}deg) translateZ(${R}px)`, backfaceVisibility: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center'}}>
                <div style={{position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center'}}>
                  <Img src={src(id)} style={{...est, filter: 'drop-shadow(0 20px 22px rgba(0,0,0,.45))'}} />
                  <Img src={src(id)} style={{...est, position: 'absolute', left: '50%', bottom: 0, transform: 'translate(-50%, 100%) scaleY(-1)', opacity: 0.22, WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 55%)', maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 55%)'}} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(27,17,20,0) 40%, rgba(27,17,20,.82) 100%)'}} />
      <div style={{position: 'absolute', right: (L ? 130 : 70) * k, top: (L ? 120 : 130) * k, opacity: cl((t - K.pronto) / 0.08), transform: `rotate(${-9 + tembl}deg) scale(${0.4 + 0.6 * pulso + (t < K.pronto + 0.1 ? 1.4 * (1 - cl((t - K.pronto) / 0.1)) : 0)})`}}>
        <div style={{border: `${6 * k}px solid ${P.gold}`, borderRadius: 18 * k, padding: `${14 * k}px ${40 * k}px`, background: 'rgba(27,17,20,.6)', boxShadow: `0 0 ${40 * k}px rgba(210,168,81,.4)`}}>
          <Lab s={fecha ? 44 : 62} color={P.gold} track={0.28}>{fecha ? `Llega el ${fecha}` : 'Pronto'}</Lab>
          {fecha && hora ? <Lab s={30} color={P.cream} style={{marginTop: 6 * k}}>{hora}</Lab> : null}
        </div>
      </div>
      <Destellos t={t} t0={K.pronto + 0.05} x={w - (L ? 330 : 280) * k} y={(L ? 230 : 250) * k} n={26} fuerza={560} />
      <AbsoluteFill style={{display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: `0 ${(L ? 130 : 70) * k}px ${(L ? 70 : 90) * k}px`, gap: 6 * k}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 28 * k}}>
          <Rev t={t} at={14.04} dur={0.7}><H s={L ? 140 : 120} color={P.cream}>El nuevo</H></Rev>
          <Rev t={t} at={K.drop} dur={0.8}><Oro s={L ? 290 : 230} t={t}>drop</Oro></Rev>
        </div>
        <Pal t={t} at={K.disponible} dur={0.5} dy={30} blur={8}><Lab s={L ? 34 : 30} color={P.cream} track={0.3}>Estará disponible</Lab></Pal>
        <Pal t={t} at={K.pagina} dur={0.5} dy={30} blur={8}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16 * k}}>
            <svg viewBox="0 0 24 24" width={38 * k} height={38 * k} fill="none" stroke={P.gold} strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="3" /><path d="M2 9 H22" /><circle cx="5.5" cy="6.5" r=".6" fill={P.gold} /></svg>
            <Lab s={L ? 34 : 30} color={P.gold} track={0.3}>En nuestra página web</Lab>
          </div>
        </Pal>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 6 · «Piezas nuevas listas para ti.» (17 – 19,9 s): mosaico de tarjetas que giran, palomitas y ola de saltitos
// =====================================================================================================
const Piezas: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const cols = L ? 4 : 2, rows = L ? 2 : 4;
  const tw = (L ? 232 : 440) * k, th = (L ? 300 : 250) * k, gap = 20 * k;
  const gw = cols * tw + (cols - 1) * gap, gh = rows * th + (rows - 1) * gap;
  const gx = L ? w - gw - 80 * k : w / 2 - gw / 2;
  const gy = L ? h / 2 - gh / 2 : h - gh - 0.05 * h;
  const orden: PId[] = ['tenis-nb', 'bolso-negro', 'tenis-nike', 'bolso-beige', 'tenis-levis', 'sling-reebok', 'tenis-gris', 'sling-verde'];
  const fondos = [P.rose, P.tint, '#f3e3b8', P.cream];
  const [sx, sy] = temblor(t, [[K.parati, 6 * k]]);
  return (
    <AbsoluteFill style={{background: P.paper, transform: `translate(${sx}px, ${sy}px)`}}>
      <div style={{position: 'absolute', left: -0.1 * w, bottom: -0.3 * h, width: 0.7 * w, height: 0.7 * w, borderRadius: '50%', background: 'radial-gradient(circle, rgba(246,211,218,.75) 0%, rgba(246,211,218,0) 70%)'}} />
      <Bokeh t={t} n={8} alfa={0.2} />
      <div style={{position: 'absolute', left: L ? 130 * k : 0, right: L ? 0.52 * w : 0, top: L ? 0 : 0.06 * h, bottom: L ? 0 : undefined, display: 'flex', flexDirection: 'column', justifyContent: L ? 'center' : 'flex-start', alignItems: L ? 'flex-start' : 'center', gap: 2 * k}}>
        <div style={{display: 'flex', gap: 0.24 * 124 * k, alignItems: 'baseline'}}>
          <Rev t={t} at={K.piezas}><H s={124}>Piezas</H></Rev>
          <Rev t={t} at={17.58}><H s={124} color={P.wine}>nuevas</H></Rev>
        </div>
        <div style={{display: 'flex', flexDirection: L ? 'column' : 'row', gap: L ? 0 : 0.24 * 124 * k, alignItems: L ? 'flex-start' : 'baseline'}}>
          <Rev t={t} at={K.listas}><H s={124}>listas</H></Rev>
          <Rev t={t} at={K.parati} dur={0.8}>
            <div style={{position: 'relative'}}>
              <Oro s={L ? 170 : 140} t={t}>para ti</Oro>
              {Array.from({length: 9}).map((_, i) => {
                const a = (i / 9) * Math.PI * 2; const q = cl((t - K.parati - 0.05) / 0.9);
                return q > 0 && q < 1 ? <div key={i} style={{position: 'absolute', left: '50%', top: '50%', marginLeft: Math.cos(a) * 200 * q * k - 12 * k, marginTop: Math.sin(a) * 125 * q * k - 12 * k, opacity: Math.sin(q * Math.PI), transform: `scale(${0.5 + q * 0.9})`}}><Corazon s={26 * k} c={i % 2 ? P.wine : P.gold} /></div> : null;
              })}
            </div>
          </Rev>
        </div>
      </div>
      {orden.slice(0, cols * rows).map((id, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const at = K.piezas + 0.1 * i;
        const gira = spr(t, at, 7, 13);
        const chk = spr(t, K.listas + 0.1 * i, 6, 16);
        const ola = t > K.parati + 0.06 * i ? Math.sin(cl((t - K.parati - 0.06 * i) / 0.5) * Math.PI) : 0;
        const ar = AR[id];
        const pw = ar > 1 ? tw * 0.88 : Math.min(tw * 0.88, th * 0.78 * ar);
        return t < at ? null : (
          <div key={i} style={{position: 'absolute', left: gx + c * (tw + gap), top: gy + r * (th + gap) - ola * 16 * k, width: tw, height: th, perspective: 900 * k}}>
            <div style={{width: '100%', height: '100%', borderRadius: 26 * k, overflow: 'hidden', background: fondos[(i + r) % 4], boxShadow: `0 ${(22 + 14 * ola) * k}px ${46 * k}px rgba(85,32,42,${0.22 + 0.1 * ola})`, transform: `rotateY(${(1 - Math.min(1, gira)) * -100}deg) scale(${1 + 0.035 * ola})`, opacity: cl((t - at) / 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'}}>
              <Prod id={id} w={pw / k} brillo={cl((t - (at + 0.5)) / 0.7)} style={{filter: 'drop-shadow(0 14px 14px rgba(85,32,42,.3))', transform: `scale(${1 + 0.06 * ola})`}} />
              <div style={{position: 'absolute', left: 12 * k, top: 12 * k, background: P.gold, borderRadius: 99, padding: `${6 * k}px ${16 * k}px`}}><Lab s={18} color={P.night} track={0.18}>Nuevo</Lab></div>
            </div>
            {t >= K.listas + 0.1 * i ? (
              <div style={{position: 'absolute', right: -10 * k, bottom: -10 * k, width: 54 * k, height: 54 * k, borderRadius: '50%', background: P.wine, border: `${4 * k}px solid #fff`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${Math.min(1.15, chk)})`}}>
                <svg viewBox="0 0 24 24" width={28 * k} height={28 * k} fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 L10 17.5 L19 7" /></svg>
              </div>
            ) : null}
          </div>
        );
      })}
      <Destellos t={t} t0={K.parati} x={L ? 130 * k + 330 * k : w / 2} y={L ? h / 2 + 150 * k : 0.06 * h + 300 * k} n={26} fuerza={560} />
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 7 · «Sin vueltas, pides directo por WhatsApp.» (19,1 – 22,4 s): la línea se endereza y un producto vuela al chat
// =====================================================================================================
const Whatsapp: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const T0 = 19.1, VEL = 0.69;
  // dónde cae la toma en pantalla
  const caja = L ? {x: 0, y: 0, w, h} : {x: 60 * k, y: 0.3 * h, w: w - 120 * k, h: 0.65 * h};
  const zoom = L ? 1.1 : 1.0, fx = 0.48, ax = L ? 0.36 : 0.5;
  const H0 = Math.max(caja.h, (caja.w * 9) / 16) * zoom, W0 = (H0 * 16) / 9;
  const left = Math.min(0, Math.max(caja.w - W0, caja.w * ax - fx * W0)), top = (caja.h - H0) / 2;
  const kb = 1 + 0.03 * pr(t, T0, 3, eInOut);
  // esquinas de la pantalla verde en este instante (interpoladas entre cuadros) y algo agrandadas: lo que sobra lo tapa el marco
  const {i, fr} = cuadroToma(t, T0, VEL);
  const q0 = PANTALLA[i], q1 = PANTALLA[i + 1];
  const qq = q0.map((p, j) => [lerp(p[0], q1[j][0], fr), lerp(p[1], q1[j][1], fr)] as Pt);
  const cx = qq.reduce((a, p) => a + p[0], 0) / 4, cy = qq.reduce((a, p) => a + p[1], 0) / 4;
  const quad = qq.map(([x, y]) => [left + ((cx + (x - cx) * 1.07) / 1280) * W0, top + ((cy + (y - cy) * 1.05) / 720) * H0] as Pt);
  const CW = 460, CH = 1000;
  const enQuad = (u: number, v: number): Pt => {
    const a = quad[0], b = quad[1], c = quad[2], d = quad[3];
    const x1 = lerp(a[0], b[0], u), y1 = lerp(a[1], b[1], u), x2 = lerp(d[0], c[0], u), y2 = lerp(d[1], c[1], u);
    return [caja.x + lerp(x1, x2, v), caja.y + lerp(y1, y2, v)];
  };
  // momentos del chat
  const texto = 'Hola Alexa, quiero ver el nuevo drop';
  const escrito = t >= K.whatsapp ? '' : texto.slice(0, Math.floor(Math.max(0, t - 20.85) / 0.012));
  const envia = spr(t, K.whatsapp, 6, 14);
  const vol = pr(t, 20.45, 0.6, eInOut5), volAnt = pr(t - FRAME, 20.45, 0.6, eInOut5);
  const [dx, dy] = enQuad(0.3, 0.84);
  const ini: Pt = [L ? w + 200 * k : w + 150 * k, L ? 0.1 * h : 0.2 * h];
  const px = lerp(ini[0], dx, vol), py = lerp(ini[1], dy, vol) - 160 * k * Math.sin(Math.PI * vol);
  const pxA = lerp(ini[0], dx, volAnt);
  const [ex, ey] = enQuad(0.6, 0.62);
  const [sx, sy] = temblor(t, [[K.whatsapp, 6 * k]]);
  const chat = (
    <div style={{position: 'absolute', left: 0, top: 0, width: CW, height: CH, transformOrigin: '0 0', transform: homografia(CW, CH, quad), background: '#efe6da', overflow: 'hidden', fontFamily: SANS}}>
      <div style={{position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: `radial-gradient(${P.wine} 1.5px, transparent 1.6px)`, backgroundSize: '22px 22px'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 178, background: P.wine, display: 'flex', alignItems: 'flex-end', padding: '0 22px 20px', gap: 16}}>
        <div style={{width: 70, height: 70, borderRadius: '50%', background: P.deep, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `3px solid ${P.gold}`}}><Img src={staticFile('img/logo-mark.svg')} style={{height: 46, width: 'auto'}} /></div>
        <div><div style={{fontFamily: SERIF, fontWeight: 600, fontSize: 38, color: '#fff', lineHeight: 1}}>Tiendas Alexa</div><div style={{fontSize: 19, color: P.goldSoft, marginTop: 6}}>en línea</div></div>
      </div>
      {/* mensaje enviado */}
      {t >= K.whatsapp ? (
        <div style={{position: 'absolute', right: 22, bottom: 128 + 40 * (1 - Math.min(1, envia)), width: 330, opacity: cl(envia * 2), transform: `scale(${0.8 + 0.2 * Math.min(1.05, envia)})`, transformOrigin: '100% 100%', background: P.wine, borderRadius: '26px 26px 6px 26px', padding: 12, boxShadow: '0 8px 18px rgba(85,32,42,.25)'}}>
          <div style={{background: P.card, borderRadius: 18, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Img src={src('bolso-negro')} style={{height: 190, width: 'auto'}} /></div>
          <div style={{color: '#fff', fontSize: 25, lineHeight: 1.3, padding: '10px 6px 2px'}}>{texto}</div>
          <div style={{color: P.goldSoft, fontSize: 17, textAlign: 'right', padding: '0 6px'}}>21:32 ✓✓</div>
        </div>
      ) : null}
      {/* adjunto listo para enviar */}
      {vol >= 1 && t < K.whatsapp ? (
        <div style={{position: 'absolute', left: 22, bottom: 120, width: 170, height: 170, borderRadius: 20, background: P.card, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(0,0,0,.15)', transform: `scale(${Math.min(1.05, spr(t, 20.45 + 0.6, 7, 16))})`, transformOrigin: '0 100%'}}><Img src={src('bolso-negro')} style={{height: 140, width: 'auto'}} /></div>
      ) : null}
      {/* barra para escribir */}
      <div style={{position: 'absolute', left: 16, right: 16, bottom: 26, height: 82, display: 'flex', gap: 12, alignItems: 'center'}}>
        <div style={{flex: 1, height: 78, borderRadius: 40, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 24px', fontSize: 24, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden'}}>
          {escrito ? <>{escrito}<span style={{color: P.wine, opacity: Math.floor(t * 6) % 2 ? 1 : 0.2}}>|</span></> : <span style={{color: '#a99'}}>Mensaje</span>}
        </div>
        <div style={{width: 78, height: 78, borderRadius: '50%', background: P.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 + 0.25 * Math.sin(Math.min(1, envia) * Math.PI)})`}}>
          <svg viewBox="0 0 24 24" width={36} height={36} fill={P.night}><path d="M3 20 L21 12 L3 4 L3 10 L15 12 L3 14 Z" /></svg>
        </div>
      </div>
    </div>
  );
  const toma = (
    <div style={{position: 'absolute', left: caja.x, top: caja.y, width: caja.w, height: caja.h, overflow: 'hidden', borderRadius: L ? 0 : 44 * k, boxShadow: L ? undefined : `0 ${40 * k}px ${90 * k}px rgba(85,32,42,.35), 0 0 0 ${4 * k}px rgba(210,168,81,.85)`, transform: `scale(${kb})`}}>
      {chat}
      <Toma id="mano" t={t} t0={T0} vel={VEL} style={{left, top, width: W0, height: H0}} />
    </div>
  );
  return (
    <AbsoluteFill style={{background: P.paper, transform: `translate(${sx}px, ${sy}px)`}}>
      {!L ? <div style={{position: 'absolute', right: -0.2 * w, top: -0.1 * h, width: 0.9 * w, height: 0.9 * w, borderRadius: '50%', background: 'radial-gradient(circle, rgba(246,211,218,.7) 0%, rgba(246,211,218,0) 70%)'}} /> : null}
      {toma}
      {L ? <AbsoluteFill style={{background: 'linear-gradient(270deg, rgba(247,241,232,.97) 0%, rgba(247,241,232,.9) 30%, rgba(247,241,232,0) 52%)'}} /> : null}
      <div style={{position: 'absolute', left: L ? 0.6 * w : 0, right: 0, top: L ? 0 : 0.05 * h, bottom: L ? 0 : undefined, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: L ? 'flex-start' : 'center', gap: 4 * k}}>
        <div style={{display: 'flex', gap: 0.24 * 130 * k, alignItems: 'baseline'}}>
          <Rev t={t} at={K.vueltas}><H s={L ? 150 : 128}>Sin</H></Rev>
          <Rev t={t} at={19.68}><H s={L ? 150 : 128} color={P.wine}>vueltas,</H></Rev>
        </div>
        <div style={{display: 'flex', gap: 0.22 * 100 * k, alignItems: 'baseline', marginTop: 6 * k}}>
          <Rev t={t} at={K.pides}><H s={L ? 112 : 100} color={P.muted} weight={500}>pides</H></Rev>
          <Rev t={t} at={K.directo}><Oro s={L ? 126 : 112} t={t}>directo</Oro></Rev>
        </div>
        <Pal t={t} at={K.whatsapp - 0.08} dur={0.5} dy={30} style={{marginTop: 18 * k}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 18 * k, background: P.wine, borderRadius: 99, padding: `${12 * k}px ${34 * k}px ${12 * k}px ${14 * k}px`, boxShadow: `0 ${14 * k}px ${30 * k}px rgba(85,32,42,.3)`}}>
            <svg viewBox="0 0 24 24" width={58 * k} height={58 * k}><circle cx="12" cy="12" r="12" fill={P.cream} /><path d="M12 4.2a7.8 7.8 0 0 0-6.7 11.8L4.2 19.8l3.9-1a7.8 7.8 0 1 0 3.9-14.6z" fill="none" stroke={P.wine} strokeWidth="1.5" strokeLinejoin="round" /><path d="M9.2 8.6c.2-.4.5-.4.7-.4h.3c.2 0 .3.1.4.3l.6 1.4c.1.2 0 .3-.1.5l-.4.5c-.1.1-.1.2 0 .3.5.8 1.1 1.4 1.9 1.8.2.1.3.1.4 0l.5-.6c.1-.2.3-.2.5-.1l1.4.7c.2.1.3.2.2.4-.1.6-.6 1.2-1.3 1.3-.5.1-1.2 0-2.3-.5-1.7-.8-2.9-2.1-3.5-3.3-.4-.8-.3-1.5.1-2z" fill={P.wine} /></svg>
            <Lab s={30} color={P.cream} track={0.16}>WhatsApp</Lab>
          </div>
        </Pal>
      </div>
      {vol > 0 && vol < 1 ? (
        <MB sx={Math.abs(px - pxA) * 0.5} sy={0} style={{position: 'absolute', left: px - 130 * k, top: py - 140 * k, transform: `rotate(${(1 - vol) * 40}deg) scale(${lerp(1.5, 0.4, vol)})`}}>
          <Prod id="bolso-negro" w={260} style={{filter: 'drop-shadow(0 30px 30px rgba(0,0,0,.35))'}} />
        </MB>
      ) : null}
      <Destellos t={t} t0={K.whatsapp} x={ex} y={ey} n={26} fuerza={520} />
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 8 · «Sólo entra y elige Alexa.» (21,8 – 25,2 s): iris, ondas de choque, la marca y confeti dorado
// =====================================================================================================
const Final: React.FC<{t: number; incentivo: string}> = ({t, incentivo}) => {
  const {w, h, L, k} = useD();
  const p = pr(t, K.iris, 0.6, eInOut);
  const r = p * (Math.hypot(w, h) / 2 + 40);
  const caeAt = 23.85;
  const q = t - caeAt;
  const cae = q < 0 ? 0 : 1 - Math.exp(-q * 7) * Math.cos(q * 20);
  const letras = 'Alexa'.split('');
  const [sx, sy] = temblor(t, [[caeAt, 10 * k], [K.alexa, 5 * k]]);
  const sube = spr(t, 22.1, 5.5, 9);
  const galto = (L ? 0.9 : 0.46) * h, gcx = (L ? 0.21 : 0.5) * w;
  const tcx = L ? 0.68 * w : 0.5 * w, tcy = L ? 0.44 * h : 0.27 * h;
  return (
    <AbsoluteFill style={{clipPath: `circle(${r}px at 50% 50%)`}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 38%, #5e1f30 0%, ${P.deep} 50%, ${P.night} 100%)`, transform: `translate(${sx}px, ${sy}px)`}}>
        <Bokeh t={t} n={16} alfa={0.35} />
        <div style={{position: 'absolute', left: w / 2 - 0.7 * w, top: -0.3 * h, width: 1.4 * w, height: 1.6 * h, background: `conic-gradient(from ${t * 12}deg at 50% 40%, rgba(255,226,170,0) 0deg, rgba(255,226,170,.14) 20deg, rgba(255,226,170,0) 45deg, rgba(255,226,170,0) 180deg, rgba(255,226,170,.1) 200deg, rgba(255,226,170,0) 225deg)`, filter: `blur(${10 * k}px)`}} />
        {[0, 1, 2].map((i) => {
          const qq = cl((t - caeAt - i * 0.12) / 1.1);
          return qq > 0 && qq < 1 ? <div key={i} style={{position: 'absolute', left: tcx - 700 * k * qq, top: tcy - 700 * k * qq, width: 1400 * k * qq, height: 1400 * k * qq, borderRadius: '50%', border: `${5 * k * (1 - qq)}px solid ${P.gold}`, opacity: (1 - qq) * 0.7}} /> : null;
        })}
        {/* ella, feliz con su bolsa */}
        <div style={{position: 'absolute', inset: 0, transform: `translateY(${(1 - Math.min(1.02, sube)) * 220 * k}px)`, opacity: cl(sube * 1.8)}}>
          <div style={{position: 'absolute', left: gcx - 560 * k, top: h - galto * 0.95, width: 1120 * k, height: galto, borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 50%, rgba(210,168,81,.35) 0%, rgba(210,168,81,0) 62%)'}} />
          <Recorte id="bolsa" t={t} t0={21.95} vel={0.6} alto={galto} cx={gcx} base={h + 2} style={{filter: `drop-shadow(0 0 ${34 * k}px rgba(210,168,81,.3))`}} />
        </div>
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', justifyContent: L ? 'center' : 'flex-start', alignItems: 'center', gap: 4 * k, paddingLeft: L ? 0.36 * w : 0, paddingTop: L ? 0 : 0.07 * h}}>
          <div style={{display: 'flex', gap: 22 * k, alignItems: 'baseline', marginBottom: 6 * k}}>
            <Rev t={t} at={22.04}><H s={L ? 76 : 72} color={P.goldSoft} italic weight={500}>Sólo</H></Rev>
            <Rev t={t} at={22.34}><H s={L ? 76 : 72} color={P.cream} weight={500}>entra</H></Rev>
            <Rev t={t} at={22.7}><H s={L ? 76 : 72} color={P.cream} weight={500}>y</H></Rev>
            <Rev t={t} at={23.02}><Oro s={L ? 80 : 76} t={t}>elige</Oro></Rev>
          </div>
          <div style={{position: 'relative', height: 170 * k, width: 200 * k, display: 'flex', justifyContent: 'center'}}>
            <Img src={staticFile('img/logo-mark.svg')} style={{height: 170 * k, width: 'auto', transform: `translateY(${lerp(-460 * k, 0, cae)}px) scale(${1 + (q > 0 ? 0.08 * Math.exp(-q * 6) : 0)})`, opacity: q < -0.25 ? 0 : 1, filter: `drop-shadow(0 0 ${22 * k}px rgba(210,168,81,${q > 0 ? 0.6 * Math.exp(-q * 2) : 0}))`}} />
          </div>
          <div style={{display: 'flex'}}>
            {letras.map((l, i) => (
              <Rev key={i} t={t} at={K.alexa + i * 0.08} dur={0.75}><span style={{display: 'inline-block', fontFamily: SERIF, fontWeight: 500, fontSize: (L ? 300 : 260) * k, color: P.cream, letterSpacing: '.04em', lineHeight: 0.95}}>{l}</span></Rev>
            ))}
          </div>
          <Pal t={t} at={24.15} dur={0.5} dy={20} blur={6} rebote={false}><Lab s={L ? 26 : 24} color={P.goldSoft} track={0.34} weight={400}>Detalles &amp; Obsequios</Lab></Pal>
          {incentivo ? <Pal t={t} at={24.3} dur={0.5} dy={20}><Lab s={26} color={P.cream} weight={400} style={{marginTop: 12 * k}}>{incentivo}</Lab></Pal> : null}
          <div style={{height: 22 * k}} />
          <Pal t={t} at={24.4} dur={0.5} dy={20} blur={6} rebote={false}><Lab s={L ? 30 : 28} color={P.cream} track={0.2}>alexashop.cc · Choluteca</Lab></Pal>
        </AbsoluteFill>
        {t > caeAt ? Array.from({length: 46}).map((_, i) => {
          const a = t - caeAt - random(`c${i}d`) * 0.4;
          if (a < 0) return null;
          const x = random(`c${i}x`) * w + Math.sin(a * 3 + i) * 40 * k;
          const y = -60 * k + a * (260 + random(`c${i}v`) * 360) * k;
          if (y > h + 60 * k) return null;
          return <div key={i} style={{position: 'absolute', left: x, top: y, width: (10 + random(`c${i}w`) * 12) * k, height: (18 + random(`c${i}h`) * 20) * k, background: i % 3 ? P.gold : P.rose, opacity: 0.85, borderRadius: 2 * k, transform: `rotate(${a * 240 * (i % 2 ? 1 : -1)}deg) rotateX(${a * 400}deg)`}} />;
        }) : null}
      </AbsoluteFill>
      <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, opacity: p > 0 && p < 1 ? 1 : 0}}><circle cx={w / 2} cy={h / 2} r={Math.max(0, r - 6 * k)} fill="none" stroke={P.gold} strokeWidth={12 * k} /></svg>
    </AbsoluteFill>
  );
};

// =====================================================================================================
// montaje: capas que se solapan; todas las transiciones se calculan aquí
// =====================================================================================================
export const ProximoDrop: React.FC<DropProps> = ({fecha, hora, incentivo, voz}) => {
  const f = useCurrentFrame();
  const {fps, width: w, height: h} = useVideoConfig();
  const t = f / fps;
  const k = Math.min(w, h) / 1080;
  const diag = Math.hypot(w, h);

  // T1 · zoom a través con onda de choque (3,55 – 4,3)
  const p1 = pr(t, K.barrido, 0.75, eInOut);
  // T2 · cinta de satén (7,95 – 8,85) con un tenis que la cruza
  const qc = pr(t, K.cinta, 0.9, eInOut);
  const qcAnt = pr(t - FRAME, K.cinta, 0.9, eInOut);
  const bw = 0.5 * w, xl = lerp(-0.1 * w, w * 1.3 + bw, qc);
  const lead = borde(h, xl, 26 * k, t * 7, 0.22), trail = borde(h, xl - bw, 20 * k, t * 6 + 2, 0.22);
  const clipEstilo = poly([[-60, -30], ...trail, [-60, h + 30]]);
  const banda = [...trail, ...lead.slice().reverse()];
  // T3 · empuje vertical (10,95 – 11,45)
  const pe = pr(t, K.empuje, 0.5, eInOut5);
  // T4 · barrido lateral con desenfoque (13,95 – 14,65)
  const p4 = pr(t, K.ventana, 0.7, eInOut5);
  // T5 · zoom hacia el mosaico (16,9 – 17,4)
  const p5 = pr(t, K.ventanaFin - 0.1, 0.5, eInOut);
  // T6 · barrido líquido (19,1 – 19,7)
  const p6 = pr(t, 19.1, 0.6, eInOut);
  const bordeC = borde(h, lerp(w + 160 * k, -160 * k, p6), 34 * k, t * 6 + 1);
  const clipC = poly([...bordeC, [w + 400, h + 30], [w + 400, -30]]);
  const franjaC = poly([...bordeC.map(([x, y]) => [x - 110 * k, y] as Pt), ...bordeC.slice().reverse()]);

  return (
    <AbsoluteFill style={{background: P.deep}}>
      {/* 1 → 2 */}
      <Capa t={t} de={0} hasta={4.4} style={{transform: `scale(${1 + 0.55 * p1})`, filter: p1 > 0.01 ? `blur(${p1 * 22}px)` : undefined, opacity: 1 - eOut(cl(p1 * 1.15))}}><Hook t={t} /></Capa>
      {t >= K.barrido ? (
        <AbsoluteFill style={{opacity: cl(p1 * 1.7), transform: `scale(${1.3 - 0.3 * p1})`, filter: p1 < 0.99 ? `blur(${(1 - p1) * 16}px)` : undefined}}>
          <Capa t={t} de={K.barrido} hasta={9.1}><Grupos t={t} /></Capa>
        </AbsoluteFill>
      ) : null}
      {t >= K.barrido && t < K.barrido + 1.0 ? (
        <>
          <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0}}><circle cx={w / 2} cy={h / 2} r={p1 * diag * 0.62} fill="none" stroke={P.gold} strokeWidth={(16 * (1 - p1) + 2) * k} opacity={(1 - p1) * 0.9} /><circle cx={w / 2} cy={h / 2} r={p1 * diag * 0.45} fill="none" stroke="#fff" strokeWidth={4 * k} opacity={(1 - p1) * 0.5} /></svg>
          <AbsoluteFill style={{background: '#fff', opacity: Math.max(0, 0.5 - Math.abs(p1 - 0.35) * 2.4)}} />
        </>
      ) : null}
      {/* 2 → 2b: se abre un círculo desde el grupo «Outfit» hacia la calle */}
      {t >= T_CALLE && t < 9.1 ? (() => {
        const pc = pr(t, T_CALLE, 0.62, eInOut5);
        const ox = (w > h ? 0.81 : 0.5) * w, oy = (w > h ? 0.45 : 0.8) * h;
        const rc = pc * Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy)) * 1.02;
        return (
          <>
            <AbsoluteFill style={{clipPath: pc < 1 ? `circle(${rc}px at ${ox}px ${oy}px)` : undefined}}><Calle t={t} /></AbsoluteFill>
            {pc > 0 && pc < 1 ? <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0}}><circle cx={ox} cy={oy} r={rc} fill="none" stroke={P.gold} strokeWidth={14 * k * (1 - pc) + 3 * k} /><circle cx={ox} cy={oy} r={rc * 0.86} fill="none" stroke="#fff" strokeWidth={3 * k} opacity={0.5 * (1 - pc)} /></svg> : null}
          </>
        );
      })() : null}
      {/* 2 → 3: cinta de satén con el New Balance */}
      {t >= K.cinta ? <AbsoluteFill style={{clipPath: qc < 1 ? clipEstilo : undefined, transform: `translateY(${-pe * h}px)`}}><MB sx={0} sy={Math.sin(Math.PI * pe) * 40 * k}><Capa t={t} de={K.cinta} hasta={K.empuje + 0.6}><Estilo t={t} /></Capa></MB></AbsoluteFill> : null}
      {t >= K.cinta && t < K.cinta + 1.0 ? (
        <>
          <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0}}>
            <defs>
              <linearGradient id="satin" gradientUnits="userSpaceOnUse" x1={trail[Math.floor(trail.length / 2)][0]} y1={0} x2={lead[Math.floor(lead.length / 2)][0]} y2={0}>
                <stop offset="0" stopColor="#5a1428" /><stop offset=".35" stopColor="#8e3548" /><stop offset=".5" stopColor="#a9485c" /><stop offset=".65" stopColor="#8e3548" /><stop offset="1" stopColor="#5a1428" />
              </linearGradient>
            </defs>
            <polygon points={banda.map((p) => p.join(',')).join(' ')} fill="url(#satin)" />
            <polyline points={lead.map((p) => p.join(',')).join(' ')} fill="none" stroke={P.gold} strokeWidth={9 * k} strokeLinejoin="round" />
            <polyline points={trail.map((p) => p.join(',')).join(' ')} fill="none" stroke={P.gold} strokeWidth={5 * k} strokeLinejoin="round" />
          </svg>
          <MB sx={Math.abs(lerp(-0.1 * w, w * 1.3 + bw, qc) - lerp(-0.1 * w, w * 1.3 + bw, qcAnt)) * 0.55} sy={0} style={{position: 'absolute', left: xl - 0.12 * w, top: h * 0.5 - (900 * k) / AR['tenis-nb'] / 2 + Math.sin(t * 6) * 8 * k, transform: 'rotate(-10deg)'}}>
            <Prod id="tenis-nb" w={900} style={{filter: 'drop-shadow(0 40px 40px rgba(0,0,0,.45))'}} />
          </MB>
        </>
      ) : null}
      {/* 3 → 4: el texto sube y entra el celular; luego el barrido lateral hacia la escena del carrusel */}
      <Capa t={t} de={K.empuje - 0.05} hasta={15.1} style={{background: P.paper, transform: `translate(${p4 * w}px, ${t < 12 ? (1 - pe) * h : 0}px)`}}>
        <MB sx={Math.sin(Math.PI * p4) * 46 * k} sy={t < 12 ? Math.sin(Math.PI * pe) * 40 * k : 0}><Web t={t} /></MB>
      </Capa>
      {/* 5 → 6 */}
      <Capa t={t} de={K.ventanaFin - 0.3} hasta={19.9} style={{opacity: pr(t, K.ventanaFin - 0.1, 0.45, eInOut), transform: `scale(${0.9 + 0.1 * p5})`, filter: p5 < 0.99 ? `blur(${(1 - p5) * 14}px)` : undefined}}><Piezas t={t} /></Capa>
      <Capa t={t} de={K.ventana} hasta={K.ventanaFin + 0.5} style={{transform: `translateX(${(p4 - 1) * w}px) scale(${1 + 0.25 * p5})`, opacity: 1 - eOut(cl(p5 * 1.7)), filter: p5 > 0.01 ? `blur(${p5 * 16}px)` : undefined}}>
        <MB sx={Math.sin(Math.PI * p4) * 46 * k} sy={0}><Escenario t={t} fecha={fecha} hora={hora} /></MB>
      </Capa>
      {t >= 19.1 && t < 19.9 ? (
        <AbsoluteFill style={{clipPath: franjaC, backgroundColor: 'rgba(210,168,81,.35)', backgroundImage: 'repeating-linear-gradient(60deg, rgba(255,255,255,.4) 0 2px, transparent 2px 22px), repeating-linear-gradient(-60deg, rgba(255,255,255,.3) 0 2px, transparent 2px 22px)', opacity: 1 - cl((t - 19.6) / 0.12)}} />
      ) : null}
      {t >= 19.1 ? <AbsoluteFill style={{clipPath: p6 < 1 ? clipC : undefined}}><Capa t={t} de={19.1} hasta={22.6}><Whatsapp t={t} /></Capa></AbsoluteFill> : null}
      <Capa t={t} de={K.iris} hasta={99}><Final t={t} incentivo={incentivo} /></Capa>
      {/* grano de película y viñeta, sobre todo */}
      <AbsoluteFill style={{backgroundImage: `url(${staticFile('img/grain.png')})`, backgroundSize: `${w}px auto`, backgroundPosition: `${-random('gx' + Math.floor(f / 2)) * 900}px ${-random('gy' + Math.floor(f / 2)) * 900}px`, mixBlendMode: 'overlay', opacity: 0.1, pointerEvents: 'none'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(27,17,20,.28) 100%)', pointerEvents: 'none'}} />
      <Audio src={staticFile(`audio/6-ProximoDrop${voz ? '' : '-sinvoz'}.wav`)} />
    </AbsoluteFill>
  );
};
