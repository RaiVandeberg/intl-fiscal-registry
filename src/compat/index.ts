import { getCountries, getCountry } from "../countries/index.js";
import type { CountryInfo, RegionScope } from "../countries/index.js";
import {
  getDocumentConfigs,
  isValidCUIT,
  isValidCNPJ,
  maskCNPJ,
  maskDocument,
  resolveDocumentConfig,
  validateDocument,
} from "../documents/index.js";
import type { CompanyDocumentConfig } from "../documents/index.js";
import {
  getPersonalDocuments,
  maskPersonalDocument,
  resolvePersonalDocument,
  validatePersonalDocument,
} from "../personal/index.js";
import type { PersonalDocumentConfig } from "../personal/index.js";
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
  /** Canonical short document type (no country suffix), e.g. "RUT", "EIN", "CNPJ". */
  type: string;
  label: string;
  mask: (value: string) => string;
  isValid: (value: string) => boolean;
  countryCode: string;
  validationLevel: CompanyDocumentConfig["validationLevel"];
}

export interface LegacyCountryRule {
  ddi: string;
  label: string;
  /**
   * Emoji flags of the countries sharing this calling code (e.g. `["🇧🇷"]` for
   * `+55`, `["🇨🇦","🇺🇸","🇵🇷"]` for `+1`). Optional so consumers can construct
   * partial rules without breaking their type check; always populated when
   * produced by this module.
   */
  flags?: string[];
  /**
   * ISO2 codes sharing this calling code, in the same order as {@link flags}.
   * Useful when a DDI groups multiple jurisdictions and the consumer needs to
   * pick one (e.g. the currently selected country in a phone field). Optional
   * for the same reason as {@link flags}.
   */
  iso2s?: string[];
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
    type: config.type,
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

function fallbackLegacyRuleFor(iso2: string): LegacyDocRule {
  const config = resolveDocumentConfig(iso2);
  return {
    key: legacyKey(config.countryCode, config.type),
    type: config.type,
    label: config.label,
    mask: (value) => maskDocument(config.countryCode, config.type, value),
    isValid: (value) => validateDocument(config.countryCode, config.type, value).valid,
    countryCode: config.countryCode,
    validationLevel: config.validationLevel,
  };
}

/**
 * Same as {@link getDocTypesForDDI}, but when no curated rule exists for the
 * resolved country it returns the fallback rule (validationLevel: "fallback")
 * instead of an empty list. Additive companion — the original function is
 * unchanged so existing callers keep the same behavior.
 */
export function getDocTypesForDDIWithFallback(ddi: string, preferredIso2?: string): LegacyDocRule[] {
  const rules = getDocTypesForDDI(ddi, preferredIso2);
  if (rules.length > 0) return rules;
  const iso2 = iso2FromDDI(ddi, preferredIso2);
  return iso2 ? [fallbackLegacyRuleFor(iso2)] : [];
}

/**
 * Same result set as {@link getDocTypesForDDI} without `preferredIso2` (all
 * curated rules for the DDI), but with `preferredIso2` used to sort the
 * matching country's rules first instead of filtering the others out. Additive
 * companion — leaves the original function untouched, so callers of
 * `getDocTypesForDDI(ddi, iso2)` still get the filtered behavior.
 */
export function getDocTypesForDDIOrdered(ddi: string, preferredIso2?: string): LegacyDocRule[] {
  const normalized = normalizeCallingCode(ddi);
  const all = getCountries("world")
    .filter(({ callingCode }) => callingCode === normalized)
    .flatMap(({ iso2 }) => getDocumentConfigs(iso2).map(asLegacyRule));
  const deduped = all.filter((rule, index) => all.findIndex(({ key }) => key === rule.key) === index);
  if (!preferredIso2) return deduped;
  const preferred = preferredIso2.trim().toUpperCase();
  return [...deduped].sort((a, b) => {
    const aPref = a.countryCode === preferred ? 0 : 1;
    const bPref = b.countryCode === preferred ? 0 : 1;
    return aPref - bPref;
  });
}

function asLegacyPersonalRule(config: PersonalDocumentConfig): LegacyDocRule {
  return {
    key: legacyKey(config.countryCode, config.type),
    type: config.type,
    label: config.label,
    mask: (value) => maskPersonalDocument(config.countryCode, config.type, value),
    isValid: (value) => validatePersonalDocument(config.countryCode, config.type, value).valid,
    countryCode: config.countryCode,
    validationLevel: config.validationLevel,
  };
}

function fallbackPersonalLegacyRuleFor(iso2: string): LegacyDocRule {
  const config = resolvePersonalDocument(iso2);
  return {
    key: legacyKey(config.countryCode, config.type),
    type: config.type,
    label: config.label,
    mask: (value) => maskPersonalDocument(config.countryCode, config.type, value),
    isValid: (value) => validatePersonalDocument(config.countryCode, config.type, value).valid,
    countryCode: config.countryCode,
    validationLevel: config.validationLevel,
  };
}

/**
 * Returns the curated placeholder (example) for the given document key, or
 * `undefined` when the document resolves to a fallback config. Additive
 * companion to {@link docPlaceholderByKey}, which always returns a non-empty
 * string ("Documento" for unknown/fallback). Prefer this function when the
 * consumer wants to distinguish "known format" from "unknown format" and use
 * its own i18n fallback text.
 */
export function getPlaceholder(key?: string): string | undefined {
  if (!key) return undefined;
  const normalized = key.toUpperCase();
  const corporate = getCountries("world")
    .flatMap(({ iso2 }) => getDocumentConfigs(iso2))
    .find(({ countryCode, type }) => legacyKey(countryCode, type).toUpperCase() === normalized);
  if (corporate?.example) return corporate.example;
  const personal = getCountries("world")
    .flatMap(({ iso2 }) => getPersonalDocuments(iso2))
    .find(({ countryCode, type }) => legacyKey(countryCode, type).toUpperCase() === normalized);
  return personal?.example;
}

/**
 * Returns corporate + personal document rules for a DDI in a single list,
 * ordered PJ (corporate) first, PF (personal) second. Never returns an empty
 * list — falls back to the corporate/personal fallback rule when neither
 * bucket has a curated rule for the resolved country. Additive; leaves
 * {@link getDocTypesForDDI} and {@link getDocTypesForDDIOrdered} untouched.
 */
export function getAllDocsForDDI(ddi: string, preferredIso2?: string): LegacyDocRule[] {
  const corporate = getDocTypesForDDIOrdered(ddi, preferredIso2);
  const normalized = normalizeCallingCode(ddi);
  const isoInScope = getCountries("world")
    .filter(({ callingCode }) => callingCode === normalized)
    .map(({ iso2 }) => iso2);
  const personal = isoInScope.flatMap((iso2) => getPersonalDocuments(iso2).map(asLegacyPersonalRule));
  const combined = [...corporate, ...personal];
  const seen = new Set<string>();
  const deduped: LegacyDocRule[] = [];
  for (const rule of combined) {
    if (seen.has(rule.key)) continue;
    seen.add(rule.key);
    deduped.push(rule);
  }
  if (deduped.length > 0) {
    if (!preferredIso2) return deduped;
    const preferred = preferredIso2.trim().toUpperCase();
    return [...deduped].sort((a, b) => {
      const aPref = a.countryCode === preferred ? 0 : 1;
      const bPref = b.countryCode === preferred ? 0 : 1;
      return aPref - bPref;
    });
  }
  const iso2 = iso2FromDDI(ddi, preferredIso2);
  if (!iso2) return [];
  return [fallbackLegacyRuleFor(iso2), fallbackPersonalLegacyRuleFor(iso2)];
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
  const countriesForCode = getCountries("world").filter(
    (country) => country.callingCode === callingCode,
  );
  return {
    ddi,
    label: callingCode,
    flags: countriesForCode.map(({ flag }) => flag),
    iso2s: countriesForCode.map(({ iso2: code }) => code),
    phoneDigitLengths: iso2 ? getPhoneMeta(iso2).digitLengths : [],
    docTypes: getDocTypesForDDI(ddi),
  };
});

