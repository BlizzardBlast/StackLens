import { describe, expect, it } from "vitest";

import { normalizeAdvisorySeverity, advisoryAliasGroup } from "../src/advisory-severity.js";
import type { JavaScriptOsvVulnerability } from "../src/analysis-metadata.js";

function advisory(type: string, score: string): JavaScriptOsvVulnerability {
  return {
    id: "TEST-1",
    aliases: ["CVE-TEST"],
    severities: [{ type, score, source: "OSV fixture" }],
    affected: [{ packageName: "fixture", ecosystem: "npm", severities: [] }],
  };
}
describe("FR-011 validated CVSS base severity", () => {
  it.each([
    ["CVSS_V2", "AV:N/AC:L/Au:N/C:C/I:C/A:C", "2.0", 10],
    ["CVSS_V3", "CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", "3.0", 9.8],
    ["CVSS_V3", "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", "3.1", 9.8],
    ["CVSS_V4", "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:H/SI:H/SA:H", "4.0", 10],
  ])("validates reference vector %s %s", (type, vector, version, score) => {
    expect(normalizeAdvisorySeverity([advisory(type, vector)], "fixture")).toMatchObject({
      severity: "critical",
      ratings: [{ version, vector, baseScore: score, source: "OSV fixture" }],
    });
  });
  it.each([
    "9.8",
    "CVSS:3.1/AV:N",
    "CVSS:3.1/AV:N/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    "CVSS:3.1/AV:Q/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
  ])("preserves unknown for malformed vectors %s", (score) => {
    expect(normalizeAdvisorySeverity([advisory("CVSS_V3", score)], "fixture")).toEqual({
      severity: "unknown",
      ratings: [],
    });
  });
  it("excludes threat/environmental adjustments from CVSS v4 base scoring", () => {
    const vector = "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:H/SI:H/SA:H/E:U";
    expect(
      normalizeAdvisorySeverity([advisory("CVSS_V4", vector)], "fixture").ratings[0]?.baseScore,
    ).toBe(10);
  });
  it("joins transitive advisory aliases and excludes withdrawn records", () => {
    const first = advisory("CVSS_V3", "invalid");
    const second = { ...first, id: "GHSA-2", aliases: ["CVE-TEST", "CVE-OTHER"] };
    const third = { ...first, id: "OSV-3", aliases: ["CVE-OTHER"] };
    expect(advisoryAliasGroup([third, second, first], "TEST-1").map((item) => item.id)).toEqual([
      "GHSA-2",
      "OSV-3",
      "TEST-1",
    ]);
  });
});
