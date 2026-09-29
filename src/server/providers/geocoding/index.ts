/**
 * Geocoding abstraction (address search + reverse geocoding).
 * - NominatimGeocoder: OpenStreetMap Nominatim (free, 1 req/s policy – results are cached).
 * - MockGeocoder: offline deterministic fictional addresses (tests / air-gapped dev).
 * Select with GEOCODER=nominatim|mock.
 */
import { branding } from "@config/branding";

export type GeoAddress = {
  lat: number;
  lng: number;
  street: string | null;
  streetNumber: string | null;
  district: string | null;
  formattedAddress: string;
};

export interface GeocodingProvider {
  readonly name: string;
  reverse(lat: number, lng: number, locale: string): Promise<GeoAddress | null>;
  search(query: string, locale: string): Promise<GeoAddress[]>;
}

class TtlCache<V> {
  private m = new Map<string, { v: V; exp: number }>();
  constructor(private ttlMs: number, private max = 2000) {}
  get(k: string) {
    const e = this.m.get(k);
    if (!e) return undefined;
    if (e.exp < Date.now()) {
      this.m.delete(k);
      return undefined;
    }
    return e.v;
  }
  set(k: string, v: V) {
    if (this.m.size >= this.max) this.m.delete(this.m.keys().next().value!);
    this.m.set(k, { v, exp: Date.now() + this.ttlMs });
  }
}

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
};

export class NominatimGeocoder implements GeocodingProvider {
  readonly name = "nominatim";
  private cache = new TtlCache<unknown>(24 * 3_600_000);
  private last = 0;
  constructor(private baseUrl = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org") {}

  private async get<T>(path: string, locale: string): Promise<T | null> {
    const key = `${locale}:${path}`;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit as T;
    // Respect the 1 request / second usage policy.
    const wait = this.last + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.last = Date.now();
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        // HTTP headers must be ASCII: "Primăria Orașului" would make fetch() throw, so strip diacritics.
        "user-agent": asciiHeader(`${branding.brandName}/1.0 (${process.env.GEOCODER_CONTACT ?? branding.contact.email})`),
        "accept-language": locale,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    this.cache.set(key, data);
    return data;
  }

  private map(r: NominatimResult): GeoAddress {
    const a = r.address ?? {};
    const street = a.road ?? a.pedestrian ?? a.footway ?? a.square ?? a.path ?? null;
    return {
      lat: Number(r.lat),
      lng: Number(r.lon),
      street,
      streetNumber: a.house_number ?? null,
      district: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? null,
      formattedAddress: [street, a.house_number].filter(Boolean).join(" ") || r.display_name.split(",").slice(0, 2).join(","),
    };
  }

  async reverse(lat: number, lng: number, locale: string) {
    const r = await this.get<NominatimResult & { error?: string }>(
      `/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}`,
      locale,
    );
    if (!r || r.error) return null;
    return this.map(r);
  }

  async search(query: string, locale: string) {
    const b = branding.map.maxBounds;
    const viewbox = b ? `&viewbox=${b[0]},${b[3]},${b[2]},${b[1]}&bounded=1` : "";
    const rs = await this.get<NominatimResult[]>(
      `/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(query)}${viewbox}`,
      locale,
    );
    return (rs ?? []).map((r) => this.map(r));
  }
}

const FICTIONAL_STREETS = [
  "Strada Castanilor", "Strada Teilor", "Bulevardul Unirii", "Strada Florilor", "Strada Morii",
  "Strada Lalelelor", "Aleea Parcului", "Strada Școlii", "Strada Gării", "Strada Viilor",
  "Strada Plopilor", "Calea Nordului", "Strada Fântânii", "Strada Livezii", "Strada Podului",
];
const DISTRICTS = ["Centru", "Cartierul Nord", "Cartierul Sud", "Zona Est", "Grădini", "Industrial Vest"];

export class MockGeocoder implements GeocodingProvider {
  readonly name = "mock";
  async reverse(lat: number, lng: number): Promise<GeoAddress> {
    const h = Math.abs(Math.round(lat * 10_000) * 31 + Math.round(lng * 10_000));
    const street = FICTIONAL_STREETS[h % FICTIONAL_STREETS.length]!;
    const nr = String((h % 120) + 1);
    return { lat, lng, street, streetNumber: nr, district: DISTRICTS[h % DISTRICTS.length]!, formattedAddress: `${street} ${nr}` };
  }
  async search(query: string): Promise<GeoAddress[]> {
    const q = query.toLowerCase();
    const { lat, lng } = branding.map.defaultLocation;
    return FICTIONAL_STREETS.map((s, i) => ({ s, i }))
      .filter(({ s }) => s.toLowerCase().includes(q.replace(/\d+/g, "").trim()))
      .slice(0, 6)
      .map(({ s, i }) => {
        const nr = /\d+/.exec(query)?.[0] ?? null;
        return {
          lat: lat + (i - 7) * 0.003,
          lng: lng + ((i * 7) % 11 - 5) * 0.004,
          street: s,
          streetNumber: nr,
          district: DISTRICTS[i % DISTRICTS.length]!,
          formattedAddress: [s, nr].filter(Boolean).join(" "),
        };
      });
  }
}

let instance: GeocodingProvider | null = null;
export function getGeocoder(): GeocodingProvider {
  instance ??= process.env.GEOCODER === "mock" ? new MockGeocoder() : new NominatimGeocoder();
  return instance;
}

function asciiHeader(v: string) {
  return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "");
}
