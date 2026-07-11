# CampingMath

Plan smarter. Pack lighter. Camp better.

CampingMath is a free, static collection of camping and hiking planning calculators —
tent size, sleeping bag temperature rating, campsite fit, campfire wood, cooler ice,
propane, hiking time, and backpack weight. It's part of a small family of practical
planning sites alongside Backyard Math and Split Math.

## Tech

Plain HTML, CSS, and vanilla JavaScript. No framework, no build step, no database,
no accounts, no paid APIs. The whole site is static files that can be served by
any static web host (Netlify, GitHub Pages, `python -m http.server`, etc.).

## Structure

```
index.html               Homepage — hero, categories, all 8 calculator cards, trust section
about.html
privacy-policy.html
terms-of-use.html
disclaimer.html
robots.txt
sitemap.xml

css/
  style.css               Single shared stylesheet: design tokens, layout, components

js/
  shared.js               Site-wide behavior: mobile nav, footer year, 5-star rating widget
  calculators.js          Shared math/unit-conversion/validation/formatting helpers
  calc-tent-size.js        \
  calc-sleeping-bag.js      |
  calc-campsite-size.js     |  One page-specific logic file per calculator —
  calc-campfire-wood.js     |  each wires its own form to CampingMath.calc helpers
  calc-cooler-ice.js        |  and renders its own results.
  calc-propane.js           |
  calc-hiking-time.js       |
  calc-backpack-weight.js  /

calculators/
  tent-size.html
  sleeping-bag.html
  campsite-size.html
  campfire-wood.html
  cooler-ice.html
  propane.html
  hiking-time.html
  backpack-weight.html

images/
  favicon.svg
  og-image.png            Placeholder social-share image — swap before launch
```

A note on structure: the brief called for one `js/calculators.js` file for all
calculator logic, but with eight fairly different calculators, one page-specific
file per calculator (`js/calc-<slug>.js`) turned out easier to maintain and
review than a single multi-thousand-line file. `js/calculators.js` still holds
every *shared* helper (unit conversion, rounding, validation, animated counters,
gauges, clipboard copy) so no calculator reimplements its own math primitives.

Every page also intentionally repeats the header/footer markup rather than
using a JS include — this is a zero-build-step static site, so there's no
template layer to share HTML through. All shared *behavior* (nav toggle,
footer year, star ratings) lives in `js/shared.js`, and all shared *styling*
lives in `css/style.css`, so the only thing that repeats across pages is the
markup skeleton itself.

## Running locally

No install or build step is required. From the project root, run any static
file server, for example:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/` in a browser. Because the site uses
root-relative URLs (`/css/style.css`, `/calculators/tent-size.html`, etc.),
it must be served from the project root — opening `index.html` directly via
`file://` will break those links.

## Calculators & key formulas

Each calculator page explains its own formula in plain language in a "How this
estimate is calculated" section, and the same explanation appears as a code
comment above the main calculation function in its `js/calc-*.js` file. Summary:

- **Tent Size** — sums real sleeping-surface footprints (pad/mattress/cot
  dimensions from the brief), adds pet and gear allowance plus ~15% circulation
  space for sloped walls/poles, then applies a comfort multiplier. Converts
  area to a "person rating equivalent" at ~15 sq ft/person to compare against
  manufacturer capacity claims, and warns when a same-sized manufacturer rating
  would likely feel crowded.
- **Sleeping Bag Temperature** — starts from a 10°F baseline safety buffer below
  the expected overnight low, then adds/subtracts degrees for sleeper type, pad
  R-value deficit, shelter type, clothing, humidity, and wind — all additive and
  shown as an itemized breakdown.
- **Campsite Size** — adds clearance to the tent's dimensions and tests both
  orientations against the pad's actual length/width (not just area), then
  compares total occupied footprint (tent + vehicles + canopy + kitchen,
  depending on layout type) against total site area for a Comfortable/Tight/
  Unlikely verdict.
- **Campfire Wood** — cubic feet driven mainly by fire size × burn duration,
  with modest multipliers for cold, wind, and wood condition, plus flat
  allowances for cooking and nightly kindling. Rounds bundle/piece counts up.
- **Cooler Ice** — a lb-per-gallon-of-capacity-per-day baseline adjusted for
  temperature, cooler quality, starting temperature, opening frequency, shade,
  and contents, split into a larger day-1 initial charge plus smaller daily
  top-ups.
- **Propane** — per-appliance BTU × hours × days × duty cycle, summed and
  converted at 21,600 BTU/lb, with cylinders sized at ~80% (or ~90% for 1 lb
  bottles) of nominal weight to reflect standard fill practice, plus a
  user-set reserve percentage.
- **Hiking Time** — a Naismith-style baseline (distance ÷ pace, plus ~30
  min/1000 ft of gain and a smaller add for loss), then transparent
  multipliers for terrain, pack weight, altitude, and group composition,
  presented as a range.
- **Backpack Weight** — base gear weight + food + water (converted at 2.2
  lb/liter) + fuel + extras, expressed as a percentage of body weight against
  an experience/season/trip-style-adjusted guideline band (explicitly framed
  as a rough guideline, not a universal rule).

All eight follow the same accuracy philosophy: show the logic, label
recommendations separately from exact math, use ranges instead of false
precision, round purchase-style outputs upward, and let users override every
default.

## Testing performed

- Manual pass on every calculator with normal values, then zero, blank,
  negative, decimal, and very large inputs — confirmed no `NaN`, `Infinity`,
  or negative outputs (guarded via `CampingMath.calc.toNumber`/`formatNumber`
  and input clamping).
- Verified unit toggles (°F/°C, mi/km, ft/m, lb/kg, qt/L) convert from a single
  canonical internal value rather than repeatedly reconverting a displayed
  value.
- Checked keyboard navigation and focus states across nav, forms, segmented
  controls, star ratings, and FAQ accordions.
- Confirmed every internal link (nav, footer, related-calculator cards,
  in-body contextual links) resolves to a real page.
- Confirmed the homepage links to all eight calculators and `sitemap.xml`
  lists every public page.
- Loaded the site from a plain static file server with no network requests
  required for any calculator to function.

## Before deploying

- Replace `images/og-image.png` (a generated placeholder) with a designed
  social-share image.
- Register `campingmath.com` (or update canonical/OG URLs if the domain differs)
  and connect the repo to Netlify.
- If analytics is desired, add Google's `gtag.js` snippet to each page's
  `<head>` — the rating widgets already fire a `calculator_rating` event when
  `gtag` is present, and degrade silently when it isn't.
