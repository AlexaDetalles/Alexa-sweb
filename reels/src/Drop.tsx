import React from 'react';
import {AbsoluteFill, Audio, Img, random, staticFile, useCurrentFrame, useVideoConfig, continueRender, delayRender} from 'remotion';

// «6-ProximoDrop» · 25,5 s · 60 fps · anuncio SIN fecha de un nuevo drop (ropa, accesorios, tenis y más). Sale en 16:9 (1920×1080) y en 9:16 (1080×1920).
//
// Construido a partir del análisis, fotograma a fotograma, de un anuncio conceptual de referencia. Lo que se imitó es la forma de mover las cosas, no su contenido:
//  · nada es un corte seco: cada escena entra mientras la anterior todavía se está yendo (transiciones solapadas);
//  · barrido líquido (borde ondulado con franja translúcida), cinta de satén que cruza la pantalla, iris circular;
//  · letras que suben en escalera con desenfoque, texto que pasa por detrás de un objeto recortado, palabras que se suman y recentran la línea;
//  · foto a pantalla completa que se encoge hasta una ventana redondeada; ventana que entra deslizando con desenfoque de movimiento;
//  · colina que no deja de deformarse con una mascota que rebota y levanta polvo; tarjetas que nacen de un destello, giran y se disuelven;
//  · un punto que se vuelve icono y el icono que se convierte en la interfaz (elemento compartido), máquina de escribir y una tarjeta que se arma pieza por pieza;
//  · celular que sube con la pantalla de la web real desplazándose por dentro, y el diseño se espeja; palabras que saltan; logo que se arma letra a letra.
// No se usó metraje, personajes, audio ni textos del original. Los colores y la marca son los de Tiendas Alexa.
// Lo que aún no existe (fecha, hora, incentivo) solo sale si viene en props.json.

export type DropProps = {fecha: string; hora: string; incentivo: string; voz: boolean};
export const dropPorDefecto: DropProps = {fecha: '', hora: '', incentivo: '', voz: true};
export const DROP_FPS = 60;
export const DROP_SEG = 25.5;
export const DROP_FRAMES = Math.round(DROP_FPS * DROP_SEG);

/** Tiempos de cada momento, en segundos. audio/musica_pop.py y audio/voz.py usan estos mismos números. */
export const K = {
  barrido: 1.1, foto: 2.0, encoge: 2.5, cinta: 3.9, colina: 4.3, tarjeta: 4.9, durTarjeta: 1.1, colinaFin: 9.4,
  palabras: 9.2, punto: 11.9, interfaz: 12.9, ventana: 15.3, celular: 17.8, espeja: 19.6, gris: 20.8, solo: 21.0, iris: 22.6,
};

const P = {red: '#8c1e3c', redDark: '#5e1228', redLight: '#b44460', ink: '#1b1114', white: '#ffffff', gold: '#d2a851', cream: '#f7ead7', rose: '#f6d3da', gris: '#f1ecee', stroke: '#6f6266'};
const FF = "'Fredoka Alexa', 'Arial Rounded MT Bold', Arial, sans-serif";

if (typeof document !== 'undefined' && !(window as any).__fredokaAlexa) {
  (window as any).__fredokaAlexa = true;
  const espera = delayRender('fuente Fredoka');
  Promise.all([
    new FontFace('Fredoka Alexa', `url(${staticFile('fonts/fredoka-latin-600-normal.woff2')})`, {weight: '600'}),
    new FontFace('Fredoka Alexa', `url(${staticFile('fonts/fredoka-latin-700-normal.woff2')})`, {weight: '700'}),
  ].map((d) => d.load())).then((ls) => ls.forEach((f) => (document as any).fonts.add(f))).catch((e) => console.error('Fuente', e)).finally(() => continueRender(espera));
}

