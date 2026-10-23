"use client";

import type { Map as MlMap } from "maplibre-gl";
import { ICON_PATHS, type IconName } from "@/components/ui/Icon";
import type { ThemeMode } from "@/lib/theme/shared";

/**
 * Map markers in the style of the reference design: a rounded-square tile with the category icon
 * and a small status-coloured dot. Drawn on a canvas on demand (MapLibre "styleimagemissing"),
 * so any category/status colour combination works without shipping sprite files.
 *
 * Image id: cr|<mode>|<icon>|<#status colour>|<n|a>   (a = active / selected)
 */
export const markerId = (mode: ThemeMode, active: boolean) =>
  ["concat", `cr|${mode}|`, ["get", "icon"], "|", ["get", "color"], active ? "|a" : "|n"] as unknown as string;

const RATIO = 2;

export function installMarkerImages(map: MlMap, primaryFor: (mode: ThemeMode) => string) {
  map.on("styleimagemissing", (e: { id: string }) => {
    const [ns, mode, icon, color, state] = e.id.split("|");
    if (ns !== "cr" || map.hasImage(e.id)) return;
    const img = drawTile(icon as IconName, color, mode as ThemeMode, state === "a", primaryFor(mode as ThemeMode));
    if (img) map.addImage(e.id, img, { pixelRatio: RATIO });
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTile(icon: IconName, color: string, mode: ThemeMode, active: boolean, primary: string) {
  const tile = active ? 46 : 36; // css px
  const pad = 10; // room for the shadow / glow
  const size = tile + pad * 2;
  const c = document.createElement("canvas");
  c.width = c.height = size * RATIO;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.scale(RATIO, RATIO);
  const dark = mode === "dark";
  const x = pad;
  const y = pad - 2;
  const r = tile * 0.3;

  // shadow / glow
  ctx.save();
  ctx.shadowColor = active ? primary : dark ? "rgba(0,0,0,0.6)" : "rgba(15,15,30,0.22)";
  ctx.shadowBlur = active ? 14 : 10;
  ctx.shadowOffsetY = active ? 0 : 4;
  roundRect(ctx, x, y, tile, tile, r);
  ctx.fillStyle = dark ? "#232328" : "#ffffff";
  ctx.fill();
  ctx.restore();

  // body gradient (subtle top highlight, like the reference tiles)
  roundRect(ctx, x, y, tile, tile, r);
  const g = ctx.createLinearGradient(0, y, 0, y + tile);
  g.addColorStop(0, dark ? "#34343b" : "#ffffff");
  g.addColorStop(1, dark ? "#1f1f24" : "#f1f1f5");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = active ? 2.5 : 1;
  ctx.strokeStyle = active ? primary : dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  ctx.stroke();

  // icon (24×24 stroke paths from the app's icon set)
  const d = ICON_PATHS[icon] ?? ICON_PATHS.pin;
  const iconSize = tile * 0.5;
  ctx.save();
  ctx.translate(x + (tile - iconSize) / 2, y + (tile - iconSize) / 2);
  ctx.scale(iconSize / 24, iconSize / 24);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.1;
  ctx.strokeStyle = active ? primary : dark ? "#f4f4f6" : "#26262b";
  ctx.stroke(new Path2D(d));
  ctx.restore();

  // status dot (bottom-right corner, ringed with the page background)
  const dr = active ? 6 : 5;
  const cx = x + tile - dr * 0.6;
  const cy = y + tile - dr * 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, dr + 2.5, 0, Math.PI * 2);
  ctx.fillStyle = dark ? "#121215" : "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, dr, 0, Math.PI * 2);
  ctx.fillStyle = /^#[0-9a-f]{3,8}$/i.test(color) ? color : "#94a3b8";
  ctx.fill();

  const data = ctx.getImageData(0, 0, c.width, c.height);
  return { width: c.width, height: c.height, data: new Uint8Array(data.data.buffer) };
}
