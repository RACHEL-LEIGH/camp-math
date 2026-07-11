/*!
 * CampingMath — calc-campfire-wood.js
 * Page-specific logic for the Campfire Wood Calculator.
 */
(function () {
  "use strict";

  var calc = window.CampingMath && window.CampingMath.calc;
  if (!calc) return;

  var form = document.getElementById("campfire-form");
  var nightsInput = document.getElementById("nights");
  var hoursInput = document.getElementById("hours");
  var tempInput = document.getElementById("temp");
  var bundleSizeInput = document.getElementById("bundle-size");
  var bundlePriceInput = document.getElementById("bundle-price");
  var cookingCheckbox = document.getElementById("cooking-fire");

  var fireSizeGroup = form.querySelector('[data-segmented="fireSize"]');
  var windGroup = form.querySelector('[data-segmented="wind"]');
  var woodGroup = form.querySelector('[data-segmented="woodCondition"]');

  var DEFAULTS = {
    nights: 2,
    hours: 3,
    fireSize: "medium",
    temp: 55,
    wind: "calm",
    woodCondition: "seasoned",
    bundleSize: 0.75,
    bundlePrice: 7,
    cookingFire: false
  };

  var resultEls = {
    bundles: document.querySelector('[data-result="bundles"]'),
    costSub: document.querySelector('[data-result="cost-sub"]'),
    cuft: document.querySelector('[data-result="cuft"]'),
    cost: document.querySelector('[data-result="cost"]'),
    pieces: document.querySelector('[data-result="pieces"]'),
    nightsEcho: document.querySelector('[data-result="nights-echo"]'),
    baseCuft: document.querySelector('[data-result="base-cuft"]'),
    adjCuft: document.querySelector('[data-result="adj-cuft"]'),
    adjustmentNote: document.querySelector('[data-result="adjustment-note"]')
  };
  var gaugeFill = document.querySelector('[data-gauge-fill]');

  calc.wireSegmented(fireSizeGroup, function () { compute(); });
  calc.wireSegmented(windGroup, function () { compute(); });
  calc.wireSegmented(woodGroup, function () { compute(); });

  var SIZE_RATES = { small: 0.5, medium: 1.0, large: 1.75 };
  var WIND_FACTORS = { calm: 1.0, breezy: 1.1, windy: 1.2 };
  var WOOD_FACTORS = { seasoned: 1.0, slightly_damp: 1.25, poorly_seasoned: 1.5 };
  var AVG_PIECE_VOLUME_CUFT = 0.04; // typical split log piece, roughly a 16" split; configurable in principle

  function tempFactorFor(tempF) {
    if (tempF < 32) return 1.25;
    if (tempF < 50) return 1.10;
    if (tempF <= 70) return 1.00;
    return 0.90;
  }

  /*
   * Base consumption depends mainly on burn time and fire size; temperature, wind, and
   * wood condition are then applied as modest multiplicative adjustments on top of that
   * base, plus flat allowances for kindling/relighting and optional cooking use.
   */
  function calculate(inputs) {
    var sizeRate = SIZE_RATES[inputs.fireSize] !== undefined ? SIZE_RATES[inputs.fireSize] : SIZE_RATES.medium;
    var baseCuFt = sizeRate * inputs.hours * inputs.nights;

    var tempFactor = tempFactorFor(inputs.temp);
    var windFactor = WIND_FACTORS[inputs.wind] !== undefined ? WIND_FACTORS[inputs.wind] : WIND_FACTORS.calm;
    var woodFactor = WOOD_FACTORS[inputs.woodCondition] !== undefined ? WOOD_FACTORS[inputs.woodCondition] : WOOD_FACTORS.seasoned;

    var cookingAddition = inputs.cookingFire ? 0.4 * inputs.nights : 0;
    var kindlingAddition = 0.15 * inputs.nights;

    var baseEstimateCuFt = baseCuFt + cookingAddition + kindlingAddition;
    var weatherAdjustedCuFt = baseCuFt * tempFactor * windFactor * woodFactor + cookingAddition + kindlingAddition;

    var bundleSize = inputs.bundleSize > 0 ? inputs.bundleSize : DEFAULTS.bundleSize;
    // CampingMath.calc.roundUpTo rounds up to a cu-ft multiple of bundleSize; divide back down for a bundle count.
    var bundles = weatherAdjustedCuFt > 0 ? calc.roundUpTo(weatherAdjustedCuFt, bundleSize) / bundleSize : 0;

    var cost = bundles * inputs.bundlePrice;
    var pieces = weatherAdjustedCuFt > 0 ? Math.ceil(weatherAdjustedCuFt / AVG_PIECE_VOLUME_CUFT) : 0;

    return {
      baseEstimateCuFt: baseEstimateCuFt,
      weatherAdjustedCuFt: weatherAdjustedCuFt,
      bundles: bundles,
      cost: cost,
      pieces: pieces,
      tempFactor: tempFactor,
      windFactor: windFactor,
      woodFactor: woodFactor
    };
  }

  function readInputs() {
    var nightsResult = calc.validateField(nightsInput, { required: true, min: 0, max: 60, fallback: DEFAULTS.nights });
    var hoursResult = calc.validateField(hoursInput, { required: true, min: 0, max: 24, fallback: DEFAULTS.hours });
    var tempResult = calc.validateField(tempInput, { allowNegative: true, min: -40, max: 130, fallback: DEFAULTS.temp });
    var bundleSizeResult = calc.validateField(bundleSizeInput, { required: true, min: 0.1, max: 50, fallback: DEFAULTS.bundleSize });
    var bundlePriceResult = calc.validateField(bundlePriceInput, { required: true, min: 0, max: 1000, fallback: DEFAULTS.bundlePrice });

    var fireSize = calc.getSegmentedValue(fireSizeGroup) || DEFAULTS.fireSize;
    var wind = calc.getSegmentedValue(windGroup) || DEFAULTS.wind;
    var woodCondition = calc.getSegmentedValue(woodGroup) || DEFAULTS.woodCondition;

    return {
      nights: nightsResult.value,
      hours: hoursResult.value,
      temp: tempResult.value,
      bundleSize: bundleSizeResult.value > 0 ? bundleSizeResult.value : DEFAULTS.bundleSize,
      bundlePrice: bundlePriceResult.value,
      fireSize: fireSize,
      wind: wind,
      woodCondition: woodCondition,
      cookingFire: !!(cookingCheckbox && cookingCheckbox.checked)
    };
  }

  function describeAdjustment(result) {
    var parts = [];
    if (result.tempFactor > 1) parts.push("colder temps add " + Math.round((result.tempFactor - 1) * 100) + "%");
    else if (result.tempFactor < 1) parts.push("mild temps trim " + Math.round((1 - result.tempFactor) * 100) + "%");
    if (result.windFactor > 1) parts.push("wind adds " + Math.round((result.windFactor - 1) * 100) + "%");
    if (result.woodFactor > 1) parts.push("wood condition adds " + Math.round((result.woodFactor - 1) * 100) + "%");

    if (parts.length === 0) {
      return "No weather or wood-condition adjustment applied — mild temperature, calm wind, seasoned wood.";
    }
    return "Adjusted for: " + parts.join(", ") + ".";
  }

  function compute() {
    var inputs = readInputs();
    var result = calculate(inputs);

    var safeBundles = Number.isFinite(result.bundles) && result.bundles > 0 ? result.bundles : 0;
    var safeCost = Number.isFinite(result.cost) && result.cost > 0 ? result.cost : 0;
    var safePieces = Number.isFinite(result.pieces) && result.pieces > 0 ? result.pieces : 0;
    var safeCuFt = Number.isFinite(result.weatherAdjustedCuFt) && result.weatherAdjustedCuFt > 0 ? result.weatherAdjustedCuFt : 0;
    var safeBaseCuFt = Number.isFinite(result.baseEstimateCuFt) && result.baseEstimateCuFt > 0 ? result.baseEstimateCuFt : 0;

    if (resultEls.bundles) calc.animateValue(resultEls.bundles, safeBundles, { decimals: 0 });
    if (resultEls.costSub) resultEls.costSub.textContent = "Estimated cost: $" + calc.formatNumber(safeCost, 2);
    if (resultEls.cuft) resultEls.cuft.textContent = calc.formatNumber(safeCuFt, 1);
    if (resultEls.cost) resultEls.cost.textContent = "$" + calc.formatNumber(safeCost, 2);
    if (resultEls.pieces) resultEls.pieces.textContent = calc.formatNumber(safePieces, 0);
    if (resultEls.nightsEcho) resultEls.nightsEcho.textContent = calc.formatNumber(inputs.nights, 0);
    if (resultEls.baseCuft) resultEls.baseCuft.textContent = calc.formatNumber(safeBaseCuFt, 1) + " cu ft";
    if (resultEls.adjCuft) resultEls.adjCuft.textContent = calc.formatNumber(safeCuFt, 1) + " cu ft";
    if (resultEls.adjustmentNote) resultEls.adjustmentNote.textContent = describeAdjustment(result);

    if (gaugeFill) {
      // Scale gauge against a "heavy" reference of 20 cu ft (roughly a large fire, several nights).
      var pct = calc.clamp((safeCuFt / 20) * 100, 0, 100);
      calc.setGauge(gaugeFill, pct, 80);
    }

    form.setAttribute("data-last-bundles", String(safeBundles));
    form.setAttribute("data-last-cost", String(safeCost));
    form.setAttribute("data-last-cuft", String(safeCuFt));
    form.setAttribute("data-last-pieces", String(safePieces));
  }

  var debouncedCompute = calc.debounce(compute, 150);

  [nightsInput, hoursInput, tempInput, bundleSizeInput, bundlePriceInput].forEach(function (input) {
    if (!input) return;
    input.addEventListener("input", debouncedCompute);
    input.addEventListener("change", compute);
  });
  if (cookingCheckbox) cookingCheckbox.addEventListener("change", compute);

  var resetBtn = document.querySelector('[data-action="reset"]');
  var copyBtn = document.querySelector('[data-action="copy"]');

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      nightsInput.value = DEFAULTS.nights;
      hoursInput.value = DEFAULTS.hours;
      tempInput.value = DEFAULTS.temp;
      bundleSizeInput.value = DEFAULTS.bundleSize;
      bundlePriceInput.value = DEFAULTS.bundlePrice;
      if (cookingCheckbox) cookingCheckbox.checked = DEFAULTS.cookingFire;

      setSegmentedDefault(fireSizeGroup, DEFAULTS.fireSize);
      setSegmentedDefault(windGroup, DEFAULTS.wind);
      setSegmentedDefault(woodGroup, DEFAULTS.woodCondition);

      document.querySelectorAll(".field.invalid").forEach(function (field) {
        field.classList.remove("invalid");
      });

      compute();
    });
  }

  function setSegmentedDefault(group, value) {
    if (!group) return;
    var buttons = Array.prototype.slice.call(group.querySelectorAll("button"));
    buttons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-value") === value ? "true" : "false");
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var bundles = calc.toNumber(form.getAttribute("data-last-bundles"), 0);
      var cost = calc.toNumber(form.getAttribute("data-last-cost"), 0);
      var cuft = calc.toNumber(form.getAttribute("data-last-cuft"), 0);
      var pieces = calc.toNumber(form.getAttribute("data-last-pieces"), 0);
      var text = "Campfire Wood Calculator: " + calc.formatNumber(bundles, 0) + " bundles (" +
        calc.formatNumber(cuft, 1) + " cu ft, ~" + calc.formatNumber(pieces, 0) + " pieces), estimated cost $" +
        calc.formatNumber(cost, 2) + ". Always check local burn bans before building a fire.";
      calc.copyResult(text);
    });
  }

  // Initial render using pre-filled defaults.
  compute();
})();
