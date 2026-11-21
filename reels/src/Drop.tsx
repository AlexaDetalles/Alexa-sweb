import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Bg, Grain, Vignette, Rise, Fade, Safe, Scene, Serif, Caps, prog, C, F, W, H} from './brand';

// «6-ProximoDrop» · 22 s · anuncio SIN fecha de un nuevo drop (ropa, accesorios, tenis y más).
// Técnica: preguntas de gancho, una palabra de acento por frase, tarjetas que caen con rebote, texto que pasa por detrás del producto,
// la web en un celular y la marca que se arma. 90 pulsos por minuto = un pulso cada 20 cuadros (los `at` coinciden con audio/musica.py).
// Nada de lo que todavía no existe se muestra: la fecha, la hora y el incentivo solo salen si vienen en props.json.

export type DropProps = {fecha: string; hora: string; incentivo: string; voz: boolean};
export const dropPorDefecto: DropProps = {fecha: '', hora: '', incentivo: '', voz: true};
export const DROP_FRAMES = 660;

const Latido: React.FC = () => {
  const f = useCurrentFrame();
  const env = Math.exp(-((f % 20) / 5));
  return <AbsoluteFill style={{background: `radial-gradient(circle at 50% 42%, rgba(210,168,81,${0.12 * env}) 0%, rgba(210,168,81,0) 62%)`, pointerEvents: 'none'}} />;
};

// ---------- pictogramas (línea dorada, sin fotos: esas piezas aún no están en la web) ----------
const Perchero: React.FC<{c: string}> = ({c}) => (
  <svg viewBox="0 0 120 100" width="210" height="175" fill="none" stroke={c} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M60 40 V34 C60 27 69 25 69 17 a9 9 0 1 0 -18 0" />
    <path d="M60 40 L13 73 Q7 78 14 82 H106 Q113 78 107 73 Z" />
  </svg>
);
const Reloj: React.FC<{c: string}> = ({c}) => (
  <svg viewBox="0 0 120 120" width="190" height="190" fill="none" stroke={c} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="60" cy="60" r="27" />
    <path d="M60 44 V60 L71 66" />
    <path d="M48 34 L52 12 H68 L72 34" />
    <path d="M48 86 L52 108 H68 L72 86" />
  </svg>
);
const Tenis: React.FC<{c: string}> = ({c}) => (
  <svg viewBox="0 0 160 90" width="260" height="146" fill="none" stroke={c} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 72 H152" />
    <path d="M8 72 V54 C8 47 13 45 19 45 H40 C51 45 55 36 63 29 L70 23 C75 29 82 33 90 35 L121 41 C141 45 152 55 152 66 V72" />
    <path d="M72 38 L80 31 M82 42 L90 35 M93 45 L101 38" />
  </svg>
);
const Mas: React.FC<{c: string}> = ({c}) => (
  <svg viewBox="0 0 120 100" width="190" height="158" fill="none" stroke={c} strokeWidth="4.5" strokeLinecap="round">
    <path d="M60 22 V68 M37 45 H83" />
    <circle cx="28" cy="86" r="2.5" fill={c} /><circle cx="60" cy="86" r="2.5" fill={c} /><circle cx="92" cy="86" r="2.5" fill={c} />
  </svg>
);

// ---------- 1 · gancho (0-2 s) ----------
const Gancho: React.FC<{dur: number}> = ({dur}) => (
  <Scene dur={dur}>
    <Bg src="img/hero.webp" blur={[75, 55]} dur={dur} />
    <Safe>
      <Rise at={6}><Serif size={122}>¿Ya viste lo que</Serif></Rise>
      <Rise at={16}><Serif size={226} italic color={C.gold}>se viene?</Serif></Rise>
    </Safe>
  </Scene>
);

