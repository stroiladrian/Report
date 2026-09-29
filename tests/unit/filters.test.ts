import { describe, expect, it } from "vitest";
import { activeFilterCount, parseFilters, toApiQuery, toSearch } from "@/lib/filters";

describe("URL filter state", () => {
  it("round-trips through the query string", () => {
    const qs = "?status=in_progress&category=roads,waste&period=30d&q=lamp&view=list&page=2";
    const f = parseFilters(new URLSearchParams(qs));
    expect(f).toMatchObject({ status: ["in_progress"], category: ["roads", "waste"], period: "30d", q: "lamp", view: "list", page: 2 });
    expect(toSearch(f)).toBe("?status=in_progress&category=roads%2Cwaste&period=30d&q=lamp&view=list&page=2");
    expect(activeFilterCount(f)).toBe(4);
  });
  it("treats absent lists as 'all' and '-' as 'none'", () => {
    expect(parseFilters(new URLSearchParams("")).status).toBeNull();
    expect(parseFilters(new URLSearchParams("category=-")).category).toEqual([]);
    expect(toApiQuery(parseFilters(new URLSearchParams("category=-")))).toBe("category=__none__");
  });
  it("custom dates override the preset period", () => {
    const f = parseFilters(new URLSearchParams("period=7d&from=2026-01-01&to=bad"));
    expect(f.from).toBe("2026-01-01");
    expect(f.to).toBeNull();
    expect(toSearch(f)).toBe("?from=2026-01-01");
  });
});
