import { getCountry } from "../countries/index.js";

export interface PersonalDocumentConfig {
  countryCode: string;
  countryCallingCode: string;
  type: string;
  label: string;
  example?: string;
  /** Maximum number of characters produced by `mask`, including separators. */
  maxLength?: number;
  mask?: string | ((value: string) => string);
  regex?: string;
  validate?: (value: string) => boolean;
  isFallback?: boolean;
  validationLevel: "checksum" | "format" | "fallback";
  source?: {
    name: string;
    url: string;
    accessedAt: string;
  };
}

export interface PersonalDocumentValidationResult {
  valid: boolean;
  usedFallback: boolean;
}

const digits = (value: string): string => value.replace(/\D/g, "");

const alphanumericUpper = (value: string): string =>
  value.toUpperCase().replace(/[^A-Z\d]/g, "");

function withBoundedMask(config: PersonalDocumentConfig): PersonalDocumentConfig {
  if (!config.example) return config;
  const maxLength = config.example.length;
  const canonicalLength = alphanumericUpper(config.example).length;
  const originalMask = config.mask;
  const mask = (value: string): string => {
    const bounded = alphanumericUpper(value).slice(0, canonicalLength);
    if (typeof originalMask === "function") return originalMask(bounded).slice(0, maxLength);
    if (!originalMask) return bounded.slice(0, maxLength);
    let position = 0;
    return originalMask
      .replace(/9/g, () => digits(bounded)[position++] ?? "")
      .replace(/[^\d]+$/, "")
      .slice(0, maxLength);
  };
  return { ...config, maxLength, mask };
}

export function maskCPF(value: string): string {
  const normalized = digits(value).slice(0, 11);
  if (normalized.length <= 3) return normalized;
  if (normalized.length <= 6) return `${normalized.slice(0, 3)}.${normalized.slice(3)}`;
  if (normalized.length <= 9) {
    return `${normalized.slice(0, 3)}.${normalized.slice(3, 6)}.${normalized.slice(6)}`;
  }
  return `${normalized.slice(0, 3)}.${normalized.slice(3, 6)}.${normalized.slice(6, 9)}-${normalized.slice(9)}`;
}

export function isValidCPF(value: string): boolean {
  const normalized = digits(value);
  if (normalized.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(normalized)) return false;
  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += Number(normalized[index]) * (10 - index);
  }
  let firstVerifier = 11 - (sum % 11);
  if (firstVerifier >= 10) firstVerifier = 0;
  if (firstVerifier !== Number(normalized[9])) return false;
  sum = 0;
  for (let index = 0; index < 10; index += 1) {
    sum += Number(normalized[index]) * (11 - index);
  }
  let secondVerifier = 11 - (sum % 11);
  if (secondVerifier >= 10) secondVerifier = 0;
  return secondVerifier === Number(normalized[10]);
}

const RECEITA_FEDERAL_SOURCE = {
  name: "Receita Federal — CPF (Cadastro de Pessoas Físicas)",
  url: "https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cadastros/cpf",
  accessedAt: "2026-07-30",
} as const;

