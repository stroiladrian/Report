"use client";

import { useState } from "react";
import { formatDate, type Locale } from "@/lib/i18n/core";

/** Single-series daily bar chart with hover tooltip and a hidden data table (a11y). */
export function DailyBars({ data, locale, label }: { data: { day: string; count: number }[]; locale: Locale; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const W = 600;
  const PAD = 26;
  const H = 160;
  const gap = 2;
  const bw = (W - PAD) / data.length - gap;
  const ticks = [0, Math.ceil(max / 2), max];
  return (
    <figure className="relative">
      <svg viewBox={`0 -10 ${W} ${H + 32}`} className="h-auto w-full" role="img" aria-label={label}>
        {ticks.map((tk) => {
          const y = H - (tk / max) * H;
          return (
            <g key={tk}>
              <line x1={PAD} x2={W} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={PAD - 6} y={y + 3} textAnchor="end" fontSize={10} fill="#64748b">
                {tk}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.count / max) * H;
          const x = PAD + i * (bw + gap);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x - gap / 2} y={0} width={bw + gap} height={H} fill="transparent" />
              {d.count > 0 && (
                <path
                  d={`M${x},${H} v${-Math.max(h - 4, 0)} q0,-4 4,-4 h${Math.max(bw - 8, 0)} q4,0 4,4 v${Math.max(h - 4, 0)} z`}
                  fill="rgb(var(--c-primary))"
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              {(i === 0 || i % 7 === 0) && (
                <text x={x + bw / 2} y={H + 15} textAnchor="middle" fontSize={10} fill="#64748b">
                  {formatDate(d.day, locale).slice(0, 5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-xs text-white shadow"
          style={{ left: `${((PAD + (hover + 0.5) * (bw + gap)) / W) * 100}%`, top: 0 }}
        >
          {formatDate(data[hover]!.day, locale)}: <b>{data[hover]!.count}</b>
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Horizontal magnitude bars (single hue), labels in ink colour. */
export function HBars({ rows, empty }: { rows: { name: string; count: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.name} className="grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-2 text-sm" title={`${r.name}: ${r.count}`}>
          <span className="truncate text-slate-700">{r.name}</span>
          <span className="h-3 rounded-r bg-slate-100">
            <span className="block h-3 rounded-r" style={{ width: `${(r.count / max) * 100}%`, backgroundColor: "rgb(var(--c-primary))" }} />
          </span>
          <span className="text-right font-semibold tabular-nums text-slate-900">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}