// ---------- tiempo, curvas y tamaño ----------
const cl = (x: number) => Math.min(1, Math.max(0, x));
const eOut = (x: number) => 1 - Math.pow(1 - cl(x), 3);
const eOut5 = (x: number) => 1 - Math.pow(1 - cl(x), 5);
const eInOut = (x: number) => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const eBack = (x: number, s = 1.9) => { x = cl(x); const c3 = s + 1; return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
/** Progreso 0..1 de t dentro de [a, a+d]. */
const pr = (t: number, a: number, d: number, e: (x: number) => number = eOut) => e((t - a) / d);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** k = tamaño de referencia: el lado corto del cuadro vale 1080 unidades, tanto en horizontal como en vertical. */
const useD = () => {
  const {width, height} = useVideoConfig();
  return {w: width, h: height, L: width > height, k: Math.min(width, height) / 1080};
};

const T: React.FC<{s: number; color?: string; weight?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({s, color = P.ink, weight = 700, style, children}) => {
  const {k} = useD();
  return <div style={{fontFamily: FF, fontWeight: weight, fontSize: s * k, lineHeight: 1.02, letterSpacing: '-0.02em', color, whiteSpace: 'pre', ...style}}>{children}</div>;
};
/** Palabra que entra con rebote, desenfoque y desplazamiento. */
const Pal: React.FC<{t: number; at: number; dur?: number; dx?: number; dy?: number; blur?: number; rebote?: boolean; style?: React.CSSProperties; children: React.ReactNode}> = ({t, at, dur = 0.5, dx = 0, dy = 60, blur = 12, rebote = true, style, children}) => {
  const {k} = useD();
  const p = pr(t, at, dur, rebote ? eBack : eOut);
  const b = (1 - cl((t - at) / dur)) * blur;
  return <div style={{display: 'inline-block', opacity: cl((t - at) / (dur * 0.45)), transform: `translate(${(1 - p) * dx * k}px, ${(1 - p) * dy * k}px)`, filter: b > 0.3 ? `blur(${b}px)` : undefined, ...style}}>{children}</div>;
};
/** Letras que suben en escalera; con `salto` rebotan una vez al terminar. */
const Letras: React.FC<{t: number; at: number; texto: string; s: number; color: string; paso?: number; salto?: number; weight?: number}> = ({t, at, texto, s, color, paso = 0.04, salto = 0, weight = 700}) => {
  const {k} = useD();
  return (
    <div style={{display: 'flex', fontFamily: FF, fontWeight: weight, fontSize: s * k, lineHeight: 1.02, letterSpacing: '-0.02em', color, whiteSpace: 'pre'}}>
      {texto.split('').map((c, i) => {
        const a = at + i * paso;
        const p = pr(t, a, 0.5, eBack);
        const b = (1 - cl((t - a) / 0.45)) * 10;
        const h = salto ? -salto * k * Math.sin(cl((t - (a + 0.45)) / 0.45) * Math.PI) : 0;
        return <span key={i} style={{display: 'inline-block', opacity: cl((t - a) / 0.2), transform: `translateY(${(1 - p) * 70 * k + h}px) rotate(${(1 - p) * 6}deg)`, filter: b > 0.3 ? `blur(${b}px)` : undefined}}>{c}</span>;
      })}
    </div>
  );
};
const Capa: React.FC<{t: number; de: number; hasta: number; children: React.ReactNode; style?: React.CSSProperties}> = ({t, de, hasta, children, style}) =>
  t >= de && t < hasta ? <AbsoluteFill style={style}>{children}</AbsoluteFill> : null;

// ---------- formas (borde ondulado, barridos) ----------
type Pt = [number, number];
const poly = (pts: Pt[]) => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`;
/** Borde vertical ondulado: x en cada y, con dos ondas que se desfasan para que parezca líquido. */
const borde = (h: number, x0: number, amp: number, fase: number, inclina = 0, n = 56): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const y = -30 + ((h + 60) * i) / n;
    pts.push([x0 + inclina * (y - h / 2) + amp * Math.sin(y / (h * 0.17) + fase) + amp * 0.5 * Math.sin(y / (h * 0.065) - fase * 1.7), y]);
  }
  return pts;
};

// ---------- ilustraciones ----------
const Perchero: React.FC<{w?: number; c?: string}> = ({w = 230, c = P.red}) => (
  <svg viewBox="0 0 120 100" width={w} height={w * 0.83}>
    <path d="M60 40 V34 C60 27 69 25 69 17 a9 9 0 1 0 -18 0" fill="none" stroke={c} strokeWidth="6" strokeLinecap="round" />
    <path d="M60 38 L11 72 Q4 78 13 83 H107 Q116 78 109 72 Z" fill={c} />
    <path d="M60 46 L22 73 H98 Z" fill="#fff" opacity=".18" />
    <path d="M20 79 H100" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".5" />
  </svg>
);
const Tenis: React.FC<{w?: number; c?: string}> = ({w = 270, c = P.red}) => (
  <svg viewBox="0 0 160 92" width={w} height={w * 0.575}>
    <path d="M8 72 V52 C8 46 12 44 18 44 H40 C51 44 55 35 63 28 L70 22 C75 28 82 32 90 34 L121 40 C141 44 152 54 152 66 V72 Z" fill={c} />
    <path d="M70 22 C75 28 82 32 90 34 L121 40 C128 41 134 44 139 48 L100 50 C86 48 76 40 70 22 Z" fill="#fff" opacity=".18" />
    <rect x="4" y="68" width="152" height="16" rx="8" fill="#fff" stroke={c} strokeWidth="3" />
    <path d="M73 36 L82 29 M84 41 L93 34 M95 45 L104 38" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
  </svg>
);
const Mas: React.FC<{w?: number; c?: string}> = ({w = 200, c = P.red}) => (
  <svg viewBox="0 0 120 100" width={w} height={w * 0.83}>
    <circle cx="60" cy="48" r="38" fill={c} />
    <path d="M60 28 V68 M40 48 H80" stroke="#fff" strokeWidth="9" strokeLinecap="round" />
    <circle cx="28" cy="92" r="3.5" fill={c} /><circle cx="60" cy="92" r="3.5" fill={c} /><circle cx="92" cy="92" r="3.5" fill={c} />
  </svg>
);
const RelojFoto: React.FC<{h: number}> = ({h}) => (
  <Img src={staticFile('img/reloj-dorado-recorte.webp')} style={{height: h, width: 'auto', filter: 'drop-shadow(0 12px 14px rgba(94,18,40,.35))',
    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 12%, #000 88%, transparent 100%)', maskImage: 'linear-gradient(to bottom, transparent 0%, #000 12%, #000 88%, transparent 100%)'}} />
);
const Lupa: React.FC<{s: number}> = ({s}) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke={P.ink} strokeWidth="2.4" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 L21 21" /></svg>
);
const Mascota: React.FC<{s: number}> = ({s}) => (
  <svg viewBox="0 0 220 230" width={s} height={s * 1.045} style={{overflow: 'visible'}}>
    <path d="M78 66 C78 20 142 20 142 66" fill="none" stroke={P.gold} strokeWidth="11" strokeLinecap="round" />
    <rect x="28" y="62" width="164" height="136" rx="30" fill={P.cream} />
    <rect x="28" y="104" width="164" height="22" fill={P.red} />
    <circle cx="82" cy="152" r="11" fill={P.ink} /><circle cx="138" cy="152" r="11" fill={P.ink} />
    <circle cx="85" cy="148" r="3.5" fill="#fff" /><circle cx="141" cy="148" r="3.5" fill="#fff" />
    <path d="M95 172 Q110 184 125 172" fill="none" stroke={P.ink} strokeWidth="5" strokeLinecap="round" />
    <circle cx="68" cy="212" r="14" fill={P.ink} /><circle cx="152" cy="212" r="14" fill={P.ink} />
  </svg>
);

// ======================================================================================================
// ESCENA 1 · «¿Ya viste lo que… se viene?» (0 – 2,5 s): letras en escalera, barrido líquido, palabra que salta
// ======================================================================================================
const Gancho: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const zoom = 1 + t * 0.012;
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 25% 20%, ${P.redLight} 0%, ${P.red} 62%)`}}>
      <AbsoluteFill style={{transform: `scale(${zoom})`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', paddingLeft: (L ? 150 : 70) * k, gap: 12 * k}}>
        {L ? (
          <Letras t={t} at={0.12} texto="¿Ya viste lo que" s={178} color={P.white} paso={0.03} />
        ) : (
          <>
            <Letras t={t} at={0.12} texto="¿Ya viste" s={215} color={P.white} paso={0.035} />
            <Letras t={t} at={0.45} texto="lo que" s={215} color={P.white} paso={0.035} />
          </>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
const SeViene: React.FC<{t: number}> = ({t}) => {
  const {L, k, w} = useD();
  const p = pr(t, K.barrido, 0.6, eInOut);
  return (
    <AbsoluteFill style={{background: P.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: L ? 'row' : 'column', gap: (L ? 40 : 6) * k}}>
      <div style={{transform: `translateX(${(1 - p) * 0.3 * w}px)`, display: 'flex', gap: 40 * k, alignItems: 'center', flexDirection: L ? 'row' : 'column'}}>
        <Letras t={t} at={K.barrido + 0.35} texto="se" s={L ? 250 : 190} color={P.ink} paso={0.05} salto={26} />
        <Letras t={t} at={K.barrido + 0.45} texto="viene?" s={290} color={P.red} paso={0.06} salto={34} />
      </div>
    </AbsoluteFill>
  );
};

// ======================================================================================================
// ESCENA 2 · foto a pantalla completa → ventana redondeada, «algo nuevo» pasa por detrás de la cartera (2 – 4,8 s)
// ======================================================================================================
const Polvo: React.FC<{t: number; x: number; y: number; desde: number; hasta: number; cada?: number; color?: string; dir?: number}> = ({t, x, y, desde, hasta, cada = 0.1, color = '#fff', dir = -1}) => {
  const {k} = useD();
  const out: React.ReactNode[] = [];
  for (let b = desde; b < Math.min(hasta, t); b += cada) {
    const age = t - b;
    if (age > 0.6) continue;
    const r = random(`polvo${b.toFixed(2)}`);
    const q = age / 0.6;
    out.push(<div key={b} style={{position: 'absolute', left: x + dir * (30 + 120 * q) * k, top: y - (12 + 70 * q * (0.6 + r)) * k, width: (14 + 14 * r) * k * (1 - q * 0.6), height: (14 + 14 * r) * k * (1 - q * 0.6), borderRadius: 99, background: color, opacity: (1 - q) * 0.9}} />);
  }
  return <>{out}</>;
};
const FotoVentana: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const aparece = pr(t, K.foto, 0.45);
  const s = pr(t, K.encoge, 0.75, eInOut);
  const mx = (L ? 200 : 90) * k, my = (L ? 120 : 330) * k;
  const radio = 64 * k * s;
  const blur = 5 * s;
  const desliza = pr(t, K.encoge + 0.2, 0.9, eOut5);
  const bag = pr(t, 3.2, 0.5, eBack);
  const mascX = lerp(-300 * k, (L ? 330 : 190) * k, pr(t, 2.85, 0.7, eOut5));
  return (
    <AbsoluteFill style={{opacity: aparece, background: `radial-gradient(circle at 30% 25%, ${P.redLight} 0%, ${P.red} 62%)`}}>
      <div style={{position: 'absolute', left: mx * s, right: mx * s, top: my * s, bottom: my * s, borderRadius: radio, overflow: 'hidden', boxShadow: `0 ${40 * s}px ${80 * s}px rgba(0,0,0,.35)`, border: `${10 * k * s}px solid ${P.rose}`}}>
        <Img src={staticFile('img/hero.webp')} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.08 + (t - K.foto) * 0.03})`, filter: `blur(${blur}px)`}} />
        <AbsoluteFill style={{background: `rgba(94,18,40,${0.55 * s})`}} />
        <AbsoluteFill style={{display: 'flex', flexDirection: L ? 'row' : 'column', justifyContent: 'center', alignItems: 'center', gap: (L ? 50 : 0) * k}}>
          <Pal t={t} at={2.8} dur={0.55} dx={-160} dy={0} blur={16}><T s={200} color={P.white}>algo</T></Pal>
          <Pal t={t} at={3.0} dur={0.55} dx={160} dy={0} blur={16}><T s={270} color={P.gold}>nuevo</T></Pal>
        </AbsoluteFill>
        {/* la cartera va DELANTE del texto: el texto pasa por detrás */}
        <Img src={staticFile('img/cartera-recorte.webp')} style={{position: 'absolute', left: '50%', top: '50%', width: (L ? 430 : 400) * k, height: 'auto', marginLeft: (L ? 70 : -60) * k, marginTop: (L ? -190 : -40) * k,
          opacity: cl((t - 3.2) / 0.15), transform: `scale(${0.2 + 0.8 * bag}) rotate(${(1 - bag) * -22}deg)`, filter: 'drop-shadow(0 30px 30px rgba(0,0,0,.4))'}} />
        <div style={{position: 'absolute', left: mascX, bottom: 20 * k, transform: `translateY(${-Math.abs(Math.sin(t * 11)) * 18 * k}px) rotate(${Math.sin(t * 11) * 2}deg)`}}><Mascota s={170 * k} /></div>
        <Polvo t={t} x={mascX + 40 * k} y={h - my - 40 * k} desde={2.9} hasta={3.9} cada={0.09} dir={-1} />
      </div>
    </AbsoluteFill>
  );
};

// ======================================================================================================
// TRANSICIÓN · cinta de satén que cruza la pantalla (3,9 – 4,8 s): la escena nueva aparece detrás de la cinta
// ======================================================================================================
const cintaPuntos = (t: number, w: number, h: number) => {
  const q = pr(t, K.cinta, 0.9, eInOut);
  const bw = 0.5 * w;
  const xl = lerp(-0.1 * w, w * 1.3 + bw, q);
  const incl = 0.22;
  const lead = borde(h, xl, 26, t * 7, incl);
  const trail = borde(h, xl - bw, 20, t * 6 + 2, incl);
  return {q, lead, trail};
};

// ======================================================================================================
// ESCENA 3 · colina que se deforma, mascota con polvo, tarjetas que nacen de un destello (4,3 – 9,4 s)
// ======================================================================================================
const alturaColina = (x: number, t: number, w: number, h: number) => {
  const xc = w * (0.5 + 0.14 * Math.sin(t * 0.85));
  const g = Math.exp(-Math.pow((x - xc) / (0.3 * w), 2));
  return 0.9 * h - 0.26 * h * g + 0.012 * h * Math.sin(x / (0.1 * w) + t * 2.4);
};
const TarjetaCae: React.FC<{t: number; i: number; titulo: string; oro?: boolean; children: React.ReactNode}> = ({t, i, titulo, oro, children}) => {
  const {w, h, L, k} = useD();
  const c = K.tarjeta + i * K.durTarjeta;
  if (t < c || t > c + K.durTarjeta + 0.05) return null;
  const a = t - c;
  const p = eBack(a / 0.55, 1.5);
  const q = cl((a - 0.82) / 0.25);
  const cw = (L ? 700 : 760) * k, ch = (L ? 390 : 470) * k;
  const flash = Math.max(0, 1 - a / 0.35);
  const bl = (1 - cl(a / 0.4)) * 14 + q * 10;
  return (
    <div style={{position: 'absolute', left: (w - cw) / 2, top: (L ? 70 : 250) * k, width: cw, height: ch}}>
      <div style={{position: 'absolute', inset: -60 * k, borderRadius: 120 * k, background: `radial-gradient(circle, rgba(246,211,218,${0.9 * flash}) 0%, rgba(246,211,218,0) 70%)`, transform: `scale(${1 + 0.6 * (1 - flash)})`}} />
      <div style={{width: cw, height: ch, borderRadius: 56 * k, background: oro ? P.gold : P.rose, opacity: cl(a / 0.12) * (1 - q), filter: bl > 0.3 ? `blur(${bl}px)` : undefined,
        transform: `scale(${(0.06 + 0.94 * p) * (1 + 0.08 * q)}) rotate(${lerp(26, -3, p) - 6 * q}deg) translateY(${-24 * q * k}px)`, boxShadow: `0 0 ${80 * k}px rgba(140,30,60,.35)`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${52 * k}px`}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 8 * k}}>
          <Pal t={t} at={c + 0.18} dur={0.35} dy={20} blur={8}><T s={38} color={oro ? P.ink : P.redDark} weight={600}>Nuevo</T></Pal>
          <Pal t={t} at={c + 0.28} dur={0.45} dy={40} blur={10}><T s={L ? 104 : 96} color={oro ? P.ink : P.red}>{titulo}</T></Pal>
        </div>
        <Pal t={t} at={c + 0.22} dur={0.5} dy={30} blur={10} style={{display: 'flex'}}>{children}</Pal>
      </div>
    </div>
  );
};
const Colina: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const n = 40;
  const pts: Pt[] = [[-60, h + 20]];
  for (let i = 0; i <= n; i++) { const x = -60 + ((w + 120) * i) / n; pts.push([x, alturaColina(x, t, w, h)]); }
  pts.push([w + 60, h + 20]);
  const mx = w * 0.5;
  const my = alturaColina(mx, t, w, h);
  const dy = alturaColina(mx + 24, t, w, h) - alturaColina(mx - 24, t, w, h);
  const ang = (Math.atan2(dy, 48) * 180) / Math.PI * 0.9;
  const salto = Math.abs(Math.sin(t * 8)) * 12 * k;
  const ms = (L ? 220 : 250) * k;
  const fin = 1 - pr(t, 8.9, 0.5, eInOut);
  return (
    <AbsoluteFill style={{background: P.white}}>
      <AbsoluteFill style={{opacity: fin}}>
        <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0}}><polygon points={pts.map((p) => p.join(',')).join(' ')} fill={P.red} /></svg>
        <div style={{position: 'absolute', left: mx - ms / 2, top: my - ms * 0.99 - salto, transform: `rotate(${ang}deg)`, transformOrigin: '50% 90%'}}><Mascota s={ms} /></div>
        <Polvo t={t} x={mx - 60 * k} y={my - 4 * k} desde={K.colina} hasta={K.colinaFin} cada={0.085} dir={-1} />
        <TarjetaCae t={t} i={0} titulo="Ropa"><Perchero w={(L ? 190 : 210) * k} /></TarjetaCae>
        <TarjetaCae t={t} i={1} titulo="Accesorios"><RelojFoto h={(L ? 250 : 270) * k} /></TarjetaCae>
        <TarjetaCae t={t} i={2} titulo="Tenis"><Tenis w={(L ? 240 : 250) * k} /></TarjetaCae>
        <TarjetaCae t={t} i={3} titulo="y más…" oro><Mas w={(L ? 170 : 190) * k} c={P.ink} /></TarjetaCae>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ======================================================================================================
