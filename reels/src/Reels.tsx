import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import {Bg, Grain, Vignette, Rise, Fade, Rule, Wordmark, Caps, Serif, Safe, TapePhoto, Scene, Pulse, C} from './brand';

// Todo cae en el compás: 90 pulsos por minuto = un pulso cada 20 cuadros. Los números de «at» son cuadros dentro de la escena
// y coinciden con los «ping» de audio/musica.py. Si cambias un tiempo aquí, cambia también el sonido.

/** Destello dorado suave en cada pulso, igual que el latido del audio. */
const Latido: React.FC<{desde: number}> = ({desde}) => {
  const f = useCurrentFrame();
  const x = (((f - desde) % 20) + 20) % 20;
  const env = f < desde ? 0 : Math.exp(-x / 5);
  return <AbsoluteFill style={{background: `radial-gradient(circle at 50% 42%, rgba(210,168,81,${0.14 * env}) 0%, rgba(210,168,81,0) 62%)`, pointerEvents: 'none'}} />;
};

const Marco: React.FC<{id: string; latido?: number; children: React.ReactNode}> = ({id, latido = 20, children}) => (
  <AbsoluteFill style={{background: C.night}}>
    {children}
    <Latido desde={latido} />
    <Vignette />
    <Grain />
    <Audio src={staticFile(`audio/${id}.wav`)} />
  </AbsoluteFill>
);

// ---------- Escenas reutilizables (texto mínimo) ----------
const Gancho: React.FC<{dur: number; img: string}> = ({dur, img}) => (
  <Scene dur={dur}>
    <Bg src={img} blur={[75, 48]} dur={dur} />
    <Safe>
      <Rise at={10}><Serif size={158}>Algo bueno</Serif></Rise>
      <Rise at={20}><Serif size={206} italic color={C.gold}>viene.</Serif></Rise>
      <div style={{height: 46}} />
      <Rule at={44} />
      <div style={{height: 34}} />
      <Fade at={56}><Pulse /></Fade>
    </Safe>
  </Scene>
);

const Cuenta: React.FC<{dur: number; img: string; n: number; etiqueta: string}> = ({dur, img, n, etiqueta}) => {
  const f = useCurrentFrame();
  const v = Math.round(interpolate(f, [0, 40], [0, n], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)}));
  return (
    <Scene dur={dur}>
      <Bg src={img} blur={[55, 38]} dur={dur} />
      <Safe>
        <Serif size={440} weight={300} style={{fontVariantNumeric: 'lining-nums', letterSpacing: '-.02em'}}>{v}</Serif>
        <Rise at={40}><Serif size={96} italic color={C.gold}>{etiqueta}</Serif></Rise>
      </Safe>
    </Scene>
  );
};

const Regla: React.FC<{dur: number; img: string}> = ({dur, img}) => (
  <Scene dur={dur}>
    <Bg src={img} blur={[50, 34]} dur={dur} />
    <Safe>
      <Rise at={10}><Serif size={150}>Una pieza.</Serif></Rise>
      <Rise at={30}><Serif size={170} italic color={C.gold}>Sin repetir.</Serif></Rise>
    </Safe>
  </Scene>
);

const Web: React.FC<{at: number}> = ({at}) => (
  <Fade at={at}><Caps size={40} color={C.cream} style={{letterSpacing: '.22em'}}>alexashop.cc</Caps></Fade>
);

const Incentivo: React.FC<{at: number; texto: string}> = ({at, texto}) => (
  <Fade at={at}><div style={{maxWidth: 760}}><Serif size={58} style={{lineHeight: 1.1}}>{texto}</Serif></div></Fade>
);

const Cierre: React.FC<{dur: number; img: string; dia: string; hora: string; incentivo: string}> = ({dur, img, dia, hora, incentivo}) => (
  <Scene dur={dur}>
    <Bg src={img} blur={[40, 26]} dur={dur} />
    <Safe>
      <Fade at={10}><Caps size={34} color={C.gold}>Closet 001 abre</Caps></Fade>
      <div style={{height: 24}} />
      <Rise at={20}><Serif size={190}>{dia}</Serif></Rise>
      <div style={{height: 24}} />
      <Fade at={40}><Serif size={104} italic color={C.gold}>{hora}</Serif></Fade>
      <div style={{height: 56}} />
      <Incentivo at={60} texto={incentivo} />
      <div style={{height: 52}} />
      <Web at={80} />
    </Safe>
  </Scene>
);

const Sello: React.FC<{dur: number; img: string}> = ({dur, img}) => (
  <Scene dur={dur}>
    <Bg src={img} blur={[45, 32]} dur={dur} />
    <Safe>
      <Rise at={10}><Serif size={124}>Cuando se van,</Serif></Rise>
      <Rise at={20}><Serif size={150} italic color={C.gold}>no vuelven.</Serif></Rise>
      <div style={{height: 70}} />
      <Fade at={50}><Wordmark scale={0.8} /></Fade>
      <div style={{height: 44}} />
      <Web at={70} />
    </Safe>
  </Scene>
);

// ---------- Datos que cambian (fecha, hora, números) ----------
export type FechaProps = {dia: string; hora: string; incentivo: string; piezas: number; unicas: number};
export const porDefecto: FechaProps = {
  dia: 'Martes 24',
  hora: '1:00 PM',
  incentivo: 'Las primeras 10 compras: envoltura de regalo gratis',
  piezas: 143,
  unicas: 124,
};

