import type { IconName } from "@/components/ui/Icon";

/** Map icon per top-level category slug (see prisma/demo-data.ts). Unknown categories get a generic pin. */
const BY_ROOT: Record<string, IconName> = {
  roads: "road",
  lighting: "bulb",
  waste: "trash",
  green: "tree",
  infrastructure: "bench",
  traffic: "trafficLight",
  parking: "parking",
  noise: "volume",
  water: "droplet",
  sewerage: "waves",
  buildings: "building",
  integrity: "shield",
  other: "dots",
};

export function categoryIcon(rootSlug: string | null | undefined): IconName {
  return (rootSlug && BY_ROOT[rootSlug]) || "pin";
}