// ESCENA 4 · «Un nuevo drop de Tiendas Alexa»: palabras que se suman y recentran la línea (9,2 – 11,9 s)
// ======================================================================================================
const Palabras: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const a1 = K.palabras + 0.25, a2 = K.palabras + 0.75, a3 = K.palabras + 1.25;
  const p2 = pr(t, a2, 0.6, eOut5);
  // la línea 1 se recentra a medida que entra «drop»
  const hid1 = (1 - p2) * ((4 * 0.56 * 230 + 40) * k) / 2;
  const hid3 = (1 - pr(t, a3, 0.6, eOut5)) * 0.5 * 16 * 0.5 * 84 * k / 2;
  const col1 = pr(t, a1, 0.9, eOut);
  const sale = pr(t, 11.55, 0.35, eInOut);
  const bag = pr(t, K.palabras + 0.7, 0.9, eBack);
  const cx = L ? 0.36 * w : w / 2;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{opacity: 1 - sale, filter: sale > 0.05 ? `blur(${sale * 14}px)` : undefined, transform: `scale(${1 + sale * 0.05})`}}>
        <div style={{position: 'absolute', left: cx, top: (L ? 0.5 : 0.38) * h, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 * k}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 36 * k, transform: `translateX(${hid1 * (L ? 0.4 : 0.3)}px)`}}>
            <Pal t={t} at={a1} dy={70}><T s={L ? 140 : 135} color={`rgb(${Math.round(lerp(140, 27, col1))},${Math.round(lerp(30, 17, col1))},${Math.round(lerp(60, 20, col1))})`}>Un nuevo</T></Pal>
            <Pal t={t} at={a2} dy={90}><T s={L ? 250 : 210} color={P.red}>drop</T></Pal>
          </div>
          <div style={{transform: `translateX(${hid3 * 0.2}px)`}}><Pal t={t} at={a3} dy={50}><T s={L ? 86 : 84} color={P.ink} weight={600}>de Tiendas Alexa</T></Pal></div>
        </div>
        <Img src={staticFile('img/cartera-recorte.webp')} style={{position: 'absolute', left: L ? 0.7 * w : w / 2 - 230 * k, top: L ? 0.08 * h : 0.6 * h, width: (L ? 540 : 460) * k, height: 'auto', opacity: cl((t - K.palabras - 0.7) / 0.25),
          transform: `translateY(${(1 - bag) * 0.9 * h + Math.sin(t * 3) * 10 * k}px) rotate(${-8 + (1 - bag) * 12}deg)`, filter: 'drop-shadow(0 30px 30px rgba(0,0,0,.25))'}} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ======================================================================================================
