import { motion } from 'framer-motion';

export const EASE = [0.22, 1, 0.36, 1] as const;
export const SNAP = { type: 'spring', stiffness: 320, damping: 22 } as const;

export function StackMark({ size = 10, delay = 0 }: { size?: number; delay?: number }) {
  const plates = ['var(--amber)', 'var(--paper)', 'var(--mint)'];
  return (
    <div style={{ position: 'relative', width: size + 'vmin', height: size * 0.9 + 'vmin' }}>
      {plates.map((c, i) => (
        <motion.div
          key={i}
          initial={{ y: '-60vmin', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SNAP, delay: delay + i * 0.4 }}
          style={{
            position: 'absolute', left: 0, top: (2 - i) * size * 0.22 + 'vmin',
            width: size + 'vmin', height: size * 0.42 + 'vmin',
            transform: 'none',
          }}
        >
          <div style={{
            width: '100%', height: '100%', background: c, borderRadius: size * 0.08 + 'vmin',
            transform: 'perspective(40vmin) rotateX(55deg) rotateZ(-38deg)',
            boxShadow: '0 1vmin 2vmin rgba(10,15,22,0.35)',
          }} />
        </motion.div>
      ))}
    </div>
  );
}

export function Eyebrow({ children, color = 'var(--mint-deep)' }: { children: string; color?: string }) {
  return <div className="f-mono" style={{ fontSize: '2vmin', letterSpacing: '0.2em', textTransform: 'uppercase', color }}>{children}</div>;
}