// ---------- 2 · tarjetas que caen (2-6 s) ----------
const Tarjeta: React.FC<{at: number; x: number; y: number; rot: number; titulo: string; oro?: boolean; children: React.ReactNode}> = ({at, x, y, rot, titulo, oro, children}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: f - at, fps, config: {damping: 11, stiffness: 120, mass: 0.9}});
  const aparece = f >= at ? 1 : 0;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 400, height: 430, opacity: aparece, transform: `translateY(${(1 - s) * -1100}px) rotate(${rot * s}deg)`,
      background: oro ? C.gold : C.cream, borderRadius: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
      boxShadow: '0 34px 70px rgba(0,0,0,.45)'}}>
      {children}
      <div style={{fontFamily: F.serif, fontSize: 70, fontWeight: 500, color: oro ? C.night : C.wine, fontStyle: oro ? 'italic' : 'normal', lineHeight: 1}}>{titulo}</div>
    </div>
  );
};
const Tarjetas: React.FC<{dur: number}> = ({dur}) => (
  <Scene dur={dur}>
    <AbsoluteFill style={{background: C.wine}} />
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 30%, rgba(210,168,81,.16) 0%, rgba(210,168,81,0) 60%)`}} />
    <AbsoluteFill>
      <Tarjeta at={14} x={110} y={330} rot={-3} titulo="Ropa"><Perchero c={C.wine} /></Tarjeta>
      <Tarjeta at={34} x={570} y={390} rot={3} titulo="Accesorios"><Reloj c={C.wine} /></Tarjeta>
      <Tarjeta at={54} x={110} y={820} rot={2.5} titulo="Tenis"><Tenis c={C.wine} /></Tarjeta>
      <Tarjeta at={74} x={570} y={880} rot={-2.5} titulo="y más…" oro><Mas c={C.night} /></Tarjeta>
    </AbsoluteFill>
  </Scene>
);

// ---------- 3 · «drop» pasa por detrás del reloj (6-10 s) ----------
const Detras: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  const p = prog(f, 20, 34);
  const flota = Math.sin(f / 16) * 9;
  const palabra = prog(f, 8, 30);
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{background: C.cream}} />
      <Safe justify="flex-start" style={{paddingTop: 250}}>
        <Rise at={4}><Serif size={118} color={C.wine}>Un nuevo</Serif></Rise>
      </Safe>
      <div style={{position: 'absolute', top: 330, left: 0, width: W, textAlign: 'center', fontFamily: F.serif, fontStyle: 'italic', fontSize: 500, color: C.gold, lineHeight: 1, letterSpacing: '-.02em', opacity: palabra, transform: `translateY(${(1 - palabra) * 60}px)`}}>drop</div>
      {/* Recorte del reloj (fondo blanco quitado desde el borde, sin tocar el producto): la palabra «drop» queda de verdad detrás. Las correas se desvanecen porque la foto original las corta. */}
      <AbsoluteFill>
        <Img src={staticFile('img/reloj-dorado-recorte.webp')} style={{position: 'absolute', left: (W - 800) / 2, top: 610, width: 800, height: 800, objectFit: 'contain', opacity: p,
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)', maskImage: 'linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)',
          filter: 'drop-shadow(0 40px 40px rgba(59,18,32,.35))',
          transform: `translateY(${(1 - p) * 300 + flota}px) scale(${0.86 + 0.14 * p}) rotate(${(1 - p) * -6}deg)`}} />
      </AbsoluteFill>
      <Safe justify="flex-end" style={{paddingBottom: 440}}>
        <Fade at={52}><Caps color={C.wineLight} size={34}>en Tiendas Alexa</Caps></Fade>
      </Safe>
    </Scene>
  );
};

// ---------- 4 · la web en el celular (10-14,7 s) ----------
const Celular: React.FC<{dur: number; fecha: string; hora: string}> = ({dur, fecha, hora}) => {
  const f = useCurrentFrame();
  const sube = prog(f, 10, 36);
  const pw = 540, ph = pw * (1688 / 780); // pantalla: misma proporción que la captura real
  const k = pw / 780; // de píxeles de la captura a píxeles en pantalla
  const aro = (at: number, x: number, y: number, w: number, h: number) => {
    const a = prog(f, at, 14);
    const l = 0.5 + 0.5 * Math.sin((f - at) / 4);
    return <div style={{position: 'absolute', left: x * k - 8, top: y * k - 8, width: w * k + 16, height: h * k + 16, borderRadius: 999, border: `5px solid ${C.gold}`, opacity: a, boxShadow: `0 0 ${10 + 18 * l}px rgba(210,168,81,.8)`}} />;
  };
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{background: C.night}} />
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 70%, rgba(120,47,58,.55) 0%, rgba(120,47,58,0) 65%)`}} />
      <Safe justify="flex-start" style={{paddingTop: 220}}>
        <Rise at={4}><Serif size={92}>{fecha ? 'Llega el' : 'Llega en'}</Serif></Rise>
        <Rise at={12}><Serif size={fecha ? 130 : 138} italic color={C.gold}>{fecha || 'estas semanas'}</Serif></Rise>
        {fecha && hora ? <Fade at={24}><Caps size={34}>{hora}</Caps></Fade> : null}
      </Safe>
      <div style={{position: 'absolute', left: (W - pw) / 2 - 14, top: 590 + (1 - sube) * 900, width: pw + 28, height: ph + 28, borderRadius: 70, background: '#0c0708', border: '3px solid #3a2a2d', padding: 14, boxShadow: '0 50px 100px rgba(0,0,0,.6)'}}>
        <div style={{position: 'relative', width: pw, height: ph, borderRadius: 58, overflow: 'hidden', background: C.paper}}>
          <Img src={staticFile('img/movil-catalogo.webp')} style={{width: pw, height: ph, display: 'block'}} />
          {aro(52, 408, 760, 140, 82)}
          {aro(66, 564, 760, 142, 82)}
          {aro(80, 44, 858, 214, 82)}
        </div>
      </div>
    </Scene>
  );
};

