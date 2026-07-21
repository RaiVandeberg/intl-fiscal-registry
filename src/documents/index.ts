import { getCountries, getCountry } from "../countries/index.js";

export interface CompanyDocumentConfig {
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

export interface DocumentValidationResult {
  valid: boolean;
  usedFallback: boolean;
}

export interface DocumentCoverageReport {
  totalCountries: number;
  specificCountries: number;
  checksumCountries: string[];
  formatOnlyCountries: string[];
  fallbackCountries: string[];
}

const digits = (value: string): string => value.replace(/\D/g, "");

const documentCharacters = (value: string): string =>
  value.toUpperCase().replace(/[^A-ZÑ&\d]/g, "");

function withBoundedMask(config: CompanyDocumentConfig): CompanyDocumentConfig {
  if (!config.example) return config;

  const maxLength = config.example.length;
  const canonicalLength = documentCharacters(config.example).length;
  const originalMask = config.mask;
  const mask = (value: string): string => {
    const bounded = documentCharacters(value).slice(0, canonicalLength);
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

export function maskCNPJ(value: string): string {
  const normalized = value.toUpperCase().replace(/[^A-Z\d]/g, "").slice(0, 14);
  if (normalized.length <= 2) return normalized;
  if (normalized.length <= 5) return `${normalized.slice(0, 2)}.${normalized.slice(2)}`;
  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5)}`;
  }
  if (normalized.length <= 12) {
    return `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/${normalized.slice(8)}`;
  }
  return `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/${normalized.slice(8, 12)}-${normalized.slice(12)}`;
}

function cnpjCharacterValue(character: string): number {
  return character.charCodeAt(0) - 48;
}

function cnpjCheckDigit(base: string, weights: number[]): number {
  const sum = [...base].reduce(
    (total, character, index) => total + cnpjCharacterValue(character) * (weights[index] ?? 0),
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCNPJ(value: string): boolean {
  const normalized = value.toUpperCase().replace(/[^A-Z\d]/g, "");
  if (!/^[A-Z\d]{12}\d{2}$/.test(normalized) || /^(.)\1+$/.test(normalized)) return false;
  const first = cnpjCheckDigit(normalized.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = cnpjCheckDigit(`${normalized.slice(0, 12)}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return normalized.endsWith(`${first}${second}`);
}

export function maskCUIT(value: string): string {
  const normalized = digits(value).slice(0, 11);
  if (normalized.length <= 2) return normalized;
  if (normalized.length <= 10) return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
  return `${normalized.slice(0, 2)}-${normalized.slice(2, 10)}-${normalized.slice(10)}`;
}

export function isValidCUIT(value: string): boolean {
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

export function maskChileanRUT(value: string): string {
  const normalized = value.replace(/[^\dKk]/g, "").toUpperCase().slice(0, 9);
  if (normalized.length <= 1) return normalized;
  const body = normalized.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${normalized.slice(-1)}`;
}

export function isValidChileanRUT(value: string): boolean {
  const normalized = value.replace(/[.\s-]/g, "").toUpperCase();
  if (!/^\d{7,8}[\dK]$/.test(normalized)) return false;
  const body = normalized.slice(0, -1);
  let sum = 0;
  let weight = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * weight;
    weight = weight === 7 ? 2 : weight + 1;
  }
  const result = 11 - (sum % 11);
  const verifier = result === 11 ? "0" : result === 10 ? "K" : String(result);
  return verifier === normalized.slice(-1);
}

function maskEIN(value: string): string {
  const normalized = digits(value).slice(0, 9);
  return normalized.length <= 2 ? normalized : `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
}

function maskUKVAT(value: string): string {
  const normalized = digits(value).slice(0, 9);
  return [normalized.slice(0, 3), normalized.slice(3, 7), normalized.slice(7)]
    .filter(Boolean)
    .join(" ");
}

function maskABN(value: string): string {
  const normalized = digits(value).slice(0, 11);
  return [normalized.slice(0, 2), normalized.slice(2, 5), normalized.slice(5, 8), normalized.slice(8)]
    .filter(Boolean)
    .join(" ");
}

function maskTrailingVerifier(value: string): string {
  const normalized = digits(value);
  return normalized.length <= 1 ? normalized : `${normalized.slice(0, -1)}-${normalized.slice(-1)}`;
}

function normalizeUpperAlphanumeric(value: string, maxLength: number): string {
  return value.toUpperCase().replace(/[^A-ZÑ&\d]/g, "").slice(0, maxLength);
}

export function isValidABN(value: string): boolean {
  const normalized = digits(value);
  if (normalized.length !== 11) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const sum = [...normalized].reduce((total, digit, index) => {
    const adjusted = index === 0 ? Number(digit) - 1 : Number(digit);
    return total + adjusted * (weights[index] ?? 0);
  }, 0);
  return sum % 89 === 0;
}

export function isValidJapaneseCorporateNumber(value: string): boolean {
  const normalized = digits(value);
  if (!/^\d{13}$/.test(normalized)) return false;
  const checkDigit = Number(normalized[0]);
  const baseDigits = [...normalized.slice(1)].reverse();
  const sum = baseDigits.reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 2),
    0,
  );
  return checkDigit === 9 - (sum % 9);
}

