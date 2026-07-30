import { describe, expect, it } from "vitest";
import {
  getPersonalDocuments,
  maskPersonalDocument,
  resolvePersonalDocument,
  validatePersonalDocument,
} from "../src/personal/index.js";

describe("personal documents", () => {
  it("curates the Brazilian CPF with a checksum validator", () => {
    const cpf = resolvePersonalDocument("BR", "CPF");
    expect(cpf).toMatchObject({
      countryCode: "BR",
      countryCallingCode: "+55",
      type: "CPF",
      validationLevel: "checksum",
    });
    expect(cpf.example).toBe("529.982.247-25");
    // A curated placeholder must pass its own validator — non-negotiable UX rule.
    expect(cpf.validate?.(cpf.example ?? "")).toBe(true);

    expect(validatePersonalDocument("BR", "CPF", "529.982.247-25")).toEqual({
      valid: true,
      usedFallback: false,
    });
    expect(validatePersonalDocument("BR", "CPF", "111.111.111-11").valid).toBe(false);
    expect(validatePersonalDocument("BR", "CPF", "").valid).toBe(false);
    expect(maskPersonalDocument("BR", "CPF", "52998224725")).toBe("529.982.247-25");
  });

  it("falls back for uncurated countries without throwing", () => {
    expect(getPersonalDocuments("ZA")).toEqual([]);
    const config = resolvePersonalDocument("ZA");
    expect(config).toMatchObject({
      type: "PERSONAL_ID",
      validationLevel: "fallback",
      isFallback: true,
    });
    expect(validatePersonalDocument("ZA", undefined, "abc123")).toEqual({
      valid: true,
      usedFallback: true,
    });
  });

  it("validates Argentina CUIL and DNI as separate documents", () => {
    const argentine = getPersonalDocuments("AR");
    expect(argentine.map(({ type }) => type)).toEqual(["DNI", "CUIL"]);
    expect(validatePersonalDocument("AR", "CUIL", "20-12345678-6").valid).toBe(true);
    expect(validatePersonalDocument("AR", "CUIL", "20-12345678-5").valid).toBe(false);
    expect(validatePersonalDocument("AR", "DNI", "12345678").valid).toBe(true);
    expect(validatePersonalDocument("AR", "DNI", "abc").valid).toBe(false);
  });

  it("validates Mexican CURP with the RENAPO format", () => {
    expect(validatePersonalDocument("MX", "CURP", "GOMR780512HDFRRL08").valid).toBe(true);
    expect(validatePersonalDocument("MX", "CURP", "GOMR78051X").valid).toBe(false);
  });

  it("validates Canadian SIN via Luhn checksum", () => {
    expect(validatePersonalDocument("CA", "SIN", "046-454-286").valid).toBe(true);
    expect(validatePersonalDocument("CA", "SIN", "046-454-287").valid).toBe(false);
  });

  it("rejects SSNs from reserved SSA ranges", () => {
    expect(validatePersonalDocument("US", "SSN", "123-45-6789").valid).toBe(true);
    expect(validatePersonalDocument("US", "SSN", "000-45-6789").valid).toBe(false);
    expect(validatePersonalDocument("US", "SSN", "666-45-6789").valid).toBe(false);
    expect(validatePersonalDocument("US", "SSN", "900-45-6789").valid).toBe(false);
    expect(validatePersonalDocument("US", "SSN", "123-00-6789").valid).toBe(false);
    expect(validatePersonalDocument("US", "SSN", "123-45-0000").valid).toBe(false);
    expect(validatePersonalDocument("PR", "SSN", "123-45-6789").valid).toBe(true);
  });

  it("validates Ecuador and Uruguay identity checksums", () => {
    expect(validatePersonalDocument("EC", "CEDULA", "1710034065").valid).toBe(true);
    expect(validatePersonalDocument("EC", "CEDULA", "1710034066").valid).toBe(false);
    expect(validatePersonalDocument("UY", "CI", "12345672").valid).toBe(true);
    expect(validatePersonalDocument("UY", "CI", "12345673").valid).toBe(false);
  });

  it("accepts format-only jurisdictions with sensible bounds", () => {
    expect(validatePersonalDocument("PE", "DNI", "12345678").valid).toBe(true);
    expect(validatePersonalDocument("PE", "DNI", "1234").valid).toBe(false);
    expect(validatePersonalDocument("PY", "CI", "1234567").valid).toBe(true);
    expect(validatePersonalDocument("GT", "DPI", "1234567890123").valid).toBe(true);
    expect(validatePersonalDocument("HN", "IDENTIDAD", "0801199912345").valid).toBe(true);
    expect(validatePersonalDocument("HT", "NIF", "123456789").valid).toBe(true);
    expect(validatePersonalDocument("SV", "DUI", "123456789").valid).toBe(true);
    expect(validatePersonalDocument("DO", "CEDULA", "00112345678").valid).toBe(true);
    expect(validatePersonalDocument("CR", "CEDULA", "123456789").valid).toBe(true);
    expect(validatePersonalDocument("VE", "CEDULA", "V-12345678").valid).toBe(true);
  });

  it("caps every documented mask at the example length", () => {
    const veryLong = "12345678901234567890ABCDEFGHIJ".repeat(2);
    for (const iso2 of ["BR", "AR", "MX", "CA", "US", "PR", "EC", "UY", "PE", "PY", "GT", "HN", "HT", "SV", "DO", "CR", "VE"]) {
      for (const config of getPersonalDocuments(iso2)) {
        if (!config.example) continue;
        expect(config.maxLength, `${iso2}/${config.type}`).toBe(config.example.length);
        const masked = maskPersonalDocument(iso2, config.type, veryLong);
        expect(masked.length, `${iso2}/${config.type}`).toBeLessThanOrEqual(config.example.length);
        expect(validatePersonalDocument(iso2, config.type, veryLong).valid, `${iso2}/${config.type}`).toBe(false);
      }
    }
  });
});
