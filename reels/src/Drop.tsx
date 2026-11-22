import React from 'react';
import {AbsoluteFill, Audio, Img, random, staticFile, useCurrentFrame, useVideoConfig, continueRender, delayRender} from 'remotion';

// «6-ProximoDrop» · 25,2 s · 60 fps · anuncio SIN fecha del próximo drop de Tiendas Alexa. Sale en 16:9 (1920×1080) y en 9:16 (1080×1920).
//
// Está guiado por la locución real (voz «Cami», ElevenLabs): cada escena y cada animación caen en la palabra que se dice.
// Las fotos son las de las prendas del drop; la marca es la de la tienda (Vino, Dorado, Crema; Cormorant Garamond y Space Grotesk).
// Las transiciones se inspiran en el análisis de un anuncio de referencia: todo se solapa, nada es un corte seco (barrido líquido, cinta de satén, empuje, ventana
// que desliza con desenfoque, mosaico que gira, línea que se endereza, iris circular). No se usó nada de su metraje, personajes, audio ni textos.
// Lo que aún no existe (fecha, hora, incentivo) solo sale si viene en props.json.

export type DropProps = {fecha: string; hora: string; incentivo: string; voz: boolean};
export const dropPorDefecto: DropProps = {fecha: '', hora: '', incentivo: '', voz: true};
export const DROP_FPS = 60;
export const DROP_SEG = 25.2;
export const DROP_FRAMES = Math.round(DROP_FPS * DROP_SEG);

/** Momentos clave en segundos (los de la locución). audio/musica_pop.py y audio/voz.py usan estos mismos tiempos. */
export const K = {
  barrido: 3.55,      // «…de siempre?» → barrido líquido
  tenis: 4.42, bolsos: 5.34, outfit: 6.38, llama: 6.88,
  cinta: 7.95,        // cinta de satén
  estilo: 8.34, complicado: 10.34, tachon: 10.65,
  empuje: 10.95,      // el texto sube y entra el celular
  celular: 11.0, entra: 11.3, web: 12.18, punto: 12.98, clic: 13.4,
  ventana: 13.95, drop: 14.32, pronto: 14.66, disponible: 15.06, pagina: 16.08, ventanaFin: 17.0,
  piezas: 17.26, listas: 17.84, parati: 18.72,
  vueltas: 19.48, pides: 20.48, directo: 20.7, whatsapp: 21.32,
  iris: 21.85, alexa: 23.4,
};

const P = {wine: '#782f3a', wineDark: '#55202a', deep: '#3b1220', night: '#1b1114', paper: '#f7f1e8', ink: '#261a1c', gold: '#d2a851', goldSoft: '#efdcab', cream: '#f7ead7', card: '#fffdf9', tint: '#f0e6d8', line: '#e3d7c7', muted: '#6f6259'};
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

