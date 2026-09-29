"use client";

import type { GeoJSONSource, Map as MlMap, MapLayerMouseEvent, Popup } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { branding } from "@config/branding";
import { useI18n } from "@/lib/i18n/client";
import type { MapReportDTO } from "@/types/reports";
import { ReportPreviewCard } from "@/components/reports/ReportPreviewCard";

export type Bbox = [number, number, number, number];

type Props = {
  reports: MapReportDTO[];
  heatmap: boolean;
  onOpen: (r: MapReportDTO) => void;
  onBoundsChange?: (bbox: Bbox) => void;
  className?: string;
};

const SRC = "reports";

/**
 * Interactive report map (MapLibre GL + any vector style, OpenFreeMap by default).
 * - clusters at low zoom, individual status-coloured points when zoomed in
 * - heat-map mode
 * - desktop: hover preview card; touch: tap opens the report
 */
export function MapView({ reports, heatmap, onOpen, onBoundsChange, className }: Props) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [popupEl, setPopupEl] = useState<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<MapReportDTO | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<false | "network" | "webgl">(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flashRef = useRef<(k: "map.locationUnavailable" | "map.outsideArea" | "create.location.locationDenied") => void>(() => undefined);
  flashRef.current = (k) => {
    setNotice(t(k));
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  };
  const flash = (k: "map.locationUnavailable" | "map.outsideArea" | "create.location.locationDenied") => flashRef.current(k);
  const byId = useMemo(() => new Map(reports.map((r) => [r.id, r])), [reports]);
  const byIdRef = useRef(byId);
  byIdRef.current = byId;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const onBoundsRef = useRef(onBoundsChange);
  onBoundsRef.current = onBoundsChange;
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const geojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: reports.map((r) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [r.lng, r.lat] },
        properties: { id: r.id, color: r.color },
      })),
    }),
    [reports],
  );

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !container.current) return;
      const touch = window.matchMedia("(hover: none)").matches;
      map = new maplibregl.Map({
        container: container.current,
        style: branding.map.styleUrl,
        center: [branding.map.defaultLocation.lng, branding.map.defaultLocation.lat],
        zoom: branding.map.defaultZoom,
        minZoom: branding.map.minZoom,
        maxZoom: branding.map.maxZoom,
        maxBounds: branding.map.maxBounds ?? undefined,
        attributionControl: { compact: true },
        cooperativeGestures: false,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      const geo = new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true, timeout: 10_000 },
        trackUserLocation: false,
        showAccuracyCircle: true,
        fitBoundsOptions: { maxZoom: 16 },
      });
      map.addControl(geo, "top-right");
      geo.on("error", () => flash(window.isSecureContext ? "create.location.locationDenied" : "map.locationUnavailable"));
      // MapLibre fires "outofmaxbounds" (and does not move) when the position is outside maxBounds.
      geo.on("outofmaxbounds", () => flash("map.outsideArea"));
      geo.on("geolocate", (pos: GeolocationPosition) => {
        const b = branding.map.maxBounds;
        const { latitude: lat, longitude: lng } = pos.coords;
        if (b && (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3])) flash("map.outsideArea");
      });
      map.on("error", (e) => {
        console.error("[map]", e.error);
        // Only treat it as fatal if the map style is still missing a few seconds later
        // (a single failed tile/sprite request must not hide the whole map).
        if (!map?.isStyleLoaded() && /style|fetch/i.test(String(e.error?.message ?? ""))) {
          setTimeout(() => {
            if (map && !map.isStyleLoaded()) setFailed("network");
          }, 4000);
        }
      });

      map.on("load", () => {
        if (!map) return;
        setFailed(false);
        map.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterMaxZoom: 13, clusterRadius: 38 });
        map.addLayer({
          id: "heat",
          type: "heatmap",
          source: SRC,
          layout: { visibility: "none" },
          paint: {
            "heatmap-weight": ["case", ["has", "point_count"], ["min", ["/", ["get", "point_count"], 5], 3], 1],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 16, 2],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 14, 16, 34],
            "heatmap-opacity": 0.85,
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(33,102,172,0)", 0.15, "rgb(103,169,207)", 0.35, "rgb(209,229,240)",
              0.5, "rgb(253,219,119)", 0.7, "rgb(244,165,96)", 0.85, "rgb(214,96,77)", 1, "rgb(178,24,43)",
            ],
          },
        });
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: SRC,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": branding.colors.primary,
            "circle-opacity": 0.88,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 50, 24, 200, 30],
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: SRC,
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 13, "text-font": [...branding.map.labelFont] },
          paint: { "text-color": "#ffffff" },
        });
        map.addLayer({
          id: "points",
          type: "circle",
          source: SRC,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 5, 16, 8, 19, 11],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 3, 1.5],
            "circle-opacity": 0.95,
          },
        });

        map.on("click", "clusters", async (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const src = map!.getSource(SRC) as GeoJSONSource;
          const zoom = await src.getClusterExpansionZoom(f.properties!.cluster_id as number);
          map!.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.3 });
        });
        let hoverId: string | number | undefined;
        const clearHover = () => {
          if (hoverId !== undefined) map!.setFeatureState({ source: SRC, id: hoverId }, { hover: false });
          hoverId = undefined;
        };
        map.on("click", "points", (e: MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          const r = id ? byIdRef.current.get(id) : undefined;
          if (r) onOpenRef.current(r);
        });
        for (const layer of ["points", "clusters"]) {
          map.on("mouseenter", layer, () => (map!.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map!.getCanvas().style.cursor = ""));
        }
        if (!touch) {
          map.on("mousemove", "points", (e) => {
            const f = e.features?.[0];
            if (!f) return;
            const id = f.properties?.id as string;
            if (hoverId !== f.id) {
              clearHover();
              hoverId = f.id;
              if (hoverId !== undefined) map!.setFeatureState({ source: SRC, id: hoverId }, { hover: true });
            }
            const r = byIdRef.current.get(id);
            if (!r) return;
            clearTimeout(closeTimer.current);
            setHovered(r);
            const el = document.createElement("div");
            if (!popupRef.current) {
              popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: true, maxWidth: "340px", offset: 12, className: "cr-popup" });
            }
            const p = popupRef.current;
            if (!p.isOpen() || (p as unknown as { _rid?: string })._rid !== id) {
              (p as unknown as { _rid?: string })._rid = id;
              p.setLngLat([r.lng, r.lat]).setDOMContent(el).addTo(map!);
              el.addEventListener("mouseenter", () => clearTimeout(closeTimer.current));
              el.addEventListener("mouseleave", () => scheduleClose());
              setPopupEl(el);
            }
          });
          map.on("mouseleave", "points", () => {
            clearHover();
            scheduleClose();
          });
        }
        const scheduleClose = () => {
          clearTimeout(closeTimer.current);
          closeTimer.current = setTimeout(() => {
            popupRef.current?.remove();
            setPopupEl(null);
            setHovered(null);
          }, 350);
        };
        const emitBounds = () => {
          const b = map!.getBounds();
          onBoundsRef.current?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
        };
        map.on("moveend", emitBounds);
        emitBounds();
        setReady(true);
      });
    })().catch((err) => {
      console.error("[map] failed to initialise", err);
      setFailed(/webgl/i.test(String((err as Error)?.message ?? err)) ? "webgl" : "network");
    });
    return () => {
      cancelled = true;
      popupRef.current?.remove();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Push data updates.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const src = map.getSource(SRC) as GeoJSONSource | undefined;
    // promoteId-like behaviour: give features numeric ids for feature-state
    src?.setData({ ...geojson, features: geojson.features.map((f, i) => ({ ...f, id: i + 1 })) });
  }, [geojson, ready]);

  // Heat-map toggle.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setLayoutProperty("heat", "visibility", heatmap ? "visible" : "none");
    for (const l of ["clusters", "cluster-count", "points"]) map.setLayoutProperty(l, "visibility", heatmap ? "none" : "visible");
  }, [heatmap, ready]);

  return (
    <div className={className}>
      <div ref={container} className="h-full w-full" role="region" aria-label={t("map.label")} />
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-slate-100 p-6 text-center text-slate-600">
          <div className="space-y-2">
            <p>{failed === "webgl" ? t("map.webglError") : t("map.mapError")}</p>
            <button type="button" className="link" onClick={() => window.location.reload()}>
              {t("common.retry")}
            </button>
          </div>
        </div>
      )}
      {notice && (
        <div role="status" className="absolute inset-x-3 top-16 z-20 mx-auto max-w-sm rounded-md bg-slate-900/90 px-3 py-2 text-center text-sm font-medium text-white shadow-lg md:top-3">
          {notice}
        </div>
      )}
      {popupEl &&
        hovered &&
        createPortal(<ReportPreviewCard report={hovered} onOpen={() => onOpenRef.current(hovered)} />, popupEl)}
    </div>
  );
}
