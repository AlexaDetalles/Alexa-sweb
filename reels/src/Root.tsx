import React from 'react';
import {Composition} from 'remotion';
import {AlgoViene, Closet, CuentaRegresiva, Anuncio, Apertura, porDefecto, aperturaPorDefecto, aperturaFrames} from './Reels';
import {ProximoDrop, dropPorDefecto, DROP_FRAMES, DROP_FPS} from './Drop';
import {W, H} from './brand';

const base = {width: W, height: H, fps: 30};

export const Root: React.FC = () => (
  <>
    <Composition id="1-AlgoViene" component={AlgoViene} durationInFrames={260} {...base} />
    <Composition id="2-Closet" component={Closet} durationInFrames={380} defaultProps={porDefecto} {...base} />
    <Composition id="3-CuentaRegresiva" component={CuentaRegresiva} durationInFrames={200} defaultProps={porDefecto} {...base} />
    <Composition id="4-Anuncio" component={Anuncio} durationInFrames={440} defaultProps={porDefecto} {...base} />
    <Composition id="5-Apertura" component={Apertura} durationInFrames={aperturaFrames(aperturaPorDefecto.piezas.length)} defaultProps={aperturaPorDefecto} {...base} />
    <Composition id="6-ProximoDrop" component={ProximoDrop} durationInFrames={DROP_FRAMES} defaultProps={dropPorDefecto} width={W} height={H} fps={DROP_FPS} />
    <Composition id="6-ProximoDrop-16x9" component={ProximoDrop} durationInFrames={DROP_FRAMES} defaultProps={dropPorDefecto} width={1920} height={1080} fps={DROP_FPS} />
  </>
);
