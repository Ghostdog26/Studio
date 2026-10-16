import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';
import { EASE, Eyebrow } from '../shared';

const CARDS = [
  ['Ticketing', 'Python'], ['Data warehouse', 'TypeScript'], ['Identity', 'Go'], ['Version control', 'TypeScript'],
  ['Chat ops', 'Rust'], ['Observability', 'Python'], ['Document store', 'C#'], ['Payments', 'Java'],
  ['Calendar', 'Kotlin'], ['Search index', 'Go'], ['Secrets', 'Rust'], ['Metadata catalogue', 'Python'],
];
const PRIORITY = new Set([2, 5, 10, 11]);

export function Scene3() {
  const [filter, setFilter] = useState(false);
  const [push, setPush] = useState(false);
  useSceneTimer([
    { time: 1400, callback: () => setFilter(true) },
    { time: 3300, callback: () => setPush(true) },
  ]);
  return (
    <motion.section className="absolute inset-0 overflow-hidden" style={{ background: 'var(--mint-pale)' }}
      initial={{ clipPath: 'inset(100% 0% 0% 0%)' }} animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
      exit={{ opacity: 0, transition: { duration: 0.35, delay: 0.25 } }}
      transition={{ duration: 0.55, ease: [0.7, 0, 0.3, 1] }}>
      <motion.div className="f-display outline-word absolute" initial={{ x: '8vw' }} animate={{ x: '-6vw' }} transition={{ duration: 4, ease: 'linear' }}
        style={{ ['--outline-color' as string]: 'rgba(47,138,104,0.45)', top: '-7vmin', left: 0, fontSize: '30vmin', fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1 }}>CATALOGUE</motion.div>
      <motion.div className="absolute" style={{ left: '6vw', right: '6vw', top: '27vh', perspective: '120vmin' }}
        animate={push ? { scale: 3, x: '-38vw', y: '-6vh', opacity: [1, 1, 0], filter: ['blur(0px)', 'blur(2px)', 'blur(12px)'] } : { scale: 1 }}
        transition={{ duration: 0.7, ease: [0.6, 0, 0.8, 0.4], times: [0, 0.55, 1] }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2vmin' }}>
          {CARDS.map(([name, lang], i) => {
            const pri = PRIORITY.has(i);
            const dim = filter && !pri;
            return (
              <motion.div key={name} initial={{ z: 700, opacity: 0, rotateY: -12 }} animate={{ z: 0, opacity: dim ? 0.32 : 1, rotateY: 0 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.6, ease: EASE, opacity: { duration: 0.3, delay: filter ? 0 : 0.1 + i * 0.06 } }}
                style={{ background: filter && pri ? 'var(--ink)' : '#fbf8f1', color: filter && pri ? 'var(--paper)' : 'var(--ink)', borderRadius: '1.6vmin', padding: '2.2vmin', border: filter && pri ? '0.35vmin solid var(--amber)' : '1px solid rgba(23,32,43,0.1)', transition: 'background 0.3s, color 0.3s' }}>
                <div className="f-mono" style={{ fontSize: '1.7vmin', letterSpacing: '0.14em', textTransform: 'uppercase', color: filter && pri ? 'var(--amber)' : 'var(--muted)' }}>{filter && pri ? 'Priority standard' : 'MCP reference'}</div>
                <div className="f-display" style={{ fontSize: '3.4vmin', fontWeight: 600, marginTop: '1vmin' }}>{name}</div>
                <div style={{ fontSize: '1.9vmin', marginTop: '0.6vmin', opacity: 0.7 }}>{lang} · unreviewed</div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
      <motion.div className="absolute" style={{ left: '6vw', bottom: '7vh' }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: push ? 0 : 1, y: 0 }} transition={{ delay: push ? 0 : 2.2, duration: 0.4 }}>
        <Eyebrow>02 · Catalogue</Eyebrow>
        <div style={{ fontSize: '3.2vmin', color: 'var(--ink)', marginTop: '1vmin' }}>Community MCP references · enterprise standards · capability evidence on approval</div>
      </motion.div>
    </motion.section>
  );
}
