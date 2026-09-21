# Persian for DeepSeek Harness

[فارسی](README.fa.md) · Independent community plugin by [MiRHaDi](https://github.com/MiRHaDi)

Adds **فارسی** to the Web language selector, translates **240 strings across six namespaces**, and enables right-to-left layout while Persian is selected. Code, keyboard shortcuts, terminal and editor containers remain left-to-right. The plugin uses the public locale API and has no runtime npm dependencies.

![Persian settings in the actual DeepSeek Harness Web app](docs/persian-settings.png)

## Install

Tested with **DeepSeek Harness 0.1.6-alpha.2**, Node 24.15.0 and installed Google Chrome 153.0.8010.52 on Windows. This is an alpha API; earlier releases are not supported and later compatibility is not guaranteed. Use an existing DSH installation with this version. The plugin does not install or upgrade DSH.

Download `dsh-persian-rtl-0.1.0.tgz` from [Releases](https://github.com/MiRHaDi/dsh-persian-rtl/releases). With the Web profile already created, run:

```sh
dsh plugin --profile web add ./dsh-persian-rtl-0.1.0.tgz
dsh --profile web --no-open
```

Open the local address printed by DSH, then select **Settings → General → Language → فارسی**. An unset language preference also follows a Persian browser locale such as `fa-IR`. Your explicit preference takes priority. No API key is needed to select the language; model requests still require the normal provider setup.

For an isolated trial, set `DSH_HOME` to an empty directory before starting DSH. See the official [profile and plugin guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md). The release tarball contains the built client and does not require a build script at installation.

Remove with `dsh plugin --profile web remove dsh-persian-rtl`, then reload the page. Disposal removes the dictionaries, selector entry, listener and stylesheet. When leaving Persian, the previous document direction is restored unless another owner has changed it. Language and preference persistence belong to DSH.

## Coverage and limits

| Namespace | Strings | Coverage at pinned revision |
|---|---:|---|
| `common` | 37 | Complete |
| `settings.locale` | 1 | Complete |
| `sidebar` | 5 | Complete |
| `settings` | 29 | Complete |
| `workspace` | 64 | Complete |
| `chat` | 104 | Complete |

Other namespaces use DSH's English fallback. This is **not a complete translation of the application**: onboarding, provider configuration, composer controls and several settings panels remain English. The screenshot intentionally shows this scope. Locale-specific date conversion, Persian digits, speech, and the terminal UI are not implemented. Dates retain the upstream calendar. Singular and plural count templates preserve their parameters and use natural Persian count nouns.

RTL uses document direction and scoped CSS, not string reversal or inserted directional control characters. Code containers (`pre`, `code`, `kbd`, `samp`, xterm, Monaco and CodeMirror) use LTR isolation. Paragraphs and textareas use `unicode-bidi: plaintext` to handle mixed Persian and Latin text. These selectors are not proof that every third-party renderer supports RTL; report a reproducible component when one does not.

## Validation

```sh
npm ci
npm run build
npm test
```

Six automated tests cover every dictionary key and placeholder against a pinned upstream fixture, real published `LocaleRuntime` behavior, `fa-IR` negotiation, English fallback, repeated language changes, unload/reload, restoration of direction, and listener disposal. The runtime tests load the published client factory; unused rendering dependencies throw if called, so they do not pretend to test the settings component.

The plugin was also installed through the real `dsh plugin` command and exercised in the actual Web app using headless system Chrome: Settings language changes `fa → en → fa`, `lang`/`dir`, and zero page errors. LTR code/editor CSS was checked with temporary DOM fixtures under the live plugin; these were removed before the screenshot. No model request, production account or user workspace was used. Full conversation execution and every viewport/theme were not tested.

For the browser smoke, install Playwright 1.62.1 separately or locally without saving it, set `DSH_TEST_URL` to your isolated running instance's local authenticated URL and run `node test/browser.cjs`. This opens only headless Chrome. Keep that URL private. The test changes only the test instance's language and onboarding preferences. Use the upstream browser-picker overlay when starting an automated test instance.

English fixture source: DeepSeek Harness commit `ddefc45fbc7f8e46dd73185e68295696d1297887`. To update, compare the six source dictionaries listed in `test/upstream-sources.json`; preserve placeholder names and multiplicity. Translation and code were prepared with AI assistance and reviewed through the validation above; Persian speaker feedback is welcome.

## Contributing

Report missing translations with a namespace/key or a screenshot without credentials. For layout bugs, include DSH/browser versions and minimal mixed-language text. PRs should include a regression test and describe the user-visible behavior. This is a community package, not an official DeepSeek product or a claim of membership in its core team.