// ---------- 5 · llamado a la acción (14,7-18 s) ----------
const Whatsapp: React.FC<{c: string; bg: string}> = ({c, bg}) => (
  <svg viewBox="0 0 24 24" width="64" height="64">
    <circle cx="12" cy="12" r="12" fill={bg} />
    <path d="M12 4.2a7.8 7.8 0 0 0-6.7 11.8L4.2 19.8l3.9-1a7.8 7.8 0 1 0 3.9-14.6z" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M9.2 8.6c.2-.4.5-.4.7-.4h.3c.2 0 .3.1.4.3l.6 1.4c.1.2 0 .3-.1.5l-.4.5c-.1.1-.1.2 0 .3.5.8 1.1 1.4 1.9 1.8.2.1.3.1.4 0l.5-.6c.1-.2.3-.2.5-.1l1.4.7c.2.1.3.2.2.4-.1.6-.6 1.2-1.3 1.3-.5.1-1.2 0-2.3-.5-1.7-.8-2.9-2.1-3.5-3.3-.4-.8-.3-1.5.1-2z" fill={c} />
  </svg>
);
const Accion: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const b = spring({frame: f - 40, fps, config: {damping: 12, stiffness: 140}});
  const press = f > 70 ? 1 - 0.05 * Math.exp(-(f - 70) / 4) : 1;
  return (
    <Scene dur={dur}>
      <Bg src="img/gift-feature.webp" blur={[60, 44]} dur={dur} dim={0.6} />
      <Safe>
        <Rise at={4}><Serif size={96}>Entra a</Serif></Rise>
        <Rise at={12}><Serif size={146} italic color={C.gold}>alexashop.cc</Serif></Rise>
        <div style={{height: 36}} />
        <Rise at={24}><Serif size={78}>y escríbenos por WhatsApp</Serif></Rise>
        <div style={{height: 70}} />
        <div style={{display: 'flex', alignItems: 'center', gap: 22, background: C.gold, borderRadius: 999, padding: '26px 52px 26px 34px', transform: `scale(${(0.6 + 0.4 * b) * press})`, opacity: Math.min(1, b * 1.4),
          boxShadow: '0 24px 60px rgba(0,0,0,.45)'}}>
          <Whatsapp c={C.gold} bg={C.night} />
          <span style={{fontFamily: F.sans, fontWeight: 700, fontSize: 48, color: C.night}}>Escríbenos</span>
        </div>
      </Safe>
    </Scene>
  );
};

// ---------- 6 · la marca se arma (18-22 s) ----------
const Marca: React.FC<{dur: number; incentivo: string}> = ({dur, incentivo}) => {
  const f = useCurrentFrame();
  const sello = prog(f, 6, 28);
  const letras = 'Alexa'.split('');
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{background: C.wine}} />
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 40%, rgba(210,168,81,.22) 0%, rgba(210,168,81,0) 60%)`}} />
      <Safe>
        <Img src={staticFile('img/logo-mark.svg')} style={{height: 190, width: 'auto', opacity: sello, transform: `translateY(${(1 - sello) * -50}px) scale(${0.8 + 0.2 * sello})`}} />
        <div style={{display: 'flex', gap: 4, marginTop: 24}}>
          {letras.map((l, i) => {
            const p = prog(f, 18 + i * 4, 18);
            return <span key={i} style={{display: 'inline-block', fontFamily: F.serif, fontSize: 210, fontWeight: 500, color: C.cream, lineHeight: 0.95, opacity: p, transform: `translateY(${(1 - p) * 70}px)`}}>{l}</span>;
          })}
        </div>
        <Fade at={44}><Caps size={26} color={C.goldSoft}>Detalles &amp; Obsequios</Caps></Fade>
        <div style={{height: 70}} />
        <Rise at={58}><Serif size={128} italic color={C.gold}>Muy pronto.</Serif></Rise>
        {incentivo ? <><div style={{height: 26}} /><Fade at={76}><Caps size={30} color={C.cream}>{incentivo}</Caps></Fade></> : null}
        <div style={{height: 44}} />
        <Fade at={86}><Caps size={30}>alexashop.cc · Choluteca</Caps></Fade>
      </Safe>
    </Scene>
  );
};

export const ProximoDrop: React.FC<DropProps> = ({fecha, hora, incentivo, voz}) => (
  <AbsoluteFill style={{background: C.night}}>
    <Sequence durationInFrames={60}><Gancho dur={60} /></Sequence>
    <Sequence from={60} durationInFrames={120}><Tarjetas dur={120} /></Sequence>
    <Sequence from={180} durationInFrames={120}><Detras dur={120} /></Sequence>
    <Sequence from={300} durationInFrames={140}><Celular dur={140} fecha={fecha} hora={hora} /></Sequence>
    <Sequence from={440} durationInFrames={100}><Accion dur={100} /></Sequence>
    <Sequence from={540} durationInFrames={120}><Marca dur={120} incentivo={incentivo} /></Sequence>
    <Latido />
    <Vignette />
    <Grain />
    <Audio src={staticFile(`audio/6-ProximoDrop${voz ? '' : '-sinvoz'}.wav`)} />
  </AbsoluteFill>
);