// ---------- tiempo, curvas y tamaño ----------
const cl = (x: number) => Math.min(1, Math.max(0, x));
const eOut = (x: number) => 1 - Math.pow(1 - cl(x), 3);
const eOut5 = (x: number) => 1 - Math.pow(1 - cl(x), 5);
const eInOut = (x: number) => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const eBack = (x: number, s = 1.9) => { x = cl(x); const c3 = s + 1; return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const pr = (t: number, a: number, d: number, e: (x: number) => number = eOut) => e((t - a) / d);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** k: el lado corto del cuadro vale 1080 unidades, en horizontal y en vertical. */
const useD = () => {
  const {width, height} = useVideoConfig();
  return {w: width, h: height, L: width > height, k: Math.min(width, height) / 1080};
};

// ---------- texto ----------
const H: React.FC<{s: number; color?: string; italic?: boolean; weight?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({s, color = P.ink, italic, weight = 600, style, children}) => {
  const {k} = useD();
  return <div style={{fontFamily: SERIF, fontWeight: weight, fontStyle: italic ? 'italic' : 'normal', fontSize: s * k, lineHeight: 1.0, letterSpacing: '-0.012em', color, whiteSpace: 'pre', ...style}}>{children}</div>;
};
const Lab: React.FC<{s: number; color?: string; track?: number; weight?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({s, color = P.ink, track = 0.22, weight = 700, style, children}) => {
  const {k} = useD();
  return <div style={{fontFamily: SANS, fontWeight: weight, fontSize: s * k, lineHeight: 1.1, letterSpacing: `${track}em`, textTransform: 'uppercase', color, whiteSpace: 'pre', ...style}}>{children}</div>;
};
/** Palabra que entra en su segundo exacto: rebote, desenfoque y desplazamiento. */
const Pal: React.FC<{t: number; at: number; dur?: number; dx?: number; dy?: number; blur?: number; rebote?: boolean; style?: React.CSSProperties; children: React.ReactNode}> = ({t, at, dur = 0.5, dx = 0, dy = 50, blur = 12, rebote = true, style, children}) => {
  const {k} = useD();
  const p = pr(t, at, dur, rebote ? eBack : eOut);
  const b = (1 - cl((t - at) / dur)) * blur;
  return <div style={{display: 'inline-block', opacity: cl((t - at) / (dur * 0.45)), transform: `translate(${(1 - p) * dx * k}px, ${(1 - p) * dy * k}px)`, filter: b > 0.3 ? `blur(${b}px)` : undefined, ...style}}>{children}</div>;
};
const Capa: React.FC<{t: number; de: number; hasta: number; children: React.ReactNode; style?: React.CSSProperties}> = ({t, de, hasta, children, style}) =>
  t >= de && t < hasta ? <AbsoluteFill style={style}>{children}</AbsoluteFill> : null;

// ---------- formas (borde ondulado, cinta) ----------
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
const Foto: React.FC<{n: number; style?: React.CSSProperties}> = ({n, style}) => (
  <Img src={staticFile(`img/drop/0${n}.jpg`)} style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style}} />
);

// =====================================================================================================
// 1 · «¿Sigues buscando qué estrenar sin ver lo mismo de siempre?» (0 – 4,2 s)
//     palabras en su segundo; «lo mismo de siempre» = la misma foto repetida; glitch en «siempre»
// =====================================================================================================
type PalT = [string, number, boolean?];
const Hook: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const lineas: PalT[][] = L
    ? [[['¿Sigues', 0.0], ['buscando', 0.44]], [['qué', 0.84], ['estrenar', 1.26, true]], [['sin', 1.88], ['ver', 2.48], ['lo', 2.72], ['mismo', 2.86], ['de', 3.18], ['siempre?', 3.4, true]]]
    : [[['¿Sigues', 0.0], ['buscando', 0.44]], [['qué', 0.84], ['estrenar', 1.26, true]], [['sin', 1.88], ['ver', 2.48], ['lo', 2.72], ['mismo', 2.86]], [['de', 3.18], ['siempre?', 3.4, true]]];
  const cols = L ? 8 : 4, rows = L ? 3 : 6;
  const tw = w / cols, th = h / rows;
  const glitch = t > 3.38 && t < 3.72;
  const gfade = 1 - pr(t, 3.5, 0.3, eInOut);
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 25% 18%, #5e1f30 0%, ${P.deep} 55%, ${P.night} 100%)`}}>
      <AbsoluteFill style={{opacity: gfade}}>
        {Array.from({length: cols * rows}).map((_, i) => {
          const c = i % cols, r = Math.floor(i / cols);
          const at = 2.3 + 0.035 * i;
          const jx = glitch ? (random(`gx${i}${Math.floor(t * 30)}`) - 0.5) * 40 * k : 0;
          const jy = glitch ? (random(`gy${i}${Math.floor(t * 30)}`) - 0.5) * 20 * k : 0;
          return (
            <div key={i} style={{position: 'absolute', left: c * tw + jx + ((t - 2.3) * 24 * k) * (r % 2 ? 1 : -1), top: r * th + jy, width: tw - 10 * k, height: th - 10 * k, borderRadius: 14 * k, overflow: 'hidden',
              opacity: cl((t - at) / 0.25) * 0.34, filter: `grayscale(1) brightness(.75) ${glitch ? 'contrast(1.6)' : ''}`}}>
              <Foto n={1} />
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(27,17,20,.72) 0%, rgba(27,17,20,.25) 100%)'}} />
      <AbsoluteFill style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', paddingLeft: (L ? 150 : 80) * k, gap: (L ? 6 : 4) * k}}>
        {lineas.map((ln, i) => (
          <div key={i} style={{display: 'flex', gap: 0.26 * (L ? 164 : 140) * k, alignItems: 'baseline'}}>
            {ln.map(([txt, at, acento], j) => (
              <Pal key={j} t={t} at={at} dur={0.5} dy={46} blur={12}>
                <H s={L ? 164 : 140} color={acento ? P.gold : P.cream} italic={!!acento} weight={acento ? 500 : 600}>{txt}</H>
              </Pal>
            ))}
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 2 · «Tenis, bolsos o ese outfit que llama la atención.» (3,6 – 8,9 s): una foto por palabra
// =====================================================================================================
const Tarjetas: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const cw = (L ? 400 : 560) * k, ch = (L ? 540 : 420) * k;
  const defs = [
    {n: 3, at: K.tenis, etiqueta: 'Tenis', cx: L ? 0.25 : 0.36, cy: L ? 0.5 : 0.23, rot: -7, ox: -900, oy: 500},
    {n: 5, at: K.bolsos, etiqueta: 'Bolsos', cx: L ? 0.5 : 0.64, cy: L ? 0.5 : 0.5, rot: 3, ox: 0, oy: 900},
    {n: 4, at: K.outfit, etiqueta: 'Outfit', cx: L ? 0.75 : 0.38, cy: L ? 0.5 : 0.77, rot: 7, ox: 900, oy: 500},
  ];
  const spot = pr(t, K.llama, 0.5, eOut);
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <div style={{position: 'absolute', left: -0.1 * w, top: -0.2 * h, width: 0.6 * w, height: 0.6 * w, borderRadius: '50%', background: 'radial-gradient(circle, rgba(246,211,218,.7) 0%, rgba(246,211,218,0) 70%)'}} />
      <div style={{position: 'absolute', right: -0.15 * w, bottom: -0.25 * h, width: 0.7 * w, height: 0.7 * w, borderRadius: '50%', background: 'radial-gradient(circle, rgba(210,168,81,.22) 0%, rgba(210,168,81,0) 70%)'}} />
      {defs.map((d, i) => {
        const p = pr(t, d.at, 0.65, (x) => eBack(x, 1.35));
        const flota = Math.sin(t * 1.8 + i * 1.7) * 8 * k;
        const esOutfit = i === 2;
        const esc = (0.72 + 0.28 * p) * (esOutfit ? 1 + 0.07 * spot : 1);
        return t < d.at ? null : (
          <div key={i}>
            {esOutfit ? (
              <div style={{position: 'absolute', left: d.cx * w - cw * 0.95, top: d.cy * h - ch * 0.8, width: cw * 1.9, height: ch * 1.6, borderRadius: '50%', opacity: spot, background: `radial-gradient(circle, rgba(210,168,81,.55) 0%, rgba(210,168,81,0) 65%)`}} />
            ) : null}
            <div style={{position: 'absolute', left: d.cx * w - cw / 2 + (1 - p) * d.ox * k, top: d.cy * h - ch / 2 + (1 - p) * d.oy * k + flota, width: cw, height: ch, borderRadius: 34 * k, overflow: 'hidden', background: '#fff', border: `${9 * k}px solid #fff`,
              boxShadow: `0 ${34 * k}px ${70 * k}px rgba(85,32,42,${0.28 + 0.1 * (esOutfit ? spot : 0)})`, transform: `rotate(${d.rot + (1 - p) * (d.rot < 0 ? -26 : 26)}deg) scale(${esc})`,
              filter: `blur(${(1 - cl((t - d.at) / 0.4)) * 12}px)`, opacity: cl((t - d.at) / 0.12)}}>
              <Foto n={d.n} style={{transform: `scale(${1.04 + (t - d.at) * 0.025})`}} />
            </div>
            <div style={{position: 'absolute', left: d.cx * w, top: d.cy * h + ch / 2 + 26 * k + flota, transform: 'translateX(-50%)'}}>
              <Pal t={t} at={d.at + 0.18} dur={0.4} dy={30} blur={6}>
                <div style={{background: P.wine, borderRadius: 99, padding: `${12 * k}px ${34 * k}px`, boxShadow: `0 ${10 * k}px ${24 * k}px rgba(85,32,42,.3)`}}><Lab s={26} color={P.cream}>{d.etiqueta}</Lab></div>
              </Pal>
            </div>
          </div>
        );
      })}
      {/* destellos en «llama la atención» */}
      {Array.from({length: 9}).map((_, i) => {
        const a = (i / 9) * Math.PI * 2 + 0.4;
        const rr = (0.34 + 0.12 * random(`e${i}`)) * (L ? h : w) * 0.9;
        const q = cl((t - K.llama - i * 0.045) / 0.9);
        if (q <= 0 || q >= 1) return null;
        const cxs = (L ? 0.75 : 0.38) * w, cys = (L ? 0.5 : 0.77) * h;
        return <div key={i} style={{position: 'absolute', left: cxs + Math.cos(a) * rr * (0.5 + 0.6 * q) - 14 * k, top: cys + Math.sin(a) * rr * (0.5 + 0.6 * q) - 14 * k, opacity: Math.sin(q * Math.PI), transform: `scale(${0.4 + q}) rotate(${q * 90}deg)`}}><Estrella s={28 * k} /></div>;
      })}
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 3 · «Encontrar tu estilo no debería ser complicado.» (8 – 11,5 s): «complicado» se tacha con una línea dorada
// =====================================================================================================
const Estilo: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const s = L ? 168 : 140;
  const lineas: PalT[][] = L
    ? [[['Encontrar', 8.34], ['tu', 8.78], ['estilo', 8.9, true]], [['no', 9.28], ['debería', 9.72], ['ser', 10.16], ['complicado.', 10.34]]]
    : [[['Encontrar', 8.34]], [['tu', 8.78], ['estilo', 8.9, true]], [['no', 9.28], ['debería', 9.72]], [['ser', 10.16], ['complicado.', 10.34]]];
  const tacha = pr(t, K.tachon, 0.32, eInOut);
  const apaga = pr(t, K.tachon + 0.15, 0.4, eOut);
  return (
    <AbsoluteFill style={{background: P.deep}}>
      <Img src={staticFile('img/hero.webp')} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(16px) saturate(.8)', transform: `scale(${1.15 + (t - 8) * 0.03})`}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(59,18,32,.88) 0%, rgba(27,17,20,.9) 100%)'}} />
      <AbsoluteFill style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: L ? 'flex-start' : 'center', paddingLeft: (L ? 150 : 0) * k, gap: 12 * k}}>
        {lineas.map((ln, i) => (
          <div key={i} style={{display: 'flex', gap: 0.26 * s * k, alignItems: 'baseline'}}>
            {ln.map(([txt, at, acento], j) => {
              const esC = txt === 'complicado.';
              return (
                <Pal key={j} t={t} at={at} dur={0.55} dy={50}>
                  <div style={{position: 'relative', opacity: esC ? 1 - 0.62 * apaga : 1}}>
                    <H s={acento ? s * 1.22 : s} color={acento ? P.gold : P.cream} italic={!!acento} weight={acento ? 500 : 600}>{txt}</H>
                    {esC ? <div style={{position: 'absolute', left: -8 * k, top: '56%', height: 7 * k, width: `calc(${tacha * 100}% + ${16 * k}px)`, background: P.gold, borderRadius: 9 * k, boxShadow: `0 0 ${20 * k}px rgba(210,168,81,.8)`}} /> : null}
                  </div>
                </Pal>
              );
            })}
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 4 · «Sólo entra a AlexaShop.cc.» (11 – 14,5 s): sube el celular con la web real y la dirección se escribe con la voz
// =====================================================================================================
const Celular: React.FC<{x: number; y: number; scrollA: number; scrollB: number; mezcla: number; rot?: number}> = ({x, y, scrollA, scrollB, mezcla, rot = 0}) => {
  const {k, L} = useD();
  const pw = (L ? 400 : 520) * k, ph = pw * (1688 / 780), r = pw / 780;
  return (
    <div style={{position: 'absolute', left: x - pw / 2 - 14 * k, top: y, width: pw + 28 * k, height: ph + 28 * k, borderRadius: 70 * k, background: '#0c0708', padding: 14 * k, transform: `rotate(${rot}deg)`, boxShadow: `0 ${40 * k}px ${80 * k}px rgba(27,17,20,.32)`}}>
      <div style={{position: 'relative', width: pw, height: ph, borderRadius: 58 * k, overflow: 'hidden', background: '#fff'}}>
        <Img src={staticFile('img/inicio-larga.webp')} style={{position: 'absolute', left: 0, top: -scrollA * r, width: pw, height: 'auto', opacity: 1 - mezcla}} />
        <Img src={staticFile('img/catalogo-larga.webp')} style={{position: 'absolute', left: 0, top: -scrollB * r, width: pw, height: 'auto', opacity: mezcla}} />
        <div style={{position: 'absolute', left: '50%', top: 12 * k, width: 120 * k, height: 34 * k, marginLeft: -60 * k, borderRadius: 40 * k, background: '#0c0708'}} />
      </div>
    </div>
  );
};
const Web: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const pw = (L ? 400 : 520) * k, ph = pw * (1688 / 780);
  const sube = pr(t, K.celular, 0.75, (x) => eBack(x, 1.2));
  const yFinal = L ? 0.5 * h - (ph + 28 * k) / 2 : 0.42 * h;
  const x = L ? 0.27 * w : w / 2;
  const n = t < K.punto ? Math.floor(cl((t - K.web) / 0.78) * 9) : 9 + Math.floor(cl((t - K.punto) / 0.3) * 3.01);
  const url = 'alexashop.cc'.slice(0, t < K.web ? 0 : n);
  const listo = t >= K.punto + 0.3;
  const clic = pr(t, K.clic, 0.5, eBack);
  const scrollA = lerp(0, 700, pr(t, 11.7, 1.6, eInOut));
  const mezcla = pr(t, 13.0, 0.5, eInOut);
  const scrollB = lerp(0, 1300, pr(t, 13.2, 1.2, eInOut));
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <div style={{position: 'absolute', right: -0.1 * w, top: -0.2 * h, width: 0.6 * w, height: 0.6 * w, borderRadius: '50%', background: 'radial-gradient(circle, rgba(246,211,218,.7) 0%, rgba(246,211,218,0) 70%)'}} />
      <div style={{position: 'absolute', left: L ? 0.5 * w : 0, right: 0, top: L ? 0 : 0.1 * h, bottom: L ? 0 : 0.6 * h, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: L ? 'flex-start' : 'center', gap: 26 * k}}>
        <div style={{display: 'flex', gap: 0.24 * 120 * k, alignItems: 'baseline'}}>
          <Pal t={t} at={11.3} dy={46}><H s={L ? 150 : 130} color={P.ink}>Sólo</H></Pal>
          <Pal t={t} at={11.62} dy={46}><H s={L ? 150 : 130} color={P.ink}>entra</H></Pal>
          <Pal t={t} at={11.9} dy={46}><H s={L ? 150 : 130} color={P.ink} italic weight={500}>a</H></Pal>
        </div>
        {t >= K.web - 0.05 ? (
          <div style={{position: 'relative'}}>
            {[0, 1, 2].map((r) => {
              const q = cl((t - K.clic - r * 0.1) / 0.6);
              return q > 0 && q < 1 ? <div key={r} style={{position: 'absolute', left: '50%', top: '50%', width: (460 + q * 360) * k, height: (130 + q * 220) * k, transform: 'translate(-50%,-50%)', borderRadius: 99, border: `${5 * k}px solid ${P.gold}`, opacity: (1 - q) * 0.7}} /> : null;
            })}
            <div style={{background: P.wine, borderRadius: 99, padding: `${26 * k}px ${64 * k}px`, boxShadow: `0 ${24 * k}px ${54 * k}px rgba(120,47,58,.4)`, transform: `scale(${(0.7 + 0.3 * pr(t, K.web - 0.05, 0.35, eBack)) * (1 + 0.06 * Math.sin(clic * Math.PI))})`, display: 'flex', alignItems: 'center', minWidth: 620 * k, justifyContent: 'center'}}>
              <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 96 * k, color: '#fff', letterSpacing: '-0.01em', whiteSpace: 'pre'}}>{url}<span style={{color: P.gold, opacity: !listo && Math.floor(t * 5) % 2 === 0 ? 1 : 0}}>|</span></div>
            </div>
          </div>
        ) : null}
      </div>
      <Celular x={x} y={lerp(h + 40 * k, yFinal, sube)} scrollA={scrollA} scrollB={scrollB} mezcla={mezcla} />
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 5 · «El nuevo drop pronto estará disponible en nuestra página web.» (13,9 – 17,4 s): ventana con las prendas en movimiento
// =====================================================================================================
const Drop: React.FC<{t: number; fecha: string; hora: string}> = ({t, fecha, hora}) => {
  const {w, h, L, k} = useD();
  const p = pr(t, K.ventana, 0.7, eOut5);
  const sale = pr(t, K.ventanaFin, 0.4, eInOut);
  const vw = (L ? 1620 : 960) * k, vh = (L ? 900 : 1240) * k;
  const cols = L ? 4 : 2;
  const cwid = (vw - 20 * k * (cols + 1)) / cols;
  const orden = [[1, 3, 5, 7], [2, 4, 6, 1], [3, 5, 7, 2], [6, 2, 4, 1]];
  const pulso = pr(t, K.pronto, 0.55, (x) => eBack(x, 2.4));
  const temblor = t > K.pronto + 0.3 && t < K.pronto + 0.7 ? Math.sin((t - K.pronto) * 90) * 3 * k : 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: P.deep, opacity: pr(t, K.ventana, 0.6) * (1 - pr(t, K.ventanaFin - 0.1, 0.45, eInOut))}} />
      <div style={{position: 'absolute', opacity: 1 - sale, left: w / 2 - vw / 2 - (1 - p) * w * 0.9, top: h / 2 - vh / 2, width: vw, height: vh, borderRadius: 64 * k, overflow: 'hidden', background: P.night, border: `${10 * k}px solid ${P.cream}`,
        boxShadow: `0 ${30 * k}px ${80 * k}px rgba(27,17,20,.4)`, filter: `blur(${(1 - p) * 18 + sale * 10}px)`, transform: `scale(${1 + sale * 0.05})`}}>
        <div style={{position: 'absolute', inset: 0, display: 'flex', gap: 20 * k, padding: `0 ${20 * k}px`, transform: `rotate(-4deg) scale(1.12)`}}>
          {Array.from({length: cols}).map((_, c) => {
            const lista = orden[c % 4];
            const alto = cwid * 1.3;
            const v = (c % 2 ? -1 : 1) * 46 * k * (t - K.ventana);
            return (
              <div key={c} style={{width: cwid, display: 'flex', flexDirection: 'column', gap: 20 * k, transform: `translateY(${(c % 2 ? -alto * 0.5 : 0) + v}px)`}}>
                {[...lista, ...lista].map((n, i) => <div key={i} style={{width: cwid, height: alto, borderRadius: 26 * k, overflow: 'hidden', flexShrink: 0}}><Foto n={n} /></div>)}
              </div>
            );
          })}
        </div>
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(27,17,20,.1) 0%, rgba(27,17,20,.35) 45%, rgba(27,17,20,.88) 100%)'}} />
        {/* sello «PRONTO» */}
        <div style={{position: 'absolute', right: (L ? 90 : 60) * k, top: (L ? 80 : 90) * k, opacity: cl((t - K.pronto) / 0.1), transform: `rotate(${-9 + temblor}deg) scale(${0.4 + 0.6 * pulso + (t < K.pronto + 0.12 ? 1.3 * (1 - cl((t - K.pronto) / 0.12)) : 0)})`}}>
          <div style={{border: `${6 * k}px solid ${P.gold}`, borderRadius: 18 * k, padding: `${14 * k}px ${40 * k}px`, background: 'rgba(27,17,20,.55)'}}>
            <Lab s={fecha ? 44 : 62} color={P.gold} track={0.28}>{fecha ? `Llega el ${fecha}` : 'Pronto'}</Lab>
            {fecha && hora ? <Lab s={30} color={P.cream} style={{marginTop: 6 * k}}>{hora}</Lab> : null}
          </div>
        </div>
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: `0 ${(L ? 90 : 60) * k}px ${(L ? 64 : 80) * k}px`, gap: 6 * k}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 28 * k}}>
            <Pal t={t} at={14.04} dur={0.5} dy={50} dx={-40}><H s={L ? 140 : 120} color={P.cream}>El nuevo</H></Pal>
            <Pal t={t} at={K.drop} dur={0.6} dy={70} dx={-60}><H s={L ? 290 : 230} color={P.gold} italic weight={500}>drop</H></Pal>
          </div>
          <Pal t={t} at={K.disponible} dur={0.5} dy={30} blur={8}><Lab s={L ? 34 : 30} color={P.cream} track={0.3}>Estará disponible</Lab></Pal>
          <Pal t={t} at={K.pagina} dur={0.5} dy={30} blur={8}>
            <div style={{display: 'flex', alignItems: 'center', gap: 16 * k}}>
              <svg viewBox="0 0 24 24" width={38 * k} height={38 * k} fill="none" stroke={P.gold} strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="3" /><path d="M2 9 H22" /><circle cx="5.5" cy="6.5" r=".6" fill={P.gold} /></svg>
              <Lab s={L ? 34 : 30} color={P.gold} track={0.3}>En nuestra página web</Lab>
            </div>
          </Pal>
        </AbsoluteFill>
      </div>
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 6 · «Piezas nuevas listas para ti.» (17 – 19,9 s): mosaico que gira, palomitas, corazón en «ti»
// =====================================================================================================
const Piezas: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const cols = L ? 3 : 2, rows = 2 + (L ? 0 : 1);
  const tw = (L ? 292 : 440) * k, th = (L ? 380 : 340) * k, gap = 22 * k;
  const gw = cols * tw + (cols - 1) * gap, gh = rows * th + (rows - 1) * gap;
  const gx = L ? w - gw - 90 * k : w / 2 - gw / 2;
  const gy = L ? h / 2 - gh / 2 : h - gh - 0.08 * h;
  const fotos = [1, 2, 3, 4, 5, 6];
  const latido = Math.sin(cl((t - K.parati) / 0.5) * Math.PI);
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <div style={{position: 'absolute', left: -0.1 * w, bottom: -0.3 * h, width: 0.7 * w, height: 0.7 * w, borderRadius: '50%', background: 'radial-gradient(circle, rgba(246,211,218,.7) 0%, rgba(246,211,218,0) 70%)'}} />
      <div style={{position: 'absolute', left: L ? 150 * k : 0, right: L ? 0.52 * w : 0, top: L ? 0 : 0.07 * h, bottom: L ? 0 : undefined, display: 'flex', flexDirection: 'column', justifyContent: L ? 'center' : 'flex-start', alignItems: L ? 'flex-start' : 'center', gap: 2 * k}}>
        <div style={{display: 'flex', gap: 0.24 * 120 * k, alignItems: 'baseline'}}>
          <Pal t={t} at={K.piezas} dy={50}><H s={L ? 124 : 124}>Piezas</H></Pal>
          <Pal t={t} at={17.58} dy={50}><H s={L ? 124 : 124} color={P.wine}>nuevas</H></Pal>
        </div>
        <div style={{display: 'flex', flexDirection: L ? 'column' : 'row', gap: L ? 0 : 0.24 * 120 * k, alignItems: L ? 'flex-start' : 'baseline'}}>
          <Pal t={t} at={K.listas} dy={50}><H s={L ? 124 : 124}>listas</H></Pal>
          <Pal t={t} at={K.parati} dy={60} blur={14}>
            <div style={{position: 'relative'}}>
              <H s={L ? 170 : 140} color={P.gold} italic weight={500}>para ti</H>
              {t > K.parati ? (
                <div style={{position: 'absolute', left: '50%', top: '50%'}}>
                  {Array.from({length: 8}).map((_, i) => {
                    const a = (i / 8) * Math.PI * 2; const q = cl((t - K.parati - 0.05) / 0.8);
                    return q > 0 && q < 1 ? <div key={i} style={{position: 'absolute', left: Math.cos(a) * 190 * q * k - 12 * k, top: Math.sin(a) * 120 * q * k - 12 * k, opacity: Math.sin(q * Math.PI), transform: `scale(${0.5 + q * 0.8})`}}><Corazon s={26 * k} c={i % 2 ? P.wine : P.gold} /></div> : null;
                  })}
                </div>
              ) : null}
            </div>
          </Pal>
        </div>
      </div>
      {fotos.slice(0, cols * rows).map((n, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const at = K.piezas + 0.14 * i;
        const gira = pr(t, at, 0.55, (x) => eBack(x, 1.2));
        const chk = pr(t, K.listas + 0.12 * i, 0.4, (x) => eBack(x, 2.2));
        return t < at ? null : (
          <div key={i} style={{position: 'absolute', left: gx + c * (tw + gap), top: gy + r * (th + gap), width: tw, height: th, perspective: 900 * k}}>
            <div style={{width: '100%', height: '100%', borderRadius: 26 * k, overflow: 'hidden', border: `${7 * k}px solid #fff`, background: '#fff', boxShadow: `0 ${22 * k}px ${46 * k}px rgba(85,32,42,.25)`,
              transform: `rotateY(${(1 - gira) * -90}deg) scale(${1 + 0.035 * latido})`, opacity: cl((t - at) / 0.15)}}>
              <Foto n={n} />
              <div style={{position: 'absolute', left: 12 * k, top: 12 * k, background: P.gold, borderRadius: 99, padding: `${6 * k}px ${16 * k}px`}}><Lab s={18} color={P.night} track={0.18}>Nuevo</Lab></div>
            </div>
            {t >= K.listas + 0.12 * i ? (
              <div style={{position: 'absolute', right: -10 * k, bottom: -10 * k, width: 54 * k, height: 54 * k, borderRadius: '50%', background: P.wine, border: `${4 * k}px solid #fff`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${chk})`}}>
                <svg viewBox="0 0 24 24" width={28 * k} height={28 * k} fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 L10 17.5 L19 7" /></svg>
              </div>
            ) : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 7 · «Sin vueltas, pides directo por WhatsApp.» (19,1 – 22,4 s): la línea con vueltas se endereza y llega al chat
// =====================================================================================================
const Whatsapp: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const dibuja = pr(t, 19.6, 0.8, eInOut);
  const endereza = pr(t, K.directo - 0.15, 0.55, eInOut);
  const largo = (L ? 0.84 : 0.8) * w;
  const x0 = L ? 0.08 * w : 0.1 * w;
  const y0 = L ? 0.73 * h : 0.55 * h;
  const amp = lerp(1, 0, endereza);
  const pts: string[] = [];
  const n = 120;
  for (let i = 0; i <= Math.floor(n * dibuja); i++) {
    const s = i / n;
    const x = x0 + s * largo + Math.sin(s * Math.PI * 9) * 64 * k * amp;
    const y = y0 + Math.cos(s * Math.PI * 9) * 64 * k * amp - 64 * k * amp;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const chatP = pr(t, 20.3, 0.55, (x) => eBack(x, 1.4));
  const texto = 'Hola Alexa, quiero ver el nuevo drop';
  const escrito = texto.slice(0, Math.floor(Math.max(0, t - 20.6) / 0.02));
  const envia = pr(t, K.whatsapp, 0.45, (x) => eBack(x, 2));
  const cw = (L ? 640 : 900) * k;
  return (
    <AbsoluteFill style={{background: '#fff'}}>
      <div style={{position: 'absolute', left: L ? 150 * k : 0, right: L ? 0.5 * w : 0, top: L ? 0.14 * h : 0.07 * h, display: 'flex', flexDirection: 'column', alignItems: L ? 'flex-start' : 'center', gap: 4 * k}}>
        <div style={{display: 'flex', gap: 0.24 * 130 * k, alignItems: 'baseline'}}>
          <Pal t={t} at={K.vueltas} dy={50}><H s={L ? 170 : 134}>Sin</H></Pal>
          <Pal t={t} at={19.68} dy={50}><H s={L ? 170 : 134} color={P.wine}>vueltas,</H></Pal>
        </div>
        <div style={{display: 'flex', gap: 0.22 * 100 * k, alignItems: 'baseline', marginTop: 10 * k}}>
          <Pal t={t} at={K.pides} dy={36}><H s={L ? 120 : 100} color={P.muted} weight={500}>pides</H></Pal>
          <Pal t={t} at={K.directo} dy={36}><H s={L ? 136 : 112} color={P.gold} italic weight={500}>directo</H></Pal>
        </div>
      </div>
      <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <polyline points={pts.join(' ')} fill="none" stroke={P.wine} strokeWidth={8 * k} strokeLinecap="round" strokeLinejoin="round" />
        {endereza > 0.9 ? <path d={`M ${x0 + largo - 30 * k} ${y0 - 22 * k} L ${x0 + largo + 6 * k} ${y0} L ${x0 + largo - 30 * k} ${y0 + 22 * k}`} fill="none" stroke={P.wine} strokeWidth={8 * k} strokeLinecap="round" strokeLinejoin="round" /> : null}
      </svg>
      <div style={{position: 'absolute', left: L ? 0.52 * w : w / 2 - cw / 2, top: L ? 0.22 * h : 0.66 * h - 0.0 * h, width: cw, transform: `scale(${0.6 + 0.4 * chatP})`, opacity: Math.min(1, chatP * 1.5), transformOrigin: 'left center'}}>
        <div style={{background: P.card, borderRadius: 40 * k, border: `${5 * k}px solid ${P.wine}`, padding: `${30 * k}px ${34 * k}px`, boxShadow: `0 ${30 * k}px ${70 * k}px rgba(85,32,42,.22)`}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 18 * k, marginBottom: 22 * k}}>
            <div style={{width: 76 * k, height: 76 * k, borderRadius: '50%', background: P.deep, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Img src={staticFile('img/logo-mark.svg')} style={{height: 52 * k, width: 'auto'}} /></div>
            <div><H s={38} color={P.ink}>Tiendas Alexa</H><Lab s={16} color={P.muted} track={0.18} weight={400} style={{marginTop: 4 * k}}>WhatsApp</Lab></div>
          </div>
          <div style={{minHeight: 120 * k, display: 'flex', justifyContent: 'flex-end'}}>
            {escrito ? <div style={{background: P.wine, color: '#fff', borderRadius: `${28 * k}px ${28 * k}px ${6 * k}px ${28 * k}px`, padding: `${20 * k}px ${26 * k}px`, fontFamily: SANS, fontSize: 30 * k, lineHeight: 1.35, maxWidth: '86%', transform: `translateY(${-envia * 8 * k}px)`}}>{escrito}<span style={{color: P.gold, opacity: envia < 0.1 ? 1 : 0}}>|</span></div> : null}
          </div>
          <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: 14 * k, alignItems: 'center', gap: 12 * k}}>
            {t > K.whatsapp ? <Lab s={18} color={P.muted} weight={400} track={0.12}>✓✓ Enviado</Lab> : null}
            <div style={{width: 78 * k, height: 78 * k, borderRadius: '50%', background: P.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 + 0.18 * Math.sin(envia * Math.PI)})`}}>
              <svg viewBox="0 0 24 24" width={36 * k} height={36 * k} fill={P.night}><path d="M3 20 L21 12 L3 4 L3 10 L15 12 L3 14 Z" /></svg>
            </div>
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', left: L ? 150 * k : 0, right: L ? 0.5 * w : 0, bottom: L ? 0.08 * h : 0.08 * h, display: 'flex', justifyContent: L ? 'flex-start' : 'center'}}>
        <Pal t={t} at={K.whatsapp - 0.08} dur={0.5} dy={40}>
          <div style={{display: 'flex', alignItems: 'center', gap: 22 * k}}>
            <svg viewBox="0 0 24 24" width={76 * k} height={76 * k}><circle cx="12" cy="12" r="12" fill={P.wine} /><path d="M12 4.2a7.8 7.8 0 0 0-6.7 11.8L4.2 19.8l3.9-1a7.8 7.8 0 1 0 3.9-14.6z" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /><path d="M9.2 8.6c.2-.4.5-.4.7-.4h.3c.2 0 .3.1.4.3l.6 1.4c.1.2 0 .3-.1.5l-.4.5c-.1.1-.1.2 0 .3.5.8 1.1 1.4 1.9 1.8.2.1.3.1.4 0l.5-.6c.1-.2.3-.2.5-.1l1.4.7c.2.1.3.2.2.4-.1.6-.6 1.2-1.3 1.3-.5.1-1.2 0-2.3-.5-1.7-.8-2.9-2.1-3.5-3.3-.4-.8-.3-1.5.1-2z" fill="#fff" /></svg>
            <H s={L ? 96 : 88} color={P.wine}>WhatsApp</H>
          </div>
        </Pal>
      </div>
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 8 · «Sólo entra y elige Alexa.» (21,8 – 25,2 s): iris circular y la marca; el tacón cae como un punto
// =====================================================================================================
const Final: React.FC<{t: number; incentivo: string}> = ({t, incentivo}) => {
  const {w, h, L, k} = useD();
  const p = pr(t, K.iris, 0.6, eInOut);
  const r = p * (Math.hypot(w, h) / 2 + 40);
  const caeAt = 23.85;
  const q = t - caeAt;
  const cae = q < 0 ? 0 : 1 - Math.exp(-q * 7) * Math.cos(q * 20);
  const letras = 'Alexa'.split('');
  return (
    <AbsoluteFill style={{clipPath: `circle(${r}px at 50% 50%)`}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 38%, #5e1f30 0%, ${P.deep} 50%, ${P.night} 100%)`}}>
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 4 * k}}>
          <div style={{display: 'flex', gap: 22 * k, alignItems: 'baseline', marginBottom: 6 * k}}>
            <Pal t={t} at={22.04} dur={0.5} dy={30} blur={8}><H s={L ? 76 : 72} color={P.goldSoft} italic weight={500}>Sólo</H></Pal>
            <Pal t={t} at={22.34} dur={0.5} dy={30} blur={8}><H s={L ? 76 : 72} color={P.cream} weight={500}>entra</H></Pal>
            <Pal t={t} at={22.7} dur={0.5} dy={30} blur={8}><H s={L ? 76 : 72} color={P.cream} weight={500}>y</H></Pal>
            <Pal t={t} at={23.02} dur={0.5} dy={30} blur={8}><H s={L ? 76 : 72} color={P.gold} italic weight={500}>elige</H></Pal>
          </div>
          <div style={{position: 'relative', height: 170 * k, width: 200 * k, display: 'flex', justifyContent: 'center'}}>
            {q > 0 ? <div style={{position: 'absolute', left: '50%', bottom: 4 * k, width: 260 * k * (0.4 + q * 2.4), height: 260 * k * (0.4 + q * 2.4) * 0.3, marginLeft: -130 * k * (0.4 + q * 2.4), borderRadius: '50%', border: `${4 * k}px solid ${P.gold}`, opacity: Math.max(0, 0.7 - q * 1.4)}} /> : null}
            <Img src={staticFile('img/logo-mark.svg')} style={{height: 170 * k, width: 'auto', transform: `translateY(${lerp(-420 * k, 0, cae)}px)`, opacity: q < -0.25 ? 0 : 1}} />
          </div>
          <div style={{display: 'flex'}}>
            {letras.map((l, i) => {
              const a = K.alexa + i * 0.08;
              const pp = pr(t, a, 0.55, eBack);
              const b = (1 - cl((t - a) / 0.45)) * 10;
              return <span key={i} style={{display: 'inline-block', fontFamily: SERIF, fontWeight: 500, fontSize: (L ? 300 : 260) * k, color: P.cream, letterSpacing: '.04em', lineHeight: 0.95, opacity: cl((t - a) / 0.2), transform: `translateY(${(1 - pp) * 80 * k}px)`, filter: b > 0.3 ? `blur(${b}px)` : undefined}}>{l}</span>;
            })}
          </div>
          <Pal t={t} at={24.15} dur={0.5} dy={20} blur={6} rebote={false}><Lab s={L ? 26 : 24} color={P.goldSoft} track={0.34} weight={400}>Detalles &amp; Obsequios</Lab></Pal>
          {incentivo ? <Pal t={t} at={24.3} dur={0.5} dy={20}><Lab s={26} color={P.cream} weight={400} style={{marginTop: 12 * k}}>{incentivo}</Lab></Pal> : null}
          <div style={{height: 22 * k}} />
          <Pal t={t} at={24.4} dur={0.5} dy={20} blur={6} rebote={false}><Lab s={L ? 30 : 28} color={P.cream} track={0.2}>alexashop.cc · Choluteca</Lab></Pal>
        </AbsoluteFill>
      </AbsoluteFill>
      <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, opacity: p > 0 && p < 1 ? 1 : 0}}><circle cx={w / 2} cy={h / 2} r={Math.max(0, r - 6 * k)} fill="none" stroke={P.gold} strokeWidth={12 * k} /></svg>
    </AbsoluteFill>
  );
};

// =====================================================================================================
// montaje: capas que se solapan
// =====================================================================================================
export const ProximoDrop: React.FC<DropProps> = ({fecha, hora, incentivo, voz}) => {
  const f = useCurrentFrame();
  const {fps, width: w, height: h} = useVideoConfig();
  const t = f / fps;
  const k = Math.min(w, h) / 1080;

  // barrido líquido (3,55 – 4,15): la escena de las fotos aparece a la derecha del borde ondulado
  const pb = pr(t, K.barrido, 0.6, eInOut);
  const bordeB = borde(h, lerp(w + 160 * k, -160 * k, pb), 34 * k, t * 6);
  const clipB = poly([...bordeB, [w + 400, h + 30], [w + 400, -30]]);
  const franja = poly([...bordeB.map(([x, y]) => [x - 110 * k, y] as Pt), ...bordeB.slice().reverse()]);

  // cinta de satén (7,95 – 8,85)
  const qc = pr(t, K.cinta, 0.9, eInOut);
  const bw = 0.5 * w, xl = lerp(-0.1 * w, w * 1.3 + bw, qc);
  const lead = borde(h, xl, 26 * k, t * 7, 0.22), trail = borde(h, xl - bw, 20 * k, t * 6 + 2, 0.22);
  const clipEstilo = poly([[-60, -30], ...trail, [-60, h + 30]]);
  const banda = [...trail, ...lead.slice().reverse()];

  // empuje: «Estilo» sube y entra el celular (10,95 – 11,45)
  const pe = pr(t, K.empuje, 0.5, eInOut);

  // barrido líquido 2 (19,1 – 19,7): entra «Sin vueltas»
  const p2 = pr(t, 19.1, 0.6, eInOut);
  const bordeC = borde(h, lerp(w + 160 * k, -160 * k, p2), 34 * k, t * 6 + 1);
  const clipC = poly([...bordeC, [w + 400, h + 30], [w + 400, -30]]);
  const franjaC = poly([...bordeC.map(([x, y]) => [x - 110 * k, y] as Pt), ...bordeC.slice().reverse()]);

  const fran = (clip: string, op: number) => (
    <AbsoluteFill style={{clipPath: clip, backgroundColor: 'rgba(255,255,255,.34)', backgroundImage: 'repeating-linear-gradient(60deg, rgba(255,255,255,.35) 0 2px, transparent 2px 22px), repeating-linear-gradient(-60deg, rgba(255,255,255,.28) 0 2px, transparent 2px 22px)', opacity: op}} />
  );

  return (
    <AbsoluteFill style={{background: P.deep}}>
      <Capa t={t} de={0} hasta={4.3}><Hook t={t} /></Capa>
      {t >= K.barrido && t < 4.3 ? fran(franja, 1 - cl((t - 4.05) / 0.12)) : null}
      {t >= K.barrido ? <AbsoluteFill style={{clipPath: pb < 1 ? clipB : undefined}}><Capa t={t} de={K.barrido} hasta={9.0}><Tarjetas t={t} /></Capa></AbsoluteFill> : null}
      {t >= K.cinta ? <AbsoluteFill style={{clipPath: qc < 1 ? clipEstilo : undefined, transform: `translateY(${-pe * h}px)`, opacity: 1 - pe * 0.4}}><Capa t={t} de={K.cinta} hasta={K.empuje + 0.6}><Estilo t={t} /></Capa></AbsoluteFill> : null}
      {t >= K.cinta && t < K.cinta + 1.0 ? (
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
      ) : null}
      <Capa t={t} de={K.empuje - 0.05} hasta={15.0} style={{transform: `translateY(${(1 - pe) * h}px)`}}><Web t={t} /></Capa>
      <Capa t={t} de={K.ventanaFin - 0.3} hasta={19.9} style={{opacity: pr(t, K.ventanaFin - 0.1, 0.45, eInOut)}}><Piezas t={t} /></Capa>
      <Capa t={t} de={K.ventana} hasta={K.ventanaFin + 0.5}><Drop t={t} fecha={fecha} hora={hora} /></Capa>
      {t >= 19.1 && t < 19.9 ? fran(franjaC, 1 - cl((t - 19.6) / 0.12)) : null}
      {t >= 19.1 ? <AbsoluteFill style={{clipPath: p2 < 1 ? clipC : undefined}}><Capa t={t} de={19.1} hasta={22.6}><Whatsapp t={t} /></Capa></AbsoluteFill> : null}
      <Capa t={t} de={K.iris} hasta={99}><Final t={t} incentivo={incentivo} /></Capa>
      <Audio src={staticFile(`audio/6-ProximoDrop${voz ? '' : '-sinvoz'}.wav`)} />
    </AbsoluteFill>
  );
};