/** Checksum-backed personal documents in the Américas. */
function isValidCUIL(value: string): boolean {
  const normalized = digits(value);
  if (normalized.length !== 11 || /^(\d)\1+$/.test(normalized)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = normalized.slice(0, 10).split("").reduce(
    (total, digit, index) => total + Number(digit) * (weights[index] ?? 0),
    0,
  );
  const remainder = 11 - (sum % 11);
  const verifier = remainder === 11 ? 0 : remainder === 10 ? 9 : remainder;
  return verifier === Number(normalized[10]);
}

function isValidSIN(value: string): boolean {
  const normalized = digits(value);
  if (normalized.length !== 9) return false;
  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    let digit = Number(normalized[index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

function isValidSSN(value: string): boolean {
  const normalized = digits(value);
  if (!/^\d{9}$/.test(normalized)) return false;
  const area = normalized.slice(0, 3);
  const group = normalized.slice(3, 5);
  const serial = normalized.slice(5);
  if (area === "000" || area === "666") return false;
  if (Number(area) >= 900) return false;
  if (group === "00") return false;
  if (serial === "0000") return false;
  return true;
}

function isValidEcuadorCedula(value: string): boolean {
  const normalized = digits(value);
  if (normalized.length !== 10) return false;
  const province = Number(normalized.slice(0, 2));
  if (province < 1 || (province > 24 && province !== 30)) return false;
  if (Number(normalized[2]) > 5) return false;
  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let total = 0;
  for (let index = 0; index < 9; index += 1) {
    const product = Number(normalized[index]) * (coefficients[index] ?? 0);
    total += product >= 10 ? product - 9 : product;
  }
  const verifier = total % 10 === 0 ? 0 : 10 - (total % 10);
  return verifier === Number(normalized[9]);
}

function isValidUruguayanCI(value: string): boolean {
  const normalized = digits(value);
  if (normalized.length < 7 || normalized.length > 8) return false;
  const padded = normalized.padStart(8, "0");
  const weights = [2, 9, 8, 7, 6, 3, 4];
  const sum = padded.slice(0, 7).split("").reduce(
    (total, digit, index) => total + Number(digit) * (weights[index] ?? 0),
    0,
  );
  const verifier = (10 - (sum % 10)) % 10;
  return verifier === Number(padded[7]);
}

const CURP_REGEX = /^[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/;

function isValidCURP(value: string): boolean {
  return CURP_REGEX.test(value.trim().toUpperCase());
}

function maskDNI8(value: string): string {
  return digits(value).slice(0, 8);
}

const registry: Readonly<Record<string, readonly PersonalDocumentConfig[]>> = {
  BR: [{
    countryCode: "BR",
    countryCallingCode: "+55",
    type: "CPF",
    label: "Cadastro de Pessoas Físicas",
    example: "529.982.247-25",
    mask: maskCPF,
    regex: "^\\d{11}$",
    validate: isValidCPF,
    validationLevel: "checksum",
    source: RECEITA_FEDERAL_SOURCE,
  }],
  AR: [{
    countryCode: "AR",
    countryCallingCode: "+54",
    type: "DNI",
    label: "Documento Nacional de Identidad",
    example: "12345678",
    mask: maskDNI8,
    regex: "^\\d{7,8}$",
    validate: (value) => /^\d{7,8}$/.test(digits(value)),
    validationLevel: "format",
    source: {
      name: "Registro Nacional de las Personas (RENAPER) — DNI",
      url: "https://www.argentina.gob.ar/interior/renaper",
      accessedAt: "2026-07-30",
    },
  }, {
    countryCode: "AR",
    countryCallingCode: "+54",
    type: "CUIL",
    label: "Código Único de Identificación Laboral",
    example: "20-12345678-6",
    validate: isValidCUIL,
    regex: "^\\d{11}$",
    validationLevel: "checksum",
    source: {
      name: "ANSES — CUIL",
      url: "https://www.anses.gob.ar/consulta/constancia-de-cuil",
      accessedAt: "2026-07-30",
    },
  }],
  MX: [{
    countryCode: "MX",
    countryCallingCode: "+52",
    type: "CURP",
    label: "Clave Única de Registro de Población",
    example: "GOMR780512HDFRRL08",
    regex: "^[A-Z][AEIOUX][A-Z]{2}\\d{6}[HM][A-Z]{5}[A-Z0-9]\\d$",
    validate: isValidCURP,
    validationLevel: "format",
    source: {
      name: "Registro Nacional de Población — CURP",
      url: "https://www.gob.mx/curp/",
      accessedAt: "2026-07-30",
    },
  }],
  CA: [{
    countryCode: "CA",
    countryCallingCode: "+1",
    type: "SIN",
    label: "Social Insurance Number",
    example: "046-454-286",
    regex: "^\\d{9}$",
    validate: isValidSIN,
    validationLevel: "checksum",
    source: {
      name: "Service Canada — Social Insurance Number",
      url: "https://www.canada.ca/en/employment-social-development/services/sin.html",
      accessedAt: "2026-07-30",
    },
  }],
  US: [{
    countryCode: "US",
    countryCallingCode: "+1",
    type: "SSN",
    label: "Social Security Number",
    example: "123-45-6789",
    regex: "^\\d{9}$",
    validate: isValidSSN,
    validationLevel: "format",
    source: {
      name: "Social Security Administration — SSN Randomization",
      url: "https://www.ssa.gov/employer/randomization.html",
      accessedAt: "2026-07-30",
    },
  }],
  PR: [{
    countryCode: "PR",
    countryCallingCode: "+1",
    type: "SSN",
    label: "Social Security Number",
    example: "123-45-6789",
    regex: "^\\d{9}$",
    validate: isValidSSN,
    validationLevel: "format",
    source: {
      name: "Social Security Administration — Puerto Rico uses the federal SSN",
      url: "https://www.ssa.gov/employer/randomization.html",
      accessedAt: "2026-07-30",
    },
  }],
  EC: [{
    countryCode: "EC",
    countryCallingCode: "+593",
    type: "CEDULA",
    label: "Cédula de Identidad",
    example: "1710034065",
    regex: "^\\d{10}$",
    validate: isValidEcuadorCedula,
    validationLevel: "checksum",
    source: {
      name: "Dirección General de Registro Civil — Ecuador",
      url: "https://www.registrocivil.gob.ec/",
      accessedAt: "2026-07-30",
    },
  }],
  UY: [{
    countryCode: "UY",
    countryCallingCode: "+598",
    type: "CI",
    label: "Cédula de Identidad",
    example: "1.234.567-8",
    regex: "^\\d{7,8}$",
    validate: isValidUruguayanCI,
    validationLevel: "checksum",
    source: {
      name: "Dirección Nacional de Identificación Civil — Uruguay",
      url: "https://www.gub.uy/ministerio-interior/dnic",
      accessedAt: "2026-07-30",
    },
  }],
  PE: [{
    countryCode: "PE",
    countryCallingCode: "+51",
    type: "DNI",
    label: "Documento Nacional de Identidad",
    example: "12345678",
    mask: maskDNI8,
    regex: "^\\d{8}$",
    validate: (value) => /^\d{8}$/.test(digits(value)),
    validationLevel: "format",
    source: {
      name: "Registro Nacional de Identificación y Estado Civil (RENIEC) — Perú",
      url: "https://www.reniec.gob.pe/",
      accessedAt: "2026-07-30",
    },
  }],
  PY: [{
    countryCode: "PY",
    countryCallingCode: "+595",
    type: "CI",
    label: "Cédula de Identidad",
    example: "1234567",
    regex: "^\\d{6,8}$",
    validate: (value) => /^\d{6,8}$/.test(digits(value)),
    validationLevel: "format",
    source: {
      name: "Departamento de Identificaciones — Policía Nacional del Paraguay",
      url: "https://www.policianacional.gov.py/",
      accessedAt: "2026-07-30",
    },
  }],
  GT: [{
    countryCode: "GT",
    countryCallingCode: "+502",
    type: "DPI",
    label: "Documento Personal de Identificación",
    example: "1234567890123",
    regex: "^\\d{13}$",
    validate: (value) => /^\d{13}$/.test(digits(value)),
    validationLevel: "format",
    source: {
      name: "Registro Nacional de las Personas (RENAP) — Guatemala",
      url: "https://www.renap.gob.gt/",
      accessedAt: "2026-07-30",
    },
  }],
  HN: [{
    countryCode: "HN",
    countryCallingCode: "+504",
    type: "IDENTIDAD",
    label: "Documento Nacional de Identificación",
    example: "0801199912345",
    regex: "^\\d{13}$",
    validate: (value) => /^\d{13}$/.test(digits(value)),
    validationLevel: "format",
    source: {
      name: "Registro Nacional de las Personas — Honduras",
      url: "https://www.rnp.hn/",
      accessedAt: "2026-07-30",
    },
  }],
  HT: [{
    countryCode: "HT",
    countryCallingCode: "+509",
    type: "NIF",
    label: "Numéro d'Identification Fiscale",
    example: "123456789",
    regex: "^\\d{9,10}$",
    validate: (value) => /^\d{9,10}$/.test(digits(value)),
    validationLevel: "format",
    source: {
      name: "Direction Générale des Impôts — Haïti",
      url: "https://www.dgi.gouv.ht/",
      accessedAt: "2026-07-30",
    },
  }],
  SV: [{
    countryCode: "SV",
    countryCallingCode: "+503",
    type: "DUI",
    label: "Documento Único de Identidad",
    example: "12345678-9",
    regex: "^\\d{9}$",
    validate: (value) => /^\d{9}$/.test(digits(value)),
    validationLevel: "format",
    source: {
      name: "Registro Nacional de las Personas Naturales — El Salvador",
      url: "https://www.rnpn.gob.sv/",
      accessedAt: "2026-07-30",
    },
  }],
  DO: [{
    countryCode: "DO",
    countryCallingCode: "+1",
    type: "CEDULA",
    label: "Cédula de Identidad y Electoral",
    example: "00112345678",
    regex: "^\\d{11}$",
    validate: (value) => /^\d{11}$/.test(digits(value)),
    validationLevel: "format",
    source: {
      name: "Junta Central Electoral — República Dominicana",
      url: "https://jce.gob.do/",
      accessedAt: "2026-07-30",
    },
  }],
  CR: [{
    countryCode: "CR",
    countryCallingCode: "+506",
    type: "CEDULA",
    label: "Cédula de Identidad",
    example: "1-2345-6789",
    regex: "^\\d{9}$",
    validate: (value) => /^\d{9}$/.test(digits(value)),
    validationLevel: "format",
    source: {
      name: "Tribunal Supremo de Elecciones — Costa Rica",
      url: "https://www.tse.go.cr/",
      accessedAt: "2026-07-30",
    },
  }],
  VE: [{
    countryCode: "VE",
    countryCallingCode: "+58",
    type: "CEDULA",
    label: "Cédula de Identidad",
    example: "V-12345678",
    regex: "^[VE]-?\\d{6,9}$",
    validate: (value) => /^[VE]-?\d{6,9}$/.test(value.trim().toUpperCase()),
    validationLevel: "format",
    source: {
      name: "Servicio Administrativo de Identificación, Migración y Extranjería (SAIME) — Venezuela",
      url: "https://www.saime.gob.ve/",
      accessedAt: "2026-07-30",
    },
  }],
};

function fallbackFor(iso2: string): PersonalDocumentConfig {
  const country = getCountry(iso2);
  return {
    countryCode: country?.iso2 ?? iso2.trim().toUpperCase(),
    countryCallingCode: country?.callingCode ?? "",
    type: "PERSONAL_ID",
    label: "Documento de identificação pessoal",
    validate: (value) => value.trim().length >= 3,
    isFallback: true,
    validationLevel: "fallback",
  };
}

/**
 * Personal documents for a given country. Returns `[]` when the country either
 * has no curated personal document (fallback path) or is a jurisdiction where a
 * single identifier covers both personal and corporate use (e.g. Chile's RUT —
 * use `/documents` there).
 */
export function getPersonalDocuments(iso2: string): PersonalDocumentConfig[] {
  return (registry[iso2.trim().toUpperCase()] ?? []).map(withBoundedMask);
}

/**
 * Resolves a personal document config for the given country/type, falling back
 * to a permissive `PERSONAL_ID` config (`validationLevel: "fallback"`) when
 * nothing is curated.
 */
export function resolvePersonalDocument(
  iso2: string,
  type?: string,
): PersonalDocumentConfig {
  const configs = getPersonalDocuments(iso2);
  if (!configs.length) return fallbackFor(iso2);
  if (!type) return configs[0] ?? fallbackFor(iso2);
  return configs.find((config) => config.type.toUpperCase() === type.toUpperCase())
    ?? fallbackFor(iso2);
}

export function validatePersonalDocument(
  iso2: string,
  type: string | undefined,
  value: string,
): PersonalDocumentValidationResult {
  const config = resolvePersonalDocument(iso2, type);
  const valid = config.validate
    ? config.validate(value)
    : config.regex
      ? new RegExp(config.regex).test(digits(value))
      : false;
  return { valid, usedFallback: config.isFallback === true };
}

export function maskPersonalDocument(
  iso2: string,
  type: string | undefined,
  value: string,
): string {
  const config = resolvePersonalDocument(iso2, type);
  const mask = config.mask;
  if (typeof mask === "function") return mask(value);
  if (!mask) return config.maxLength === undefined ? value : value.slice(0, config.maxLength);
  let position = 0;
  const normalized = digits(value);
  return mask.replace(/9/g, () => normalized[position++] ?? "").replace(/[^\d]+$/, "");
}
