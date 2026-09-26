'use client';

import { useEffect, useRef, useState } from 'react';
import { INDIA_PATH, INDIA_VIEWBOX, REACH_ORIGIN, REACH_POINTS } from '@/lib/site/india-map';
import m from './reach.module.css';

// A curved route from Jaipur to a destination, bowed upward (or left, for
// routes running north) so the lines fan out instead of overlapping.
function arc(x2: number, y2: number) {
  const { x: x1, y: y1 } = REACH_ORIGIN;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  let nx = -dy / len, ny = dx / len;
  if (ny > 0 || (Math.abs(ny) < 0.2 && nx > 0)) { nx = -nx; ny = -ny; }
  const k = len * 0.22;
  const cx = (x1 + x2) / 2 + nx * k, cy = (y1 + y2) / 2 + ny * k;
  return `M${x1} ${y1}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2} ${y2}`;
}

const STAGGER = 0.16; // seconds between routes

// Routes draw out from Jaipur once the map scrolls into view, each landing
// with a ripple; small lights then keep travelling along them. Without
// JavaScript, or with reduced motion, the finished map shows at once.
export default function IndiaReach({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { setLive(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setLive(true); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { width, height } = INDIA_VIEWBOX;
  const o = REACH_ORIGIN;
  return (
    <div ref={ref} className={`${m.map} ${live ? m.live : ''}`}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <defs>
          <pattern id="reach-dots" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="3.5" cy="3.5" r="0.95" className={m.dot} />
          </pattern>
          <radialGradient id="reach-glow">
            <stop offset="0" style={{ stopColor: 'var(--gold)', stopOpacity: 0.45 }} />
            <stop offset="1" style={{ stopColor: 'var(--gold)', stopOpacity: 0 }} />
          </radialGradient>
          {REACH_POINTS.map((p, i) => (
            <linearGradient key={i} id={`reach-g${i}`} gradientUnits="userSpaceOnUse" x1={o.x} y1={o.y} x2={p.x} y2={p.y}>
              <stop offset="0" style={{ stopColor: 'var(--gold)' }} />
              <stop offset="1" style={{ stopColor: 'var(--route-end)' }} />
            </linearGradient>
          ))}
        </defs>

        <path d={INDIA_PATH} className={m.land} />
        <path d={INDIA_PATH} fill="url(#reach-dots)" />

        <circle cx={o.x} cy={o.y} r="70" fill="url(#reach-glow)" className={m.glow} />

        <g className={m.routes}>
          {REACH_POINTS.map((p, i) => (
            <path key={i} d={arc(p.x, p.y)} pathLength={1} stroke={`url(#reach-g${i})`} className={m.route}
              style={{ animationDelay: `${0.3 + i * STAGGER}s` }} />
          ))}
        </g>

        {REACH_POINTS.map((p, i) => {
          const landed = 0.3 + i * STAGGER + 1.1;
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" className={m.ripple} style={{ animationDelay: `${landed}s` }} />
              <circle cx={p.x} cy={p.y} r="3.6" className={m.stop} style={{ animationDelay: `${landed}s` }} />
              <circle r="2.2" className={m.spark} style={{ animationDelay: `${landed + 0.4}s` }}>
                <animateMotion dur={`${2.6 + (i % 3) * 0.35}s`} begin={`${(i * 0.37) % 2.4}s`} repeatCount="indefinite"
                  path={arc(p.x, p.y)} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.25 1" />
              </circle>
            </g>
          );
        })}

        <g className={m.origin}>
          <circle cx={o.x} cy={o.y} r="6" className={m.pulse} />
          <circle cx={o.x} cy={o.y} r="6" className={m.pulse} style={{ animationDelay: '1.2s' }} />
          <circle cx={o.x} cy={o.y} r="6" className={m.core} />
          <g transform={`translate(${o.x - 14} ${o.y + 12})`}>
            <rect x="-38" y="0" width="52" height="20" rx="10" className={m.tag} />
            <text x="-12" y="14" textAnchor="middle" className={m.tagText}>{o.label}</text>
          </g>
        </g>
      </svg>
    </div>
  );
}
