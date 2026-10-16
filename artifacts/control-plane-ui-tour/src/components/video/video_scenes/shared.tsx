import { useEffect, useState } from 'react';

export const ui = (name: string) => `${import.meta.env.BASE_URL}ui/${name}.jpg`;

/** Stage index that advances at the given ms marks. */
export function useStages(marks: number[]) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const ids = marks.map((t, i) => window.setTimeout(() => setStage(i + 1), t));
    return () => ids.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return stage;
}

/** Covers the pre-rename sidebar wordmark in the captures with the Control Plane name. */
export function BrandPatch() {
  return (
    <div style={{ position: 'absolute', left: '4.7%', top: '2.4%', width: '10.2%', height: '6%', background: 'hsl(218 29% 19%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.15em' }}>
      <div className="f-display" style={{ color: '#f3efe6', fontWeight: 600, fontSize: '1.15em', lineHeight: 1, letterSpacing: '-0.03em' }}>Control Plane</div>
      <div className="f-mono" style={{ color: 'rgba(243,239,230,0.6)', fontSize: '0.5em', letterSpacing: '0.18em' }}>SHARED INTELLIGENCE</div>
    </div>
  );
}