export interface GetCountryRulesOptions {
  /**
   * ISO2 codes to pin at the start of the result, in the given order. Any
   * remaining rules keep the order determined by {@link GetCountryRulesOptions.sort}
   * (or insertion order when `sort` is omitted).
   */
  pin?: string[];
  /**
   * How to order rules that were not pinned. Defaults to insertion order.
   * `"ddi"` sorts by numeric DDI ascending; `"alpha"` sorts by the calling
   * code label ascending; a comparator function receives the two rules.
   */
  sort?: "alpha" | "ddi" | ((a: LegacyCountryRule, b: LegacyCountryRule) => number);
}

/**
 * Legacy-shaped country rules derived from any {@link RegionScope}. Countries
 * sharing a calling code are grouped into a single entry (e.g. `+1` → one
 * entry aggregating US and CA documents). When no country in the group has a
 * curated document rule, the fallback rule (`validationLevel: "fallback"`) is
 * emitted so callers never receive an empty `docTypes` list.
 *
 * Additive companion to the fixed {@link COUNTRY_RULES} constant: consumers
 * that need a specific region (e.g. `"latam"`) can now derive it without
 * reimplementing the grouping.
 *
 * `options.pin` places the given ISO2s' rules first; `options.sort` orders the
 * remainder. Both are optional and never change existing (unpinned, unsorted)
 * output when omitted.
 */
