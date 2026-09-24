# Contributing to TrueLink Schema Studio

Thanks for helping! Schema Studio is an open-source (MIT) workspace for Schema.org structured
data, maintained by [TrueLink](https://truelink-group.com/). Bug reports, template ideas,
translations and code are all welcome.

- **Found a bug?** [Open a bug report](https://github.com/Johnny050033/truelink-schema-web-tools/issues/new?template=bug_report.yml).
- **Missing a Schema.org type or feature?** [Suggest it](https://github.com/Johnny050033/truelink-schema-web-tools/issues/new?template=feature_request.yml)
  or [propose a template](https://github.com/Johnny050033/truelink-schema-web-tools/issues/new?template=new_template.yml).
- **Speak another language?** See [Translations](#translations).
- **Security issue?** Don't open a public issue. Follow [SECURITY.md](SECURITY.md).

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ground rules

- **Synthetic data only.** Never paste real customer data, personal data, credentials or
  tokens into issues, fixtures, screenshots or tests. Use `example.com` and invented names.
- **Advice, not promises.** Structured data can help search engines and AI assistants
  understand a brand. Copy must never promise rankings, rich results, traffic or AI
  citations. The checks enforce this wording in every language.
- **Independent of private systems.** This repository contains no TrueLink backend code,
  credentials or deployment wiring, and it must stay that way.
- **Brand assets** (the TrueLink name, shield and app icons) aren't covered by the MIT License.
  See [TRADEMARKS.md](TRADEMARKS.md).

## Develop

Requirements: Node.js **22.13+** and **pnpm 11.19.0** (pinned in `package.json`).

```sh
git clone https://github.com/Johnny050033/truelink-schema-web-tools.git
cd truelink-schema-web-tools
pnpm install --frozen-lockfile
pnpm dev      # Schema Studio at http://localhost:5173
pnpm check    # typecheck, translation checks, tests and builds for every workspace
```

| Path | What lives there |
| --- | --- |
| `packages/schema-document` | The shared core: templates, audit checks, descriptions, import, the document contract, translations of core text |
| `packages/cloud-client` | The host-bridge protocol between the Studio and a TrueLink host page |
| `apps/web` | Schema Studio (React PWA) |
| `src/` | Low-level validation and sandboxed-embed library ([docs/LIBRARY.md](docs/LIBRARY.md)) |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit together.

## Pull requests

1. Keep each pull request focused on one change, and add or update tests.
2. Run `pnpm check` and make sure it passes.
3. Describe what users will notice. Add screenshots for UI changes (light and dark theme if
   styling changed).
4. Commit messages use a short prefix: `feat:`, `fix:`, `docs:`, `build:`, `test:`, `chore:`.
5. Match the surrounding code: strict TypeScript, no new runtime dependencies without
   discussing them first.
   - In the Studio, follow the brand rules in [apps/web/README.md](apps/web/README.md): the
     official shield only, and one gold call to action per screen.

## Adding or changing a template

Templates live in `packages/schema-document/src/templates/`. Each field declares its
Schema.org path, widget, importance (`required`, `recommended` or `optional`) and help text.

- **Importance.** `required` must mirror a documented search-engine requirement, or the
  minimum the tool needs. Link the source (Google Search Central or Schema.org) in `learnMore`.
- **Text.** Every text is written in both source languages: `t('繁體中文', 'English')`.
  - If you don't write Chinese, put your English in both places and say so in the pull
    request. A maintainer will add the Chinese.
  - Combine values with `fmt('…{name}…', '…{name}…', { name })`. Never build text by
    concatenation: the extractor rejects it, because translators need the whole sentence.
- **Checks.** Run `pnpm --filter truelink-schema-document i18n` to refresh the locale
  reference files, then `pnpm check`. New text shows in English in other languages until
  translators catch up.

## Translations

Schema Studio speaks English, 繁體中文, 简体中文, 日本語, Español, Português (Brasil) and
Bahasa Indonesia.

- English and Traditional Chinese are the source languages.
- The other languages were translated with AI assistance. They show a **Beta** tag until a
  native speaker has reviewed them. **Reviews are the most valuable contribution you can make.**

There are two kinds of catalogs, both flat JSON files:

| File | Keys | Contains |
| --- | --- | --- |
| `apps/web/src/i18n/locales/<locale>.json` | message ids (`"nav.home"`) | the app interface |
| `packages/schema-document/locales/<locale>.json` | the source text | template labels, help, audit messages, description sentences |

Core catalogs are keyed by the English text, except `zh-CN`, which is keyed by the
Traditional Chinese text, since it is adapted from it. `en.json` and `zh-TW.json` in
`packages/schema-document/locales/` are generated references; don't edit them.

### Improve a translation

1. Edit the value (never the key) in the JSON file.
2. Keep every `{slot}` exactly as written. You may move slots to fit your grammar.
   - `{aLabel}`, `{aJob}` and `{aType}` include an English article and are only for English.
     Other languages use `{label}`, `{job}` and `{label}`.
3. Validate (the `--todo` option lists what is still untranslated):

   ```sh
   pnpm --filter truelink-schema-studio i18n:check
   pnpm --filter truelink-schema-document i18n:check
   node packages/schema-document/scripts/i18n.mjs --todo ja   # what is still untranslated
   node apps/web/scripts/i18n.mjs --todo ja
   ```

4. Open a pull request, or, if you prefer, a
   [translation issue](https://github.com/Johnny050033/truelink-schema-web-tools/issues/new?template=translation.yml)
   with the current and the suggested text.

When a native speaker has reviewed a whole language, change its `status` from `beta` to
`reviewed` in `LOCALE_INFO` (`packages/schema-document/src/i18n.ts`) to remove the Beta tag.

### Add a language

1. **Shared core:**
   - Add the locale to `Locale` and `LOCALES` in `packages/schema-document/src/types.ts`.
   - Add it to `LOCALE_INFO` in `src/i18n.ts`, with `status: 'beta'`.
   - Add date formats to `formatWallClock` in `src/formats.ts`, if they differ from the defaults.
   - Add it to `CATALOG_LOCALES` in `scripts/i18n.mjs`.
2. **Studio:**
   - Add a loader in `apps/web/src/i18n/locales.ts`.
   - Update browser-language matching in `matchLocale` (`src/i18n/index.tsx`).
   - Add a short name in `SHORT_NAMES` (`src/features/shell/LanguageMenu.tsx`).
   - Add the HTML `lang` value in `public/theme-init.js`.
3. Create both catalogs. The easiest start is `--todo <locale>`.
4. Run `pnpm check`. It verifies slots, wording and that no text is left out.

## License

By contributing you agree that your contributions are licensed under the MIT License
([LICENSE](LICENSE)).
