"use client";

import type { GeoJSONSource, GeolocateControl, Map as MlMap, MapLayerMouseEvent, Popup } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { branding } from "@config/branding";
import { useI18n } from "@/lib/i18n/client";
import { mapBus } from "@/lib/map-bus";
import { categoryIcon } from "@/lib/category-icons";
import { mapStyleFor, type ThemeMode } from "@/lib/theme/shared";
import type { MapReportDTO } from "@/types/reports";
import { ReportPreviewCard } from "@/components/reports/ReportPreviewCard";
import { installMarkerImages, markerId } from "./markers";

export type Bbox = [number, number, number, number];
export type LngLat = { lat: number; lng: number };

type Props = {
  reports: MapReportDTO[];
  heatmap: boolean;
  /** Current public theme (map style + marker look). */
  theme: ThemeMode;
  /** Highlighted report (tile with a primary ring). */
  selectedId?: string | null;
  /** Bump `n` to move the camera to `id` (e.g. when the visitor swipes the cards). */
  focus?: { id: string; n: number } | null;
  /** Pixels covered at the bottom (the report cards) – the camera keeps targets above them. */
  bottomInset?: number;
  /** Marker tap/click. */
  onSelect: (r: MapReportDTO) => void;
  /** "Details" in the desktop hover card. */
  onOpen: (r: MapReportDTO) => void;
  onBoundsChange?: (bbox: Bbox, center: LngLat) => void;
  onUserLocation?: (pos: LngLat) => void;
  className?: string;
};

const SRC = "reports";
type FlashKey = "map.locationUnavailable" | "map.outsideArea" | "create.location.locationDenied";

/**
 * Interactive report map (MapLibre GL + any vector style, OpenFreeMap by default).
 * - clusters at low zoom, category tiles with a status dot when zoomed in
 * - dark / light style follows the public theme
 * - desktop: hover preview card; tap/click selects a report (the explorer shows its card)
 */
