# intl-fiscal-registry

Biblioteca TypeScript open source e vendor-neutral para país, telefone e documento fiscal.
Funciona em browser, Node.js e runtimes edge, sem dependência de React, Next.js ou DOM e com
**zero dependências de runtime**.

> Estado atual: versão inicial em desenvolvimento (`0.x`). Todos os países ISO resolvem país,
> telefone e documento. Regras fiscais ou telefônicas específicas são adicionadas apenas quando
> há fonte e validação confiáveis; os demais países usam fallbacks explícitos e sinalizados.

## Instalação

```bash
npm install intl-fiscal-registry
```

## Uso

```ts
import {
  createPhone,
  getCountries,
  resolveDocumentConfig,
  validateDocument,
} from "intl-fiscal-registry";

const countries = getCountries("world");
const document = resolveDocumentConfig("BR", "CNPJ");
const result = validateDocument("BR", "CNPJ", "12.ABC.345/01DE-35");
const phone = createPhone().toE164("11 91234-5678", "BR");
```

Cada configuração fiscal informa `validationLevel`:

- `checksum`: formato e dígito verificador calculados localmente;
- `format`: somente a estrutura oficial é conferida; não há cálculo de checksum nem consulta ao
  cadastro governamental;
- `fallback`: `TAX_ID` genérico e explicitamente sinalizado.

Configurações com `example` também expõem `maxLength`. A função `mask` da configuração e
`maskDocument()` descartam caracteres excedentes e nunca produzem um valor maior que esse limite,
o que permite reutilizar o metadado diretamente no atributo `maxLength` de inputs.

`getDocumentCoverage()` fornece a cobertura auditável. **Todos os 249 países/territórios são
suportados**; 44 já possuem regras fiscais específicas: CNPJ/BR (inclusive o formato alfanumérico
de 2026), CUIT/AR, RUT/CL, ABN/AU,
Corporate Number/JP, GSTIN/IN, UEN/SG, NZBN/NZ, BRN/KR, EIN/US, BN/CA, VAT dos 27 membros da UE
e outros formatos latino-americanos já documentados. Os demais resolvem `TAX_ID` com
`isFallback: true`.

`getPhoneMeta(iso2).isFallback` informa se o telefone usa somente a regra genérica de 6 a 15
dígitos. **Todos os 249 países/territórios resolvem metadados de telefone**; o snapshot atual traz
máscara e comprimentos nacionais estáticos para 242 deles.
Os sete territórios sem plano próprio no snapshot (`AQ`, `BV`, `TF`, `HM`, `PN`, `GS`, `UM`)
permanecem no fallback. O pacote instalado não depende de `libphonenumber-js` nem de outro pacote
de runtime.

Importações menores estão disponíveis em `intl-fiscal-registry/countries`, `/documents`,
`/phone` e `/compat`.

## Migração legada por DDI

```ts
import {
  documentMask,
  getDocRule,
  getDocTypesForDDI,
  validatePhoneByDDI,
} from "intl-fiscal-registry/compat";

const cnpj = getDocRule("55", "CNPJ"); // { key, label, mask, isValid }
const nanp = getDocTypesForDDI("1");   // inclui EIN_US e BN_CA
```

O adapter mantém aliases antigos como `RUT_CL`, `EIN_US`, `BN_CA`, `RFC_MX`, `NIT_CO` e
`RUC_PE`. Em DDIs compartilhados, a lista fiscal agrega países compatíveis; telefone aceita um
`preferredIso2` para eliminar ambiguidade.

## Desenvolvimento

```bash
npm install
npm run check
npm pack --dry-run
```

## Política de regras fiscais

- Nunca inventar regex, formato ou algoritmo fiscal.
- Uma regra específica deve ter testes positivos e negativos.
- Sem regra confiável, manter `TAX_ID` com `isFallback: true`.
- A lista mundial continua disponível independentemente da cobertura específica.

## Política de telefone

- DDI, máscara e comprimentos são dados estáticos mantidos neste repositório, com origem e versão
  declaradas em `PHONE_DATA_SOURCE`.
- País curado usa seus comprimentos e máscara próprios.
- País ainda não curado aceita somente dígitos em comprimento genérico razoável e retorna
  `isFallback: true`.
- Não há dependência de runtime para parsing ou validação.

## Licença

MIT
