import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';
import { EASE, StackMark, Eyebrow } from '../shared';

function Word({ text, color, delay }: { text: string; color: string; delay: number }) {
  return (
    <div style={{ display: 'flex', overflow: 'hidden', paddingBottom: '1vmin' }}>
      {text.split('').map((ch, i) => (
        <motion.span key={i} className="f-display"
          initial={{ y: '110%' }} animate={{ y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: delay + i * 0.04 }}
          style={{ display: 'inline-block', fontSize: '17vmin', fontWeight: 700, lineHeight: 0.92, color }}>{ch}</motion.span>
      ))}
    </div>
  );
}

export function Scene1() {
  const [push, setPush] = useState(false);
  useSceneTimer([{ time: 3200, callback: () => setPush(true) }]);
  return (
    <motion.section className="absolute inset-0 grain" style={{ background: 'var(--ink)' }}
      exit={{ opacity: 0, transition: { duration: 0.5, delay: 0.3 } }}>
      <div className="absolute inset-0 grid-bg" />
      <motion.div className="absolute inset-0 flex items-center"
        style={{ paddingLeft: '9vw', gap: '6vmin' }}
        animate={push ? { scale: 2.6, opacity: [1, 1, 0], filter: ['blur(0px)', 'blur(2px)', 'blur(14px)'] } : { scale: [1.08, 1] }}
        transition={push ? { duration: 0.8, ease: [0.6, 0, 0.8, 0.4], times: [0, 0.55, 1] } : { duration: 3.2, ease: 'easeOut' }}>
        <StackMark size={22} />
        <div>
          <Word text="CONTROL" color="var(--paper)" delay={1.1} />
          <Word text="PLANE" color="var(--mint)" delay={1.55} />
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.3, duration: 0.5, ease: EASE }} style={{ marginTop: '3vmin' }}>
            <Eyebrow color="rgba(243,239,230,0.7)">Enterprise second brain · Agent factory · MCP builder</Eyebrow>
          </motion.div>
        </div>
      </motion.div>
    </motion.section>
  );
}