export function MapView({ reports, heatmap, theme, selectedId, focus, bottomInset = 0, onSelect, onOpen, onBoundsChange, onUserLocation, className }: Props) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const geoRef = useRef<GeolocateControl | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [popupEl, setPopupEl] = useState<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<MapReportDTO | null>(null);
  const [ready, setReady] = useState(false);
  const [styleRev, setStyleRev] = useState(0);
  const [failed, setFailed] = useState<false | "network" | "webgl">(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flashRef = useRef<(k: FlashKey) => void>(() => undefined);
  flashRef.current = (k) => {
    setNotice(t(k));
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  };
  const flash = (k: FlashKey) => flashRef.current(k);
  const byId = useMemo(() => new Map(reports.map((r) => [r.id, r])), [reports]);
  const byIdRef = useRef(byId);
  byIdRef.current = byId;
  const cb = useRef({ onSelect, onOpen, onBoundsChange, onUserLocation });
  cb.current = { onSelect, onOpen, onBoundsChange, onUserLocation };
  const themeRef = useRef(theme);
  const insetRef = useRef(bottomInset);
  insetRef.current = bottomInset;
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const geojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: reports.map((r, i) => ({
        type: "Feature" as const,
        id: i + 1,
        geometry: { type: "Point" as const, coordinates: [r.lng, r.lat] },
        properties: { id: r.id, color: r.color, icon: categoryIcon(r.categoryKey) },
      })),
    }),
    [reports],
  );
  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

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
        style: mapStyleFor(themeRef.current),
        center: [branding.map.defaultLocation.lng, branding.map.defaultLocation.lat],
        zoom: branding.map.defaultZoom,
        minZoom: branding.map.minZoom,
        maxZoom: branding.map.maxZoom,
        maxBounds: branding.map.maxBounds ?? undefined,
        attributionControl: { compact: true },
        cooperativeGestures: false,
      });
      mapRef.current = map;
      installMarkerImages(map, (mode) => branding.publicTheme[mode].primary);
      // Phones pinch to zoom; desktops get +/- buttons.
      if (!touch) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      const geo = new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true, timeout: 10_000 },
        trackUserLocation: false,
        showAccuracyCircle: true,
        fitBoundsOptions: { maxZoom: 16 },
      });
      geoRef.current = geo;
      // The button itself is hidden on the public site – the header's location icon triggers it.
      map.addControl(geo, "top-right");
      geo.on("error", () => flash(window.isSecureContext ? "create.location.locationDenied" : "map.locationUnavailable"));
      // MapLibre fires "outofmaxbounds" (and does not move) when the position is outside maxBounds.
      geo.on("outofmaxbounds", () => flash("map.outsideArea"));
      geo.on("geolocate", (pos: GeolocationPosition) => {
        const b = branding.map.maxBounds;
        const { latitude: lat, longitude: lng } = pos.coords;
        if (b && (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3])) flash("map.outsideArea");
        else cb.current.onUserLocation?.({ lat, lng });
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

      /** Source + layers; re-run after every style switch (dark/light). */
      const install = () => {
        if (!map || map.getSource(SRC)) return;
        const mode = themeRef.current;
        const dark = mode === "dark";
        const primary = branding.publicTheme[mode].primary;
        map.addSource(SRC, { type: "geojson", data: geojsonRef.current, cluster: true, clusterMaxZoom: 13, clusterRadius: 42 });
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
            "circle-color": dark ? "#232328" : "#ffffff",
            "circle-stroke-color": primary,
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.9,
            "circle-radius": ["step", ["get", "point_count"], 17, 10, 21, 50, 26, 200, 31],
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: SRC,
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 14, "text-font": [...branding.map.labelFont], "text-allow-overlap": true },
          paint: { "text-color": dark ? "#f4f4f6" : "#1c1c20" },
        });
        map.addLayer({
          id: "points",
          type: "symbol",
          source: SRC,
          filter: ["!", ["has", "point_count"]],
          layout: { "icon-image": markerId(mode, false), "icon-allow-overlap": true, "icon-anchor": "center", "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.8, 15, 1] },
        });
        map.addLayer({
          id: "points-active",
          type: "symbol",
          source: SRC,
          filter: ["==", ["get", "id"], ""],
          layout: { "icon-image": markerId(mode, true), "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-anchor": "center" },
        });
        setStyleRev((n) => n + 1);
      };

      map.on("load", () => {
        if (!map) return;
        setFailed(false);
        install();
        // Compact attribution starts expanded on small screens; keep it as the (i) button until tapped.
        container.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");

        map.on("click", "clusters", async (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const src = map!.getSource(SRC) as GeoJSONSource;
          const zoom = await src.getClusterExpansionZoom(f.properties!.cluster_id as number);
          map!.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.3, padding: { top: 0, left: 0, right: 0, bottom: insetRef.current } });
        });
        const pick = (e: MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          const r = id ? byIdRef.current.get(id) : undefined;
          if (r) cb.current.onSelect(r);
        };
        map.on("click", "points", pick);
        map.on("click", "points-active", pick);
        for (const layer of ["points", "points-active", "clusters"]) {
          map.on("mouseenter", layer, () => (map!.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map!.getCanvas().style.cursor = ""));
        }
        if (!touch) {
          map.on("mousemove", "points", (e) => {
            const f = e.features?.[0];
            if (!f) return;
            const id = f.properties?.id as string;
            const r = byIdRef.current.get(id);
            if (!r) return;
            clearTimeout(closeTimer.current);
            setHovered(r);
            const el = document.createElement("div");
            if (!popupRef.current) {
              popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: true, maxWidth: "340px", offset: 22, className: "cr-popup" });
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
          map.on("mouseleave", "points", () => scheduleClose());
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
          const c = map!.getCenter();
          cb.current.onBoundsChange?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], { lat: c.lat, lng: c.lng });
        };
        map.on("moveend", emitBounds);
        emitBounds();
        setReady(true);
      });
      // After a theme switch (setStyle) the sources/layers are gone: add them again.
      map.on("style.load", () => {
        if (map?.loaded() || map?.isStyleLoaded()) install();
      });
    })().catch((err) => {
      console.error("[map] failed to initialise", err);
      setFailed(/webgl/i.test(String((err as Error)?.message ?? err)) ? "webgl" : "network");
    });
    const offLocate = mapBus.on("locate", () => {
      if (!geoRef.current) return;
      if (!window.isSecureContext) return flash("map.locationUnavailable");
      geoRef.current.trigger();
    });
    return () => {
      cancelled = true;
      offLocate();
      popupRef.current?.remove();
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme switch → swap the map style (layers are re-installed on "style.load").
  useEffect(() => {
    const map = mapRef.current;
    if (themeRef.current === theme) return;
    themeRef.current = theme;
    if (map) map.setStyle(mapStyleFor(theme));
  }, [theme]);

  // Push data updates.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource(SRC) as GeoJSONSource | undefined)?.setData(geojson);
  }, [geojson, ready, styleRev]);

  // Selected marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.getLayer("points-active")) return;
    map.setFilter("points-active", ["==", ["get", "id"], selectedId ?? ""]);
    map.setFilter("points", selectedId ? ["all", ["!", ["has", "point_count"]], ["!=", ["get", "id"], selectedId]] : ["!", ["has", "point_count"]]);
  }, [selectedId, ready, styleRev]);

  // Camera follows the card the visitor swiped to.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus) return;
    const r = byIdRef.current.get(focus.id);
    if (!r) return;
    map.easeTo({
      center: [r.lng, r.lat],
      zoom: Math.max(map.getZoom(), 15),
      padding: { top: 72, left: 0, right: 0, bottom: insetRef.current },
      duration: 650,
    });
  }, [focus, ready]);

  // Heat-map toggle.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.getLayer("heat")) return;
    map.setLayoutProperty("heat", "visibility", heatmap ? "visible" : "none");
    for (const l of ["clusters", "cluster-count", "points", "points-active"]) map.setLayoutProperty(l, "visibility", heatmap ? "none" : "visible");
  }, [heatmap, ready, styleRev]);

  return (
    <div className={className}>
      <div ref={container} className="h-full w-full" role="region" aria-label={t("map.label")} />
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-background p-6 text-center text-muted">
          <div className="space-y-2">
            <p>{failed === "webgl" ? t("map.webglError") : t("map.mapError")}</p>
            <button type="button" className="link" onClick={() => window.location.reload()}>
              {t("common.retry")}
            </button>
          </div>
        </div>
      )}
      {notice && (
        <div role="status" className="absolute inset-x-4 top-20 z-20 mx-auto max-w-sm rounded-2xl px-4 py-3 text-center text-sm font-medium cr-glass">
          {notice}
        </div>
      )}
      {popupEl && hovered && createPortal(<ReportPreviewCard report={hovered} onOpen={() => cb.current.onOpen(hovered)} />, popupEl)}
    </div>
  );
}
