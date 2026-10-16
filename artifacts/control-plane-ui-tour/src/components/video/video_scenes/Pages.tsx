import { motion } from 'framer-motion';
import { BrandPatch, ui, useStages } from './shared';

type Pose = { t: number; fx: number; fy: number; s: number };
type Ring = { t: number; x: number; y: number; w: number; h: number; label: string; below?: boolean };
type PageProps = {
  img: string; chapter: string; route: string; title: string[]; why: string;
  side: 'left' | 'right'; poses: Pose[]; rings: Ring[]; dur: number;
};

const W = 62; // window width in vw
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function PageScene({ img, chapter, route, title, why, side, poses, rings, dur }: PageProps) {
  const stage = useStages([...poses.map((p) => p.t), ...rings.map((r) => r.t), 350, 700, 1400, 2400].sort((a, b) => a - b));
  const elapsedMarks = [...poses.map((p) => p.t), ...rings.map((r) => r.t), 350, 700, 1400, 2400].sort((a, b) => a - b);
  const now = stage === 0 ? 0 : elapsedMarks[stage - 1];
  const pose = [...poses].reverse().find((p) => p.t <= now) ?? poses[0];
  const x = clamp((0.5 - pose.fx * pose.s) * 100, (1 - pose.s) * 100, 0);
  const y = clamp((0.5 - pose.fy * pose.s) * 100, (1 - pose.s) * 100, 0);
  const activeRing = [...rings].reverse().find((r) => r.t <= now);
  const winLeft = side === 'right' ? 34 : 4;
  const capLeft = side === 'right' ? 5 : 69;

  return (
    <motion.div className="absolute inset-0 grain overflow-hidden" style={{ background: 'var(--ink)' }}
      initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.45, delay: 0.1 } }}>
      <div className="absolute inset-0 grid-bg" style={{ opacity: 0.5 }} />
      {/* screen window */}
      <motion.div className="absolute overflow-hidden"
        style={{ left: `${winLeft}vw`, top: `calc(50% - ${W * 9 / 32}vw)`, width: `${W}vw`, height: `${W * 9 / 16}vw`, borderRadius: '1.1vw', boxShadow: '0 3vw 6vw rgba(0,0,0,0.45), 0 0 0 1px rgba(79,191,148,0.25)' }}
        initial={{ clipPath: 'inset(8% 8% 8% 8% round 1.1vw)', scale: 1.06, opacity: 0 }}
        animate={{ clipPath: 'inset(0% 0% 0% 0% round 1.1vw)', scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, y: '-3vh', transition: { duration: 0.55, ease: [0.6, 0, 0.8, 0.4] } }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}>
        <motion.div className="absolute inset-0" style={{ transformOrigin: '0 0', fontSize: `${W * 0.0102}vw` }}
          animate={{ x: `${x}%`, y: `${y}%`, scale: pose.s }}
          transition={{ duration: 1.5, ease: [0.45, 0, 0.15, 1] }}>
          <img src={ui(img)} className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover' }} alt="" />
          <BrandPatch />
          {rings.map((r, i) => (
            <motion.div key={i} className="absolute"
              style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`, borderRadius: '0.6em', border: `${0.22 / pose.s}vw solid var(--amber)`, background: 'rgba(229,154,75,0.08)' }}
              initial={{ opacity: 0, scale: 1.15 }}
              animate={activeRing === r ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.08 }}
              transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }} />
          ))}
        </motion.div>
        {/* ring label in screen space */}
        {activeRing && (
          <motion.div key={activeRing.label} className="absolute f-mono"
            style={{ left: '3%', bottom: '4%', background: 'var(--ink)', color: 'var(--paper)', padding: '0.9vmin 1.6vmin', borderRadius: '0.8vmin', fontSize: '1.9vmin', letterSpacing: '0.04em', borderLeft: '0.6vmin solid var(--amber)' }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            {activeRing.label}
          </motion.div>
        )}
      </motion.div>

      {/* caption column */}
      <div className="absolute" style={{ left: `${capLeft}vw`, top: '12vh', width: '27vw' }}>
        <motion.div className="f-display outline-word" style={{ fontSize: '17vmin', lineHeight: 0.9, fontWeight: 700, color: 'var(--mint)', ['--outline-color' as string]: 'rgba(79,191,148,0.55)' }}
          initial={{ opacity: 0, y: '4vmin' }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          {chapter}
        </motion.div>
        <motion.div className="f-mono" style={{ color: 'var(--mint)', fontSize: '2vmin', letterSpacing: '0.16em', marginTop: '2vmin' }}
          initial={{ opacity: 0 }} animate={{ opacity: stage >= 1 ? 1 : 0 }}>
          {route}
        </motion.div>
        <div className="f-display" style={{ color: 'var(--paper)', fontSize: '5.6vmin', lineHeight: 1.02, fontWeight: 600, marginTop: '1.6vmin' }}>
          {title.map((l, i) => (
            <div key={i} style={{ overflow: 'hidden', paddingBottom: '0.08em' }}>
              <motion.div initial={{ y: '110%' }} animate={{ y: stage >= 2 ? '0%' : '110%' }} transition={{ duration: 0.6, delay: i * 0.12, ease: [0.2, 0.8, 0.2, 1] }}>{l}</motion.div>
            </div>
          ))}
        </div>
        <motion.div style={{ marginTop: '4vmin', borderTop: '1px solid rgba(243,239,230,0.18)', paddingTop: '2.2vmin' }}
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: stage >= 4 ? 1 : 0, y: stage >= 4 ? 0 : 14 }} transition={{ duration: 0.5 }}>
          <div className="f-mono" style={{ color: 'var(--amber)', fontSize: '1.9vmin', letterSpacing: '0.18em' }}>WHY IT MATTERS</div>
          <div style={{ color: 'rgba(243,239,230,0.85)', fontSize: '3vmin', lineHeight: 1.3, marginTop: '1vmin' }}>{why}</div>
        </motion.div>
      </div>
      {/* scene progress hairline */}
      <motion.div className="absolute" style={{ left: 0, bottom: 0, height: '0.5vmin', width: '100%', background: 'var(--mint)', transformOrigin: '0 50%' }}
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: dur / 1000, ease: 'linear' }} />
    </motion.div>
  );
}

export const OverviewScene = () => (
  <PageScene img="overview" chapter="02" route="/ OVERVIEW" dur={11500} side="right"
    title={['One view of', 'everything shared.']}
    why="Teams see what already exists before they build, and what isn't live yet."
    poses={[{ t: 0, fx: 0.5, fy: 0.5, s: 1 }, { t: 1800, fx: 0.58, fy: 0.38, s: 1.6 }, { t: 6200, fx: 0.42, fy: 0.72, s: 1.75 }, { t: 9600, fx: 0.5, fy: 0.5, s: 1.08 }]}
    rings={[{ t: 2600, x: 0.18, y: 0.31, w: 0.8, h: 0.14, label: '4,252 shared documents · 1 agent · 2 components' }, { t: 7000, x: 0.19, y: 0.62, w: 0.45, h: 0.21, label: 'Runtime adapters: not connected, said plainly' }]} />
);

export const KnowledgeScene = () => (
  <PageScene img="knowledge" chapter="03" route="/ KNOWLEDGE" dur={8500} side="left"
    title={['Answers', 'with receipts.']}
    why="Cited sources mean every agent builds on context people can verify."
    poses={[{ t: 0, fx: 0.5, fy: 0.3, s: 1.1 }, { t: 1500, fx: 0.8, fy: 0.4, s: 1.7 }, { t: 4300, fx: 0.78, fy: 0.62, s: 1.5 }, { t: 6900, fx: 0.6, fy: 0.75, s: 1.25 }]}
    rings={[{ t: 2100, x: 0.82, y: 0.33, w: 0.155, h: 0.045, label: 'OpenMetadata: reference only, not connected' }, { t: 4700, x: 0.58, y: 0.48, w: 0.385, h: 0.33, label: 'Every source linked and version-qualified' }, { t: 7000, x: 0.7, y: 0.855, w: 0.28, h: 0.13, label: 'Cited retrieval: answer and evidence together' }]} />
);

export const CatalogueScene = () => (
  <PageScene img="catalogue" chapter="04" route="/ CATALOGUE" dur={9500} side="right"
    title={['Start from', 'what exists.']}
    why="4,210 community references to reuse first. Every one stays unreviewed until checked."
    poses={[{ t: 0, fx: 0.5, fy: 0.5, s: 1 }, { t: 1500, fx: 0.82, fy: 0.24, s: 1.9 }, { t: 4200, fx: 0.55, fy: 0.52, s: 1.45 }, { t: 7200, fx: 0.5, fy: 0.75, s: 1.35 }]}
    rings={[{ t: 2200, x: 0.84, y: 0.19, w: 0.15, h: 0.08, label: '4,210 entries, linked to source' }, { t: 4800, x: 0.18, y: 0.45, w: 0.8, h: 0.16, label: 'Twelve priority review areas' }, { t: 7600, x: 0.18, y: 0.665, w: 0.8, h: 0.1, label: 'References, not approved integrations' }]} />
);

export const BuilderScene = () => (
  <PageScene img="builder" chapter="05" route="/ GUIDED BUILDER" dur={11500} side="left"
    title={['Goal in.', 'Reviewable', 'package out.']}
    why="Matching is deterministic. AI drafts only the specification. Nothing is built or deployed for you."
    poses={[{ t: 0, fx: 0.4, fy: 0.25, s: 1.15 }, { t: 1700, fx: 0.45, fy: 0.55, s: 1.55 }, { t: 5200, fx: 0.86, fy: 0.45, s: 1.9 }, { t: 8200, fx: 0.86, fy: 0.68, s: 1.9 }, { t: 10200, fx: 0.5, fy: 0.5, s: 1.1 }]}
    rings={[{ t: 2300, x: 0.21, y: 0.38, w: 0.56, h: 0.34, label: 'Describe the goal in plain language' }, { t: 5800, x: 0.785, y: 0.33, w: 0.19, h: 0.25, label: 'Journey ledger tracks every decision' }, { t: 8600, x: 0.785, y: 0.6, w: 0.19, h: 0.14, label: 'What has not happened: no build, no deploy' }]} />
);

export const McpScene = () => (
  <PageScene img="mcp" chapter="06" route="/ MCP COMPONENTS" dur={8500} side="right"
    title={['Official standards,', 'any language.']}
    why="Eleven languages, ten official SDKs, with provenance pinned to exact revisions."
    poses={[{ t: 0, fx: 0.5, fy: 0.4, s: 1.1 }, { t: 1500, fx: 0.86, fy: 0.48, s: 1.9 }, { t: 4000, fx: 0.3, fy: 0.72, s: 1.7 }, { t: 7000, fx: 0.5, fy: 0.55, s: 1.15 }]}
    rings={[{ t: 2100, x: 0.82, y: 0.46, w: 0.155, h: 0.06, label: 'Protocol revision and spec provenance' }, { t: 4500, x: 0.19, y: 0.665, w: 0.215, h: 0.08, label: 'Language + target: Python → OpenShell' }, { t: 6200, x: 0.19, y: 0.76, w: 0.215, h: 0.15, label: 'Official SDK repo, exact revision' }]} />
);

export const AgentsScene = () => (
  <PageScene img="agents" chapter="07" route="/ AGENTS" dur={9500} side="left"
    title={['Agents as', 'portable', 'definitions.']}
    why="Instructions, input schema and model, saved once. A draft, ready for review, not a running agent."
    poses={[{ t: 0, fx: 0.4, fy: 0.4, s: 1.1 }, { t: 1500, fx: 0.38, fy: 0.5, s: 1.75 }, { t: 4300, fx: 0.38, fy: 0.52, s: 2.2 }, { t: 7400, fx: 0.5, fy: 0.42, s: 1.2 }]}
    rings={[{ t: 2000, x: 0.175, y: 0.305, w: 0.4, h: 0.4, label: 'Workspace Researcher: saved definition' }, { t: 4800, x: 0.19, y: 0.49, w: 0.37, h: 0.065, label: 'Explicit input contract' }, { t: 6800, x: 0.52, y: 0.32, w: 0.045, h: 0.04, label: 'Status: Draft' }]} />
);
