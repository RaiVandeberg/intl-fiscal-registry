import { getCountries, getCountry } from "../countries/index.js";
import {
  getDocumentConfigs,
  isValidCUIT,
  isValidCNPJ,
  maskCNPJ,
  maskDocument,
  validateDocument,
} from "../documents/index.js";
import type { CompanyDocumentConfig } from "../documents/index.js";
import { createPhone, getPhoneMeta } from "../phone/index.js";

function normalizeCallingCode(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

const DEFAULT_ISO2_BY_DDI: Readonly<Record<string, string>> = {
  "+1": "US",
  "+7": "RU",
  "+44": "GB",
  "+47": "NO",
  "+61": "AU",
  "+212": "MA",
  "+358": "FI",
};

const LEGACY_DOCUMENT_ALIASES: Readonly<Record<string, { iso2: string; type: string }>> = {
  CNPJ: { iso2: "BR", type: "CNPJ" },
  CUIT: { iso2: "AR", type: "CUIT" },
  RUT_CL: { iso2: "CL", type: "RUT" },
  EIN_US: { iso2: "US", type: "EIN" },
  BN_CA: { iso2: "CA", type: "BN" },
  RFC_MX: { iso2: "MX", type: "RFC" },
  NIT_CO: { iso2: "CO", type: "NIT" },
  RUC_PE: { iso2: "PE", type: "RUC" },
  RUC_PY: { iso2: "PY", type: "RUC" },
  RUC_EC: { iso2: "EC", type: "RUC" },
};

export interface LegacyDocRule {
  key: string;
  label: string;
  mask: (value: string) => string;
  isValid: (value: string) => boolean;
  countryCode: string;
  validationLevel: CompanyDocumentConfig["validationLevel"];
}

export interface LegacyCountryRule {
  ddi: string;
  label: string;
  phoneDigitLengths: number[];
  docTypes: LegacyDocRule[];
}

function legacyKey(iso2: string, type: string): string {
  const alias = Object.entries(LEGACY_DOCUMENT_ALIASES).find(
    ([, target]) => target.iso2 === iso2 && target.type === type,
  );
  return alias?.[0] ?? type;
}

function asLegacyRule(config: CompanyDocumentConfig): LegacyDocRule {
  return {
    key: legacyKey(config.countryCode, config.type),
    label: config.label,
    mask: (value) => maskDocument(config.countryCode, config.type, value),
    isValid: (value) => validateDocument(config.countryCode, config.type, value).valid,
    countryCode: config.countryCode,
    validationLevel: config.validationLevel,
  };
}

function countriesForDDI(ddi: string, preferredIso2?: string) {
  const normalized = normalizeCallingCode(ddi);
  if (preferredIso2) {
    const preferred = preferredIso2.trim().toUpperCase();
    return getPhoneMeta(preferred).callingCode === normalized
      ? getCountries([preferred])
      : [];
  }
  return getCountries("world").filter(({ callingCode }) => callingCode === normalized);
}

export function iso2FromDDI(ddi: string, preferredIso2?: string): string | undefined {
  const normalized = normalizeCallingCode(ddi);
  if (preferredIso2) {
    const preferred = getPhoneMeta(preferredIso2);
    if (preferred.callingCode === normalized) return preferredIso2.trim().toUpperCase();
  }
  const defaultIso2 = DEFAULT_ISO2_BY_DDI[normalized];
  if (defaultIso2 && getPhoneMeta(defaultIso2).callingCode === normalized) return defaultIso2;
  return countriesForDDI(normalized)[0]?.iso2;
}

export function getDocTypesForDDI(ddi: string, preferredIso2?: string): LegacyDocRule[] {
  const rules = countriesForDDI(ddi, preferredIso2)
    .flatMap(({ iso2 }) => getDocumentConfigs(iso2).map(asLegacyRule));
  return rules.filter((rule, index) => rules.findIndex(({ key }) => key === rule.key) === index);
}

export function getDocRule(ddi: string, key?: string, preferredIso2?: string): LegacyDocRule | undefined {
  const rules = getDocTypesForDDI(ddi, preferredIso2);
  return key ? rules.find((rule) => rule.key === key || rule.key === key.toUpperCase()) : rules[0];
}

export function getPhoneMask(ddi: string, preferredIso2?: string): string | null {
  const iso2 = iso2FromDDI(ddi, preferredIso2);
  return iso2 ? getPhoneMeta(iso2).mask ?? null : null;
}

export function validatePhoneNumber(ddi: string, value: string, preferredIso2?: string): boolean {
  const iso2 = iso2FromDDI(ddi, preferredIso2);
  return iso2 ? createPhone().isValid(value, iso2) : false;
}

export function phoneMask(value: string, ddi = "55", preferredIso2?: string): string {
  const iso2 = iso2FromDDI(ddi, preferredIso2);
  return iso2 ? createPhone().mask(value, iso2) : value;
}

export const applyPhoneMaskDDI = phoneMask;
export const validatePhoneByDDI = (value: string, ddi: string, preferredIso2?: string): boolean =>
  validatePhoneNumber(ddi, value, preferredIso2);
export const validarCNPJ = isValidCNPJ;
export { isValidCUIT };
export const validarCUIT = isValidCUIT;
export const aplicarMascaraCNPJ = maskCNPJ;

export function documentMask(value: string, documentType = "CNPJ"): string {
  const alias = LEGACY_DOCUMENT_ALIASES[documentType.toUpperCase()];
  return alias ? maskDocument(alias.iso2, alias.type, value) : value;
}

export const onlyDigits = (value?: string): string => (value ?? "").replace(/\D/g, "");
export const phoneUnMask = onlyDigits;
export const phone_regexp = /^[0-9]{11}$/;

export function applyMask(value: string, mask: string): string {
  const normalized = onlyDigits(value);
  let index = 0;
  let result = "";
  for (const character of mask) {
    if (index >= normalized.length) break;
    if (character === "9") result += normalized[index++] ?? "";
    else result += character;
  }
  return result;
}

export function genericPhoneMask(value: string, targetLength: number): string {
  const normalized = onlyDigits(value).slice(0, targetLength);
  if (targetLength === 10) {
    return normalized.replace(/(\d{3})(\d{3})(\d{0,4})/, (_, a, b, c) => c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`);
  }
  if (targetLength === 11) {
    return normalized.replace(/(\d{2})(\d{5})(\d{0,4})/, (_, a, b, c) => c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`);
  }
  if (targetLength === 9) {
    return normalized.replace(/(\d)(\d{4})(\d{0,4})/, (_, a, b, c) => c ? `${a} ${b}-${c}` : `${a} ${b}`);
  }
  if (targetLength === 8) {
    return normalized.replace(/(\d{4})(\d{0,4})/, (_, a, b) => b ? `${a}-${b}` : a);
  }
  return normalized;
}

export const phoneMaskBrasil = (value: string): string => phoneMask(value, "55");
export const phoneMaskArgentina = (value: string): string => phoneMask(value.replace(/^15/, ""), "54");
export const phoneMaskUruguay = (value: string): string => phoneMask(value, "598");

export function applyPhoneMask(rawPhoneWithDDI?: string): string {
  if (!rawPhoneWithDDI) return "";
  const normalized = onlyDigits(rawPhoneWithDDI);
  const candidates = [...new Set(getCountries("world").map(({ callingCode }) => onlyDigits(callingCode)))]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const ddi = candidates.find((candidate) => normalized.startsWith(candidate) && normalized.length > candidate.length);
  if (!ddi) return normalized;
  return `+${ddi} ${phoneMask(normalized.slice(ddi.length), ddi)}`;
}

const legacyCallingCodes = [...new Set(
  getCountries("world")
    .filter(({ iso2 }) => getDocumentConfigs(iso2).length > 0)
    .map(({ callingCode }) => callingCode),
)];

export const COUNTRY_RULES: LegacyCountryRule[] = legacyCallingCodes.map((callingCode) => {
  const ddi = onlyDigits(callingCode);
  const iso2 = iso2FromDDI(ddi);
  return {
    ddi,
    label: callingCode,
    phoneDigitLengths: iso2 ? getPhoneMeta(iso2).digitLengths : [],
    docTypes: getDocTypesForDDI(ddi),
  };
});

export const findCountry = (ddi: string): LegacyCountryRule | undefined =>
  COUNTRY_RULES.find((country) => country.ddi === onlyDigits(ddi));
export const getAllDDIs = (): string[] => COUNTRY_RULES.map(({ ddi }) => ddi);
export const getAllDocKeys = (): string[] => [...new Set(
  COUNTRY_RULES.flatMap(({ docTypes }) => docTypes.map(({ key }) => key)),
)];
export const docPlaceholderByKey = (key?: string): string => {
  if (!key) return "Documento";
  const normalized = key.toUpperCase();
  const config = getCountries("world")
    .flatMap(({ iso2 }) => getDocumentConfigs(iso2))
    .find(({ countryCode, type }) => legacyKey(countryCode, type).toUpperCase() === normalized);
  return config?.example ?? "Documento";
};
export const validateDocumentByDDI = (ddi: string, value: string, key?: string): boolean =>
  getDocRule(ddi, key)?.isValid(value) ?? true;

/** Strongly-typed aliases for the legacy string fields. */
export type DDI = LegacyCountryRule["ddi"];
export type DocKey = LegacyDocRule["key"];

/**
 * Map of DDI (calling code, digits only) → country name, covering every
 * country in the registry. Codes shared by multiple countries resolve to the
 * representative country used by {@link iso2FromDDI} (e.g. "1" → United States).
 */
export const COUNTRY_BY_DDI: Record<DDI, string> = Object.fromEntries(
  [...new Set(getCountries("world").map(({ callingCode }) => onlyDigits(callingCode)))]
    .filter(Boolean)
    .map((ddi) => {
      const iso2 = iso2FromDDI(ddi);
      return [ddi, iso2 ? getCountry(iso2)?.name ?? "" : ""] as const;
    })
    .filter(([, name]) => name !== ""),
);
