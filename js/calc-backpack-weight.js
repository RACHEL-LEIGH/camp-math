/*!
 * Camp Math — calc-backpack-weight.js
 * Page-specific logic for the Backpack Weight Calculator.
 * Depends on window.CampMath.calc (js/calculators.js) and js/shared.js.
 * Do not edit js/calculators.js or js/shared.js — this file is self-contained.
 */
(function () {
  "use strict";

  var CampMath = window.CampMath || {};
  var calc = CampMath.calc;
  if (!calc) return;

  document.addEventListener("DOMContentLoaded", init);

  /* Fields whose displayed unit follows the page-wide weight-unit toggle (lb/kg).
     Food/day, fuel, and the combined "extras" field intentionally stay in lb only. */
  var WEIGHT_FIELD_IDS = [
    "bpw-body-weight",
    "bpw-gear-weight",
    "bpw-medical",
    "bpw-camera",
    "bpw-fishing",
    "bpw-dog",
    "bpw-climbing"
  ];

  var NUMBER_FIELD_IDS = [
    "bpw-body-weight", "bpw-gear-weight", "bpw-food-per-day", "bpw-days",
    "bpw-water", "bpw-fuel", "bpw-extras",
    "bpw-medical", "bpw-camera", "bpw-fishing", "bpw-dog", "bpw-climbing"
  ];

  /* Defaults, in the units the fields load with (lb / liters). Used by Reset. */
  var DEFAULTS = {
    "bpw-body-weight": 160,
    "bpw-gear-weight": 18,
    "bpw-food-per-day": 1.5,
    "bpw-days": 3,
    "bpw-water": 2,
    "bpw-fuel": 0.5,
    "bpw-extras": 0,
    "bpw-medical": 0,
    "bpw-camera": 0,
    "bpw-fishing": 0,
    "bpw-dog": 0,
    "bpw-climbing": 0
  };

  var state = {
    weightUnit: "lb",
    waterUnit: "liters"
  };

  var els = {};

  function init() {
    els.form = document.getElementById("bpw-form");
    els.weightUnitToggle = document.getElementById("bpw-weight-unit");
    els.waterUnitToggle = document.getElementById("bpw-water-unit");
    els.season = document.getElementById("bpw-season");
    els.tripStyle = document.getElementById("bpw-trip-style");
    els.experience = document.getElementById("bpw-experience");
    els.extras = document.getElementById("bpw-extras");
    els.totalValue = document.getElementById("bpw-total-value");
    els.percentSub = document.getElementById("bpw-percent-sub");
    els.baseValue = document.getElementById("bpw-base-value");
    els.consumableValue = document.getElementById("bpw-consumable-value");
    els.categoryValue = document.getElementById("bpw-category-value");
    els.reductionCard = document.getElementById("bpw-reduction-card");
    els.reductionValue = document.getElementById("bpw-reduction-value");
    els.recommendation = document.getElementById("bpw-recommendation");
    els.recommendationTitle = document.getElementById("bpw-recommendation-title");
    els.recommendationText = document.getElementById("bpw-recommendation-text");
    els.gaugeFill = document.getElementById("bpw-gauge-fill");
    els.reset = document.getElementById("bpw-reset");
    els.copy = document.getElementById("bpw-copy");

    if (!els.form) return;

    var debouncedRecalc = calc.debounce(recalc, 150);
    NUMBER_FIELD_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", debouncedRecalc);
      el.addEventListener("change", recalc);
    });

    calc.wireSegmented(els.weightUnitToggle, function (value) {
      var oldUnit = state.weightUnit;
      if (value === oldUnit) return;
      state.weightUnit = value;
      convertWeightInputs(oldUnit, value);
      recalc();
    });

    calc.wireSegmented(els.waterUnitToggle, function (value) {
      var oldUnit = state.waterUnit;
      if (value === oldUnit) return;
      state.waterUnit = value;
      convertWaterInput(oldUnit, value);
      recalc();
    });

    calc.wireSegmented(els.season, recalc);
    calc.wireSegmented(els.tripStyle, recalc);
    calc.wireSegmented(els.experience, recalc);

    if (els.reset) els.reset.addEventListener("click", resetForm);
    if (els.copy) els.copy.addEventListener("click", copyResultText);

    recalc();
  }

  /* ---------- Unit conversion on toggle ---------- */
  function convertWeightInputs(oldUnit, newUnit) {
    WEIGHT_FIELD_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.disabled) return;
      var raw = calc.toNumber(el.value, 0);
      var lbValue = oldUnit === "kg" ? calc.convert.kgToLb(raw) : raw;
      var displayValue = newUnit === "kg" ? calc.convert.lbToKg(lbValue) : lbValue;
      el.value = calc.round(displayValue, 1);
    });
    var unitLabels = document.querySelectorAll("[data-weight-unit-text]");
    for (var i = 0; i < unitLabels.length; i++) unitLabels[i].textContent = newUnit;
  }

  function convertWaterInput(oldUnit, newUnit) {
    var el = document.getElementById("bpw-water");
    if (!el) return;
    var raw = calc.toNumber(el.value, 0);
    var liters = oldUnit === "gallons" ? calc.convert.galToLiter(raw) : raw;
    var displayValue = newUnit === "gallons" ? calc.convert.literToGal(liters) : liters;
    el.value = calc.round(displayValue, 2);
  }

  /* ---------- Read + validate inputs, converting everything to canonical lb / liters ---------- */
  function readField(id, opts) {
    var el = document.getElementById(id);
    if (!el) return opts && opts.fallback !== undefined ? opts.fallback : 0;
    return calc.validateField(el, opts).value;
  }

  function toLb(value) {
    return state.weightUnit === "kg" ? calc.convert.kgToLb(value) : value;
  }

  function getInputs() {
    var bodyWeightLb = toLb(readField("bpw-body-weight", { min: 1, max: 1000, fallback: 160, required: true, requiredMessage: "Enter your body weight." }));
    var baseGearLb = toLb(readField("bpw-gear-weight", { min: 0, max: 300, fallback: 18 }));
    var foodPerDayLb = readField("bpw-food-per-day", { min: 0, max: 15, fallback: 1.5 });
    var days = readField("bpw-days", { min: 0, max: 60, fallback: 3 });

    var waterRaw = readField("bpw-water", { min: 0, max: 80, fallback: 2 });
    var waterLiters = state.waterUnit === "gallons" ? calc.convert.galToLiter(waterRaw) : waterRaw;

    var fuelLb = readField("bpw-fuel", { min: 0, max: 50, fallback: 0.5 });

    var medicalLb = toLb(readField("bpw-medical", { min: 0, max: 200, fallback: 0 }));
    var cameraLb = toLb(readField("bpw-camera", { min: 0, max: 200, fallback: 0 }));
    var fishingLb = toLb(readField("bpw-fishing", { min: 0, max: 200, fallback: 0 }));
    var dogLb = toLb(readField("bpw-dog", { min: 0, max: 200, fallback: 0 }));
    var climbingLb = toLb(readField("bpw-climbing", { min: 0, max: 200, fallback: 0 }));
    var breakdownSumLb = medicalLb + cameraLb + fishingLb + dogLb + climbingLb;

    /* The combined "extras" field and the optional breakdown share one value: when the
       breakdown has anything entered, it takes over and drives the combined field. */
    var extrasLb;
    if (breakdownSumLb > 0) {
      els.extras.value = calc.round(breakdownSumLb, 1);
      els.extras.disabled = true;
      var extrasWrap = els.extras.closest(".field");
      if (extrasWrap) extrasWrap.classList.remove("invalid");
      extrasLb = breakdownSumLb;
    } else {
      els.extras.disabled = false;
      extrasLb = readField("bpw-extras", { min: 0, max: 300, fallback: 0 });
    }

    return {
      bodyWeightLb: bodyWeightLb,
      baseGearLb: baseGearLb,
      foodPerDayLb: foodPerDayLb,
      days: days,
      waterLiters: waterLiters,
      fuelLb: fuelLb,
      extrasLb: extrasLb,
      season: calc.getSegmentedValue(els.season) || "summer",
      tripStyle: calc.getSegmentedValue(els.tripStyle) || "lightweight",
      experience: calc.getSegmentedValue(els.experience) || "intermediate"
    };
  }

  /* Backpack starting-weight & percent-of-body-weight estimate:
   * foodWeightLb = foodPerDayLb * days
   * waterWeightLb = waterLiters * 2.2 (CampMath.calc.waterWeight.lbPerLiter)
   * consumableWeightLb = foodWeightLb + waterWeightLb + fuelWeightLb
   * extrasLb = sum(medical, camera, fishing, dog, climbing), or the single
   *   "consumables/specialty extras" field when the breakdown isn't used
   * totalStartingWeightLb = baseGearWeightLb + consumableWeightLb + extrasLb
   * percentOfBodyWeight = (totalStartingWeightLb / bodyWeightLb) * 100
   * targetMaxPercent = experience base (15/20/25) + season adjustment (0/1.5/3)
   *   + trip style adjustment (-3/0/0/+3), clamped to 8-32 — a rough guideline
   *   ceiling before a pack is considered "heavy," not a universal safety limit
   * category = Ultralight / Lightweight / Moderate / Heavy based on percent vs. targetMaxPercent
   * reductionTargetLb is only computed when category is "Heavy"
   */
  function calculateBackpackWeight(inputs) {
    var bodyWeightLb = Math.max(1, inputs.bodyWeightLb); // guard against divide-by-zero
    var foodWeightLb = Math.max(0, inputs.foodPerDayLb * inputs.days);
    var waterWeightLb = Math.max(0, inputs.waterLiters * calc.waterWeight.lbPerLiter);
    var consumableWeightLb = foodWeightLb + waterWeightLb + Math.max(0, inputs.fuelLb);
    var extrasLb = Math.max(0, inputs.extrasLb);
    var baseGearLb = Math.max(0, inputs.baseGearLb);
    var totalStartingWeightLb = baseGearLb + consumableWeightLb + extrasLb;
    var percentOfBodyWeight = (totalStartingWeightLb / bodyWeightLb) * 100;

    var experienceBase = { beginner: 15, intermediate: 20, experienced: 25 }[inputs.experience];
    if (experienceBase === undefined) experienceBase = 20;
    var seasonAdj = { summer: 0, shoulder: 1.5, winter: 3 }[inputs.season];
    if (seasonAdj === undefined) seasonAdj = 0;
    var styleAdj = { ultralight: -3, lightweight: 0, traditional: 0, comfort_focused: 3 }[inputs.tripStyle];
    if (styleAdj === undefined) styleAdj = 0;
    var targetMaxPercent = calc.clamp(experienceBase + seasonAdj + styleAdj, 8, 32);

    var category;
    if (percentOfBodyWeight <= targetMaxPercent * 0.5) category = "Ultralight";
    else if (percentOfBodyWeight <= targetMaxPercent * 0.8) category = "Lightweight";
    else if (percentOfBodyWeight <= targetMaxPercent) category = "Moderate";
    else category = "Heavy";

    var reductionTargetLb = 0;
    if (category === "Heavy") {
      reductionTargetLb = Math.max(0, totalStartingWeightLb - (targetMaxPercent / 100) * bodyWeightLb);
    }

    return {
      baseGearLb: baseGearLb,
      foodWeightLb: foodWeightLb,
      waterWeightLb: waterWeightLb,
      consumableWeightLb: consumableWeightLb,
      extrasLb: extrasLb,
      totalStartingWeightLb: totalStartingWeightLb,
      percentOfBodyWeight: Number.isFinite(percentOfBodyWeight) ? percentOfBodyWeight : 0,
      targetMaxPercent: targetMaxPercent,
      category: category,
      reductionTargetLb: reductionTargetLb
    };
  }

  var lastResult = null;

  function recalc() {
    var inputs = getInputs();
    var result = calculateBackpackWeight(inputs);
    lastResult = result;
    updateUI(result);
  }

  function updateUI(result) {
    var total = Number.isFinite(result.totalStartingWeightLb) ? result.totalStartingWeightLb : 0;
    var percent = Number.isFinite(result.percentOfBodyWeight) ? result.percentOfBodyWeight : 0;

    calc.animateValue(els.totalValue, total, { decimals: 1 });
    els.percentSub.textContent = calc.formatNumber(percent, 1) + "% of body weight";
    els.baseValue.textContent = calc.formatNumber(result.baseGearLb, 1);
    els.consumableValue.textContent = calc.formatNumber(result.consumableWeightLb, 1);
    els.categoryValue.textContent = result.category;

    if (result.category === "Heavy" && result.reductionTargetLb > 0) {
      els.reductionCard.hidden = false;
      els.reductionValue.textContent = calc.formatNumber(result.reductionTargetLb, 1);
    } else {
      els.reductionCard.hidden = true;
    }

    var scaled = calc.clamp((percent / 30) * 100, 0, 100);
    var warnAboveScaled = (result.targetMaxPercent / 30) * 100;
    calc.setGauge(els.gaugeFill, scaled, warnAboveScaled);

    updateRecommendation(result);
  }

  function updateRecommendation(result) {
    var title, text;
    var targetPct = calc.formatNumber(result.targetMaxPercent, 0);

    if (result.category === "Heavy") {
      title = "Your pack is heavier than the rough target for this setup";
      text = "Trimming about " + calc.formatNumber(result.reductionTargetLb, 1) + " lb would bring you back under a rough " + targetPct + "% target. Start with the “big three” — shelter, sleep system, and the pack itself — since they carry the most leverage; repackage food, fuel, and toiletries to cut consumable bulk; and if your route has reliable water sources, carry less between refill stops instead of a full day's supply.";
      els.recommendation.classList.add("callout-warn");
    } else if (result.category === "Moderate") {
      title = "Your pack weight looks reasonable";
      text = "You're within a sane range for your experience level, season, and trip style, though there's some room to trim if you want a lighter trip — consumables (food, water, and fuel) are usually the easiest thing to adjust trip to trip.";
      els.recommendation.classList.remove("callout-warn");
    } else if (result.category === "Lightweight") {
      title = "Your pack is comfortably light";
      text = "You're well under the rough target for this setup, which is generally good for comfort and pace — just make sure you haven't cut anything you'd genuinely need for the conditions.";
      els.recommendation.classList.remove("callout-warn");
    } else {
      title = "Your pack is very light relative to your body weight";
      text = "That's great for speed and comfort, but ultralight setups leave less margin in bad weather or an emergency — double-check you still have adequate shelter, insulation, and a way to treat water.";
      els.recommendation.classList.remove("callout-warn");
    }

    els.recommendationTitle.textContent = title;
    els.recommendationText.textContent = text;
  }

  /* ---------- Reset / Copy ---------- */
  function resetForm() {
    state.weightUnit = "lb";
    state.waterUnit = "liters";

    Object.keys(DEFAULTS).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.value = DEFAULTS[id];
      el.disabled = false;
      var wrap = el.closest(".field");
      if (wrap) wrap.classList.remove("invalid");
    });

    setSegmentedDefault(els.weightUnitToggle, "lb");
    setSegmentedDefault(els.waterUnitToggle, "liters");
    setSegmentedDefault(els.season, "summer");
    setSegmentedDefault(els.tripStyle, "lightweight");
    setSegmentedDefault(els.experience, "intermediate");

    var unitLabels = document.querySelectorAll("[data-weight-unit-text]");
    for (var i = 0; i < unitLabels.length; i++) unitLabels[i].textContent = "lb";

    recalc();
  }

  function setSegmentedDefault(container, defaultValue) {
    if (!container) return;
    var buttons = container.querySelectorAll("button");
    buttons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-value") === defaultValue ? "true" : "false");
    });
  }

  function copyResultText() {
    if (!lastResult) return;
    var text = "Backpack Weight Calculator: " +
      calc.formatNumber(lastResult.totalStartingWeightLb, 1) + " lb starting pack weight (" +
      calc.formatNumber(lastResult.percentOfBodyWeight, 1) + "% of body weight, " +
      lastResult.category + " for your settings). Rough guideline only, not a safety rule — see campmath.com/calculators/backpack-weight.html.";
    calc.copyResult(text);
  }
})();
