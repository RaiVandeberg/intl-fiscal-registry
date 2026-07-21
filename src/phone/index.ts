import { getCountry } from "../countries/index.js";
import { PHONE_DATA } from "./data.js";

export { PHONE_DATA_SOURCE } from "./data.js";

export interface PhoneMeta {
  callingCode: string;
  flag: string;
  mask?: string;
  digitLengths: number[];
  isFallback: boolean;
}

export interface PhoneProvider {
  callingCode(iso2: string): string;
  mask(value: string, iso2: string): string;
  isValid(value: string, iso2: string): boolean;
  toE164(value: string, iso2: string): string | undefined;
}

const digits = (value: string): string => value.replace(/\D/g, "");
const hasOnlyPhoneCharacters = (value: string): boolean => /^[+\d\s().-]+$/.test(value.trim());
const GENERIC_PHONE_LENGTHS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;

function applyMask(value: string, pattern: string): string {
  const normalized = digits(value);
  let index = 0;
  const result = pattern.replace(/9/g, () => normalized[index++] ?? "");
  return result.replace(/[^\d]+$/, "");
}

export function getPhoneMeta(iso2: string): PhoneMeta {
  const country = getCountry(iso2);
  const rule = PHONE_DATA[iso2.trim().toUpperCase()];
  return {
    callingCode: country?.callingCode ?? "",
    flag: country?.flag ?? "",
    mask: rule?.mask,
    digitLengths: rule ? [...rule.digitLengths] : [...GENERIC_PHONE_LENGTHS],
    isFallback: rule === undefined,
  };
}

const defaultPhoneProvider: PhoneProvider = {
  callingCode: (iso2) => getPhoneMeta(iso2).callingCode,
  mask: (value, iso2) => {
    const pattern = getPhoneMeta(iso2).mask;
    return pattern ? applyMask(value, pattern) : value;
  },
  isValid: (value, iso2) => {
    if (!getCountry(iso2) || !hasOnlyPhoneCharacters(value)) return false;
    const normalized = digits(value);
    const lengths = getPhoneMeta(iso2).digitLengths;
    return lengths.includes(normalized.length);
  },
  toE164: (value, iso2) => {
    const meta = getPhoneMeta(iso2);
    if (!meta.callingCode || !defaultPhoneProvider.isValid(value, iso2)) return undefined;
    const normalized = digits(value);
    const callingCodeDigits = digits(meta.callingCode);
    return `+${normalized.startsWith(callingCodeDigits) ? normalized : `${callingCodeDigits}${normalized}`}`;
  },
};

export function createPhone(provider: PhoneProvider = defaultPhoneProvider): PhoneProvider {
  return provider;
}