// ESCENA 5 · punto → icono → interfaz (elemento compartido), máquina de escribir, tarjeta que se arma (11,9 – 15,6 s)
// ======================================================================================================
const Interfaz: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const dot = pr(t, K.punto, 0.3, eBack);
  const tile = pr(t, K.punto + 0.25, 0.45, eBack);
  const morph = pr(t, K.interfaz - 0.1, 0.55, eInOut);
  const cy0 = 0.46 * h, cy1 = (L ? 0.64 : 0.6) * h;
  const cy = lerp(cy0, cy1, morph);
  const tw = lerp(lerp(26 * k, 230 * k, tile), (L ? 1240 : 940) * k, morph);
  const th = lerp(lerp(26 * k, 230 * k, tile), 140 * k, morph);
  const rad = lerp(lerp(13 * k, 62 * k, tile), 70 * k, morph);
  const comprime = pr(t, 14.45, 0.28, eInOut);
  const typed = Math.floor(Math.max(0, t - (K.interfaz + 0.45)) / 0.045);
  const texto = 'Busca tu próximo favorito…'.slice(0, typed);
  const caret = typed < 26 && Math.floor(t * 4) % 2 === 0 && t > K.interfaz + 0.4;
  // tarjeta del producto
  const pc = pr(t, 14.55, 0.35, eOut);
  const trazo = pr(t, 14.6, 0.55, eInOut);
  const cw = (L ? 860 : 920) * k, ch = (L ? 290 : 300) * k;
  const perim = 2 * (cw + ch);
  const precio = Math.round(3500 * pr(t, 14.95, 0.5, eOut));
  const empuja = pr(t, K.ventana, 0.5, eInOut);
  const ui = [
    {n: 'Ropa', ic: <Perchero w={(L ? 150 : 130) * k} />},
    {n: 'Tenis', ic: <Tenis w={(L ? 190 : 160) * k} />},
    {n: 'Accesorios', ic: <RelojFoto h={(L ? 150 : 130) * k} />},
  ];
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{opacity: 1 - comprime, transform: `scale(${1 - 0.08 * comprime})`, filter: comprime > 0.05 ? `blur(${comprime * 8}px)` : undefined}}>
        {/* categorías que salen del icono */}
        {ui.map((u, i) => {
          const at = K.interfaz + 0.05 + i * 0.1;
          const p = pr(t, at, 0.55, (x) => eBack(x, 1.6));
          const cw2 = (L ? 400 : 290) * k, ch2 = (L ? 360 : 330) * k;
          const gap = 36 * k;
          const x1 = w / 2 + (i - 1) * (cw2 + gap) - cw2 / 2;
          const y1 = cy1 - 120 * k - ch2 - 24 * k;
          return t < at ? null : (
            <div key={u.n} style={{position: 'absolute', left: lerp(w / 2 - cw2 / 2, x1, p), top: lerp(cy0 - ch2 / 2, y1, p), width: cw2, height: ch2, borderRadius: 44 * k, background: P.gris, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 * k,
              transform: `scale(${0.3 + 0.7 * p})`, opacity: cl((t - at) / 0.15)}}>
              {u.ic}<T s={L ? 70 : 52} weight={600}>{u.n}</T>
            </div>
          );
        })}
        {/* el icono se vuelve el buscador */}
        {t >= K.punto ? (
          <div style={{position: 'absolute', left: w / 2 - tw / 2, top: cy - th / 2, width: tw, height: th, borderRadius: rad, background: morph > 0.55 ? P.gris : P.red, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: `scale(${dot < 1 && tile === 0 ? dot : 1})`, boxShadow: morph < 0.5 ? `0 ${24 * k}px ${50 * k}px rgba(140,30,60,${0.35 * (1 - morph)})` : 'none'}}>
            <Img src={staticFile('img/logo-mark.svg')} style={{height: 150 * k, width: 'auto', opacity: cl(tile - 0.4) * (1 - morph * 2.2 > 0 ? 1 - morph * 2.2 : 0), position: 'absolute'}} />
            <div style={{display: 'flex', alignItems: 'center', gap: 28 * k, opacity: cl((morph - 0.6) / 0.4), width: '100%', padding: `0 ${50 * k}px`}}>
              <Lupa s={64 * k} />
              <T s={L ? 62 : 52} color={P.stroke} weight={600}>{texto}{caret ? '|' : ''}</T>
            </div>
          </div>
        ) : null}
      </AbsoluteFill>
      {/* tarjeta que se arma pieza por pieza */}
      {t >= 14.5 ? (
        <div style={{position: 'absolute', left: w / 2 - cw / 2, top: 0.5 * h - ch / 2, width: cw, height: ch, opacity: Math.min(1, pc * 1.4) * (1 - empuja), transform: `translateX(${empuja * 0.55 * w}px) scale(${0.92 + 0.08 * pc})`, filter: empuja > 0.05 ? `blur(${empuja * 22}px)` : undefined}}>
          <svg width={cw} height={ch} style={{position: 'absolute', left: 0, top: 0}}>
            <rect x={5} y={5} width={cw - 10} height={ch - 10} rx={40 * k} fill="#fff" fillOpacity={cl((t - 14.9) / 0.3)} stroke={P.red} strokeWidth={6 * k} strokeDasharray={perim} strokeDashoffset={perim * (1 - trazo)} />
          </svg>
          <div style={{position: 'absolute', left: 36 * k, top: 22 * k, bottom: 22 * k, width: 230 * k, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.4 + 0.6 * pr(t, 14.7, 0.5, eBack)})`, opacity: cl((t - 14.7) / 0.12)}}><RelojFoto h={210 * k} /></div>
          <div style={{position: 'absolute', left: 300 * k, top: 40 * k, right: 36 * k, display: 'flex', flexDirection: 'column', gap: 12 * k}}>
            <Pal t={t} at={14.8} dur={0.35} dx={30} dy={0} blur={8}><T s={L ? 44 : 40} weight={600}>Reloj Hummer WH2-224096</T></Pal>
            <Pal t={t} at={14.9} dur={0.4} dx={30} dy={0} blur={8}><T s={L ? 98 : 90} color={P.red}>{`L ${precio.toLocaleString('en-US')}`}</T></Pal>
            <Pal t={t} at={15.05} dur={0.4} dy={20} blur={6}><div style={{display: 'inline-block', background: P.gold, borderRadius: 14 * k, padding: `${6 * k}px ${22 * k}px`}}><T s={30} color={P.ink} weight={700}>EN CATÁLOGO</T></div></Pal>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ======================================================================================================
// ESCENA 6 · ventana que entra deslizando con desenfoque de movimiento (15,3 – 17,9 s)
// ======================================================================================================
const Ventana: React.FC<{t: number; fecha: string; hora: string}> = ({t, fecha, hora}) => {
  const {w, h, L, k} = useD();
  const p = pr(t, K.ventana, 0.7, eOut5);
  const vw = (L ? 1560 : 940) * k, vh = (L ? 860 : 1180) * k;
  const sale = pr(t, 17.45, 0.45, eInOut);
  const push = 1.04 + (t - K.ventana) * 0.028;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: w / 2 - vw / 2 - (1 - p) * (w * 0.8) , top: h / 2 - vh / 2, width: vw, height: vh, borderRadius: 64 * k, overflow: 'hidden', border: `${10 * k}px solid ${P.rose}`, boxShadow: `0 ${30 * k}px ${70 * k}px rgba(94,18,40,.28)`,
        filter: `blur(${(1 - p) * 18 + sale * 10}px)`, opacity: 1 - sale, transform: `scale(${1 + sale * 0.06})`}}>
        <Img src={staticFile('img/gift-feature.webp')} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${push})`}} />
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(27,17,20,0) 38%, rgba(27,17,20,.74) 100%)'}} />
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: `0 ${80 * k}px ${64 * k}px`, gap: 4 * k}}>
          <Pal t={t} at={K.ventana + 0.55} dy={50} dx={-40}><T s={L ? 170 : 120} color={P.white}>{fecha ? 'Llega el' : 'Llega'}</T></Pal>
          <Pal t={t} at={K.ventana + 0.85} dy={50} dx={-40}><T s={fecha ? (L ? 170 : 120) : (L ? 150 : 100)} color={P.gold}>{fecha || 'en estas semanas'}</T></Pal>
          {fecha && hora ? <Pal t={t} at={K.ventana + 1.2} dy={30}><T s={62} color={P.white} weight={600}>{hora}</T></Pal> : null}
        </AbsoluteFill>
      </div>
    </AbsoluteFill>
  );
};

