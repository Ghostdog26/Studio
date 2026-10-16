import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Database, ListOrdered, Zap } from 'lucide-react';
import { useSceneTimer } from '@/lib/video';
import { EASE, SNAP, Eyebrow } from '../shared';

const QUERY = 'Which standards apply to an MCP server handling customer data?';
const STEPS = [
  { label: 'Retrieve', icon: Database },
  { label: 'Re-rank', icon: ListOrdered },
  { label: 'Cached', icon: Zap },
];

export function Scene2() {
  const [chars, setChars] = useState(0);
  const [step, setStep] = useState(-1);
  const typing = Array.from({ length: QUERY.length }, (_, i) => ({ time: 200 + i * 17, callback: () => setChars(i + 1) }));
  useSceneTimer([
    ...typing,
    { time: 2400, callback: () => setStep(0) },
    { time: 2750, callback: () => setStep(1) },
    { time: 3100, callback: () => setStep(2) },
  ]);
  return (
    <motion.section className="absolute inset-0" style={{ background: 'var(--paper)' }}
      initial={{ clipPath: 'circle(0% at 50% 50%)' }} animate={{ clipPath: 'circle(120% at 50% 50%)' }}
      exit={{ clipPath: 'inset(0% 0% 100% 0%)', transition: { duration: 0.55, ease: [0.7, 0, 0.3, 1] } }}
      transition={{ duration: 0.7, ease: EASE }}>
      <div className="absolute inset-0 grid-bg" style={{ ['--grid-color' as string]: 'rgba(23,32,43,0.05)' }} />
      <div className="absolute" style={{ left: '6vw', top: '12vh', width: '30vw' }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}><Eyebrow>01 · Knowledge</Eyebrow></motion.div>
        <motion.h2 className="f-display" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25, duration: 0.6, ease: EASE }}
          style={{ fontSize: '8vmin', lineHeight: 0.98, fontWeight: 700, margin: '2vmin 0 0', color: 'var(--ink)' }}>
          Ask what the enterprise knows.
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}
          style={{ fontSize: '3vmin', color: 'var(--muted)', marginTop: '3vmin', lineHeight: 1.3 }}>
          Answers arrive with citations you can open.
        </motion.p>
      </div>
      <motion.div className="absolute" style={{ right: '5vw', top: '11vh', width: '54vw', background: '#fbf8f1', borderRadius: '2vmin', border: '1px solid rgba(23,32,43,0.12)', boxShadow: '0 3vmin 6vmin rgba(23,32,43,0.12)', padding: '3.5vmin' }}
        initial={{ y: 60, opacity: 0, rotate: 2 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ delay: 0.1, duration: 0.7, ease: EASE }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2vmin', border: '2px solid var(--mint)', borderRadius: '1.4vmin', padding: '2vmin 2.4vmin' }}>
          <Search size={'3.4vmin' as unknown as number} color="var(--mint-deep)" />
          <span style={{ fontSize: '2.9vmin', color: 'var(--ink)', minHeight: '3.6vmin' }}>{QUERY.slice(0, chars)}<span style={{ opacity: chars < QUERY.length ? 1 : 0, color: 'var(--mint)' }}>|</span></span>
        </div>
        <div style={{ marginTop: '3vmin' }}>
          {[92, 84, 61].map((w, i) => (
            <motion.div key={i} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.4 + i * 0.15, duration: 0.5, ease: EASE }}
              style={{ transformOrigin: 'left', height: '2.2vmin', width: w + '%', background: 'var(--paper-2)', borderRadius: '1vmin', marginBottom: '1.8vmin' }} />
          ))}
          <div style={{ display: 'flex', gap: '1.4vmin', marginTop: '1vmin' }}>
            {['[1] Enterprise baseline checks', '[2] Data-handling profile', '[3] MCP authorization spec'].map((c, i) => (
              <motion.span key={c} className="f-mono" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...SNAP, delay: 1.9 + i * 0.12 }}
                style={{ fontSize: '1.9vmin', background: 'var(--mint-pale)', color: 'var(--mint-deep)', padding: '1vmin 1.4vmin', borderRadius: '1vmin' }}>{c}</motion.span>
            ))}
          </div>
        </div>
      </motion.div>
      <div className="absolute flex items-center" style={{ right: '5vw', bottom: '12vh', width: '54vw', gap: '2vmin' }}>
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const on = step >= i;
          return (
            <motion.div key={s.label} className="f-mono flex items-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, scale: step === i ? [1, 1.08, 1] : 1 }} transition={{ delay: 2.2 + i * 0.05, duration: 0.35 }}
              style={{ flex: 1, gap: '1.4vmin', padding: '2vmin', borderRadius: '1.4vmin', fontSize: '2.2vmin', textTransform: 'uppercase', letterSpacing: '0.12em', transition: 'background 0.25s, color 0.25s', background: on ? 'var(--ink)' : 'var(--paper-2)', color: on ? 'var(--mint)' : 'var(--muted)' }}>
              <Icon size={'3vmin' as unknown as number} />{s.label}
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
