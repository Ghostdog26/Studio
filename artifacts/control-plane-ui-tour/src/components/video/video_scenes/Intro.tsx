import { motion } from 'framer-motion';
import { ui, useStages } from './shared';

const words = ['Every team.', 'Every integration.', 'Hand-coded.', 'Again.'];
const thumbs = ['overview', 'knowledge', 'catalogue', 'builder', 'mcp', 'agents'];

export function Intro() {
  const s = useStages([150, 650, 1150, 1650, 2500, 3100, 3500, 3900, 4300, 4700, 5100]);
  return (
    <motion.div className="absolute inset-0 grain overflow-hidden" style={{ background: 'var(--ink)' }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}>
      <div className="absolute inset-0 grid-bg" />
      {/* kinetic stack */}
      <motion.div className="absolute" style={{ left: '6vw', top: '14vh' }}
        animate={{ opacity: s >= 5 ? 0.12 : 1, x: s >= 5 ? '-3vw' : 0 }} transition={{ duration: 0.6 }}>
        {words.map((w, i) => (
          <motion.div key={w} className="f-display" style={{ fontSize: i === 3 ? '15vmin' : '9vmin', fontWeight: 700, lineHeight: 1, color: i === 3 ? 'var(--amber)' : 'var(--paper)' }}
            initial={{ opacity: 0, scale: 1.25, y: 20 }} animate={s >= i + 1 ? { opacity: 1, scale: 1, y: 0 } : {}}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}>{w}</motion.div>
        ))}
      </motion.div>
      {/* answer */}
      <motion.div className="absolute f-display" style={{ right: '6vw', top: '10vh', textAlign: 'right', color: 'var(--paper)', fontSize: '7.5vmin', fontWeight: 600, lineHeight: 1.02 }}
        initial={{ opacity: 0 }} animate={{ opacity: s >= 5 ? 1 : 0 }}>
        <div className="f-mono" style={{ fontSize: '2vmin', color: 'var(--mint)', letterSpacing: '0.2em', marginBottom: '1.5vmin' }}>01 / INSTEAD</div>
        One shared<br /><span style={{ color: 'var(--mint)' }}>foundation.</span>
      </motion.div>
      {/* thumbnail rail */}
      <div className="absolute" style={{ left: '6vw', right: '6vw', bottom: '9vh', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1.4vw' }}>
        {thumbs.map((t, i) => (
          <motion.div key={t} style={{ aspectRatio: '16/9', borderRadius: '0.6vw', overflow: 'hidden', boxShadow: '0 1.5vw 3vw rgba(0,0,0,0.4), 0 0 0 1px rgba(79,191,148,0.3)' }}
            initial={{ opacity: 0, y: '6vh', rotate: -4 }} animate={s >= i + 6 ? { opacity: 1, y: 0, rotate: 0 } : {}}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
            <img src={ui(t)} className="w-full h-full" style={{ objectFit: 'cover' }} alt="" />
          </motion.div>
        ))}
      </div>
      <motion.div className="absolute f-mono" style={{ left: '6vw', bottom: '4vh', color: 'rgba(243,239,230,0.55)', fontSize: '1.9vmin', letterSpacing: '0.16em' }}
        initial={{ opacity: 0 }} animate={{ opacity: s >= 7 ? 1 : 0 }}>
        CONTROL PLANE · SECOND BRAIN · AGENT FACTORY · MCP BUILDER
      </motion.div>
    </motion.div>
  );
}
