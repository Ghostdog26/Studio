import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';
import { EASE, Eyebrow } from '../shared';

const LANGS = ['TypeScript', 'JavaScript', 'Python', 'Go', 'C#', 'Rust', 'Ruby', 'Java', 'Swift', 'PHP', 'Kotlin'];

export function Scene5() {
  const [k, setK] = useState(0);
  useSceneTimer(LANGS.slice(1).map((_, i) => ({ time: (i + 1) * 190, callback: () => setK(i + 1) })));
  return (
    <motion.section className="absolute inset-0 grain overflow-hidden" style={{ background: 'var(--ink)' }}
      initial={{ clipPath: 'circle(0% at 50% 50%)' }} animate={{ clipPath: 'circle(120% at 50% 50%)' }}
      exit={{ clipPath: 'inset(0% 50% 0% 50%)', transition: { duration: 0.45, ease: [0.7, 0, 0.3, 1] } }}
      transition={{ duration: 0.5, ease: EASE }}>
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute" style={{ left: '6vw', top: '9vh' }}><Eyebrow color="var(--mint)">04 · Official SDKs</Eyebrow></div>
      <div className="absolute f-mono" style={{ right: '6vw', top: '9vh', fontSize: '3vmin', color: 'var(--paper)' }}>{String(k + 1).padStart(2, '0')} / 11 languages</div>
      <div className="absolute inset-0 flex items-center justify-center" style={{ top: '-8vh' }}>
        <AnimatePresence mode="sync">
          <motion.div key={k} className="f-display absolute" initial={{ scale: 1.4, opacity: 0, filter: 'blur(8px)' }} animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.18 }}
            style={{ fontSize: '24vmin', fontWeight: 700, color: k === LANGS.length - 1 ? 'var(--mint)' : 'var(--paper)', whiteSpace: 'nowrap' }}>{LANGS[k]}</motion.div>
        </AnimatePresence>
      </div>
      <div className="absolute flex" style={{ left: '6vw', right: '6vw', bottom: '11vh', gap: '3vmin' }}>
        {[['Native languages', 'OpenShell-compatible native hosts', 1.0], ['JavaScript / TypeScript', 'Cloudflare workerd', 1.5]].map(([a, b, d]) => (
          <motion.div key={a as string} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: d as number, duration: 0.45, ease: EASE }}
            style={{ flex: 1, border: '1px solid rgba(79,191,148,0.4)', borderRadius: '1.6vmin', padding: '2.4vmin 3vmin', background: 'var(--ink-2)' }}>
            <div className="f-mono" style={{ fontSize: '2vmin', color: 'var(--mint)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{a}</div>
            <div style={{ fontSize: '3.4vmin', color: 'var(--paper)', marginTop: '0.8vmin' }}>→ {b}</div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
