// Identidad de Tiendas Alexa tomada de la web: vino oscuro, crema, dorado; Cormorant Garamond con cursiva dorada y Space Grotesk en versalitas.
import React from 'react';
import {AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame, Easing, delayRender, continueRender, random} from 'remotion';

export const C = {
  night: '#1b1114',
  wine: '#3b1220',
  wineLight: '#782f3a',
  paper: '#f7f4ee',
  cream: '#f7ead7',
  gold: '#d2a851',
  goldSoft: '#efdcab',
  ink: '#27211f',
};
export const F = {
  serif: "'Cormorant Alexa', Georgia, 'Times New Roman', serif",
  sans: "'Space Alexa', Arial, sans-serif",
};
export const W = 1080;
export const H = 1920;

// Fuentes de la web, cargadas una sola vez; el render espera a que estén listas.
if (typeof document !== 'undefined' && !(window as any).__alexaFonts) {
  (window as any).__alexaFonts = true;
  const espera = delayRender('fuentes de Alexa');
  const defs = [
    new FontFace('Cormorant Alexa', `url(${staticFile('fonts/cormorant-garamond-latin-wght-normal.woff2')})`, {weight: '300 700', style: 'normal'}),
    new FontFace('Cormorant Alexa', `url(${staticFile('fonts/cormorant-garamond-latin-wght-italic.woff2')})`, {weight: '300 700', style: 'italic'}),
    new FontFace('Space Alexa', `url(${staticFile('fonts/space-grotesk-400.ttf')})`, {weight: '400'}),
    new FontFace('Space Alexa', `url(${staticFile('fonts/space-grotesk-700.ttf')})`, {weight: '700'}),
  ];
  Promise.all(defs.map((d) => d.load()))
    .then((ls) => ls.forEach((f) => (document as any).fonts.add(f)))
    .catch((e) => console.error('No cargó una fuente', e))
    .finally(() => continueRender(espera));
}

const suave = Easing.bezier(0.2, 0.8, 0.2, 1);
export const prog = (f: number, ini: number, dur: number) =>
  interpolate(f, [ini, ini + dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: suave});

/** Fondo: foto de la web desenfocada, con tinte vino. El desenfoque cede un poco para dar la sensación de que algo se acerca. */
export const Bg: React.FC<{src?: string; blur?: [number, number]; dur?: number; dim?: number; pos?: string}> = ({src, blur = [60, 40], dur = 150, dim = 0.55, pos = 'center'}) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, dur], [1.15, 1.32], {extrapolateRight: 'clamp'});
  const b = interpolate(f, [0, dur], blur, {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: C.night}}>
      {src ? <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos, transform: `scale(${z})`, filter: `blur(${b}px) saturate(.85)`}} /> : null}
      <AbsoluteFill style={{background: `linear-gradient(180deg, rgba(27,17,20,${dim + 0.25}) 0%, rgba(59,18,32,${dim}) 55%, rgba(27,17,20,${dim + 0.3}) 100%)`}} />
    </AbsoluteFill>
  );
};

/** Grano de película: la misma textura del generador de imágenes, moviéndose a 15 cuadros por segundo. */
export const Grain: React.FC<{opacity?: number}> = ({opacity = 0.42}) => {
  const f = useCurrentFrame();
  const paso = Math.floor(f / 2);
  return (
    <AbsoluteFill style={{backgroundImage: `url(${staticFile('img/grain.png')})`, backgroundSize: `${W}px auto`, backgroundPosition: `${-random('gx' + paso) * 1000}px ${-random('gy' + paso) * 1000}px`, mixBlendMode: 'overlay', opacity, pointerEvents: 'none'}} />
  );
};

export const Vignette: React.FC = () => <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,.62) 100%)', pointerEvents: 'none'}} />;

