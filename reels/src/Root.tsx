import React from 'react';
import {Composition} from 'remotion';
import {AlgoViene, Closet, CuentaRegresiva, Anuncio, Apertura, porDefecto, aperturaPorDefecto, aperturaFrames} from './Reels';
import {W, H} from './brand';

const base = {width: W, height: H, fps: 30};

export const Root: React.FC = () => (
  <>
    <Composition id="1-AlgoViene" component={AlgoViene} durationInFrames={260} {...base} />
    <Composition id="2-Closet" component={Closet} durationInFrames={380} defaultProps={porDefecto} {...base} />
    <Composition id="3-CuentaRegresiva" component={CuentaRegresiva} durationInFrames={200} defaultProps={porDefecto} {...base} />
    <Composition id="4-Anuncio" component={Anuncio} durationInFrames={440} defaultProps={porDefecto} {...base} />
    <Composition id="5-Apertura" component={Apertura} durationInFrames={aperturaFrames(aperturaPorDefecto.piezas.length)} defaultProps={aperturaPorDefecto} {...base} />
  </>
);
