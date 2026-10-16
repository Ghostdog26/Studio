import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';
import { EASE, StackMark } from '../shared';

const WORDS = ['Knowledge.', 'Agents.', 'MCP.'];

export function Scene7() {
  const [phase, setPhase] = useState(0);
  const [fade, setFade] = useState(false);
  useSceneTimer([
    { time: 450, callback: () => setPhase(1) },
    { time: 900, callback: () => setPhase(2) },
    { time: 1600, callback: () => setPhase(3) },
    { time: 5300, callback: () => setFade(true) },
  ]);
  return (
    <motion.section className="absolute inset-0 grain overflow-hidden" style={{ background: 'var(--ink)' }}>
      <div className="absolute inset-0 grid-bg" />
      <motion.div className="absolute inset-0" animate={{ opacity: fade ? 0 : 1 }} transition={{ duration: 0.6 }}>
        <AnimatePresence>
          {phase < 3 && (
            <motion.div key="words" className="absolute inset-0 flex flex-col justify-center" style={{ paddingLeft: '9vw' }}
              exit={{ scale: 0.6, opacity: 0, filter: 'blur(8px)', transition: { duration: 0.35 } }}>
              {WORDS.map((w, i) => (
                <motion.div key={w} className="f-display" initial={{ y: 60, opacity: 0 }} animate={{ y: phase >= i ? 0 : 60, opacity: phase >= i ? 1 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  style={{ fontSize: '15vmin', fontWeight: 700, lineHeight: 1, color: i === 2 ? 'var(--mint)' : 'var(--paper)' }}>{w}</motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        {phase >= 3 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex items-center" style={{ gap: '5vmin' }}>
              <StackMark size={14} />
              <motion.div className="f-display" initial={{ opacity: 0, x: -30, letterSpacing: '0.04em' }} animate={{ opacity: 1, x: 0, letterSpacing: '-0.045em' }} transition={{ delay: 0.5, duration: 0.8, ease: EASE }}
                style={{ fontSize: '14vmin', fontWeight: 700, color: 'var(--paper)' }}>Control Plane</motion.div>
            </div>
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.0, duration: 0.7, ease: EASE }}
              style={{ width: '60vw', height: '0.3vmin', background: 'var(--mint)', margin: '4vmin 0 3vmin' }} />
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.5 }}
              style={{ fontSize: '3.4vmin', color: 'rgba(243,239,230,0.8)' }}>One plane for what your enterprise knows — and builds.</motion.div>
          </div>
        )}
      </motion.div>
    </motion.section>
  );
}
