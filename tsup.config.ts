import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "countries/index": "src/countries/index.ts",
    "documents/index": "src/documents/index.ts",
    "phone/index": "src/phone/index.ts",
    "compat/index": "src/compat/index.ts",
    "personal/index": "src/personal/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
});

