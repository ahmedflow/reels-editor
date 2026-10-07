import React from 'react';
import {AbsoluteFill, Composition, Freeze} from 'remotion';
import {Reel} from './Reel.jsx';

const FPS = 30;
const EMPTY = {
  meta: {source: 'source.mp4', width: 1080, height: 1920},
  cut: {keep: [[0, 1]], total: 1},
  face: {found: false},
  sentences: [],
  plan: {},
};

// ورقة المعاينة: نفس الريل مجمّد على كم لحظة، مصغّر ومرصوص 3 بالصف
const COLS = 3;
const CELL_W = 360;
const CELL_H = 640;
const Sheet = ({sheetFrames = [0], ...props}) => (
  <AbsoluteFill style={{background: '#000'}}>
    {sheetFrames.map((f, i) => (
      <div key={i} style={{position: 'absolute', left: (i % COLS) * CELL_W, top: Math.floor(i / COLS) * CELL_H, width: CELL_W, height: CELL_H, overflow: 'hidden'}}>
        <div style={{width: 1080, height: 1920, transform: `scale(${CELL_W / 1080})`, transformOrigin: '0 0', position: 'relative'}}>
          <Freeze frame={f}>
            <Reel {...props} />
          </Freeze>
        </div>
        <div style={{position: 'absolute', left: 8, top: 8, background: '#000', color: '#fff', font: '700 22px sans-serif', padding: '2px 10px', borderRadius: 8}}>{(f / FPS).toFixed(1)}s</div>
      </div>
    ))}
  </AbsoluteFill>
);

export const Root = () => (
  <>
    <Composition
      id="Reel"
      component={Reel}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={FPS}
      defaultProps={EMPTY}
      calculateMetadata={({props}) => ({durationInFrames: Math.max(1, Math.round(props.cut.total * FPS))})}
    />
    <Composition
      id="Sheet"
      component={Sheet}
      width={COLS * CELL_W}
      height={CELL_H}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{...EMPTY, sheetFrames: [0]}}
      calculateMetadata={({props}) => ({
        width: Math.min(COLS, props.sheetFrames.length) * CELL_W,
        height: Math.ceil(props.sheetFrames.length / COLS) * CELL_H,
        durationInFrames: Math.max(1, Math.round(props.cut.total * FPS)),
      })}
    />
  </>
);
