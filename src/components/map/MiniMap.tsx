"use client";

import { useEffect, useRef } from "react";
import { branding } from "@config/branding";

/** Small static map with a single pin (report detail). */
export function MiniMap({ lat, lng, color = branding.colors.primary, className, label }: { lat: number; lng: number; color?: string; className?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled || !ref.current) return;
      map = new maplibregl.Map({
        container: ref.current,
        style: branding.map.styleUrl,
        center: [lng, lat],
        zoom: 16,
        interactive: true,
        scrollZoom: false,
        dragRotate: false,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      new maplibregl.Marker({ color }).setLngLat([lng, lat]).addTo(map);
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng, color]);
  return <div ref={ref} className={className} role="img" aria-label={label} />;
}
