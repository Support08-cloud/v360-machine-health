# Localization Spec

Two languages implemented: English (`en`, default) and Gujarati (`gu`) — Gujarati chosen
because Surat, Gujarat is the real-world center of the diamond-cutting industry this whole
system serves. ~95 translation keys, 48 static `data-i18n` tags in the HTML, plus explicit
`t()` calls inside every function that generates text at runtime.

## Core mechanism

```js
var LANG = {
  en: { pageTitle:'Machine Health Audit', manufacturer:'Manufacturer', /* ...95 keys total... */ },
  gu: { pageTitle:'મશીન હેલ્થ ઓડિટ', manufacturer:'ઉત્પાદક', /* ...matching keys... */ }
};
function t(key){ return (LANG[state.lang] && LANG[state.lang][key]) || LANG.en[key] || key; }
```

Falls back to English if the current language is missing a key, and to the literal key string
if even English is missing it (should never happen in practice — every key defined in `en` has
a matching `gu` entry, confirmed by an automated check during development, see below).

## Two kinds of translated content

**Static UI text** — tagged directly in HTML: `<h1 data-i18n="pageTitle">Machine Health
Audit</h1>`. A single pass, `applyStaticTranslations()`, re-sets every tagged element's
`textContent` to `t(its own data-i18n value)` whenever the language toggles. Covers headers,
buttons, form labels, checkbox labels — everything that doesn't depend on which machine or
metric is currently selected.

*One exception worth calling out:* the light/dark theme toggle button's text is **not**
tagged this way, because its correct text depends on the *current* theme state (it shows the
action you'd switch to, not a fixed label) — tagging it generically would show the wrong
label if toggled while in dark mode. It's handled by explicit logic in
`applyStaticTranslations()` instead: `document.getElementById('themeToggle').textContent =
isDark ? t('lightMode') : t('darkMode')`. Any other state-dependent button text should follow
this pattern, not the generic tag.

**Generated sentences** — the diagnosis paragraph, the recommended-fix line, the fleet
conclusion, and the color-note sentence are all built with explicit `if(state.lang === 'gu')
{...} else {...}` branches inside their own functions, each branch built from the *same*
underlying computed values (weakest metric, gap, distances, etc.) so the two languages never
drift apart in what they're reporting, only in wording. These are not translated via lookup —
each language has its own full sentence-construction logic, because word order and grammar
differ enough between English and Gujarati that simple key-substitution inside a template
string would not produce natural sentences.

## Adding a third language

1. Add a new top-level key to `LANG` (e.g. `hi` for Hindi) with all ~95 keys from `en`
   translated — copy the `en` object as a starting template so nothing is missed.
2. Add a language-toggle option (the current toggle is a single button cycling `en ⇄ gu`;
   a third language means switching to a proper selector rather than a toggle).
3. Add a new branch to each of the four generated-sentence functions
   (`buildMachineDiagnosis`, `buildRecommendedFix`, the conclusion logic inside
   `renderSummary`, and the color-note logic inside `renderDetail`).
4. Run the same verification described below before considering it done.

## A real mistake made during this project, worth repeating so it isn't repeated again

Gujarati text was, twice, typed as hand-computed Unicode escape sequences (`\u0A95\u0AAE...`)
from memory rather than as literal characters — both times, this produced text with stray
characters from *other* Indic scripts (Tamil, Gurmukhi) mixed in, because the escape codes
were simply wrong. One instance shipped into a working draft before being caught by actually
reading test output closely, not by trusting the code.

**The fix, and the rule going forward: type the actual characters directly (UTF-8, via a
tool that handles Unicode natively — Python string literals worked reliably here), never
hand-compute or guess `\u` escape sequences for non-Latin scripts.** After the fix, a
whole-file automated scanner was written and run to confirm the fix actually held — checking
every character in the file against the real Gujarati Unicode block (`U+0A80`–`U+0AFF`) plus
an explicit allow-list of shared punctuation, flagging anything from Devanagari, Gurmukhi,
Tamil, Telugu, Kannada, Malayalam, or Bengali ranges. That scanner is cheap to re-run and
should be run again after any future edit to the Gujarati text, rather than trusting a visual
read of the rendered page:

```python
def scan_for_contamination(text):
    other_scripts = {
        'Devanagari': (0x0900,0x097F), 'Gurmukhi': (0x0A00,0x0A7F), 'Tamil': (0x0B80,0x0BFF),
        'Telugu': (0x0C00,0x0C7F), 'Kannada': (0x0C80,0x0CFF), 'Malayalam': (0x0D00,0x0D7F),
        'Bengali': (0x0980,0x09FF),
    }
    return [ch for ch in text for lo,hi in other_scripts.values() if lo <= ord(ch) <= hi]
```

An empty result means clean. This was run against the full file after every subsequent
Gujarati edit for the remainder of the project.
