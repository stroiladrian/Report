"use client";

import type { Map as MlMap } from "maplibre-gl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { branding } from "@config/branding";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

export type PickedLocation = {
  lat: number;
  lng: number;
  street: string | null;
  streetNumber: string | null;
  district: string | null;
  formattedAddress: string | null;
  source: "map" | "gps" | "search" | "admin";
};

type GeoAddress = { lat: number; lng: number; street: string | null; streetNumber: string | null; district: string | null; formattedAddress: string };

function inBounds(lat: number, lng: number) {
  const b = branding.map.maxBounds;
  if (!b) return true;
  return lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3];
}

/**
 * Location selector: the pin stays in the centre, the user pans the map (as in the reference).
 * Reverse geocoding fills the address; address search + "use my location" move the map.
 */
export function LocationPicker({
  value,
  onChange,
  className,
  mapClassName = "h-[46vh] min-h-[280px] md:h-[440px]",
}: {
  value: PickedLocation | null;
  onChange: (v: PickedLocation) => void;
  className?: string;
  mapClassName?: string;
}) {
  const { t } = useI18n();
  const uid = useId();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const suppressGeocode = useRef(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const toast = useToast();
  /** Location-button problems are also shown as a toast: the inline notice sits below the map, off-screen on phones. */
  const warn = (msg: string) => {
    setNotice(msg);
    toast(msg, "error");
  };
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoAddress[] | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);

  const reverse = useCallback(async (lat: number, lng: number, source: PickedLocation["source"]) => {
    if (!inBounds(lat, lng)) {
      setNotice(t("create.location.outOfBounds"));
    } else setNotice(null);
    // Emit coordinates immediately, address when geocoding returns.
    onChangeRef.current({ lat, lng, street: null, streetNumber: null, district: null, formattedAddress: null, source });
    setGeocoding(true);
    try {
      const { result } = await api<{ result: GeoAddress | null }>(`/api/geocode/reverse?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`);
      const cur = valueRef.current;
      if (result && cur && Math.abs(cur.lat - lat) < 1e-9 && Math.abs(cur.lng - lng) < 1e-9) {
        onChangeRef.current({ ...cur, street: result.street, streetNumber: result.streetNumber, district: result.district, formattedAddress: result.formattedAddress });
      }
    } catch {
      /* address stays empty – user can type it */
    } finally {
      setGeocoding(false);
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled || !container.current) return;
      const start = valueRef.current ?? { lat: branding.map.defaultLocation.lat, lng: branding.map.defaultLocation.lng };
      map = new maplibregl.Map({
        container: container.current,
        style: branding.map.styleUrl,
        center: [start.lng, start.lat],
        zoom: valueRef.current ? 17 : branding.map.defaultZoom + 1,
        minZoom: branding.map.minZoom,
        maxBounds: branding.map.maxBounds ?? undefined,
        attributionControl: { compact: true },
        dragRotate: false,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("moveend", () => {
        if (suppressGeocode.current) {
          suppressGeocode.current = false;
          return;
        }
        const c = map!.getCenter();
        void reverse(c.lat, c.lng, "map");
      });
      map.on("load", () => {
        if (!valueRef.current) {
          const c = map!.getCenter();
          void reverse(c.lat, c.lng, "map");
        }
      });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [reverse]);

  // Address autocomplete (debounced)
  useEffect(() => {
    if (q.trim().length < 3) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    const h = setTimeout(() => {
      api<{ items: GeoAddress[] }>(`/api/geocode/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        .then((r) => {
          setResults(r.items);
          setActiveIdx(-1);
        })
        .catch(() => undefined);
    }, 350);
    return () => {
      clearTimeout(h);
      ctrl.abort();
    };
  }, [q]);

  const choose = (r: GeoAddress) => {
    setResults(null);
    setQ(r.formattedAddress);
    suppressGeocode.current = true;
    mapRef.current?.flyTo({ center: [r.lng, r.lat], zoom: 17 });
    onChange({ lat: r.lat, lng: r.lng, street: r.street, streetNumber: r.streetNumber, district: r.district, formattedAddress: r.formattedAddress, source: "search" });
    setNotice(inBounds(r.lat, r.lng) ? null : t("create.location.outOfBounds"));
  };

  const locate = () => {
    if (!navigator.geolocation || !window.isSecureContext) return warn(t("map.locationUnavailable"));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        if (!inBounds(lat, lng)) return warn(t("map.outsideArea"));
        suppressGeocode.current = true;
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 17 });
        void reverse(lat, lng, "gps");
      },
      () => {
        setLocating(false);
        warn(window.isSecureContext ? t("create.location.locationDenied") : t("map.locationUnavailable"));
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const listId = `${uid}-list`;
  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <label htmlFor={`${uid}-q`} className="sr-only">
          {t("create.location.search")}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id={`${uid}-q`}
              type="search"
              role="combobox"
              aria-expanded={!!results?.length}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeIdx >= 0 ? `${listId}-${activeIdx}` : undefined}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (!results?.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.min(results.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter" && activeIdx >= 0) {
                  e.preventDefault();
                  choose(results[activeIdx]!);
                } else if (e.key === "Escape") setResults(null);
              }}
              placeholder={t("create.location.searchPlaceholder")}
              className="input pl-9"
              autoComplete="off"
            />
          </div>
          <button type="button" onClick={locate} aria-label={t("create.location.useMyLocation")} title={t("create.location.useMyLocation")} className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-50">
            {locating ? <Spinner size={16} /> : <Icon name="locate" size={18} />}
            <span className="hidden sm:inline">{t("create.location.useMyLocation")}</span>
          </button>
        </div>
        {results && (
          <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-300 bg-white shadow-card">
            {results.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">{t("create.location.noResults")}</li>
            ) : (
              results.map((r, i) => (
                <li
                  key={`${r.lat},${r.lng},${i}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(r);
                  }}
                  className={cn("cursor-pointer px-3 py-2 text-sm hover:bg-slate-100", i === activeIdx && "bg-slate-100")}
                >
                  <span className="font-semibold">{r.formattedAddress}</span>
                  {r.district && <span className="block text-xs text-slate-500">{r.district}</span>}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div className={cn("relative overflow-hidden rounded-lg border border-slate-300", mapClassName)}>
        <div ref={container} className="h-full w-full" aria-label={t("create.location.hint")} role="application" />
        {/* Fixed centre pin */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full" aria-hidden="true">
          <svg width="40" height="52" viewBox="0 0 40 52" className="drop-shadow-md">
            <path d="M20 51S3 32.5 3 19a17 17 0 1 1 34 0c0 13.5-17 32-17 32z" fill={branding.colors.accent} stroke="#fff" strokeWidth="3" />
            <circle cx="20" cy="19" r="6.5" fill="#fff" />
          </svg>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/30" aria-hidden="true" />
      </div>

      <div className="rounded-lg bg-surface p-3 text-sm" aria-live="polite">
        <p className="font-semibold text-slate-700">{t("create.location.detected")}</p>
        <p className="flex items-center gap-2 text-slate-900">
          {geocoding && <Spinner size={14} />}
          {value ? value.formattedAddress || `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : "—"}
        </p>
        {notice && <p className="mt-1 font-medium text-amber-800">{notice}</p>}
      </div>
    </div>
  );
}
