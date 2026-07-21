import { describe, expect, it } from "vitest";
import {
  documentMask,
  applyMask,
  applyPhoneMask,
  COUNTRY_RULES,
  docPlaceholderByKey,
  getDocRule,
  getDocTypesForDDI,
  iso2FromDDI,
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
});
