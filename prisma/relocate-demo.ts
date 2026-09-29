/**
 * Moves every report whose location lies OUTSIDE the configured service area
 * (branding.map.maxBounds) to a random point around branding.map.defaultLocation.
 * Use after changing the city in config/branding.ts, so existing demo data follows.
 *
 *   npm run db:relocate-demo
 *
 * Reports already inside the service area are not touched. Street names are kept.
 */
import { PrismaClient } from "@prisma/client";
import { branding } from "../config/branding";

const db = new PrismaClient();

async function main() {
  const b = branding.map.maxBounds;
  const { lat: clat, lng: clng } = branding.map.defaultLocation;
  const km = Number(process.env.SEED_RADIUS_KM ?? branding.map.demoRadiusKm);
  const locs = await db.reportLocation.findMany();
  const outside = locs.filter((l) => !b || l.lng < b[0] || l.lng > b[2] || l.lat < b[1] || l.lat > b[3]);
  for (const l of outside) {
    const r = Math.sqrt(Math.random()) * km;
    const a = Math.random() * Math.PI * 2;
    await db.reportLocation.update({
      where: { reportId: l.reportId },
      data: {
        lat: clat + (r * Math.sin(a)) / 111.32,
        lng: clng + (r * Math.cos(a)) / (111.32 * Math.cos((clat * Math.PI) / 180)),
      },
    });
  }
  console.log(`Relocated ${outside.length} of ${locs.length} report locations to ${clat}, ${clng}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
