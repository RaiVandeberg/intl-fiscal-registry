# Third-party notices

The static country registry in `src/countries/data.ts` was initially generated from the
MIT-licensed `countries-list` project by Dmytro Klymenko and contributors:
https://github.com/annexare/Countries

The generated data is committed to this repository. `countries-list` is not a runtime or
development dependency of this package.

The static telephone metadata snapshot in `src/phone/data.ts` was generated from Google
libphonenumber metadata as distributed by `libphonenumber-js` 1.13.9. Google libphonenumber is
licensed under Apache License 2.0: https://github.com/google/libphonenumber

Neither `libphonenumber` nor `libphonenumber-js` is a runtime or development dependency of this
package. Only the generated country-level lengths and presentation masks are committed.
