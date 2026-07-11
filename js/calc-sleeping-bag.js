/*!
 * Camp Math — calc-sleeping-bag.js
 * Sleeping Bag Temperature Rating Calculator.
 * All math is done internally in Fahrenheit. The unit toggle only converts
 * what is displayed/typed — the canonical value stored in `state.lowF` is
 * always Fahrenheit, so toggling F/C back and forth never drifts or
 * silently corrupts the number the calculator actually uses.
 */
(function () {
  "use strict";

  var calc = window.CampMath && window.CampMath.calc;
  if (!calc) return;

  var DEFAULTS = {
    lowF: 35,
    unit: "F",
    sleeper: "average",
    padR: 4,
    shelter: "enclosed_tent",
    clothing: "warm_base_layer",
    humidity: "dry",
    wind: "sheltered"
  };

  var state = {};
  var els = {};

  /* ---------- Label maps for the "what changed your result" breakdown ---------- */
  var SLEEPER_LABELS = { runs_warm: "Warm sleeper", runs_cold: "Cold sleeper" };
  var SHELTER_LABELS = {
    hammock_underquilt: "Hammock with underquilt",
    hammock_no_underquilt: "Hammock without underquilt",
    vehicle: "Sleeping in a vehicle",
    open_shelter: "Open shelter (no walls)"
  };
  var CLOTHING_LABELS = { light_base_layer: "Light base layer while sleeping", insulated_layers: "Insulated layers while sleeping" };
  var HUMIDITY_LABELS = { moderate: "Moderate humidity", damp: "Damp conditions" };
  var WIND_LABELS = { moderate: "Moderate wind exposure", exposed: "Exposed to wind" };

  /* ---------- Degree-delta unit conversion ----------
   * fToC/cToF on CampMath.calc.convert are for ABSOLUTE temperatures (they
   * include the 32-degree offset). Buffer amounts are DIFFERENCES in
   * temperature, so converting them must only scale by 5/9 — applying the
   * absolute converter to a delta would introduce a bogus 32-degree shift.
   */
  function deltaFtoDisplay(deltaF, unit) {
    return unit === "C" ? deltaF * (5 / 9) : deltaF;
  }

  function displayValueFor(lowF, unit) {
    return unit === "C" ? calc.convert.fToC(lowF) : lowF;
  }

  function unitSuffix(unit) {
    return unit === "C" ? "°C" : "°F";
  }

  function minMaxForUnit(unit) {
    // -60F to 120F is a generous real-world range for overnight camping lows.
    return unit === "C"
      ? { min: calc.convert.fToC(-60), max: calc.convert.fToC(120) }
      : { min: -60, max: 120 };
  }

  /* =====================================================================
   * Core formula (all math in Fahrenheit — see AGENT_BRIEF-supplied spec):
   *
   * buffer = 10                                          // baseline safety margin
   * buffer += { runs_warm: -5, average: 0, runs_cold: 10 }[sleeperType]
   * requiredR = expectedLowF >= 32 ? 1.5 : expectedLowF >= 15 ? 3.5
   *           : expectedLowF >= 0 ? 5 : 6.5
   * rDeficit = max(0, requiredR - padRValue)
   * buffer += min(15, rDeficit * 3)
   * buffer += { enclosed_tent: 0, hammock_underquilt: 2,
   *             hammock_no_underquilt: 15, vehicle: -3, open_shelter: 8 }[shelterType]
   * buffer += { light_base_layer: 5, warm_base_layer: 0, insulated_layers: -5 }[clothing]
   * buffer += { dry: 0, moderate: 3, damp: 7 }[humidity]
   * buffer += { sheltered: 0, moderate: 3, exposed: 8 }[wind]
   * buffer = clamp(buffer, 0, 45)
   * recommendedComfortRatingF = expectedLowF - buffer
   * safetyBufferRangeF = [recommendedComfortRatingF - 5, recommendedComfortRatingF]
   * padAdequate = rDeficit <= 0.5
   * ===================================================================== */
  function calculateResult(inputs) {
    var lowF = inputs.lowF;
    var components = [];

    var buffer = 10;
    components.push({ key: "baseline", label: "Baseline safety margin (bag rated colder than the low)", value: 10 });

    var sleeperAdj = { runs_warm: -5, average: 0, runs_cold: 10 }[inputs.sleeper] || 0;
    buffer += sleeperAdj;
    if (sleeperAdj !== 0) components.push({ key: "sleeper", label: SLEEPER_LABELS[inputs.sleeper], value: sleeperAdj });

    var requiredR = lowF >= 32 ? 1.5 : lowF >= 15 ? 3.5 : lowF >= 0 ? 5 : 6.5;
    var rDeficit = Math.max(0, requiredR - inputs.padR);
    var padBufferAdj = Math.min(15, rDeficit * 3);
    buffer += padBufferAdj;
    if (padBufferAdj > 0) {
      components.push({
        key: "pad",
        label: "Pad R-value below the R-" + calc.formatNumber(requiredR, requiredR % 1 ? 1 : 0) + " recommended for this low",
        value: padBufferAdj
      });
    }

    var shelterAdj = { enclosed_tent: 0, hammock_underquilt: 2, hammock_no_underquilt: 15, vehicle: -3, open_shelter: 8 }[inputs.shelter] || 0;
    buffer += shelterAdj;
    if (shelterAdj !== 0) components.push({ key: "shelter", label: SHELTER_LABELS[inputs.shelter], value: shelterAdj });

    var clothingAdj = { light_base_layer: 5, warm_base_layer: 0, insulated_layers: -5 }[inputs.clothing] || 0;
    buffer += clothingAdj;
    if (clothingAdj !== 0) components.push({ key: "clothing", label: CLOTHING_LABELS[inputs.clothing], value: clothingAdj });

    var humidityAdj = { dry: 0, moderate: 3, damp: 7 }[inputs.humidity] || 0;
    buffer += humidityAdj;
    if (humidityAdj !== 0) components.push({ key: "humidity", label: HUMIDITY_LABELS[inputs.humidity], value: humidityAdj });

    var windAdj = { sheltered: 0, moderate: 3, exposed: 8 }[inputs.wind] || 0;
    buffer += windAdj;
    if (windAdj !== 0) components.push({ key: "wind", label: WIND_LABELS[inputs.wind], value: windAdj });

    buffer = calc.clamp(buffer, 0, 45);

    var recommendedF = lowF - buffer;
    var rangeF = [recommendedF - 5, recommendedF];
    var padAdequate = rDeficit <= 0.5;

    return {
      buffer: buffer,
      components: components,
      recommendedF: recommendedF,
      rangeF: rangeF,
      requiredR: requiredR,
      rDeficit: rDeficit,
      padAdequate: padAdequate
    };
  }

  /* ---------- DOM wiring ---------- */
  function cacheEls() {
    els.lowInput = document.getElementById("expected-low");
    els.unitToggle = document.getElementById("unit-toggle");
    els.sleeperSeg = document.getElementById("sleeper-segmented");
    els.padInput = document.getElementById("pad-rvalue");
    els.shelterSelect = document.getElementById("shelter-type");
    els.clothingSeg = document.getElementById("clothing-segmented");
    els.humiditySeg = document.getElementById("humidity-segmented");
    els.windSeg = document.getElementById("wind-segmented");
    els.resetBtn = document.getElementById("reset-btn");
    els.copyBtn = document.getElementById("copy-btn");

    els.lowUnitLabel = document.getElementById("low-unit-label");
    els.resultLow = document.getElementById("result-low");
    els.resultHigh = document.getElementById("result-high");
    els.resultUnit = document.getElementById("result-unit");
    els.cardExpectedLow = document.getElementById("card-expected-low");
    els.cardBuffer = document.getElementById("card-buffer");
    els.cardPadAdequacy = document.getElementById("card-pad-adequacy");
    els.breakdownList = document.getElementById("breakdown-list");
    els.gaugeFill = document.getElementById("buffer-gauge-fill");
    els.gaugeTrack = document.getElementById("buffer-gauge-track");
    els.padCallout = document.getElementById("pad-callout");
  }

  function resetState() {
    state.lowF = DEFAULTS.lowF;
    state.unit = DEFAULTS.unit;
    state.sleeper = DEFAULTS.sleeper;
    state.padR = DEFAULTS.padR;
    state.shelter = DEFAULTS.shelter;
    state.clothing = DEFAULTS.clothing;
    state.humidity = DEFAULTS.humidity;
    state.wind = DEFAULTS.wind;
  }

  function setSegmentedSelected(container, value) {
    if (!container) return;
    var buttons = container.querySelectorAll("button");
    buttons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-value") === value ? "true" : "false");
    });
  }

  function syncFieldsFromState() {
    els.lowInput.value = calc.round(displayValueFor(state.lowF, state.unit), 0);
    els.padInput.value = state.padR;
    els.shelterSelect.value = state.shelter;
    setSegmentedSelected(els.unitToggle, state.unit);
    setSegmentedSelected(els.sleeperSeg, state.sleeper);
    setSegmentedSelected(els.clothingSeg, state.clothing);
    setSegmentedSelected(els.humiditySeg, state.humidity);
    setSegmentedSelected(els.windSeg, state.wind);
    if (els.lowUnitLabel) els.lowUnitLabel.textContent = unitSuffix(state.unit);
    var mm = minMaxForUnit(state.unit);
    els.lowInput.min = calc.round(mm.min, 0);
    els.lowInput.max = calc.round(mm.max, 0);
  }

  function handleUnitToggle(newUnit) {
    if (!newUnit || newUnit === state.unit) return;
    // Convert the value currently shown in the field (not a stale internal
    // copy) so a single toggle click performs exactly one conversion.
    var mm = minMaxForUnit(state.unit);
    var shownValue = calc.toNumber(els.lowInput.value, displayValueFor(state.lowF, state.unit));
    shownValue = calc.clamp(shownValue, mm.min, mm.max);
    state.lowF = state.unit === "C" ? calc.convert.cToF(shownValue) : shownValue;
    state.unit = newUnit;
    syncFieldsFromState();
    render();
  }

  function handleLowInput() {
    var mm = minMaxForUnit(state.unit);
    var result = calc.validateField(els.lowInput, {
      required: true,
      allowNegative: true,
      min: mm.min,
      max: mm.max,
      fallback: displayValueFor(DEFAULTS.lowF, state.unit)
    });
    state.lowF = state.unit === "C" ? calc.convert.cToF(result.value) : result.value;
    render();
  }

  function handlePadInput() {
    var result = calc.validateField(els.padInput, {
      required: true,
      allowNegative: false,
      min: 0,
      max: 12,
      fallback: DEFAULTS.padR
    });
    state.padR = result.value;
    render();
  }

  function wireEvents() {
    var debouncedLow = calc.debounce(handleLowInput, 200);
    var debouncedPad = calc.debounce(handlePadInput, 200);

    els.lowInput.addEventListener("input", debouncedLow);
    els.lowInput.addEventListener("blur", handleLowInput);
    els.padInput.addEventListener("input", debouncedPad);
    els.padInput.addEventListener("blur", handlePadInput);

    els.shelterSelect.addEventListener("change", function () {
      state.shelter = els.shelterSelect.value;
      render();
    });

    calc.wireSegmented(els.unitToggle, function (value) { handleUnitToggle(value); });
    calc.wireSegmented(els.sleeperSeg, function (value) { state.sleeper = value; render(); });
    calc.wireSegmented(els.clothingSeg, function (value) { state.clothing = value; render(); });
    calc.wireSegmented(els.humiditySeg, function (value) { state.humidity = value; render(); });
    calc.wireSegmented(els.windSeg, function (value) { state.wind = value; render(); });

    els.resetBtn.addEventListener("click", function () {
      resetState();
      syncFieldsFromState();
      // Clear any lingering validation error states.
      document.querySelectorAll(".field.invalid").forEach(function (f) { f.classList.remove("invalid"); });
      render();
    });

    els.copyBtn.addEventListener("click", function () {
      var result = calculateResult(state);
      var unit = unitSuffix(state.unit);
      var text =
        "Recommended sleeping bag comfort rating: " +
        calc.formatRange(
          calc.round(displayValueFor(result.rangeF[0], state.unit), 0),
          calc.round(displayValueFor(result.rangeF[1], state.unit), 0),
          0
        ) +
        unit +
        " (based on a " + calc.round(displayValueFor(state.lowF, state.unit), 0) + unit + " overnight low). " +
        "This targets the comfort rating, not the lower-limit or extreme rating. — Camp Math";
      calc.copyResult(text);
    });
  }

  /* ---------- Render ---------- */
  function render() {
    var result = calculateResult(state);
    var unit = unitSuffix(state.unit);

    var lowDisplay = displayValueFor(state.lowF, state.unit);
    var rangeLowDisplay = displayValueFor(result.rangeF[0], state.unit);
    var rangeHighDisplay = displayValueFor(result.rangeF[1], state.unit);
    var bufferDisplay = deltaFtoDisplay(result.buffer, state.unit);

    if (els.resultUnit) els.resultUnit.textContent = unit;
    calc.animateValue(els.resultLow, calc.round(rangeLowDisplay, 0), { decimals: 0 });
    calc.animateValue(els.resultHigh, calc.round(rangeHighDisplay, 0), { decimals: 0 });

    if (els.cardExpectedLow) els.cardExpectedLow.textContent = calc.formatNumber(calc.round(lowDisplay, 0), 0) + unit;
    if (els.cardBuffer) els.cardBuffer.textContent = calc.formatNumber(calc.round(bufferDisplay, 0), 0) + unit;
    if (els.cardPadAdequacy) {
      els.cardPadAdequacy.textContent = result.padAdequate ? "Adequate" : "May be insufficient";
      els.cardPadAdequacy.style.color = result.padAdequate ? "var(--success)" : "var(--danger)";
    }

    if (els.gaugeFill) {
      calc.setGauge(els.gaugeFill, (result.buffer / 45) * 100, 60);
    }

    if (els.breakdownList) {
      els.breakdownList.innerHTML = "";
      result.components.forEach(function (comp) {
        var li = document.createElement("li");
        var sign = comp.value > 0 ? "+" : "";
        var compDisplay = deltaFtoDisplay(comp.value, state.unit);
        li.textContent = comp.label + ": " + sign + calc.formatNumber(calc.round(compDisplay, 0), 0) + unit + " buffer";
        els.breakdownList.appendChild(li);
      });
    }

    if (els.padCallout) {
      els.padCallout.hidden = result.padAdequate;
    }
  }

  function init() {
    cacheEls();
    resetState();
    syncFieldsFromState();
    wireEvents();
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