/** Línea de texto que sube desde una máscara. */
export const Rise: React.FC<{at: number; dur?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({at, dur = 24, style, children}) => {
  const p = prog(useCurrentFrame(), at, dur);
  return (
    <div style={{overflow: 'hidden', paddingBottom: '0.14em', marginBottom: '-0.14em'}}>
      <div style={{transform: `translateY(${(1 - p) * 115}%)`, opacity: p > 0 ? 1 : 0, ...style}}>{children}</div>
    </div>
  );
};

export const Fade: React.FC<{at: number; dur?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({at, dur = 18, style, children}) => {
  const p = prog(useCurrentFrame(), at, dur);
  return <div style={{opacity: p, transform: `translateY(${(1 - p) * 14}px)`, ...style}}>{children}</div>;
};

export const Rule: React.FC<{at: number; width?: number}> = ({at, width = 120}) => {
  const p = prog(useCurrentFrame(), at, 26);
  return <div style={{height: 3, width: width * p, background: C.gold, margin: '0 auto'}} />;
};

/** Marca: tacón dorado + «lexa» + «Detalles & Obsequios», como en el encabezado de la web. */
export const Wordmark: React.FC<{scale?: number}> = ({scale = 1}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 22 * scale}}>
    <Img src={staticFile('img/logo-mark.svg')} style={{height: 118 * scale, width: 'auto'}} />
    <div style={{lineHeight: 1}}>
      <div style={{fontFamily: F.serif, fontSize: 104 * scale, color: C.cream, fontWeight: 500, letterSpacing: '.02em'}}>lexa</div>
      <div style={{fontFamily: F.sans, fontSize: 21 * scale, color: C.goldSoft, letterSpacing: '.32em', marginTop: 8 * scale, textTransform: 'uppercase'}}>Detalles &amp; Obsequios</div>
    </div>
  </div>
);

export const Caps: React.FC<{children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties}> = ({children, color = C.goldSoft, size = 28, style}) => (
  <div style={{fontFamily: F.sans, fontSize: size, color, letterSpacing: '.3em', textTransform: 'uppercase', fontWeight: 400, ...style}}>{children}</div>
);

export const Serif: React.FC<{size: number; color?: string; italic?: boolean; weight?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({size, color = C.cream, italic, weight = 400, style, children}) => (
  <div style={{fontFamily: F.serif, fontSize: size, lineHeight: 0.98, color, fontStyle: italic ? 'italic' : 'normal', fontWeight: weight, ...style}}>{children}</div>
);

/** Zona segura de Instagram: sin texto bajo los botones laterales (derecha) ni bajo el pie del Reel. */
export const Safe: React.FC<{children: React.ReactNode; justify?: string; style?: React.CSSProperties}> = ({children, justify = 'center', style}) => (
  <AbsoluteFill style={{padding: '240px 130px 430px 90px', display: 'flex', flexDirection: 'column', justifyContent: justify, alignItems: 'center', textAlign: 'center', ...style}}>{children}</AbsoluteFill>
);

/** Foto pegada con cinta, igual que las tarjetas de la web. */
export const TapePhoto: React.FC<{src: string; rot?: number; at: number; size?: number}> = ({src, rot = -4, at, size = 700}) => {
  const f = useCurrentFrame();
  const p = prog(f, at, 26);
  return (
    <div style={{position: 'relative', width: size, background: '#fffdf9', padding: 22, boxShadow: '0 40px 80px rgba(0,0,0,.5)', transform: `rotate(${rot * p}deg) translateY(${(1 - p) * 120}px) scale(${0.92 + 0.08 * p})`, opacity: p}}>
      <div style={{position: 'absolute', top: -34, left: '50%', width: 190, height: 62, marginLeft: -95, background: 'rgba(210,168,81,.78)', transform: 'rotate(-3deg)'}} />
      <Img src={staticFile(src)} style={{width: '100%', height: size - 44, objectFit: 'cover', display: 'block'}} />
    </div>
  );
};

/** Escena: entra y sale con fundido para que los cortes no se sientan secos. */
export const Scene: React.FC<{dur: number; children: React.ReactNode}> = ({dur, children}) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 6, dur - 8, dur], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{opacity: o}}>{children}</AbsoluteFill>;
};

export const Pulse: React.FC = () => {
  const f = useCurrentFrame();
  const l = 0.5 + 0.5 * Math.sin(f / 5.5);
  return <div style={{width: 18, height: 18, borderRadius: 9, background: C.gold, boxShadow: `0 0 ${14 + 22 * l}px ${4 + 8 * l}px rgba(210,168,81,${0.3 + 0.3 * l})`}} />;
};
