import { describe, expect, it } from "vitest";
import {
  documentMask,
  applyMask,
  applyPhoneMask,
  COUNTRY_RULES,
  docPlaceholderByKey,
  getAllDocsForDDI,
  getCountryRule,
  getCountryRules,
  getDocRule,
  getDocTypesForDDI,
  getDocTypesForDDIOrdered,
  getDocTypesForDDIWithFallback,
  getPlaceholder,
  iso2FromDDI,
  localizeCountryName,
  phoneUnMask,
  validateDocumentByDDI,
  validatePhoneNumber,
} from "../src/compat/index.js";

describe("legacy DDI compatibility", () => {
  it("keeps the old document rule shape", () => {
    const cnpj = getDocRule("55", "CNPJ");
    expect(cnpj).toMatchObject({ key: "CNPJ", countryCode: "BR", validationLevel: "checksum" });
    expect(cnpj?.isValid("11.222.333/0001-81")).toBe(true);
    expect(cnpj?.mask("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("aggregates ambiguous +1 documents while using US as the phone default", () => {
    expect(getDocTypesForDDI("+1").map(({ key }) => key)).toEqual(expect.arrayContaining(["EIN_US", "BN_CA"]));
    expect(iso2FromDDI("1")).toBe("US");
    expect(iso2FromDDI("1", "CA")).toBe("CA");
    expect(validatePhoneNumber("1", "2125551234")).toBe(true);
  });

  it("supports legacy global documentMask aliases", () => {
    expect(documentMask("123456785", "RUT_CL")).toBe("12.345.678-5");
    expect(documentMask("123456789", "EIN_US")).toBe("12-3456789");
  });

  it("covers helpers found in real GTEEX imports", () => {
    expect(phoneUnMask("(11) 91234-5678")).toBe("11912345678");
    expect(applyMask("11912345678", "(99) 99999-9999")).toBe("(11) 91234-5678");
    expect(applyPhoneMask("5511912345678")).toBe("+55 (11) 91234-5678");
    expect(docPlaceholderByKey("EIN_US")).toBe("12-3456789");
    expect(validateDocumentByDDI("55", "11.222.333/0001-81", "CNPJ")).toBe(true);
    expect(COUNTRY_RULES.some(({ ddi }) => ddi === "55")).toBe(true);
  });

  it("exposes the canonical short document type alongside the legacy key", () => {
    expect(getDocRule("56", "RUT_CL")).toMatchObject({ key: "RUT_CL", type: "RUT" });
    expect(getDocRule("1", "EIN_US")).toMatchObject({ key: "EIN_US", type: "EIN" });
    expect(getDocRule("1", "BN_CA")).toMatchObject({ key: "BN_CA", type: "BN" });
    expect(getDocRule("55", "CNPJ")).toMatchObject({ key: "CNPJ", type: "CNPJ" });
    expect(getDocRule("91", "GSTIN")).toMatchObject({ key: "GSTIN", type: "GSTIN" });
    expect(getDocTypesForDDI("56").map((d) => d.type)).toContain("RUT");
  });

  it("keeps Puerto Rico on the federal EIN alias", () => {
    const pr = getDocRule("1787", "EIN");
    expect(pr?.countryCode).toBe("PR");
    expect(pr?.type).toBe("EIN");
    expect(pr?.isValid("12-3456789")).toBe(true);
    expect(pr?.mask("123456789")).toBe("12-3456789");
  });

  it("curates the América fiscal documents that used to fall back", () => {
    expect(getDocRule("598", "RUT")?.isValid("210000012340")).toBe(true);
    expect(getDocRule("591", "NIT")?.isValid("1234567")).toBe(true);
    expect(getDocRule("502", "NIT")?.isValid("1234567-8")).toBe(true);
    expect(getDocRule("58", "RIF")?.isValid("J-12345678-9")).toBe(true);
  });

  it("adds getDocTypesForDDIWithFallback without changing the original getter", () => {
    // Curated → same result as the original
    expect(getDocTypesForDDIWithFallback("55").map(({ key }) => key))
      .toEqual(getDocTypesForDDI("55").map(({ key }) => key));

    // Cuba was fallback pre-curation; still exercise the fallback path for a
    // country outside the registry.
    const zw = getDocTypesForDDIWithFallback("263");
    expect(zw.length).toBeGreaterThan(0);
    expect(zw[0]?.validationLevel).toBe("fallback");

    // Original API keeps returning empty for uncurated countries.
    expect(getDocTypesForDDI("263")).toEqual([]);
  });

  it("adds getDocTypesForDDIOrdered without breaking the filtering original", () => {
    const orderedForCa = getDocTypesForDDIOrdered("1", "CA").map(({ key }) => key);
    expect(orderedForCa).toEqual(expect.arrayContaining(["EIN_US", "BN_CA"]));
    expect(orderedForCa[0]).toBe("BN_CA");

    const orderedForUs = getDocTypesForDDIOrdered("1", "US").map(({ key }) => key);
    expect(orderedForUs[0]).toBe("EIN_US");
    expect(orderedForUs).toContain("BN_CA");

    // Original still filters
    expect(getDocTypesForDDI("1", "US").map(({ key }) => key)).toEqual(["EIN_US"]);
  });

  it("adds getCountryRules(scope) without touching COUNTRY_RULES", () => {
    const latam = getCountryRules("latam");
    const latamDDIs = new Set(latam.map(({ ddi }) => ddi));

    // DDIs that used to be missing from the fixed COUNTRY_RULES
    for (const ddi of ["591", "506", "58", "502", "509", "504", "505", "507", "598"]) {
      expect(latamDDIs.has(ddi)).toBe(true);
    }

    // Every entry has at least one docType (fallback covers the rest).
    expect(latam.every(({ docTypes }) => docTypes.length > 0)).toBe(true);

    // Original constant left intact.
    expect(COUNTRY_RULES.length).toBeGreaterThan(0);
  });

  it("adds getPlaceholder returning undefined on fallback while keeping docPlaceholderByKey untouched", () => {
    expect(getPlaceholder("CNPJ")).toBe("12.ABC.345/01DE-35");
    expect(getPlaceholder("GSTIN")).toBe("09ABCDE1234F1Z5");
    expect(getPlaceholder("CPF")).toBe("529.982.247-25");
    expect(getPlaceholder("UNKNOWN_KEY")).toBeUndefined();
    expect(getPlaceholder(undefined)).toBeUndefined();
    // Original behavior preserved for legacy consumers.
    expect(docPlaceholderByKey("UNKNOWN_KEY")).toBe("Documento");
  });

  it("adds getCountryRule singular without changing the plural getter", () => {
    expect(getCountryRule("55")?.docTypes.some((d) => d.key === "CNPJ")).toBe(true);
    expect(getCountryRule("999")).toBeUndefined();
    // Same rule regardless of scope when the DDI is in the scope.
    expect(getCountryRule("55", "latam")?.ddi).toBe("55");
    expect(getCountryRule("55", "europe")).toBeUndefined();
  });

  it("exposes optional flags and iso2s on legacy country rules", () => {
    const brasil = getCountryRule("55");
    expect(brasil?.flags).toEqual(["🇧🇷"]);
    expect(brasil?.iso2s).toEqual(["BR"]);

    const shared = getCountryRule("1");
    expect(shared?.iso2s?.length).toBeGreaterThan(1);
    expect(shared?.iso2s).toEqual(expect.arrayContaining(["US", "CA"]));
    expect(shared?.flags?.length).toBe(shared?.iso2s?.length);

    // COUNTRY_RULES also carries the fields (opt-in for old consumers).
    const brFromLegacy = COUNTRY_RULES.find((r) => r.ddi === "55");
    expect(brFromLegacy?.iso2s).toEqual(["BR"]);
  });

  it("adds getAllDocsForDDI merging corporate + personal rules PJ-first", () => {
    const brDocs = getAllDocsForDDI("55");
    const keys = brDocs.map(({ key }) => key);
    expect(keys).toContain("CNPJ");
    expect(keys).toContain("CPF");
    expect(keys.indexOf("CNPJ")).toBeLessThan(keys.indexOf("CPF"));

    // Uncurated DDI still returns something (fallback for both buckets).
    const zwDocs = getAllDocsForDDI("263");
    expect(zwDocs.length).toBeGreaterThan(0);
    expect(zwDocs.every((d) => d.validationLevel === "fallback")).toBe(true);
  });

  it("accepts pin and sort options on getCountryRules", () => {
    const pinned = getCountryRules("latam", { pin: ["BR"] });
    expect(pinned[0]?.ddi).toBe("55");

    const twoPinned = getCountryRules("latam", { pin: ["BR", "AR"] });
    expect(twoPinned.slice(0, 2).map((r) => r.ddi)).toEqual(["55", "54"]);

    const byDDI = getCountryRules("latam", { sort: "ddi" });
    const ddis = byDDI.map((r) => Number(r.ddi));
    for (let index = 1; index < ddis.length; index += 1) {
      expect(ddis[index]).toBeGreaterThanOrEqual(ddis[index - 1] ?? 0);
    }

    // Default call still works with no options.
    expect(getCountryRules("latam").length).toBeGreaterThan(0);
  });

  it("localizes country names via Intl.DisplayNames", () => {
    expect(localizeCountryName("BR", "en")).toBe("Brazil");
    expect(localizeCountryName("BR", "pt-BR")).toBe("Brasil");
    expect(localizeCountryName("BR", "es")).toBe("Brasil");
    // Unknown locale falls back to the region code, not a throw.
    expect(localizeCountryName("BR", "xx-XX")).toBeTruthy();
  });

  it("derives placeholders from the dataset for curated non-aliased keys", () => {
    expect(docPlaceholderByKey("GSTIN")).toBe("09ABCDE1234F1Z5");
    expect(docPlaceholderByKey("UEN")).toBe("201888888A");
    expect(docPlaceholderByKey("CNPJ")).toBe("12.ABC.345/01DE-35");
    expect(docPlaceholderByKey("GSTIN")).not.toBe("Documento");
    expect(docPlaceholderByKey("UEN")).not.toBe("Documento");
    expect(docPlaceholderByKey("UNKNOWN_KEY")).toBe("Documento");
    expect(docPlaceholderByKey()).toBe("Documento");
  });
});