/** 1. Teaser de 8,7 s. Solo la señal: sin producto, sin fecha. */
export const AlgoViene: React.FC = () => (
  <Marco id="1-AlgoViene">
    <Sequence durationInFrames={120}><Gancho dur={120} img="img/gift-feature.webp" /></Sequence>
    <Sequence from={120} durationInFrames={140}>
      <Scene dur={140}>
        <Bg src="img/hero.webp" blur={[48, 24]} dur={140} />
        <Safe>
          <Rise at={10}><Serif size={190} italic color={C.gold}>Muy pronto.</Serif></Rise>
          <div style={{height: 80}} />
          <Fade at={40}><Wordmark scale={0.9} /></Fade>
          <div style={{height: 50}} />
          <Web at={70} />
        </Safe>
      </Scene>
    </Sequence>
  </Marco>
);

/** 2. Los números reales del stock, 12,7 s. */
export const Closet: React.FC<FechaProps> = (p) => (
  <Marco id="2-Closet">
    <Sequence durationInFrames={80}>
      <Scene dur={80}>
        <Bg src="img/kamra.webp" blur={[70, 50]} dur={80} />
        <Safe>
          <Rise at={10}><Serif size={132}>Hay un closet</Serif></Rise>
          <Rise at={20}><Serif size={190} italic color={C.gold}>cerrado.</Serif></Rise>
        </Safe>
      </Scene>
    </Sequence>
    <Sequence from={80} durationInFrames={100}><Cuenta dur={100} img="img/regalo-rosas.webp" n={p.piezas} etiqueta="piezas" /></Sequence>
    <Sequence from={180} durationInFrames={100}><Cuenta dur={100} img="img/gift-feature.webp" n={p.unicas} etiqueta="únicas" /></Sequence>
    <Sequence from={280} durationInFrames={100}><Sello dur={100} img="img/hero.webp" /></Sequence>
  </Marco>
);

/** 3. Cuenta regresiva con fecha y hora, 6,7 s. Con tic-tac de reloj. */
export const CuentaRegresiva: React.FC<FechaProps> = (p) => (
  <Marco id="3-CuentaRegresiva" latido={0}>
    <Cierre dur={200} img="img/gift-feature.webp" dia={p.dia} hora={p.hora} incentivo={p.incentivo} />
  </Marco>
);

/** 4. Anuncio de 14,7 s: gancho en el primer segundo, números, regla y fecha. */
export const Anuncio: React.FC<FechaProps> = (p) => (
  <Marco id="4-Anuncio">
    <Sequence durationInFrames={80}><Gancho dur={80} img="img/gift-feature.webp" /></Sequence>
    <Sequence from={80} durationInFrames={80}><Cuenta dur={80} img="img/regalo-rosas.webp" n={p.piezas} etiqueta="piezas" /></Sequence>
    <Sequence from={160} durationInFrames={80}><Cuenta dur={80} img="img/hero.webp" n={p.unicas} etiqueta="únicas" /></Sequence>
    <Sequence from={240} durationInFrames={80}><Regla dur={80} img="img/kamra.webp" /></Sequence>
    <Sequence from={320} durationInFrames={120}><Cierre dur={120} img="img/gift-feature.webp" dia={p.dia} hora={p.hora} incentivo={p.incentivo} /></Sequence>
  </Marco>
);

/** 5. Apertura, 13,3 s. Cambia las fotos y precios por los de cada pieza real. */
export type Pieza = {img: string; nombre: string; precio?: string};
export type AperturaProps = {piezas: Pieza[]; incentivo: string};
export const aperturaPorDefecto: AperturaProps = {
  incentivo: porDefecto.incentivo,
  piezas: [
    {img: 'img/gift-feature.webp', nombre: 'Caja Alexa'},
    {img: 'img/regalo-rosas.webp', nombre: 'Ramo y chocolates'},
    {img: 'img/kamra.webp', nombre: 'Khamrah'},
  ],
};
export const aperturaFrames = (n: number) => 60 + n * 80 + 100;
export const Apertura: React.FC<AperturaProps> = ({piezas, incentivo}) => (
  <Marco id="5-Apertura" latido={0}>
    <Sequence durationInFrames={60}>
      <Scene dur={60}>
        <Bg src="img/gift-feature.webp" blur={[40, 20]} dur={60} />
        <Safe>
          <Rise at={10}><Serif size={160}>Ya abrimos.</Serif></Rise>
          <Rise at={20}><Serif size={120} italic color={C.gold}>Closet 001</Serif></Rise>
        </Safe>
      </Scene>
    </Sequence>
    {piezas.map((pz, i) => (
      <Sequence key={i} from={60 + i * 80} durationInFrames={80}>
        <Scene dur={80}>
          <Bg src={pz.img} blur={[60, 50]} dur={80} />
          <Safe justify="flex-start" style={{paddingTop: 330}}>
            <TapePhoto src={pz.img} at={4} rot={i % 2 ? 4 : -4} size={720} />
            <div style={{height: 56}} />
            <Rise at={20}><Serif size={82}>{pz.nombre}</Serif></Rise>
            {pz.precio ? <Rise at={30}><Serif size={108} italic color={C.gold}>{pz.precio}</Serif></Rise> : null}
          </Safe>
        </Scene>
      </Sequence>
    ))}
    <Sequence from={60 + piezas.length * 80} durationInFrames={100}>
      <Scene dur={100}>
        <Bg src="img/hero.webp" blur={[45, 30]} dur={100} />
        <Safe>
          <Incentivo at={10} texto={incentivo} />
          <div style={{height: 50}} />
          <Web at={30} />
          <div style={{height: 56}} />
          <Fade at={50}><Wordmark scale={0.8} /></Fade>
        </Safe>
      </Scene>
    </Sequence>
  </Marco>
);
