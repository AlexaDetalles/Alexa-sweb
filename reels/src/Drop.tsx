import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, continueRender, delayRender, Easing} from 'remotion';

// «6-ProximoDrop» · 24 s · 30 fps · anuncio SIN fecha de un nuevo drop (ropa, accesorios, tenis y más). Sale en 16:9 (1920×1080, como el video de referencia) y en 9:16 (1080×1920).
// Estilo del video de referencia, escena por escena: bloques planos que se alternan (vino y blanco), tipografía redonda y gruesa con UNA palabra de acento,
// cortes de ~1 s, tarjetas que caen sobre una colina con una mascota, ventana redondeada con foto y texto encima, tarjetas de interfaz, celular con la web y marca que se arma.
// Solo se imita ritmo y estructura: ni su metraje, ni sus personajes, ni su audio, ni sus textos. 120 pulsos por minuto = un pulso cada 15 cuadros; todos los cortes caen en un pulso.
// Lo que aún no existe (fecha, hora, incentivo) solo sale si viene en props.json.

export type DropProps = {fecha: string; hora: string; incentivo: string; voz: boolean};
export const dropPorDefecto: DropProps = {fecha: '', hora: '', incentivo: '', voz: true};
export const DROP_FRAMES = 720;

const P = {red: '#8c1e3c', redDark: '#5e1228', ink: '#1b1114', white: '#ffffff', gold: '#d2a851', cream: '#f7ead7', rose: '#f6d3da', gris: '#f1ecee'};
const FF = "'Fredoka Alexa', 'Arial Rounded MT Bold', Arial, sans-serif";

if (typeof document !== 'undefined' && !(window as any).__fredokaAlexa) {
  (window as any).__fredokaAlexa = true;
  const espera = delayRender('fuente Fredoka');
  Promise.all([
    new FontFace('Fredoka Alexa', `url(${staticFile('fonts/fredoka-latin-600-normal.woff2')})`, {weight: '600'}),
    new FontFace('Fredoka Alexa', `url(${staticFile('fonts/fredoka-latin-700-normal.woff2')})`, {weight: '700'}),
  ].map((d) => d.load())).then((ls) => ls.forEach((f) => (document as any).fonts.add(f))).catch((e) => console.error('Fuente', e)).finally(() => continueRender(espera));
}

// ---------- tamaño y orientación ----------
/** u escala los tamaños de letra (se diseñaron para 1080 de ancho en vertical); L = horizontal. */
const useD = () => {
  const {width, height} = useVideoConfig();
  const L = width > height;
  return {w: width, h: height, L, u: L ? 0.78 : 1};
};

// ---------- movimiento ----------
const useSpring = (at: number, damping = 11, stiffness = 150) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: f - at, fps, config: {damping, stiffness, mass: 0.8}});
};
const lin = (f: number, a: number, b: number, from = 0, to = 1) => interpolate(f, [a, b], [from, to], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});

const Txt: React.FC<{size: number; color?: string; weight?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({size, color = P.ink, weight = 700, style, children}) => {
  const {u} = useD();
  return <div style={{fontFamily: FF, fontWeight: weight, fontSize: size * u, lineHeight: 1, letterSpacing: '-0.02em', color, whiteSpace: 'nowrap', ...style}}>{children}</div>;
};
/** Línea que entra con rebote desde un lado. */
const Entra: React.FC<{at: number; from?: 'izq' | 'der' | 'abajo' | 'escala'; style?: React.CSSProperties; children: React.ReactNode}> = ({at, from = 'abajo', style, children}) => {
  const s = useSpring(at);
  const f = useCurrentFrame();
  const {w} = useD();
  const tr = from === 'izq' ? `translateX(${(1 - s) * -w}px)` : from === 'der' ? `translateX(${(1 - s) * w}px)` : from === 'escala' ? `scale(${0.3 + 0.7 * s})` : `translateY(${(1 - s) * 140}px)`;
  return <div style={{transform: tr, opacity: f >= at ? 1 : 0, ...style}}>{children}</div>;
};
const Bloque: React.FC<{bg: string; children: React.ReactNode}> = ({bg, children}) => <AbsoluteFill style={{background: bg}}>{children}</AbsoluteFill>;
const Centro: React.FC<{style?: React.CSSProperties; children: React.ReactNode}> = ({style, children}) => (
  <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', ...style}}>{children}</AbsoluteFill>
);
/** Columna de texto alineada a la izquierda; en horizontal con un margen más grande. */
const Col: React.FC<{padTop?: number; gap?: number; children: React.ReactNode}> = ({padTop = 0, gap = 14, children}) => {
  const {L} = useD();
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', paddingTop: padTop, paddingLeft: L ? 150 : 70, gap}}>
      {children}
    </AbsoluteFill>
  );
};

