/*!
 * CampingMath — calc-cooler-ice.js
 * Page-specific logic for the Cooler Ice Calculator.
 * Depends on window.CampingMath.calc (js/calculators.js) — loaded before this file.
 */
(function () {
  "use strict";

  var calc = window.CampingMath && window.CampingMath.calc;
  if (!calc) return;

  var SLUG = "cooler-ice";

  var DEFAULTS = {
    days: 3,
    capacityQt: 48,
    unit: "qt",
    tempF: 80,
    coolerType: "mid_range",
    purpose: "mixed",
    startingTemp: "pre_chilled",
    openingFrequency: "moderate",
    shade: "mixed",
    iceType: "combination",
    secondCooler: false
  };

  /* Mutable canonical state for the unit-toggling capacity field.
     Capacity is always stored here in quarts; the input only ever shows a
     converted-for-display value so repeated toggling never compounds. */
  var state = {
    unit: DEFAULTS.unit,
    capacityQt: DEFAULTS.capacityQt
  };

  var els = {};

  function q(sel) { return document.querySelector(sel); }

  function cacheEls() {
    els.form = q("[data-cooler-ice-form]");
    els.days = q("#days");
    els.capacity = q("#capacity");
    els.unitToggle = q("[data-unit-toggle]");
    els.tempF = q("#tempF");
    els.coolerType = q("[data-segmented='coolerType']");
    els.purpose = q("[data-segmented='purpose']");
    els.startingTemp = q("[data-segmented='startingTemp']");
    els.openingFrequency = q("[data-segmented='openingFrequency']");
    els.shade = q("[data-segmented='shade']");
    els.iceType = q("#iceType");
    els.secondCooler = q("#secondCooler");

    els.primaryValue = q("[data-primary-value]");
    els.resultSub = q("[data-result-sub]");
    els.initialFill = q("[data-initial-fill]");
    els.dailyReplenish = q("[data-daily-replenish]");
    els.iceMixTitle = q("[data-ice-mix-title]");
    els.iceMixValue = q("[data-ice-mix-value]");
    els.gaugeFill = q("[data-gauge-fill]");
    els.gaugeTrack = q("[data-gauge-track]");
    els.electricCallout = q("[data-electric-callout]");
    els.resultPrimary = q("[data-result-primary]");
    els.secondCoolerNote = q("[data-second-cooler-note]");
    els.foodSplit = q("[data-food-split]");
    els.drinksSplit = q("[data-drinks-split]");
    els.packingAdvice = q("[data-packing-advice]");

    els.resetBtn = q("[data-reset-btn]");
    els.copyBtn = q("[data-copy-btn]");
  }

  /* ---------- Capacity display helpers (unit toggle, no compounding) ---------- */
  function capacityBounds() {
    // ~1 to ~400 quarts covers everything from a lunchbox cooler to a giant rotomolded box.
    return state.unit === "qt"
      ? { min: 1, max: 400 }
      : { min: 1, max: calc.round(calc.convert.qtToL(400), 0) };
  }

  function renderCapacityDisplay() {
    var displayValue = state.unit === "qt" ? state.capacityQt : calc.convert.qtToL(state.capacityQt);
    els.capacity.value = calc.round(displayValue, state.unit === "qt" ? 0 : 1);
  }

  function readCapacityFromInput() {
    var bounds = capacityBounds();
    var result = calc.validateField(els.capacity, {
      required: true,
      min: bounds.min,
      max: bounds.max,
      fallback: state.unit === "qt" ? DEFAULTS.capacityQt : calc.round(calc.convert.qtToL(DEFAULTS.capacityQt), 1)
    });
    state.capacityQt = state.unit === "qt" ? result.value : calc.convert.lToQt(result.value);
  }

  /* ---------- Main calculation ----------
   * Baseline ~2 lb of ice per gallon of cooler space per day (basic cooler, moderate
   * temperature, moderate opening), scaled by outdoor temperature, cooler quality,
   * starting temperature of contents, how often the lid opens, sun/shade exposure,
   * and what's inside; day 1 gets a bigger initial charge to chill contents down,
   * and each following day needs less since a well-packed cooler retains cold.
   */
  function calculateIce(inputs) {
    var capacityGallons = inputs.capacityQt / 4;
    var dailyBaseLb = capacityGallons * 2.0;

    var tempFactor = inputs.tempF < 60 ? 0.7 : inputs.tempF <= 75 ? 1.0 : inputs.tempF <= 90 ? 1.3 : 1.6;
    var typeFactor = { basic: 1.15, mid_range: 1.0, high_performance: 0.6, electric: 0.1 }[inputs.coolerType];
    var startFactor = { pre_chilled: 0.85, some_chilled: 1.0, room_temp: 1.3 }[inputs.startingTemp];
    var openFactor = { rare: 0.85, moderate: 1.0, frequent: 1.25 }[inputs.openingFrequency];
    var shadeFactor = { shaded: 0.85, mixed: 1.0, sun: 1.25 }[inputs.shade];
    var purposeFactor = { food_only: 1.05, drinks_only: 0.9, mixed: 1.0 }[inputs.purpose];

    var dailyAdjustedLb = dailyBaseLb * tempFactor * typeFactor * startFactor * openFactor * shadeFactor * purposeFactor;

    var initialFillLb = dailyAdjustedLb * 1.3;
    var dailyReplenishLb = dailyAdjustedLb * 0.8;

    var days = inputs.days;
    var recommendedIceLbRaw = days <= 1 ? initialFillLb : initialFillLb + dailyReplenishLb * (days - 1);
    var recommendedIceLb = Math.ceil(Math.max(0, recommendedIceLbRaw));

    var initialRatioPercent = calc.clamp(
      Math.round((initialFillLb / (inputs.capacityQt * 1.04)) * 100),
      0,
      100
    );

    return {
      initialFillLb: Math.ceil(Math.max(0, initialFillLb)),
      dailyReplenishLb: Math.ceil(Math.max(0, dailyReplenishLb)),
      recommendedIceLb: recommendedIceLb,
      initialRatioPercent: Number.isFinite(initialRatioPercent) ? initialRatioPercent : 0
    };
  }

  function iceMix(iceType) {
    switch (iceType) {
      case "block":
        return {
          title: "Block ice",
          text: "Block ice melts slowest and lasts the longest, but cools slower at first. Add a small bag of cubes on top for a faster initial chill."
        };
      case "cubed":
        return {
          title: "Cubed ice",
          text: "Cubed ice cools quickly and packs into gaps well, but melts faster than block ice — good for shorter trips or when you'll open the lid often."
        };
      case "bottles":
        return {
          title: "Frozen water bottles",
          text: "Great as a food-safe supplement — they cool contents and become drinking water as they melt. Pair with bagged ice for the bulk of the cooling since bottles leave air gaps."
        };
      case "combination":
      default:
        return {
          title: "Block + cubed combination",
          text: "Layer roughly 60% block ice on the bottom for long-lasting cold, and 40% cubed or combination ice on top for a fast initial chill."
        };
    }
  }

  function packingAdvice(purpose) {
    var base = "Pack dense, already-cold items on the bottom near the ice and keep the lid closed as much as possible — every opening lets cold air spill out. ";
    if (purpose === "drinks_only") {
      base += "Since this cooler is drinks-only, it's fine to drain melted water periodically to make room for more ice and keep cans/bottles colder.";
    } else {
      base += "If food stays sealed and off the cooler floor, leaving melted ice water in place can actually help keep things cold longer — just drain it if it starts pooling above sealed containers or you're worried about cross-contact with food packaging.";
    }
    return base;
  }

  function render() {
    var days = calc.validateField(els.days, { required: true, min: 1, max: 60, fallback: DEFAULTS.days }).value;
    readCapacityFromInput();
    var tempF = calc.validateField(els.tempF, { required: true, min: -20, max: 130, allowNegative: true, fallback: DEFAULTS.tempF }).value;

    var coolerType = calc.getSegmentedValue(els.coolerType) || DEFAULTS.coolerType;
    var purpose = calc.getSegmentedValue(els.purpose) || DEFAULTS.purpose;
    var startingTemp = calc.getSegmentedValue(els.startingTemp) || DEFAULTS.startingTemp;
    var openingFrequency = calc.getSegmentedValue(els.openingFrequency) || DEFAULTS.openingFrequency;
    var shade = calc.getSegmentedValue(els.shade) || DEFAULTS.shade;
    var iceType = els.iceType.value || DEFAULTS.iceType;
    var secondCooler = !!(els.secondCooler && els.secondCooler.checked);

    var result = calculateIce({
      days: days,
      capacityQt: state.capacityQt,
      tempF: tempF,
      coolerType: coolerType,
      purpose: purpose,
      startingTemp: startingTemp,
      openingFrequency: openingFrequency,
      shade: shade
    });

    calc.animateValue(els.primaryValue, result.recommendedIceLb, { decimals: 0, suffix: "" });

    var dayWord = days <= 1 ? "day" : "days";
    els.resultSub.textContent = days <= 1
      ? "All of it is the initial fill to chill your cooler down for a " + calc.formatNumber(days, 0) + "-" + dayWord + " trip."
      : calc.formatNumber(result.initialFillLb, 0) + " lb to chill things down, plus " + calc.formatNumber(result.dailyReplenishLb, 0) + " lb/day to top off over " + calc.formatNumber(days - 1, 0) + " more " + (days - 1 === 1 ? "day" : "days") + ".";

    els.initialFill.textContent = calc.formatNumber(result.initialFillLb, 0) + " lb";
    els.dailyReplenish.textContent = calc.formatNumber(result.dailyReplenishLb, 0) + " lb/day";

    var mix = iceMix(iceType);
    els.iceMixTitle.textContent = mix.title;
    els.iceMixValue.textContent = mix.text;

    calc.setGauge(els.gaugeFill, result.initialRatioPercent, 100);

    var isElectric = coolerType === "electric";
    els.electricCallout.hidden = !isElectric;
    els.resultPrimary.classList.toggle("is-electric", isElectric);

    if (secondCooler) {
      els.secondCoolerNote.hidden = false;
      els.foodSplit.textContent = calc.formatNumber(Math.ceil(result.recommendedIceLb * 0.6), 0);
      els.drinksSplit.textContent = calc.formatNumber(Math.ceil(result.recommendedIceLb * 0.4), 0);
    } else {
      els.secondCoolerNote.hidden = true;
    }

    els.packingAdvice.textContent = packingAdvice(purpose);
  }

  function resetToDefaults() {
    els.days.value = DEFAULTS.days;
    state.unit = DEFAULTS.unit;
    state.capacityQt = DEFAULTS.capacityQt;
    renderCapacityDisplay();
    setSegmented(els.unitToggle, DEFAULTS.unit);
    els.tempF.value = DEFAULTS.tempF;
    setSegmented(els.coolerType, DEFAULTS.coolerType);
    setSegmented(els.purpose, DEFAULTS.purpose);
    setSegmented(els.startingTemp, DEFAULTS.startingTemp);
    setSegmented(els.openingFrequency, DEFAULTS.openingFrequency);
    setSegmented(els.shade, DEFAULTS.shade);
    els.iceType.value = DEFAULTS.iceType;
    els.secondCooler.checked = DEFAULTS.secondCooler;

    [els.days, els.capacity, els.tempF].forEach(function (input) {
      var wrap = input.closest(".field");
      if (wrap) wrap.classList.remove("invalid");
    });

    render();
  }

  function setSegmented(container, value) {
    if (!container) return;
    var buttons = Array.prototype.slice.call(container.querySelectorAll("button"));
    buttons.forEach(function (btn) {
      var isMatch = btn.getAttribute("data-value") === value;
      btn.setAttribute("aria-pressed", isMatch ? "true" : "false");
    });
  }

  function copyResultText() {
    var days = calc.toNumber(els.days.value, DEFAULTS.days);
    var text = "Cooler Ice Calculator: about " + els.primaryValue.textContent + " lb of ice for a " +
      calc.formatNumber(days, 0) + "-day trip (" + els.initialFill.textContent + " initial fill + " +
      els.dailyReplenish.textContent + " to top off).";
    calc.copyResult(text);
  }

  function wireEvents() {
    var debouncedRender = calc.debounce(render, 200);

    [els.days, els.tempF].forEach(function (input) {
      input.addEventListener("input", debouncedRender);
      input.addEventListener("change", render);
    });

    els.capacity.addEventListener("input", debouncedRender);
    els.capacity.addEventListener("change", render);

    calc.wireSegmented(els.unitToggle, function (value) {
      if (value === state.unit) return;
      // Read whatever is currently typed into the canonical unit BEFORE switching,
      // then flip the display unit and re-render from the canonical quarts value —
      // this is what prevents qt -> L -> qt round-trips from drifting.
      readCapacityFromInput();
      state.unit = value;
      renderCapacityDisplay();
      render();
    });

    calc.wireSegmented(els.coolerType, render);
    calc.wireSegmented(els.purpose, render);
    calc.wireSegmented(els.startingTemp, render);
    calc.wireSegmented(els.openingFrequency, render);
    calc.wireSegmented(els.shade, render);

    els.iceType.addEventListener("change", render);
    els.secondCooler.addEventListener("change", render);

    els.resetBtn.addEventListener("click", resetToDefaults);
    els.copyBtn.addEventListener("click", copyResultText);
  }

  document.addEventListener("DOMContentLoaded", function () {
    cacheEls();
    if (!els.form) return;
    renderCapacityDisplay();
    wireEvents();
    render();
  });
})();