const EU_VAT_FORMAT_SOURCE = {
  name: "Agencia Tributaria — Structure of VAT-VIES numbers by country",
  url: "https://sede.agenciatributaria.gob.es/Sede/en_gb/aduanas/intrastat-obligaciones-estadisticas/noticias-interes/nota-intrastat-partir-ano-2022.html",
  accessedAt: "2026-07-20",
} as const;

function vatFormatConfig(
  iso2: string,
  bodyPattern: string,
  example: string,
  prefixes: readonly string[] = [iso2],
): CompanyDocumentConfig {
  const country = getCountry(iso2);
  const expression = new RegExp(`^(?:${bodyPattern})$`);
  return {
    countryCode: iso2,
    countryCallingCode: country?.callingCode ?? "",
    type: "VAT",
    label: "VAT identification number",
    example,
    regex: bodyPattern,
    validate: (value) => {
      let normalized = value.toUpperCase().replace(/[\s.\-/]/g, "");
      const prefix = prefixes.find((candidate) => normalized.startsWith(candidate));
      if (prefix) normalized = normalized.slice(prefix.length);
      return expression.test(normalized);
    },
    validationLevel: "format",
    source: EU_VAT_FORMAT_SOURCE,
  };
}

const registry: Readonly<Record<string, readonly CompanyDocumentConfig[]>> = {
  AT: [vatFormatConfig("AT", "U\\d{8}", "ATU12345678")],
  AU: [{
    countryCode: "AU",
    countryCallingCode: "+61",
    type: "ABN",
    label: "Australian Business Number",
    example: "51 824 753 556",
    mask: maskABN,
    regex: "^\\d{11}$",
    validate: isValidABN,
    validationLevel: "checksum",
    source: {
      name: "Australian Business Register — Format of the ABN",
      url: "https://abr.business.gov.au/Help/AbnFormat",
      accessedAt: "2026-07-20",
    },
  }],
  AR: [{
    countryCode: "AR",
    countryCallingCode: "+54",
    type: "CUIT",
    label: "Clave Única de Identificación Tributaria",
    example: "20-12345678-6",
    mask: maskCUIT,
    validate: isValidCUIT,
    validationLevel: "checksum",
    source: {
      name: "ARCA — CUIT field specification (11 numeric digits)",
      url: "https://afip.gob.ar/gananciasYBienes/ganancias/personas-humanas-sucesiones-indivisas/declaracion-jurada/documentos/Manual-archivo-padron-regimen-simplificado-de-ganancias.pdf",
      accessedAt: "2026-07-20",
    },
  }],
  BR: [{
    countryCode: "BR",
    countryCallingCode: "+55",
    type: "CNPJ",
    label: "Cadastro Nacional da Pessoa Jurídica",
    example: "12.ABC.345/01DE-35",
    mask: maskCNPJ,
    regex: "^[A-Z0-9]{12}[0-9]{2}$",
    validate: isValidCNPJ,
    validationLevel: "checksum",
    source: {
      name: "Receita Federal — Manual de Cálculo do DV do CNPJ Alfanumérico",
      url: "https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf",
      accessedAt: "2026-07-20",
    },
  }],
  BE: [vatFormatConfig("BE", "[01]\\d{9}", "BE0123456789")],
  BG: [vatFormatConfig("BG", "\\d{9,10}", "BG123456789")],
  CL: [{
    countryCode: "CL",
    countryCallingCode: "+56",
    type: "RUT",
    label: "Rol Único Tributario",
    example: "12.345.678-5",
    mask: maskChileanRUT,
    validate: isValidChileanRUT,
    validationLevel: "checksum",
    source: {
      name: "Servicio de Impuestos Internos — RUT and módulo 11 validation",
      url: "https://www.sii.cl/ccp/formato_envio_cp_electronico_052022.pdf",
      accessedAt: "2026-07-20",
    },
  }],
  CA: [{
    countryCode: "CA",
    countryCallingCode: "+1",
    type: "BN",
    label: "Business Number",
    example: "123456789",
    regex: "^\\d{9}$",
    validate: (value) => /^\d{9}$/.test(digits(value)),
    validationLevel: "format",
    source: {
      name: "Government of Canada — Data Reference Standard on the Business Number",
      url: "https://www.canada.ca/en/government/system/digital-government/digital-government-innovations/enabling-interoperability/gc-enterprise-data-reference-standards/data-reference-standard-business-number.html",
      accessedAt: "2026-07-20",
    },
  }],
  CY: [vatFormatConfig("CY", "\\d{8}[A-Z]", "CY12345678A")],
  CO: [{
    countryCode: "CO",
    countryCallingCode: "+57",
    type: "NIT",
    label: "Número de Identificación Tributaria",
    example: "800999999-1",
    mask: maskTrailingVerifier,
    regex: "^\\d{5,14}-?\\d$",
    validate: (value) => /^\d{5,14}-?\d$/.test(value.trim()),
    validationLevel: "format",
    source: {
      name: "DIAN — NIT and verification digit technical fields",
      url: "https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_2655_2004.htm",
      accessedAt: "2026-07-20",
    },
  }],
  CZ: [vatFormatConfig("CZ", "\\d{8,10}", "CZ12345678")],
  DE: [vatFormatConfig("DE", "\\d{9}", "DE123456789")],
  DK: [vatFormatConfig("DK", "\\d{8}", "DK12345678")],
  EE: [vatFormatConfig("EE", "\\d{9}", "EE123456789")],
  ES: [vatFormatConfig("ES", "(?:[A-Z]\\d{7}[A-Z0-9]|\\d{8}[A-Z])", "ESA1234567B")],
  FI: [vatFormatConfig("FI", "\\d{8}", "FI12345678")],
  FR: [vatFormatConfig("FR", "[A-Z0-9]{2}\\d{9}", "FRAB123456789")],
  GB: [{
    countryCode: "GB",
    countryCallingCode: "+44",
    type: "VAT",
    label: "VAT registration number",
    example: "123 4567 89",
    mask: maskUKVAT,
    regex: "^\\d{9}$",
    validate: (value) => /^\d{9}$/.test(digits(value)),
    validationLevel: "format",
    source: {
      name: "HM Revenue & Customs — VAT registration number",
      url: "https://www.gov.uk/hmrc-internal-manuals/vat-registration-manual/vatreg03700",
      accessedAt: "2026-07-20",
    },
  }],
  GR: [vatFormatConfig("GR", "\\d{9}", "EL123456789", ["EL", "GR"])],
  HR: [vatFormatConfig("HR", "\\d{11}", "HR12345678901")],
  HU: [vatFormatConfig("HU", "\\d{8}", "HU12345678")],
  IE: [vatFormatConfig("IE", "(?:\\d[A-Z]\\d{5}[A-Z]|\\d{7}[A-Z]{1,2})", "IE1A23456B")],
  IN: [{
    countryCode: "IN",
    countryCallingCode: "+91",
    type: "GSTIN",
    label: "Goods and Services Tax Identification Number",
    example: "09ABCDE1234F1Z5",
    regex: "^\\d{2}[A-Z]{5}\\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$",
    validate: (value) => /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(
      value.toUpperCase().replace(/[\s.-]/g, ""),
    ),
    validationLevel: "format",
    source: {
      name: "Central Board of Indirect Taxes and Customs — GST Registration",
      url: "https://cbic-gst.gov.in/pdf/e-version-gst-fliers/regn-GST-onlineversion-07june2017.pdf",
      accessedAt: "2026-07-20",
    },
  }],
  IT: [vatFormatConfig("IT", "\\d{11}", "IT12345678901")],
  JP: [{
    countryCode: "JP",
    countryCallingCode: "+81",
    type: "CORPORATE_NUMBER",
    label: "Corporate Number",
    example: "7000012050002",
    regex: "^\\d{13}$",
    validate: isValidJapaneseCorporateNumber,
    validationLevel: "checksum",
    source: {
      name: "National Tax Agency — Composition of the Corporate Number",
      url: "https://www.houjin-bangou.nta.go.jp/documents/houjinbangounokousei.pdf",
      accessedAt: "2026-07-20",
    },
  }],
  KR: [{
    countryCode: "KR",
    countryCallingCode: "+82",
    type: "BRN",
    label: "Business Registration Number",
    example: "123-45-67890",
    regex: "^\\d{3}-?\\d{2}-?\\d{5}$",
    validate: (value) => /^\d{3}-?\d{2}-?\d{5}$/.test(value.trim()),
    validationLevel: "format",
    source: {
      name: "National Tax Service — Business Registration Number structure",
      url: "https://www.nts.go.kr/nts/na/ntt/selectNttInfo.do?mi=2448&nttSn=1386",
      accessedAt: "2026-07-20",
    },
  }],
  LT: [vatFormatConfig("LT", "(?:\\d{9}|\\d{12})", "LT123456789")],
  LU: [vatFormatConfig("LU", "\\d{8}", "LU12345678")],
  LV: [vatFormatConfig("LV", "\\d{11}", "LV12345678901")],
  MT: [vatFormatConfig("MT", "\\d{8}", "MT12345678")],
  MX: [{
    countryCode: "MX",
    countryCallingCode: "+52",
    type: "RFC",
    label: "Registro Federal de Contribuyentes",
    example: "ABC0102031A2",
    mask: (value) => normalizeUpperAlphanumeric(value, 12),
    regex: "^[A-ZÑ&]{3}\\d{6}[A-Z0-9]{3}$",
    validate: (value) => /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/.test(normalizeUpperAlphanumeric(value, 12)),
    validationLevel: "format",
    source: {
      name: "SAT — Estructura de la clave en el RFC para personas morales",
      url: "https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461176322651&ssbinary=true",
      accessedAt: "2026-07-20",
    },
  }],
  NL: [vatFormatConfig("NL", "\\d{9}B\\d{2}", "NL123456789B01")],
  NZ: [{
    countryCode: "NZ",
    countryCallingCode: "+64",
    type: "NZBN",
    label: "New Zealand Business Number",
    example: "9429123456789",
    regex: "^942\\d{10}$",
    validate: (value) => /^942\d{10}$/.test(value.replace(/[\s-]/g, "")),
    validationLevel: "format",
    source: {
      name: "New Zealand Companies Office — NZBN structure",
      url: "https://www.companiesoffice.govt.nz/all-registers/insolvency-practitioners/obligations/report-a-serious-problem/",
      accessedAt: "2026-07-20",
    },
  }],
  PL: [vatFormatConfig("PL", "\\d{10}", "PL1234567890")],
  PE: [{
    countryCode: "PE",
    countryCallingCode: "+51",
    type: "RUC",
    label: "Registro Único de Contribuyentes",
    example: "20123456789",
    regex: "^\\d{11}$",
    validate: (value) => /^\d{11}$/.test(digits(value)),
    validationLevel: "format",
    source: {
      name: "SUNAT — Inscripción al RUC para empresas",
      url: "https://orientacion.sunat.gob.pe/01-inscripcion-al-ruc-empresas",
      accessedAt: "2026-07-20",
    },
  }],
  PY: [{
    countryCode: "PY",
    countryCallingCode: "+595",
    type: "RUC",
    label: "Registro Único de Contribuyentes",
    example: "80000000-1",
    mask: maskTrailingVerifier,
    regex: "^8\\d{7}-?\\d$",
    validate: (value) => /^8\d{7}-?\d$/.test(value.trim()),
    validationLevel: "format",
    source: {
      name: "DNIT — Resolución General 79/21",
      url: "https://www.dnit.gov.py/en/web/portal-institucional/w/resolucion-general-n-79-21-1",
      accessedAt: "2026-07-20",
    },
  }],
  PT: [vatFormatConfig("PT", "\\d{9}", "PT123456789")],
  RO: [vatFormatConfig("RO", "\\d{2,10}", "RO123456789")],
  SE: [vatFormatConfig("SE", "\\d{12}", "SE123456789012")],
  SI: [vatFormatConfig("SI", "\\d{8}", "SI12345678")],
  SK: [vatFormatConfig("SK", "\\d{10}", "SK1234567890")],
  SG: [{
    countryCode: "SG",
    countryCallingCode: "+65",
    type: "UEN",
    label: "Unique Entity Number",
    example: "201888888A",
    regex: "^(?:\\d{8}[A-Z]|\\d{9}[A-Z]|T\\d{2}[A-Z]{2}\\d{4}[A-Z])$",
    validate: (value) => /^(?:\d{8}[A-Z]|\d{9}[A-Z]|T\d{2}[A-Z]{2}\d{4}[A-Z])$/.test(
      value.toUpperCase().replace(/[\s-]/g, ""),
    ),
    validationLevel: "format",
    source: {
      name: "Accounting and Corporate Regulatory Authority — Special UEN formats",
      url: "https://www.acra.gov.sg/resources/guides-forms/applying-for-special-uen/",
      accessedAt: "2026-07-20",
    },
  }],
  EC: [{
    countryCode: "EC",
    countryCallingCode: "+593",
    type: "RUC",
    label: "Registro Único de Contribuyentes",
    example: "1790012345001",
    regex: "^\\d{10}001$",
    validate: (value) => /^\d{10}001$/.test(digits(value)),
    validationLevel: "format",
    source: {
      name: "SRI — Technical field specification for RUC",
      url: "https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/19c2c062-a511-4295-b6b3-f00546c441c5/Ficha%20Tecnica%20OPR%20.pdf",
      accessedAt: "2026-07-20",
    },
  }],
  US: [{
    countryCode: "US",
    countryCallingCode: "+1",
    type: "EIN",
    label: "Employer Identification Number",
    example: "12-3456789",
    mask: maskEIN,
    regex: "^\\d{9}$",
    validate: (value) => /^\d{9}$/.test(digits(value)),
    validationLevel: "format",
    source: {
      name: "Internal Revenue Service — Instructions for Form SS-4",
      url: "https://www.irs.gov/instructions/iss4",
      accessedAt: "2026-07-20",
    },
  }],
};

