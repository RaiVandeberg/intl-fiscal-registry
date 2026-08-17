# intl-fiscal-registry

[![npm version](https://img.shields.io/npm/v/intl-fiscal-registry)](https://www.npmjs.com/package/intl-fiscal-registry)
[![npm downloads](https://img.shields.io/npm/dm/intl-fiscal-registry)](https://www.npmjs.com/package/intl-fiscal-registry)
[![CI](https://github.com/RaiVandeberg/intl-fiscal-registry/actions/workflows/publish.yml/badge.svg)](https://github.com/RaiVandeberg/intl-fiscal-registry/actions/workflows/publish.yml)
[![license](https://img.shields.io/npm/l/intl-fiscal-registry)](./LICENSE)

Biblioteca TypeScript para países, telefones e documentos fiscais — de empresa e de pessoa
física. Funciona em Node.js, browsers e runtimes edge, sem React, DOM ou dependências de runtime.

- 249 países e territórios ISO;
- países, bandeiras, DDI e agrupamentos regionais;
- máscara, validação e conversão de telefones para E.164;
- documentos fiscais **de empresa** (`/documents`) com máscara, limite de comprimento e nível
  de validação explícito;
- documentos **de pessoa física** (`/personal`) — CPF, DNI, CURP, SSN/SIN e outros — com o
  mesmo formato de config;
- ESM, CommonJS e tipos TypeScript;
- regras auditáveis com fontes oficiais.

## Instalação

```bash
npm install intl-fiscal-registry
```

## Início rápido

```ts
import {
  createPhone,
  getCountry,
  maskDocument,
  resolveDocumentConfig,
  validateDocument,
} from "intl-fiscal-registry";

getCountry("br");
// { iso2: "BR", iso3: "BRA", name: "Brazil", callingCode: "+55", flag: "🇧🇷" }

maskDocument("BR", "CNPJ", "11222333000181");
// "11.222.333/0001-81"

validateDocument("BR", "CNPJ", "11.222.333/0001-81");
// { valid: true, usedFallback: false }

const cnpj = resolveDocumentConfig("BR", "CNPJ");
cnpj.maxLength;       // 18
cnpj.validationLevel; // "checksum"

const phone = createPhone();
phone.mask("11912345678", "BR");    // "(11) 91234-5678"
phone.isValid("11 91234-5678", "BR"); // true
phone.toE164("11 91234-5678", "BR");  // "+5511912345678"
```

## Documentos fiscais

### Consultar as regras disponíveis

Um país pode ter uma ou mais configurações. Quando o tipo não for informado,
`resolveDocumentConfig()` retorna a primeira regra do país.

```ts
import {
  getDocumentConfigs,
  resolveDocumentConfig,
} from "intl-fiscal-registry/documents";

const configs = getDocumentConfigs("CO");
const nit = resolveDocumentConfig("CO", "NIT");

nit.type;       // "NIT"
nit.label;      // "Número de Identificación Tributaria"
nit.example;    // "800999999-1"
nit.maxLength;  // 11, incluindo o separador
nit.mask?.("12345678901234567890"); // "123456789-0"
```

As máscaras descartam caracteres excedentes e nunca produzem um valor maior que `maxLength`.
Isso permite usar o metadado diretamente em campos de formulário:

```ts
const config = resolveDocumentConfig("CO", "NIT");

const inputProps = {
  placeholder: config.example,
  maxLength: config.maxLength,
  onChange: (value: string) => config.mask?.(value) ?? value,
};
```

### Validar

```ts
import { validateDocument } from "intl-fiscal-registry/documents";

validateDocument("AR", "CUIT", "20-12345678-6");
// { valid: true, usedFallback: false }

validateDocument("JP", "CORPORATE_NUMBER", "7000012050003");
// { valid: false, usedFallback: false }

validateDocument("ZA", undefined, "ABC-123");
// { valid: true, usedFallback: true }
```

Cada regra informa com transparência o que foi validado:

| `validationLevel` | Garantia |
| --- | --- |
| `checksum` | Formato e dígito verificador calculados localmente |
| `format` | Somente a estrutura oficial; não calcula checksum nem consulta cadastro governamental |
| `fallback` | Regra genérica `TAX_ID`, sinalizada também por `isFallback: true` |

Uma validação local positiva não confirma que a empresa existe ou está ativa no órgão fiscal.

### Cobertura

```ts
import { getDocumentCoverage } from "intl-fiscal-registry/documents";

const coverage = getDocumentCoverage();
// totalCountries, specificCountries, checksumCountries,
// formatOnlyCountries e fallbackCountries
```

Há regras específicas para 57 países, incluindo CNPJ/BR, CUIT/AR, RUT/CL, ABN/AU, Corporate
Number/JP, GSTIN/IN, UEN/SG, NZBN/NZ, BRN/KR, EIN/US, BN/CA, VAT dos 27 membros da UE e formatos
latino-americanos documentados — UY (RUT), BO (NIT), GT (NIT), VE (RIF), DO (RNC), CR
(Cédula Jurídica), HN (RTN), SV (NIT), PA (RUC), NI (RUC), CU (NIT), HT (NIF) e PR (alias do
EIN federal). Os demais países usam o fallback explícito.

## Documentos de pessoa física

O subpath `/personal` espelha `/documents`, mas para documentos de pessoa física — CPF, DNI,
CURP, SSN, SIN e afins. Assim como em `/documents`, cada regra traz `example`, `maxLength`,
`mask`, `validate` e um `validationLevel` explícito.

```ts
import {
  getPersonalDocuments,
  maskPersonalDocument,
  resolvePersonalDocument,
  validatePersonalDocument,
} from "intl-fiscal-registry/personal";

const cpf = resolvePersonalDocument("BR", "CPF");
cpf.example;          // "529.982.247-25"
cpf.validationLevel;  // "checksum"

validatePersonalDocument("BR", "CPF", "529.982.247-25");
// { valid: true, usedFallback: false }

maskPersonalDocument("BR", "CPF", "52998224725");
// "529.982.247-25"

getPersonalDocuments("AR").map(({ type }) => type);
// ["DNI", "CUIL"]
```

Cobertura das Américas com checksum: BR (CPF), AR (CUIL), CA (SIN Luhn), EC (Cédula), UY (CI).
Com validação estrutural: US (SSN — rejeita `000/666/9xx`, grupo `00`, serial `0000`) e PR
(alias federal). Com validação de formato/regex: AR (DNI), MX (CURP), PE (DNI), PY (CI),
GT (DPI), HN (Identidad), HT (NIF), SV (DUI), DO (Cédula), CR (Cédula) e VE (Cédula).

Jurisdições onde o mesmo documento vale para PF e PJ (Chile — RUT único) devolvem `[]` em
`getPersonalDocuments()`; use `/documents` nesses casos. Países não curados caem em um
`PERSONAL_ID` de fallback permissivo, do mesmo jeito que `/documents`.

## Telefones

```ts
import { createPhone, getPhoneMeta } from "intl-fiscal-registry/phone";

const meta = getPhoneMeta("US");
// {
//   callingCode: "+1",
//   flag: "🇺🇸",
//   mask: "(999) 999-9999",
//   digitLengths: [10],
//   isFallback: false
// }

const phone = createPhone();

phone.mask("4155552671", "US");       // "(415) 555-2671"
phone.isValid("(415) 555-2671", "US"); // true
phone.toE164("(415) 555-2671", "US");  // "+14155552671"
```

Todos os países resolvem metadados. `getPhoneMeta(iso2).isFallback` indica quando o país usa
apenas a regra genérica de 6 a 15 dígitos, em vez de comprimentos nacionais específicos.

## Países e regiões

```ts
import {
  getCountries,
  getCountry,
  isCountryCode,
} from "intl-fiscal-registry/countries";

getCountries();                    // todos os 249 países e territórios
getCountries("latam");             // América Latina
getCountries("mercosul");          // membros do Mercosul
getCountries("northAmerica");      // CA, MX e US
getCountries("europe");            // países europeus
getCountries(["BR", "AR", "UY"]); // seleção personalizada

getCountry("BR");       // CountryInfo | undefined
isCountryCode("BR");    // true
isCountryCode("XX");    // false
```

### Nomes localizados

`name` vem em inglês por padrão. Passe `locale` para receber o nome traduzido,
resolvido via `Intl.DisplayNames`:

```ts
getCountry("BR")?.name;                        // "Brazil"
getCountry("BR", { locale: "pt-BR" })?.name;   // "Brasil"
getCountry("DE", { locale: "pt-BR" })?.name;   // "Alemanha"

getCountries("world", { locale: "pt-BR" });    // 249 países com nome em pt-BR
getCountries(["BR", "US"], { locale: "es" });  // ["Brasil", "Estados Unidos"]
```

A opção é aceita por `getCountry` e `getCountries`, aplica-se a qualquer escopo e
só altera o campo `name` — `iso2`, `iso3`, `callingCode` e `flag` seguem iguais.
Se o runtime não tiver `Intl.DisplayNames`, o locale for inválido ou não houver
tradução para o país, o nome em inglês é mantido.

## Importações

Use o pacote principal ou subpaths menores:

```ts
import { getCountry, createPhone } from "intl-fiscal-registry";
import { getCountries } from "intl-fiscal-registry/countries";
import { maskDocument } from "intl-fiscal-registry/documents";
import { validatePersonalDocument } from "intl-fiscal-registry/personal";
import { getPhoneMeta } from "intl-fiscal-registry/phone";
```

CommonJS também é suportado:

```js
const { getDocumentConfigs } = require("intl-fiscal-registry/documents");

const nit = getDocumentConfigs("CO").find(({ type }) => type === "NIT");
console.log(nit.mask("12345678901234567890")); // "123456789-0"
```

## Compatibilidade com a API legada por DDI

O adapter `/compat` mantém aliases como `RUT_CL`, `EIN_US`, `BN_CA`, `RFC_MX`, `NIT_CO` e
`RUC_PE`. Em DDIs compartilhados, informe `preferredIso2` para eliminar ambiguidades.

```ts
import {
  getDocRule,
  getDocTypesForDDI,
  validatePhoneByDDI,
} from "intl-fiscal-registry/compat";

const cnpj = getDocRule("55", "CNPJ");
const nanpDocuments = getDocTypesForDDI("1"); // inclui EIN_US e BN_CA

cnpj?.mask("11222333000181");
validatePhoneByDDI("4155552671", "1", "US");
```

### Helpers aditivos

Complementos que evitam boilerplate no consumidor. Todos aditivos — as funções acima
continuam com o mesmo comportamento.

```ts
import {
  getAllDocsForDDI,
  getCountryRule,
  getCountryRules,
  getDocTypesForDDIOrdered,
  getDocTypesForDDIWithFallback,
  getPlaceholder,
  localizeCountryName,
} from "intl-fiscal-registry/compat";

// Placeholder curado (ou undefined em fallback), sem o "Documento" genérico.
getPlaceholder("CPF");        // "529.982.247-25"
getPlaceholder("TAX_ID_BO");  // undefined

// Singular do getCountryRules — evita .find(...).
getCountryRule("55")?.docTypes.some(({ key }) => key === "CNPJ");

// Regras por escopo, com pin e sort opcionais.
getCountryRules("latam", { pin: ["BR"], sort: "ddi" });

// Corporate + personal juntos, PJ primeiro, nunca vazio.
const docs = getAllDocsForDDI("55");
docs.map(({ key }) => key); // ["CNPJ", "CPF"]

// getDocTypesForDDI variantes: sem quebrar a original.
getDocTypesForDDIWithFallback("263"); // devolve TAX_ID_ZW em vez de []
getDocTypesForDDIOrdered("1", "CA");  // [BN_CA, EIN_US] — ordena em vez de filtrar

// Nome localizado do país sem precisar embarcar tabela CLDR.
localizeCountryName("BR", "pt-BR"); // "Brasil"
localizeCountryName("BR", "es");    // "Brasil"
localizeCountryName("BR");          // "Brazil"
```

`LegacyCountryRule` também ganhou `flags?: string[]` e `iso2s?: string[]` (opcionais no
tipo, sempre populados em runtime), úteis pra montar labels tipo `"🇧🇷 +55"` ou distinguir
países num DDI compartilhado (`+1` → `["CA","US","PR"]`).

## Desenvolvimento e contribuição

```bash
npm install
npm run check
npm pack --dry-run
```

Pull requests executam typecheck, testes e build. Depois do merge na `main`, o semantic-release
cria a versão, a tag e a GitHub Release e publica o pacote no npm via OIDC.

Use commits convencionais:

- `fix:` gera uma versão patch;
- `feat:` gera uma versão minor;
- `BREAKING CHANGE:` gera uma versão major;
- `docs:`, `test:` e `ci:` não publicam uma nova versão isoladamente.

Ao adicionar regras, inclua uma fonte oficial e testes positivos e negativos. Se não houver regra
confiável, mantenha o fallback explícito em vez de inventar formatos ou algoritmos.

## Licença

[MIT](./LICENSE)
