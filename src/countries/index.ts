import { COUNTRY_DATA } from "./data.js";

export type CountryCode = string;

export interface CountryInfo {
  iso2: string;
  iso3: string;
  name: string;
  callingCode: string;
  flag: string;
}

export type NamedRegionScope =
  | "world"
  | "latam"
  | "mercosul"
  | "northAmerica"
  | "europe";
export type RegionScope = NamedRegionScope | string[];

const LATAM = new Set([
  "AR", "BO", "BR", "CL", "CO", "CR", "CU", "DO", "EC", "SV", "GT",
  "HT", "HN", "MX", "NI", "PA", "PY", "PE", "PR", "UY", "VE",
]);
const MERCOSUL = new Set(["AR", "BO", "BR", "PY", "UY"]);
const NORTH_AMERICA = new Set(["CA", "MX", "US"]);

function flagFromIso2(iso2: string): string {
  return [...iso2]
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

const allCountries: CountryInfo[] = COUNTRY_DATA
  .map((country) => ({
    iso2: country.iso2,
    iso3: country.iso3,
    name: country.name,
    callingCode: country.callingCode,
    flag: flagFromIso2(country.iso2),
  }));

const byIso2 = new Map(allCountries.map((country) => [country.iso2, country]));

export function getCountry(iso2: string): CountryInfo | undefined {
  return byIso2.get(iso2.trim().toUpperCase());
}

export function getCountries(scope: RegionScope = "world"): CountryInfo[] {
  if (Array.isArray(scope)) {
    return scope
      .map((iso2) => getCountry(iso2))
      .filter((country): country is CountryInfo => country !== undefined);
  }
  if (scope === "world") return [...allCountries];
  if (scope === "latam") return allCountries.filter(({ iso2 }) => LATAM.has(iso2));
  if (scope === "mercosul") return allCountries.filter(({ iso2 }) => MERCOSUL.has(iso2));
  if (scope === "northAmerica") {
    return allCountries.filter(({ iso2 }) => NORTH_AMERICA.has(iso2));
  }
  if (scope === "europe") {
    const europeanCodes = new Set<string>(
      COUNTRY_DATA.filter(({ continent }) => continent === "EU").map(({ iso2 }) => iso2),
    );
    return allCountries.filter(({ iso2 }) => europeanCodes.has(iso2));
  }
  return [];
}

export function isCountryCode(value: string): boolean {
  return byIso2.has(value.trim().toUpperCase());
}