// ======================================================================================================
// ESCENA 7 · celular que sube, web real que se desplaza dentro, diseño que se espeja (17,8 – 21,2 s)
// ======================================================================================================
const Celular: React.FC<{t: number; x: number; y: number; rot: number; op: number; mezcla: number; scrollA: number; scrollB: number}> = ({t, x, y, rot, op, mezcla, scrollA, scrollB}) => {
  const {k, L} = useD();
  const pw = (L ? 400 : 520) * k, ph = pw * (1688 / 780);
  const r = pw / 780;
  return (
    <div style={{position: 'absolute', left: x - pw / 2 - 14 * k, top: y, width: pw + 28 * k, height: ph + 28 * k, borderRadius: 70 * k, background: '#0c0708', padding: 14 * k, opacity: op, transform: `rotate(${rot}deg)`, boxShadow: `0 ${40 * k}px ${80 * k}px rgba(27,17,20,.3)`}}>
      <div style={{position: 'relative', width: pw, height: ph, borderRadius: 58 * k, overflow: 'hidden', background: P.white}}>
        <Img src={staticFile('img/inicio-larga.webp')} style={{position: 'absolute', left: 0, top: -scrollA * r, width: pw, height: 'auto', opacity: 1 - mezcla}} />
        <Img src={staticFile('img/catalogo-larga.webp')} style={{position: 'absolute', left: 0, top: -scrollB * r, width: pw, height: 'auto', opacity: mezcla}} />
        <div style={{position: 'absolute', left: '50%', top: 12 * k, width: 120 * k, height: 34 * k, marginLeft: -60 * k, borderRadius: 40 * k, background: '#0c0708'}} />
      </div>
    </div>
  );
};
const Frase: React.FC<{t: number; at: number; grande: string; acento: string; lado: 'izq' | 'der'; salida?: number}> = ({t, at, grande, acento, lado, salida = 1e9}) => {
  const {w, h, L, k} = useD();
  const sale = pr(t, salida, 0.35, eInOut);
  if (t < at || sale >= 1) return null;
  const pw = (L ? 400 : 520) * k;
  const alin = lado === 'izq' ? 'flex-start' : 'flex-end';
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: L ? 'center' : 'flex-start', alignItems: L ? alin : 'center', paddingTop: (L ? 0 : 230) * k,
      paddingLeft: L && lado === 'izq' ? 150 * k : 0, paddingRight: L && lado === 'der' ? 150 * k : 0, gap: 10 * k, opacity: 1 - sale, transform: `translateY(${-sale * 40 * k}px)`, filter: sale > 0.05 ? `blur(${sale * 14}px)` : undefined}}>
      <Pal t={t} at={at} dx={lado === 'izq' ? -80 : 80} dy={40}><T s={L ? 250 : 190}>{grande}</T></Pal>
      <Pal t={t} at={at + 0.3} dx={lado === 'izq' ? -80 : 80} dy={40}><T s={L ? 124 : 124} color={P.red}>{acento}</T></Pal>
    </div>
  );
};
const Celulares: React.FC<{t: number}> = ({t}) => {
  const {w, h, L, k} = useD();
  const bg = pr(t, K.celular - 0.1, 0.4, eOut);
  const sube = pr(t, K.celular + 0.35, 0.8, (x) => eBack(x, 1.2));
  const pw = (L ? 400 : 520) * k, ph = pw * (1688 / 780);
  const yFinal = L ? 0.5 * h - (ph + 28 * k) / 2 : 0.46 * h;
  const y = lerp(h + 30 * k, yFinal, sube);
  const mx = pr(t, K.espeja - 0.1, 0.7, eInOut);
  const xIzq = L ? 0.27 * w : w / 2, xDer = L ? 0.72 * w : w / 2;
  const x = lerp(xIzq, xDer, mx);
  const rot = Math.sin(mx * Math.PI) * -5;
  const gris = pr(t, K.gris, 0.35, eInOut);
  const scrollA = lerp(0, 1100, pr(t, K.celular + 1.0, 1.5, eInOut));
  const scrollB = lerp(0, 2300, pr(t, K.espeja + 0.5, 1.5, eInOut));
  const mezcla = pr(t, K.espeja, 0.5, eInOut);
  return (
    <AbsoluteFill style={{background: P.white, opacity: bg}}>
      <AbsoluteFill style={{opacity: 1 - gris, transform: `scale(${1 - gris * 0.05})`, filter: gris > 0.05 ? `blur(${gris * 8}px)` : undefined}}>
        <Frase t={t} at={K.celular + 0.15} grande="Elige" acento="desde tu celular" lado={L ? 'der' : 'izq'} salida={K.espeja - 0.15} />
        <Frase t={t} at={K.espeja + 0.35} grande="Pide" acento="por WhatsApp" lado={L ? 'izq' : 'izq'} />
        <Celular t={t} x={x} y={y} rot={rot} op={1} mezcla={mezcla} scrollA={scrollA} scrollB={scrollB} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ======================================================================================================
// ESCENA 8 · «Solo elige y pide»: palabras que saltan (21 – 22,6 s)
// ======================================================================================================
const Solo: React.FC<{t: number}> = ({t}) => {
  const {L, k} = useD();
  const sale = pr(t, 22.5, 0.3, eInOut);
  return (
    <AbsoluteFill style={{background: P.white}}>
      <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: L ? 'row' : 'column', gap: (L ? 46 : 10) * k, opacity: 1 - sale, filter: sale > 0.05 ? `blur(${sale * 10}px)` : undefined}}>
        <Pal t={t} at={K.solo + 0.1} dy={90} style={{transform: undefined}}><T s={130} color={P.ink}>Solo</T></Pal>
        <Pal t={t} at={K.solo + 0.4} dy={170} blur={18}><div style={{transform: `translateY(${-26 * k}px)`}}><T s={300} color={P.red}>elige</T></div></Pal>
        <Pal t={t} at={K.solo + 0.72} dy={110}><T s={130} color={P.ink}>y pide</T></Pal>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ======================================================================================================
// ESCENA 9 · iris circular y la marca que se arma: letras, el tacón cae como el punto del logo (22,6 – 25,5 s)
// ======================================================================================================
const Marca: React.FC<{t: number; incentivo: string}> = ({t, incentivo}) => {
  const {w, h, L, k} = useD();
  const p = pr(t, K.iris, 0.6, eInOut);
  const maxR = Math.hypot(w, h) / 2 + 40;
  const r = p * maxR;
  const caeAt = 23.75;
  const q = t - caeAt;
  const cae = q < 0 ? 0 : 1 - Math.exp(-q * 7) * Math.cos(q * 20);   // rebote amortiguado
  const marcaY = lerp(-400 * k, 0, cae);
  const onda = Math.max(0, 1 - Math.abs(q - 0.12) / 0.5);
  return (
    <AbsoluteFill style={{clipPath: `circle(${r}px at 50% 50%)`}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 40%, ${P.redLight} 0%, ${P.red} 65%)`}}>
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6 * k}}>
          <div style={{position: 'relative', height: 200 * k, width: 200 * k, display: 'flex', justifyContent: 'center'}}>
            {q > 0 ? <div style={{position: 'absolute', left: '50%', bottom: 10 * k, width: 260 * k * (0.4 + q * 2.2), height: 260 * k * (0.4 + q * 2.2) * 0.3, marginLeft: -130 * k * (0.4 + q * 2.2), borderRadius: '50%', border: `${4 * k}px solid ${P.gold}`, opacity: Math.max(0, 0.7 - q * 1.4)}} /> : null}
            <Img src={staticFile('img/logo-mark.svg')} style={{height: 190 * k, width: 'auto', transform: `translateY(${marcaY}px)`, opacity: q < -0.2 ? 0 : 1}} />
          </div>
          <Letras t={t} at={23.15} texto="Alexa" s={L ? 290 : 250} color={P.white} paso={0.08} />
          <Pal t={t} at={24.1} dy={40}><T s={L ? 130 : 130} color={P.gold}>Muy pronto.</T></Pal>
          {incentivo ? <Pal t={t} at={24.35} dy={20}><T s={50} color={P.white} weight={600}>{incentivo}</T></Pal> : null}
          <div style={{height: 18 * k}} />
          <Pal t={t} at={24.4} dy={20} blur={6} rebote={false}><T s={L ? 56 : 58} color={P.white} weight={600}>alexashop.cc · Choluteca</T></Pal>
        </AbsoluteFill>
      </AbsoluteFill>
      {/* aro dorado del iris */}
      <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, opacity: p > 0 && p < 1 ? 1 : 0}}><circle cx={w / 2} cy={h / 2} r={Math.max(0, r - 6 * k)} fill="none" stroke={P.gold} strokeWidth={12 * k} /></svg>
    </AbsoluteFill>
  );
};

// ======================================================================================================
// montaje: las capas se solapan; ninguna escena espera a que termine la anterior
// ======================================================================================================
export const ProximoDrop: React.FC<DropProps> = ({fecha, hora, incentivo, voz}) => {
  const f = useCurrentFrame();
  const {fps, width: w, height: h} = useVideoConfig();
  const t = f / fps;
  const k = Math.min(w, h) / 1080;

  // barrido líquido (1,1 – 1,7 s): la escena blanca aparece a la derecha del borde ondulado
  const pb = pr(t, K.barrido, 0.6, eInOut);
  const xb = lerp(w + 160 * k, -160 * k, pb);
  const bordeB = borde(h, xb, 34 * k, t * 6);
  const clipB = poly([...bordeB, [w + 400, h + 30], [w + 400, -30]]);
  const franja = poly([...bordeB.map(([x, y]) => [x - 110 * k, y] as Pt), ...bordeB.slice().reverse()]);

  // cinta de satén (3,9 – 4,8 s)
  const c = cintaPuntos(t, w, h);
  const clipNueva = poly([[-60, -30], ...c.trail, [-60, h + 30]]);
  const banda = [...c.trail, ...c.lead.slice().reverse()];

  return (
    <AbsoluteFill style={{background: P.red}}>
      {/* 0 – 2,6 s */}
      <Capa t={t} de={0} hasta={2.6}><Gancho t={t} /></Capa>
      {t >= K.barrido && t < 2.6 ? (
        <>
          <AbsoluteFill style={{clipPath: franja, backgroundColor: 'rgba(255,255,255,.34)', backgroundImage: 'repeating-linear-gradient(60deg, rgba(255,255,255,.35) 0 2px, transparent 2px 22px), repeating-linear-gradient(-60deg, rgba(255,255,255,.28) 0 2px, transparent 2px 22px)', opacity: 1 - cl((t - 1.65) / 0.15)}} />
          <AbsoluteFill style={{clipPath: pb < 1 ? clipB : undefined}}><SeViene t={t} /></AbsoluteFill>
        </>
      ) : null}
      {/* 2 – 4,9 s */}
      <Capa t={t} de={K.foto} hasta={K.cinta + 1.0}><FotoVentana t={t} /></Capa>
      {/* fondo blanco compartido por las escenas claras (4,9 – 23 s): así se solapan sin tapar a la anterior */}
      <Capa t={t} de={4.85} hasta={23.2} style={{background: P.white}}><AbsoluteFill /></Capa>
      {/* 4,3 – 9,4 s: la colina asoma detrás de la cinta */}
      {t >= K.colina && t < 9.5 ? <AbsoluteFill style={{clipPath: c.q < 1 ? clipNueva : undefined}}><Colina t={t} /></AbsoluteFill> : null}
      {t >= K.cinta && t < K.cinta + 1.0 ? (
        <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0}}>
          <defs>
            <linearGradient id="satin" gradientUnits="userSpaceOnUse" x1={c.trail[Math.floor(c.trail.length / 2)][0]} y1={0} x2={c.lead[Math.floor(c.lead.length / 2)][0]} y2={0}>
              <stop offset="0" stopColor="#6f1630" /><stop offset=".35" stopColor="#a8304f" /><stop offset=".5" stopColor="#c04a68" /><stop offset=".65" stopColor="#a8304f" /><stop offset="1" stopColor="#6f1630" />
            </linearGradient>
          </defs>
          <polygon points={banda.map((p) => p.join(',')).join(' ')} fill="url(#satin)" />
          <polyline points={c.lead.map((p) => p.join(',')).join(' ')} fill="none" stroke={P.gold} strokeWidth={9 * k} strokeLinejoin="round" />
          <polyline points={c.trail.map((p) => p.join(',')).join(' ')} fill="none" stroke={P.gold} strokeWidth={5 * k} strokeLinejoin="round" />
        </svg>
      ) : null}
      {/* 9,2 – 11,9 s */}
      <Capa t={t} de={K.palabras} hasta={K.punto + 0.05}><Palabras t={t} /></Capa>
      {/* 11,9 – 15,8 s (la ventana de 15,3 s la empuja) */}
      <Capa t={t} de={K.punto} hasta={K.ventana + 0.8}><Interfaz t={t} /></Capa>
      <Capa t={t} de={K.ventana} hasta={K.celular + 0.4}><Ventana t={t} fecha={fecha} hora={hora} /></Capa>
      <Capa t={t} de={K.celular - 0.1} hasta={K.solo + 0.05}><Celulares t={t} /></Capa>
      <Capa t={t} de={K.solo} hasta={K.iris + 0.7}><Solo t={t} /></Capa>
      <Capa t={t} de={K.iris} hasta={99}><Marca t={t} incentivo={incentivo} /></Capa>
      <Audio src={staticFile(`audio/6-ProximoDrop${voz ? '' : '-sinvoz'}.wav`)} />
    </AbsoluteFill>
  );
};