function fallbackFor(iso2: string): CompanyDocumentConfig {
  const country = getCountry(iso2);
  return {
    countryCode: country?.iso2 ?? iso2.trim().toUpperCase(),
    countryCallingCode: country?.callingCode ?? "",
    type: "TAX_ID",
    label: "Identificação fiscal da empresa",
    validate: (value) => value.trim().length >= 3,
    isFallback: true,
    validationLevel: "fallback",
  };
}

export function getDocumentConfigs(iso2: string): CompanyDocumentConfig[] {
  return (registry[iso2.trim().toUpperCase()] ?? []).map(withBoundedMask);
}

export function resolveDocumentConfig(iso2: string, type?: string): CompanyDocumentConfig {
  const configs = getDocumentConfigs(iso2);
  if (!configs.length) return fallbackFor(iso2);
  if (!type) return configs[0] ?? fallbackFor(iso2);
  return configs.find((config) => config.type.toUpperCase() === type.toUpperCase())
    ?? fallbackFor(iso2);
}

export function validateDocument(
  iso2: string,
  type: string | undefined,
  value: string,
): DocumentValidationResult {
  const config = resolveDocumentConfig(iso2, type);
  const valid = config.validate
    ? config.validate(value)
    : config.regex
      ? new RegExp(config.regex).test(digits(value))
      : false;
  return { valid, usedFallback: config.isFallback === true };
}

