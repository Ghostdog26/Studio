import { motion } from 'framer-motion';
import { ui, useStages } from './shared';

const stamps = ['Saved is not approved.', 'People review.', 'Verification stays separate.'];

export function Outro() {
  const s = useStages([300, 1500, 2800, 4300, 5200, 6000, 6800]);
  const lock = s >= 4;
  return (
    <motion.div className="absolute inset-0 overflow-hidden grain" style={{ background: lock ? 'var(--paper)' : 'var(--ink)', transition: 'background 0.5s' }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}>
      <motion.img src={ui('builder')} alt="" className="absolute" style={{ inset: 0, width: '100%', height: '100%', objectFit: 'cover', transformOrigin: '88% 65%' }}
        initial={{ opacity: 0.35, scale: 1.6 }} animate={{ opacity: lock ? 0 : 0.28, scale: lock ? 2.2 : 1.8 }} transition={{ duration: 4, ease: 'easeOut' }} />
      <div className="absolute" style={{ left: '7vw', top: '18vh' }}>
        {stamps.map((t, i) => (
          <motion.div key={t} className="f-display" style={{ color: i === 0 ? 'var(--amber)' : 'var(--paper)', fontSize: '8vmin', fontWeight: 600, lineHeight: 1.15 }}
            initial={{ opacity: 0, x: '-3vw' }}
            animate={lock ? { opacity: 0, y: '-4vh' } : s >= i + 1 ? { opacity: 1, x: 0 } : {}}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}>{t}</motion.div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div style={{ overflow: 'hidden' }}>
          <motion.div className="f-display" style={{ color: 'var(--ink)', fontSize: '19vmin', fontWeight: 700, lineHeight: 1 }}
            initial={{ y: '105%' }} animate={{ y: lock ? '0%' : '105%' }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}>
            Control Plane
          </motion.div>
        </div>
        <motion.div className="f-display" style={{ color: 'var(--mint-deep)', fontSize: '5vmin', fontWeight: 600, marginTop: '2vmin' }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: s >= 5 ? 1 : 0, y: s >= 5 ? 0 : 12 }}>Build from shared context.</motion.div>
        <motion.div className="f-mono" style={{ color: 'var(--muted)', fontSize: '2vmin', letterSpacing: '0.18em', marginTop: '4vmin' }}
          initial={{ opacity: 0 }} animate={{ opacity: s >= 6 ? 1 : 0 }}>KNOWLEDGE · CATALOGUE · BUILDER · MCP · AGENTS</motion.div>
      </div>
      <motion.div className="absolute inset-0" style={{ background: 'var(--ink)' }}
        initial={{ opacity: 0 }} animate={{ opacity: s >= 7 ? 1 : 0 }} transition={{ duration: 3.2, ease: 'easeIn' }} />
    </motion.div>
  );
}
