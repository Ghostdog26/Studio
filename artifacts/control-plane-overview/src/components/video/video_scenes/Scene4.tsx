import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquareText, Library, Route, Code2, FileJson, Save, Archive } from 'lucide-react';
import { useSceneTimer } from '@/lib/video';
import { EASE, Eyebrow } from '../shared';

const STEPS = [
  { t: 'Plain-language goal', d: '“Summarise open incidents from our ticketing system.”', icon: MessageSquareText },
  { t: 'Real catalogue matches', d: '3 references ranked from catalogue metadata', icon: Library },
  { t: 'Selected approach', d: 'Source, revision and standards stay visible', icon: Route },
  { t: 'Official SDK', d: 'TypeScript · workerd · Streamable HTTP', icon: Code2 },
  { t: 'AI specification', d: '{ "name": "incident_summary", "inputSchema": { … } }', icon: FileJson },
  { t: 'Saved draft', d: 'Definition saved · not a release', icon: Save },
  { t: 'Source archive', d: 'incident-summary.zip', icon: Archive },
];
const GAP = 44; // vw between cards

export function Scene4() {
  const [i, setI] = useState(0);
  const [overview, setOverview] = useState(false);
  const [out, setOut] = useState(false);
  useSceneTimer([
    ...STEPS.slice(1).map((_, k) => ({ time: 450 + k * 680, callback: () => setI(k + 1) })),
    { time: 4700, callback: () => setOverview(true) },
    { time: 5600, callback: () => setOut(true) },
  ]);
  const center = overview ? 3 : i;
  const scale = out ? 0.12 : overview ? 0.3 : 1;
  return (
    <motion.section className="absolute inset-0 overflow-hidden" style={{ background: 'var(--paper)' }}
      initial={{ scale: 1.5, filter: 'blur(10px)', opacity: 0 }} animate={{ scale: 1, filter: 'blur(0px)', opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }} transition={{ duration: 0.7, ease: EASE }}>
      <motion.div className="absolute inset-0 grid-bg" style={{ ['--grid-color' as string]: 'rgba(23,32,43,0.06)' }} animate={{ x: -center * 4 + 'vw' }} transition={{ duration: 0.55, ease: [0.65, 0, 0.35, 1] }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div style={{ position: 'relative', width: 0, height: 0 }}
          animate={{ x: -center * GAP * scale + 'vw', scale, filter: overview ? 'blur(0px)' : ['blur(0px)', 'blur(8px)', 'blur(0px)'] }}
          transition={{ duration: overview ? 0.8 : 0.55, ease: [0.65, 0, 0.35, 1], filter: { duration: 0.55, times: [0, 0.4, 1] } }}
          key={overview ? 'ov' : 'cam'}>
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: overview ? 1 : 0 }} transition={{ duration: 0.7, ease: EASE }}
            style={{ position: 'absolute', left: 0, top: '-0.4vmin', width: 6 * GAP + 'vw', height: '0.8vmin', background: 'var(--mint)', transformOrigin: 'left' }} />
          {STEPS.map((s, k) => {
            const Icon = s.icon;
            const active = overview || k === i;
            return (
              <div key={s.t} style={{ position: 'absolute', left: k * GAP + 'vw', top: 0, transform: 'translate(-50%, -50%)', width: '38vw' }}>
                <div style={{ background: active ? '#fbf8f1' : 'var(--paper-2)', borderRadius: '2.4vmin', padding: '4vmin', border: active ? '0.4vmin solid var(--ink)' : '0.4vmin solid transparent', boxShadow: active ? '0 3vmin 6vmin rgba(23,32,43,0.14)' : 'none', transition: 'all 0.3s' }}>
                  <div className="flex items-center" style={{ gap: '2vmin' }}>
                    <div style={{ width: '8vmin', height: '8vmin', borderRadius: '2vmin', background: 'var(--ink)', color: 'var(--mint)', display: 'grid', placeItems: 'center' }}><Icon size={'4.4vmin' as unknown as number} /></div>
                    <div className="f-mono" style={{ fontSize: '2.2vmin', color: 'var(--muted)', letterSpacing: '0.16em' }}>STEP {String(k + 1).padStart(2, '0')}</div>
                  </div>
                  <div className="f-display" style={{ fontSize: '6vmin', fontWeight: 700, lineHeight: 1, marginTop: '3vmin', color: 'var(--ink)' }}>{s.t}</div>
                  <div className={k === 4 || k === 6 ? 'f-mono' : ''} style={{ fontSize: '2.8vmin', marginTop: '2vmin', color: 'var(--mint-deep)', lineHeight: 1.3 }}>{s.d}</div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
      <div className="absolute" style={{ left: '5vw', top: '7vh' }}>
        <Eyebrow>03 · Guided builder</Eyebrow>
        <div className="f-display" style={{ fontSize: '4.4vmin', fontWeight: 700, marginTop: '1vmin', color: 'var(--ink)' }}>Goal to source, one reviewable step at a time.</div>
      </div>
      <div className="absolute f-mono" style={{ right: '5vw', top: '7vh', fontSize: '3vmin', color: 'var(--ink)' }}>{overview ? '7 / 7' : (i + 1) + ' / 7'}</div>
      <motion.div className="absolute f-mono" style={{ left: '5vw', bottom: '8vh', fontSize: '2.2vmin', color: 'var(--muted)', letterSpacing: '0.1em' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
        DISCOVERY = DETERMINISTIC CATALOGUE RETRIEVAL
      </motion.div>
    </motion.section>
  );
}