// ---------- ilustraciones (rellenas y redondeadas, como los objetos de las tarjetas de referencia) ----------
const Perchero: React.FC<{w?: number}> = ({w = 230}) => (
  <svg viewBox="0 0 120 100" width={w} height={w * 0.83}>
    <path d="M60 40 V34 C60 27 69 25 69 17 a9 9 0 1 0 -18 0" fill="none" stroke={P.red} strokeWidth="6" strokeLinecap="round" />
    <path d="M60 38 L11 72 Q4 78 13 83 H107 Q116 78 109 72 Z" fill={P.red} />
    <path d="M60 46 L22 73 H98 Z" fill="#b13a5a" opacity=".55" />
    <path d="M20 79 H100" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".5" />
  </svg>
);
const Tenis: React.FC<{w?: number}> = ({w = 270}) => (
  <svg viewBox="0 0 160 92" width={w} height={w * 0.575}>
    <path d="M8 72 V52 C8 46 12 44 18 44 H40 C51 44 55 35 63 28 L70 22 C75 28 82 32 90 34 L121 40 C141 44 152 54 152 66 V72 Z" fill={P.red} />
    <path d="M70 22 C75 28 82 32 90 34 L121 40 C128 41 134 44 139 48 L100 50 C86 48 76 40 70 22 Z" fill="#b13a5a" opacity=".6" />
    <rect x="4" y="68" width="152" height="16" rx="8" fill="#fff" stroke={P.red} strokeWidth="3" />
    <path d="M73 36 L82 29 M84 41 L93 34 M95 45 L104 38" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
  </svg>
);
const Mas: React.FC<{w?: number}> = ({w = 200}) => (
  <svg viewBox="0 0 120 100" width={w} height={w * 0.83}>
    <circle cx="60" cy="48" r="38" fill={P.red} />
    <path d="M60 28 V68 M40 48 H80" stroke="#fff" strokeWidth="9" strokeLinecap="round" />
    <circle cx="28" cy="92" r="3.5" fill={P.red} /><circle cx="60" cy="92" r="3.5" fill={P.red} /><circle cx="92" cy="92" r="3.5" fill={P.red} />
  </svg>
);
const Lupa: React.FC = () => (
  <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke={P.ink} strokeWidth="2.4" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 L21 21" /></svg>
);
const WhatsApp: React.FC<{c: string; bg: string; s?: number}> = ({c, bg, s = 96}) => (
  <svg viewBox="0 0 24 24" width={s} height={s}>
    <circle cx="12" cy="12" r="12" fill={bg} />
    <path d="M12 4.2a7.8 7.8 0 0 0-6.7 11.8L4.2 19.8l3.9-1a7.8 7.8 0 1 0 3.9-14.6z" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M9.2 8.6c.2-.4.5-.4.7-.4h.3c.2 0 .3.1.4.3l.6 1.4c.1.2 0 .3-.1.5l-.4.5c-.1.1-.1.2 0 .3.5.8 1.1 1.4 1.9 1.8.2.1.3.1.4 0l.5-.6c.1-.2.3-.2.5-.1l1.4.7c.2.1.3.2.2.4-.1.6-.6 1.2-1.3 1.3-.5.1-1.2 0-2.3-.5-1.7-.8-2.9-2.1-3.5-3.3-.4-.8-.3-1.5.1-2z" fill={c} />
  </svg>
);
const RelojFoto: React.FC<{h: number}> = ({h}) => (
  <Img src={staticFile('img/reloj-dorado-recorte.webp')} style={{height: h, width: 'auto', filter: 'drop-shadow(0 14px 16px rgba(94,18,40,.35))',
    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 12%, #000 88%, transparent 100%)', maskImage: 'linear-gradient(to bottom, transparent 0%, #000 12%, #000 88%, transparent 100%)'}} />
);

// ---------- 1-2 · gancho (0-2 s) ----------
const Gancho1: React.FC = () => (
  <Bloque bg={P.red}>
    <Col gap={24}>
      <Entra at={2} from="izq"><Txt size={210} color={P.white}>¿Ya viste</Txt></Entra>
      <Entra at={9} from="der"><Txt size={210} color={P.white}>lo que</Txt></Entra>
    </Col>
  </Bloque>
);
const Gancho2: React.FC = () => {
  const {L} = useD();
  return (
    <Bloque bg={P.white}>
      <Centro style={{gap: 10, flexDirection: L ? 'row' : 'column', alignItems: 'center'}}>
        <Entra at={0} from="escala" style={{marginRight: L ? 36 : 0}}><Txt size={L ? 250 : 170} color={P.ink}>se</Txt></Entra>
        <Entra at={3} from="escala"><Txt size={270} color={P.red}>viene?</Txt></Entra>
      </Centro>
    </Bloque>
  );
};

// ---------- 3 · ventana con foto; «nuevo» pasa por detrás de la cartera (2-3,5 s) ----------
const Ventana: React.FC<{src: string; w: number; h: number; borde?: string; children?: React.ReactNode; zoom?: number}> = ({src, w, h, borde = P.rose, children, zoom = 1}) => (
  <div style={{position: 'relative', width: w, height: h, borderRadius: 64, overflow: 'hidden', border: `10px solid ${borde}`, boxShadow: '0 30px 70px rgba(0,0,0,.28)', background: P.redDark}}>
    <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`}} />
    {children}
  </div>
);
const AlgoNuevo: React.FC = () => {
  const f = useCurrentFrame();
  const s = useSpring(10, 10, 140);
  const {L} = useD();
  const vw = L ? 1560 : 940, vh = L ? 860 : 1180;
  return (
    <Bloque bg={P.red}>
      <Centro>
        <Entra at={0} from="escala">
          <Ventana src="img/hero.webp" w={vw} h={vh} zoom={1.1 + f * 0.0016}>
            <AbsoluteFill style={{background: 'rgba(94,18,40,.55)'}} />
            <AbsoluteFill style={{display: 'flex', flexDirection: L ? 'row' : 'column', justifyContent: 'center', alignItems: 'center', gap: L ? 40 : 0}}>
              <Entra at={4} from="izq"><Txt size={190} color={P.white}>algo</Txt></Entra>
              <Entra at={8} from="der"><Txt size={260} color={P.gold}>nuevo</Txt></Entra>
            </AbsoluteFill>
            {/* La cartera va DELANTE del texto: el texto pasa por detrás. */}
            <Img src={staticFile('img/cartera-recorte.webp')} style={{position: 'absolute', left: L ? 940 : 430, top: (L ? 250 : 700) + (1 - s) * 700, width: L ? 400 : 440, height: 'auto', transform: `rotate(${(1 - s) * 10}deg)`, filter: 'drop-shadow(0 30px 30px rgba(0,0,0,.4))'}} />
          </Ventana>
        </Entra>
      </Centro>
    </Bloque>
  );
};

// ---------- 4 · colina con tarjetas que caen (3,5-8 s) ----------
const Mascota: React.FC<{f: number; k?: number}> = ({f, k = 1}) => {
  const salto = Math.abs(Math.sin(f / 5)) * 22 * k;
  return (
    <svg viewBox="0 0 220 230" width={260 * k} height={272 * k} style={{transform: `translateY(${-salto}px)`}}>
      <path d="M78 66 C78 20 142 20 142 66" fill="none" stroke={P.gold} strokeWidth="11" strokeLinecap="round" />
      <rect x="28" y="62" width="164" height="136" rx="30" fill={P.cream} />
      <rect x="28" y="104" width="164" height="22" fill={P.red} />
      <circle cx="82" cy="152" r="11" fill={P.ink} /><circle cx="138" cy="152" r="11" fill={P.ink} />
      <circle cx="85" cy="148" r="3.5" fill="#fff" /><circle cx="141" cy="148" r="3.5" fill="#fff" />
      <path d="M95 172 Q110 184 125 172" fill="none" stroke={P.ink} strokeWidth="5" strokeLinecap="round" />
      <circle cx="68" cy="212" r="14" fill={P.ink} /><circle cx="152" cy="212" r="14" fill={P.ink} />
    </svg>
  );
};
const TarjetaCae: React.FC<{at: number; dur: number; titulo: string; children: React.ReactNode}> = ({at, dur, titulo, children}) => {
  const f = useCurrentFrame();
  const s = useSpring(at, 9, 170);
  const sal = lin(f, at + dur - 7, at + dur, 0, 1);
  const {L, w} = useD();
  if (f < at || f > at + dur) return null;
  const cw = L ? 640 : 700, ch = L ? 400 : 470;
  return (
    <div style={{position: 'absolute', left: (w - cw) / 2, top: (L ? 90 : 330) + sal * 700, width: cw, height: ch, borderRadius: 56, background: P.rose, transform: `scale(${0.45 + 0.55 * s}) rotate(${sal * 14}deg)`, opacity: 1 - sal,
      boxShadow: '0 0 90px rgba(140,30,60,.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18}}>
      {children}
      <Txt size={104} color={P.red}>{titulo}</Txt>
    </div>
  );
};
const Colina: React.FC = () => {
  const f = useCurrentFrame();
  const {L, w, h} = useD();
  const hh = L ? 420 : 760;
  const apice = hh * 0.34;
  return (
    <Bloque bg={P.white}>
      <svg viewBox={`0 0 ${w} ${hh}`} width={w} height={hh} style={{position: 'absolute', left: 0, bottom: 0}}>
        <path d={`M-60 ${hh} L-60 ${hh * 0.68} Q${w / 2} ${-hh * 0.02} ${w + 60} ${hh * 0.68} L${w + 60} ${hh} Z`} fill={P.red} />
      </svg>
      <div style={{position: 'absolute', left: w / 2 - (L ? 100 : 130), top: h - hh + apice - (L ? 150 : 250)}}><Mascota f={f} k={L ? 0.75 : 1} /></div>
      <TarjetaCae at={0} dur={36} titulo="Ropa"><Perchero w={L ? 150 : 210} /></TarjetaCae>
      <TarjetaCae at={33} dur={36} titulo="Accesorios"><RelojFoto h={L ? 190 : 250} /></TarjetaCae>
      <TarjetaCae at={66} dur={36} titulo="Tenis"><Tenis w={L ? 190 : 270} /></TarjetaCae>
      <TarjetaCae at={99} dur={36} titulo="y más…"><Mas w={L ? 150 : 200} /></TarjetaCae>
    </Bloque>
  );
};

// ---------- 5-6 · «Un nuevo drop de Alexa» (8-11 s) ----------
const UnNuevo: React.FC = () => (
  <Bloque bg={P.white}>
    <Col><Entra at={1} from="izq"><Txt size={170} color={P.ink}>Un nuevo</Txt></Entra></Col>
  </Bloque>
);
const DropAlexa: React.FC = () => {
  const s = useSpring(4, 10, 130);
  const f = useCurrentFrame();
  const {L} = useD();
  return (
    <Bloque bg={P.white}>
      <Col gap={20}>
        <Entra at={0} from="izq"><Txt size={330} color={P.red}>drop</Txt></Entra>
        <Entra at={8} from="izq"><Txt size={92} color={P.ink}>de Tiendas Alexa</Txt></Entra>
      </Col>
      <Img src={staticFile('img/cartera-recorte.webp')} style={{position: 'absolute', right: L ? 170 : 30, bottom: (L ? 20 : 130) + (1 - s) * -900 - Math.sin(f / 9) * 10, width: L ? 520 : 500, height: 'auto', transform: `rotate(${-8 + (1 - s) * 14}deg)`, filter: 'drop-shadow(0 30px 30px rgba(0,0,0,.25))'}} />
    </Bloque>
  );
};

// ---------- 7 · botón (11-12 s) ----------
const Boton: React.FC = () => {
  const s = useSpring(2, 8, 160);
  const f = useCurrentFrame();
  const {L, u} = useD();
  const aro = (k: number) => {
    const t = lin(f, 8 + k * 5, 26 + k * 5, 0, 1);
    return <div key={k} style={{position: 'absolute', width: (560 + t * 520) * (L ? 1.3 : 1), height: (160 + t * 520) * (L ? 0.8 : 1), borderRadius: 999, border: `6px solid ${P.red}`, opacity: (1 - t) * 0.5}} />;
  };
  return (
    <Bloque bg={P.white}>
      <Centro>
        {[0, 1, 2].map(aro)}
        <div style={{transform: `scale(${0.4 + 0.6 * s})`, background: P.red, borderRadius: 999, padding: `${44 * u}px ${100 * u}px`, boxShadow: '0 30px 70px rgba(140,30,60,.35)'}}>
          <Txt size={104} color={P.white}>alexashop.cc</Txt>
        </div>
      </Centro>
    </Bloque>
  );
};

// ---------- 8 · tarjetas de interfaz (12-13 s) ----------
const Interfaz: React.FC = () => {
  const {L} = useD();
  const cw = L ? 420 : 300, ch = L ? 380 : 340;
  const item = (i: number, titulo: string, ic: React.ReactNode) => {
    const s = useSpring(2 + i * 3, 12, 170);
    return (
      <div key={titulo} style={{width: cw, height: ch, borderRadius: 44, background: P.gris, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, transform: `translateY(${(1 - s) * 260}px)`, opacity: Math.min(1, s * 1.6)}}>
        {ic}<Txt size={L ? 78 : 52} color={P.ink} weight={600}>{titulo}</Txt>
      </div>
    );
  };
  const b = useSpring(11, 12, 170);
  return (
    <Bloque bg={P.white}>
      <Centro style={{gap: 50}}>
        <div style={{display: 'flex', gap: 40}}>
          {item(0, 'Ropa', <Perchero w={L ? 190 : 150} />)}
          {item(1, 'Tenis', <Tenis w={L ? 220 : 170} />)}
          {item(2, 'Accesorios', <RelojFoto h={L ? 190 : 150} />)}
        </div>
        <div style={{width: cw * 3 + 80, height: L ? 140 : 150, borderRadius: 75, background: P.gris, display: 'flex', alignItems: 'center', gap: 30, padding: '0 50px', transform: `translateY(${(1 - b) * 200}px)`, opacity: Math.min(1, b * 1.6)}}>
          <Lupa /><Txt size={L ? 78 : 52} color="#6f6266" weight={600}>Busca tu próximo favorito…</Txt>
        </div>
      </Centro>
    </Bloque>
  );
};

// ---------- 9 · mensaje de WhatsApp (13-14 s) ----------
const Mensaje: React.FC = () => {
  const s = useSpring(1, 11, 150);
  const t = useSpring(9, 8, 200);
  const {L} = useD();
  return (
    <Bloque bg={P.white}>
      <Centro>
        <div style={{width: L ? 1240 : 900, borderRadius: 52, border: `8px solid ${P.red}`, padding: L ? '50px 60px' : '56px 56px 50px', display: 'flex', flexDirection: 'column', gap: 30, transform: `scale(${0.5 + 0.5 * s})`, opacity: Math.min(1, s * 1.5), background: P.white}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 28}}>
            <WhatsApp c={P.white} bg={P.red} s={L ? 120 : 110} />
            <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
              <Txt size={L ? 92 : 64} color={P.ink}>Tiendas Alexa</Txt>
              <div style={{background: P.gold, color: P.ink, fontFamily: FF, fontWeight: 700, fontSize: 30, padding: '6px 20px', borderRadius: 10, alignSelf: 'flex-start', letterSpacing: '.04em'}}>WHATSAPP</div>
            </div>
          </div>
          <Txt size={L ? 98 : 62} color={P.ink} weight={600} style={{whiteSpace: 'normal', lineHeight: 1.12, opacity: t}}>Hola Alexa, quiero ver el nuevo drop</Txt>
        </div>
      </Centro>
    </Bloque>
  );
};

// ---------- 10 · ventana con foto y texto: «Llega en estas semanas» (14-16 s) ----------
const Llega: React.FC<{fecha: string; hora: string}> = ({fecha, hora}) => {
  const f = useCurrentFrame();
  const {L} = useD();
  const vw = L ? 1560 : 940, vh = L ? 860 : 1180;
  return (
    <Bloque bg={P.red}>
      <Centro>
        <Entra at={0} from="escala">
          <Ventana src="img/gift-feature.webp" w={vw} h={vh} zoom={1.05 + f * 0.0014}>
            <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(27,17,20,0) 40%, rgba(27,17,20,.72) 100%)'}} />
            <AbsoluteFill style={{display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: L ? '0 80px 70px' : '0 60px 80px', gap: 6}}>
              <Entra at={5} from="izq"><Txt size={L ? 170 : 110} color={P.white}>{fecha ? 'Llega el' : 'Llega'}</Txt></Entra>
              <Entra at={10} from="izq"><Txt size={fecha ? (L ? 170 : 110) : (L ? 150 : 96)} color={P.gold}>{fecha || 'en estas semanas'}</Txt></Entra>
              {fecha && hora ? <Entra at={16} from="izq"><Txt size={64} color={P.white} weight={600}>{hora}</Txt></Entra> : null}
            </AbsoluteFill>
          </Ventana>
        </Entra>
      </Centro>
    </Bloque>
  );
};

// ---------- 11-12 · celular con la web + frase (16-20 s) ----------
const Celular: React.FC<{src: string; lado: 'izq' | 'der' | 'centro'}> = ({src, lado}) => {
  const s = useSpring(2, 13, 120);
  const {L, w} = useD();
  const pw = L ? 400 : 520, ph = pw * (1688 / 780);
  const x = lado === 'centro' ? (w - pw) / 2 - 14 : lado === 'izq' ? 260 : w - pw - 260;
  const top = L ? 110 : 760;
  return (
    <div style={{position: 'absolute', left: x, top: top + (1 - s) * (L ? 1100 : 900), width: pw + 28, height: ph + 28, borderRadius: 70, background: '#0c0708', padding: 14}}>
      <div style={{position: 'relative', width: pw, height: ph, borderRadius: 58, overflow: 'hidden', background: P.white}}>
        <Img src={staticFile(src)} style={{width: pw, height: ph, display: 'block'}} />
      </div>
    </div>
  );
};
/** Texto + celular: vertical = texto arriba y celular abajo; horizontal = celular a un lado y texto al otro, como en el video de referencia. */
const FraseCelular: React.FC<{src: string; grande: string; acento: string; textoDer: boolean}> = ({src, grande, acento, textoDer}) => {
  const {L, w} = useD();
  return (
    <Bloque bg={P.white}>
      {L ? (
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 14, paddingLeft: textoDer ? 860 : 150}}>
          <Entra at={1} from={textoDer ? 'der' : 'izq'}><Txt size={260} color={P.ink}>{grande}</Txt></Entra>
          <Entra at={6} from={textoDer ? 'der' : 'izq'}><Txt size={150} color={P.red}>{acento}</Txt></Entra>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{padding: '230px 70px 0', display: 'flex', flexDirection: 'column', gap: 10, alignItems: textoDer ? 'flex-end' : 'flex-start'}}>
          <Entra at={1} from={textoDer ? 'der' : 'izq'}><Txt size={190} color={P.ink}>{grande}</Txt></Entra>
          <Entra at={6} from={textoDer ? 'izq' : 'der'}><Txt size={textoDer ? 130 : 120} color={P.red}>{acento}</Txt></Entra>
        </AbsoluteFill>
      )}
      <Celular src={src} lado={L ? (textoDer ? 'izq' : 'der') : 'centro'} />
    </Bloque>
  );
};
const Elige: React.FC = () => <FraseCelular src="img/movil-inicio.webp" grande="Elige" acento="desde tu celular" textoDer={true} />;
const Pide: React.FC = () => <FraseCelular src="img/movil-catalogo.webp" grande="Pide" acento="por WhatsApp" textoDer={false} />;

// ---------- 13 · «Solo elige y pide» (20-21 s) ----------
const Solo: React.FC = () => {
  const {L} = useD();
  return (
    <Bloque bg={P.white}>
      <Centro style={{gap: 6, flexDirection: L ? 'row' : 'column', alignItems: 'center'}}>
        <Entra at={0} from="izq" style={{marginRight: L ? 40 : 0}}><Txt size={130} color={P.ink}>Solo</Txt></Entra>
        <Entra at={4} from="escala"><Txt size={290} color={P.red}>elige</Txt></Entra>
        <Entra at={9} from="der" style={{marginLeft: L ? 40 : 0}}><Txt size={130} color={P.ink}>y pide</Txt></Entra>
      </Centro>
    </Bloque>
  );
};

// ---------- 14 · la marca se arma (21-24 s) ----------
const Marca: React.FC<{incentivo: string}> = ({incentivo}) => {
  const f = useCurrentFrame();
  const sello = useSpring(2, 9, 150);
  const {L, u} = useD();
  return (
    <Bloque bg={P.red}>
      <Centro style={{gap: 6}}>
        <Img src={staticFile('img/logo-mark.svg')} style={{height: L ? 200 : 230, width: 'auto', transform: `scale(${0.3 + 0.7 * sello}) translateY(${(1 - sello) * -120}px)`, opacity: Math.min(1, sello * 2)}} />
        <div style={{display: 'flex'}}>
          {'Alexa'.split('').map((l, i) => {
            const s = spring({frame: f - (10 + i * 3), fps: 30, config: {damping: 9, stiffness: 190, mass: 0.7}});
            return <span key={i} style={{display: 'inline-block', fontFamily: FF, fontWeight: 700, fontSize: 250 * (L ? 0.85 : 1), color: P.white, lineHeight: 1, transform: `translateY(${(1 - s) * 260}px) scale(${0.6 + 0.4 * s})`, opacity: f >= 10 + i * 3 ? 1 : 0}}>{l}</span>;
          })}
        </div>
        <Entra at={36} from="escala"><Txt size={150} color={P.gold}>Muy pronto.</Txt></Entra>
        {incentivo ? <Entra at={50} from="abajo"><Txt size={56} color={P.white} weight={600}>{incentivo}</Txt></Entra> : null}
        <div style={{height: 20 * u}} />
        <Entra at={54} from="abajo"><Txt size={62} color={P.white} weight={600}>alexashop.cc · Choluteca</Txt></Entra>
      </Centro>
    </Bloque>
  );
};

// ---------- montaje: cada corte cae en un pulso (15 cuadros) ----------
const tramos: {de: number; dur: number}[] = [
  {de: 0, dur: 30}, {de: 30, dur: 30}, {de: 60, dur: 45}, {de: 105, dur: 135}, {de: 240, dur: 30}, {de: 270, dur: 60},
  {de: 330, dur: 30}, {de: 360, dur: 30}, {de: 390, dur: 30}, {de: 420, dur: 60}, {de: 480, dur: 60}, {de: 540, dur: 60}, {de: 600, dur: 30}, {de: 630, dur: 90},
];
export const ProximoDrop: React.FC<DropProps> = ({fecha, hora, incentivo, voz}) => {
  const escenas = [<Gancho1 />, <Gancho2 />, <AlgoNuevo />, <Colina />, <UnNuevo />, <DropAlexa />, <Boton />, <Interfaz />, <Mensaje />, <Llega fecha={fecha} hora={hora} />, <Elige />, <Pide />, <Solo />, <Marca incentivo={incentivo} />];
  return (
    <AbsoluteFill style={{background: P.red}}>
      {escenas.map((e, i) => <Sequence key={i} from={tramos[i].de} durationInFrames={tramos[i].dur}>{e}</Sequence>)}
      <Audio src={staticFile(`audio/6-ProximoDrop${voz ? '' : '-sinvoz'}.wav`)} />
    </AbsoluteFill>
  );
};
