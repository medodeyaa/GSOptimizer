import { describe, it, expect } from "vitest";
import { parseMB, parseSystemRequirements, requirementsToDemand } from "./pcgwClient";

// A trimmed but realistic {{System requirements}} block (The Witcher 3 shape).
const WIKITEXT = `
==System requirements==
{{System requirements
|OSfamily = Windows
|minOS    = 7, 8, 8.1
|minCPU   = Intel Core i5-2500K
|minCPU2  = AMD A10-5800K
|minRAM   = 6 GB
|minGPU   = Nvidia GeForce GTX 660
|minGPU2  = AMD Radeon HD 7870
|minVRAM  = 2 GB
|recOS    = 7, 8, 8.1
|recCPU   = Intel Core i7-3770
|recRAM   = 8 GB
|recGPU   = Nvidia GeForce GTX 770{{note|As of patch}}
|recVRAM  = 4 GB
}}
==Other==
`;

describe("parseMB", () => {
  it("parses GB and MB", () => {
    expect(parseMB("6 GB")).toBe(6144);
    expect(parseMB("512 MB")).toBe(512);
    expect(parseMB("2gb")).toBe(2048);
    expect(parseMB("8 GB RAM")).toBe(8192);
  });
  it("returns undefined for junk", () => {
    expect(parseMB(undefined)).toBeUndefined();
    expect(parseMB("")).toBeUndefined();
    expect(parseMB("lots")).toBeUndefined();
  });
});

describe("parseSystemRequirements", () => {
  it("extracts min/rec hardware and strips wiki noise", () => {
    const req = parseSystemRequirements(WIKITEXT);
    expect(req).not.toBeNull();
    expect(req!.minCPU).toBe("Intel Core i5-2500K");
    expect(req!.recCPU).toBe("Intel Core i7-3770");
    expect(req!.recGPU).toBe("Nvidia GeForce GTX 770"); // {{note}} stripped
    expect(req!.minRAM_mb).toBe(6144);
    expect(req!.recRAM_mb).toBe(8192);
    expect(req!.minVRAM_mb).toBe(2048);
    expect(req!.recVRAM_mb).toBe(4096);
  });

  it("returns null when there is no requirements block", () => {
    expect(parseSystemRequirements("==Gameplay==\nSome prose.")).toBeNull();
  });

  it("returns null when the block has no usable hardware signal", () => {
    expect(parseSystemRequirements("{{System requirements\n|OSfamily = Windows\n}}")).toBeNull();
  });
});

describe("requirementsToDemand", () => {
  const fallback = { gpu: 0.45, cpu: 0.45 };

  it("derives demand from real specs (heavier rec GPU ⇒ higher demand)", () => {
    const req = parseSystemRequirements(WIKITEXT)!;
    const heavy = requirementsToDemand(req, 2015, fallback);
    expect(heavy.gpu).toBeGreaterThanOrEqual(0.1);
    expect(heavy.gpu).toBeLessThanOrEqual(1);
    expect(heavy.cpu).toBeGreaterThanOrEqual(0.1);
    expect(heavy.cpu).toBeLessThanOrEqual(1);
  });

  it("falls back to genre demand for unmatchable hardware", () => {
    const req = { recGPU: "Quantum FluxCard 9000", recCPU: "Imaginary ChipZ" };
    const d = requirementsToDemand(req, 2015, fallback);
    expect(d.gpu).toBe(fallback.gpu);
    expect(d.cpu).toBe(fallback.cpu);
  });
});