export function maskDocument(iso2: string, type: string | undefined, value: string): string {
  const config = resolveDocumentConfig(iso2, type);
  const mask = config.mask;
  if (typeof mask === "function") return mask(value);
  if (!mask) return config.maxLength === undefined ? value : value.slice(0, config.maxLength);
  let position = 0;
  const normalized = digits(value);
  return mask.replace(/9/g, () => normalized[position++] ?? "").replace(/[^\d]+$/, "");
}

export function getDocumentCoverage(): DocumentCoverageReport {
  const checksumCountries: string[] = [];
  const formatOnlyCountries: string[] = [];
  const fallbackCountries: string[] = [];
  for (const { iso2 } of getCountries("world")) {
    const configs = getDocumentConfigs(iso2);
    if (!configs.length) {
      fallbackCountries.push(iso2);
    } else if (configs.some(({ validationLevel }) => validationLevel === "checksum")) {
      checksumCountries.push(iso2);
    } else {
      formatOnlyCountries.push(iso2);
    }
  }
  return {
    totalCountries: checksumCountries.length + formatOnlyCountries.length + fallbackCountries.length,
    specificCountries: checksumCountries.length + formatOnlyCountries.length,
    checksumCountries,
    formatOnlyCountries,
    fallbackCountries,
  };
}