export function getCountryRules(
  scope: RegionScope = "world",
  options: GetCountryRulesOptions = {},
): LegacyCountryRule[] {
  const grouped = new Map<string, CountryInfo[]>();
  for (const country of getCountries(scope)) {
    const list = grouped.get(country.callingCode) ?? [];
    list.push(country);
    grouped.set(country.callingCode, list);
  }
  const rules: LegacyCountryRule[] = [];
  for (const [callingCode, countries] of grouped) {
    const ddi = onlyDigits(callingCode);
    if (!ddi) continue;
    const representative = iso2FromDDI(ddi) ?? countries[0]?.iso2;
    if (!representative) continue;
    const docs = countries.flatMap(({ iso2 }) => getDocumentConfigs(iso2).map(asLegacyRule));
    const deduped = docs.filter((rule, index) => docs.findIndex(({ key }) => key === rule.key) === index);
    const docTypes = deduped.length > 0
      ? deduped
      : [fallbackLegacyRuleFor(representative)];
    rules.push({
      ddi,
      label: callingCode,
      flags: countries.map(({ flag }) => flag),
      iso2s: countries.map(({ iso2 }) => iso2),
      phoneDigitLengths: getPhoneMeta(representative).digitLengths,
      docTypes,
    });
  }
  return applyRuleOrdering(rules, options);
}

function applyRuleOrdering(
  rules: LegacyCountryRule[],
  options: GetCountryRulesOptions,
): LegacyCountryRule[] {
  const { pin, sort } = options;
  if (!pin?.length && !sort) return rules;

  const pinned: LegacyCountryRule[] = [];
  const rest: LegacyCountryRule[] = [];
  if (pin?.length) {
    const pinOrder = new Map<string, number>();
    pin.forEach((iso2, index) => {
      pinOrder.set(iso2.trim().toUpperCase(), index);
    });
    const chosen = new Map<number, LegacyCountryRule>();
    for (const rule of rules) {
      const matchIndex = rule.iso2s
        ?.map((iso2) => pinOrder.get(iso2))
        .find((index): index is number => index !== undefined);
      if (matchIndex === undefined) {
        rest.push(rule);
        continue;
      }
      if (!chosen.has(matchIndex)) chosen.set(matchIndex, rule);
      else rest.push(rule);
    }
    for (let index = 0; index < pin.length; index += 1) {
      const rule = chosen.get(index);
      if (rule) pinned.push(rule);
    }
  } else {
    rest.push(...rules);
  }

  if (sort === "ddi") {
    rest.sort((a, b) => Number(a.ddi) - Number(b.ddi));
  } else if (sort === "alpha") {
    rest.sort((a, b) => a.label.localeCompare(b.label));
  } else if (typeof sort === "function") {
    rest.sort(sort);
  }
  return [...pinned, ...rest];
}

/**
 * Convenience singular of {@link getCountryRules} — returns the rule matching
 * the given DDI within the requested scope, or `undefined`. Additive: existing
 * callers that use `getCountryRules(...).find(...)` keep working.
 */
export function getCountryRule(
  ddi: string,
  scope: RegionScope = "world",
): LegacyCountryRule | undefined {
  const normalized = onlyDigits(ddi);
  return getCountryRules(scope).find((rule) => rule.ddi === normalized);
}

/**
 * Thin wrapper over the runtime's `Intl.DisplayNames` API, resolving the
 * localized name of a country by ISO2. Defaults to English and gracefully
 * returns the ISO2 when the runtime lacks `Intl.DisplayNames` or the code is
 * unknown. Bundle cost is zero — the platform ships the CLDR table.
 */
export function localizeCountryName(iso2: string, locale = "en"): string {
  const code = iso2.trim().toUpperCase();
  try {
    const resolved = new Intl.DisplayNames([locale], { type: "region" }).of(code);
    return resolved ?? code;
  } catch {
    return code;
  }
}

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
