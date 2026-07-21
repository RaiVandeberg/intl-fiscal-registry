import { describe, expect, it } from "vitest";
import {
  createPhone,
  getCountries,
  getCountry,
  getDocumentConfigs,
  getDocumentCoverage,
  getPhoneMeta,
  PHONE_DATA_SOURCE,
  maskDocument,
  resolveDocumentConfig,
  validateDocument,
} from "../src/index.js";

describe("countries", () => {
  it("exposes the complete ISO registry", () => {
    expect(getCountries("world")).toHaveLength(249);
    expect(getCountry("br")).toMatchObject({ iso2: "BR", iso3: "BRA", callingCode: "+55" });
  });

  it("supports named and custom scopes", () => {
    expect(getCountries("mercosul").map(({ iso2 }) => iso2)).toContain("BR");
    expect(getCountries(["BR", "US", "invalid"]).map(({ iso2 }) => iso2)).toEqual(["BR", "US"]);
  });
});

describe("documents", () => {
  it("resolves all 249 countries and keeps every specific rule auditable", () => {
    for (const { iso2 } of getCountries("world")) {
      const resolved = resolveDocumentConfig(iso2);
      expect(resolved.countryCode, iso2).toBe(iso2);
      expect(resolved.validate, iso2).toBeTypeOf("function");
      expect(["checksum", "format", "fallback"], iso2).toContain(resolved.validationLevel);

      for (const config of getDocumentConfigs(iso2)) {
        expect(config.isFallback, `${iso2}/${config.type}`).not.toBe(true);
        expect(config.source?.url, `${iso2}/${config.type}`).toMatch(/^https:\/\//);
        expect(config.source?.accessedAt, `${iso2}/${config.type}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("validates and masks a CNPJ with check digits", () => {
    expect(validateDocument("BR", "CNPJ", "11.222.333/0001-81")).toEqual({
      valid: true,
      usedFallback: false,
    });
    expect(maskDocument("BR", "CNPJ", "11222333000181")).toBe("11.222.333/0001-81");
    expect(validateDocument("BR", "CNPJ", "11.222.333/0001-82").valid).toBe(false);
    expect(validateDocument("BR", "CNPJ", "12.ABC.345/01DE-35")).toEqual({
      valid: true,
      usedFallback: false,
    });
    expect(maskDocument("BR", "CNPJ", "12abc34501de35")).toBe("12.ABC.345/01DE-35");
  });

  it("uses an explicit fallback for every unmapped country", () => {
    expect(resolveDocumentConfig("ZA")).toMatchObject({ type: "TAX_ID", isFallback: true, validationLevel: "fallback" });
    expect(validateDocument("ZA", undefined, "ABC-123")).toEqual({ valid: true, usedFallback: true });
  });

  it("validates Argentina CUIT and Chile RUT check digits", () => {
    expect(validateDocument("AR", "CUIT", "20-12345678-6")).toEqual({ valid: true, usedFallback: false });
    expect(validateDocument("AR", "CUIT", "20-12345678-5").valid).toBe(false);
    expect(validateDocument("CL", "RUT", "12.345.678-5")).toEqual({ valid: true, usedFallback: false });
    expect(validateDocument("CL", "RUT", "12.345.678-4").valid).toBe(false);
  });

  it("distinguishes official format checks from checksum validation", () => {
    expect(resolveDocumentConfig("US", "EIN")).toMatchObject({ type: "EIN", validationLevel: "format" });
    expect(validateDocument("US", "EIN", "12-3456789").valid).toBe(true);
    expect(validateDocument("US", "EIN", "12-345678").valid).toBe(false);
    expect(resolveDocumentConfig("CA", "BN")).toMatchObject({ type: "BN", validationLevel: "format" });
    expect(resolveDocumentConfig("GB", "VAT")).toMatchObject({ type: "VAT", validationLevel: "format" });
  });

  it("covers all 27 EU VAT formats and reports fiscal coverage transparently", () => {
    const examples: Record<string, string> = {
      AT: "ATU12345678", BE: "BE0123456789", BG: "BG123456789", HR: "HR12345678901",
      CY: "CY12345678A", CZ: "CZ12345678", DE: "DE123456789", DK: "DK12345678",
      EE: "EE123456789", ES: "ESA1234567B", FI: "FI12345678", FR: "FRAB123456789",
      GR: "EL123456789", HU: "HU12345678", IE: "IE1A23456B", IT: "IT12345678901",
      LV: "LV12345678901", LT: "LT123456789", LU: "LU12345678", MT: "MT12345678",
      NL: "NL123456789B01", PL: "PL1234567890", PT: "PT123456789", RO: "RO123456789",
      SE: "SE123456789012", SI: "SI12345678", SK: "SK1234567890",
    };
    for (const [iso2, value] of Object.entries(examples)) {
      expect(validateDocument(iso2, "VAT", value), iso2).toEqual({ valid: true, usedFallback: false });
      expect(resolveDocumentConfig(iso2, "VAT").validationLevel, iso2).toBe("format");
    }
    expect(validateDocument("ES", "VAT", "ES123456789").valid).toBe(false);
    expect(getDocumentCoverage()).toMatchObject({ totalCountries: 249, specificCountries: 44 });
  });

  it("covers sourced Asia-Pacific business identifiers at the honest validation level", () => {
    expect(validateDocument("JP", "CORPORATE_NUMBER", "7000012050002")).toEqual({
      valid: true,
      usedFallback: false,
    });
    expect(validateDocument("JP", "CORPORATE_NUMBER", "7000012050003").valid).toBe(false);

    const formats = {
      KR: ["BRN", "123-45-67890"],
      NZ: ["NZBN", "9429123456789"],
      SG: ["UEN", "201888888A"],
    } as const;
    for (const [iso2, [type, value]] of Object.entries(formats)) {
      expect(validateDocument(iso2, type, value), iso2).toEqual({ valid: true, usedFallback: false });
      expect(resolveDocumentConfig(iso2, type).validationLevel, iso2).toBe("format");
      expect(resolveDocumentConfig(iso2, type).source?.url, iso2).toMatch(/^https:\/\//);
    }
  });

  it("validates Australian ABN checksum and Indian GSTIN format", () => {
    expect(validateDocument("AU", "ABN", "51 824 753 556")).toEqual({ valid: true, usedFallback: false });
    expect(validateDocument("AU", "ABN", "51 824 753 557").valid).toBe(false);
    expect(resolveDocumentConfig("AU", "ABN").validationLevel).toBe("checksum");
    expect(validateDocument("IN", "GSTIN", "09ABCDE1234F1Z5")).toEqual({ valid: true, usedFallback: false });
    expect(validateDocument("IN", "GSTIN", "09INVALID").valid).toBe(false);
    expect(resolveDocumentConfig("IN", "GSTIN").validationLevel).toBe("format");
  });

  it("adds sourced Latin American business tax formats without claiming checksums", () => {
    const examples = {
      CO: ["NIT", "800999999-1"],
      EC: ["RUC", "1790012345001"],
      MX: ["RFC", "ABC0102031A2"],
      PE: ["RUC", "20123456789"],
      PY: ["RUC", "80000000-1"],
    } as const;
    for (const [iso2, [type, value]] of Object.entries(examples)) {
      expect(validateDocument(iso2, type, value), iso2).toEqual({ valid: true, usedFallback: false });
      expect(resolveDocumentConfig(iso2, type).validationLevel, iso2).toBe("format");
      expect(resolveDocumentConfig(iso2, type).source?.url, iso2).toMatch(/^https:\/\//);
    }
  });

  it("caps every documented mask at the example length through both public APIs", () => {
    const veryLongValue = "1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(3);

    for (const { iso2 } of getCountries("world")) {
      for (const config of getDocumentConfigs(iso2)) {
        expect(config.maxLength, `${iso2}/${config.type}`).toBe(config.example?.length);
        expect(config.mask, `${iso2}/${config.type}`).toBeTypeOf("function");

        const directlyMasked = (config.mask as (value: string) => string)(veryLongValue);
        expect(directlyMasked.length, `${iso2}/${config.type} direct mask`).toBeLessThanOrEqual(
          config.example?.length ?? 0,
        );
        expect(maskDocument(iso2, config.type, veryLongValue).length, `${iso2}/${config.type} wrapper`)
          .toBeLessThanOrEqual(config.example?.length ?? 0);
        expect(validateDocument(iso2, config.type, veryLongValue).valid, `${iso2}/${config.type}`)
          .toBe(false);
      }
    }
  });

  it("truncates NIT and Japanese Corporate Number regressions", () => {
    const nit = getDocumentConfigs("CO").find(({ type }) => type === "NIT");
    const corporateNumber = getDocumentConfigs("JP").find(({ type }) => type === "CORPORATE_NUMBER");

    expect(nit?.mask).toBeTypeOf("function");
    expect((nit?.mask as (value: string) => string)("123456789012345678901234567890"))
      .toBe("123456789-0");
    expect((corporateNumber?.mask as (value: string) => string)("700001205000212345"))
      .toBe("7000012050002");
  });
});

describe("phone", () => {
  it("resolves phone metadata for every one of the 249 ISO entries", () => {
    for (const country of getCountries("world")) {
      const meta = getPhoneMeta(country.iso2);
      expect(meta.callingCode, country.iso2).toBe(country.callingCode);
      expect(meta.flag, country.iso2).toBe(country.flag);
      expect(meta.digitLengths.length, country.iso2).toBeGreaterThan(0);
      expect(meta.digitLengths.every((length) => length >= 4 && length <= 15), country.iso2).toBe(true);
      expect(meta.isFallback, country.iso2).toBeTypeOf("boolean");
    }
  });

  it("gets metadata, validates and formats E.164", () => {
    expect(getPhoneMeta("BR")).toMatchObject({
      callingCode: "+55",
      flag: "🇧🇷",
      digitLengths: [10, 11],
      isFallback: false,
    });
    expect(createPhone().isValid("11 91234-5678", "BR")).toBe(true);
    expect(createPhone().toE164("11 91234-5678", "BR")).toBe("+5511912345678");
  });

  it("ships auditable static phone rules for almost every ISO territory", () => {
    const covered = getCountries("world").filter(({ iso2 }) => !getPhoneMeta(iso2).isFallback);
    expect(covered.length).toBeGreaterThanOrEqual(240);
    expect(PHONE_DATA_SOURCE).toMatchObject({ name: "Google libphonenumber metadata", version: "1.13.9" });
    expect(getPhoneMeta("US")).toMatchObject({ mask: "(999) 999-9999", digitLengths: [10], isFallback: false });
    expect(getPhoneMeta("AR")).toMatchObject({ digitLengths: [10, 11], isFallback: false });
  });

  it("uses a signaled generic fallback for an uncurated country", () => {
    expect(getPhoneMeta("BV")).toMatchObject({ callingCode: "+47", isFallback: true });
    expect(createPhone().isValid("123456", "BV")).toBe(true);
    expect(createPhone().isValid("123", "BV")).toBe(false);
    expect(createPhone().isValid("abc123456", "BV")).toBe(false);
    expect(createPhone().toE164("123456", "BV")).toBe("+47123456");
  });
});
