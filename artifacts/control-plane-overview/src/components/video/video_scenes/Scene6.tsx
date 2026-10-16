import { motion } from 'framer-motion';
import { FileJson, FileCheck2, Fingerprint, ScrollText, ClipboardList } from 'lucide-react';
import { EASE, SNAP, Eyebrow } from '../shared';

const FILES = [
  { n: 'schema.json', d: 'Official protocol schema', icon: FileJson },
  { n: 'definition.json', d: 'The saved definition', icon: FileCheck2 },
  { n: 'PROVENANCE', d: 'SDK + spec revisions, licenses', icon: ScrollText },
  { n: 'manifest.json', d: 'source digest · build not run', icon: Fingerprint },
  { n: 'REQUIRED-REVIEW.md', d: 'Controls, evidence, negative tests', icon: ClipboardList },
];

export function Scene6() {
  return (
    <motion.section className="absolute inset-0 overflow-hidden" style={{ background: 'var(--paper)' }}
      initial={{ clipPath: 'inset(0% 50% 0% 50%)' }} animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }} transition={{ duration: 0.5, ease: [0.7, 0, 0.3, 1] }}>
      <div className="absolute" style={{ left: '6vw', top: '10vh', width: '46vw' }}>
        <Eyebrow>05 · Generated package</Eyebrow>
        <div style={{ marginTop: '3vmin' }}>
          {FILES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div key={f.n} className="flex items-center" initial={{ x: (i % 2 ? 1 : -1) * 30 + 'vw', opacity: 0, rotate: i % 2 ? 6 : -6 }} animate={{ x: 0, opacity: 1, rotate: 0 }}
                transition={{ delay: 0.15 + i * 0.22, duration: 0.55, ease: EASE }}
                style={{ gap: '2.4vmin', padding: '2vmin 2.6vmin', marginBottom: '1.4vmin', background: '#fbf8f1', borderRadius: '1.4vmin', border: '1px solid rgba(23,32,43,0.12)' }}>
                <Icon size={'3.6vmin' as unknown as number} color="var(--mint-deep)" />
                <span className="f-mono" style={{ fontSize: '2.9vmin', color: 'var(--ink)', minWidth: '24vmin' }}>{f.n}</span>
                <span style={{ fontSize: '2.3vmin', color: 'var(--muted)' }}>{f.d}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
      <div className="absolute flex flex-col items-start justify-center" style={{ right: '6vw', top: 0, bottom: 0, width: '38vw' }}>
        <motion.div className="f-display" initial={{ scale: 2.4, opacity: 0, rotate: -14 }} animate={{ scale: 1, opacity: 1, rotate: -6 }} transition={{ ...SNAP, delay: 1.5 }}
          style={{ border: '0.7vmin solid var(--amber)', color: 'var(--amber)', padding: '2vmin 3vmin', borderRadius: '1.6vmin', fontSize: '6.4vmin', fontWeight: 700, lineHeight: 1 }}>
          AI DRAFT<br />UNVERIFIED
        </motion.div>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.0, duration: 0.4 }}
          style={{ fontSize: '3.2vmin', color: 'var(--ink)', marginTop: '4vmin', lineHeight: 1.3 }}>
          Compilation, protocol and security checks, release approval and deployment stay with your reviewers.
        </motion.p>
      </div>
    </motion.section>
  );
}
