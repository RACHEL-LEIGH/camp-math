/*!
 * Camp Math — calc-hiking-time.js
 * Hiking Time Calculator: estimates total trail time from distance, elevation
 * gain/loss, terrain, pack weight, fitness, altitude, group composition, and
 * planned breaks, using a Naismith-style rule of thumb, transparently adjusted.
 */
(function () {
  "use strict";

  var calc = window.CampMath.calc;

  var DEFAULTS = {
    distanceMi: 6,
    distanceUnit: "mi",
    elevGainFt: 1200,
    elevLossFt: 1200,
    elevUnit: "ft",
    terrain: "moderate",
    fitness: "average",
    packWeightLb: 25,
    weightUnit: "lb",
    altitude: "low",
    breakMinutes: 30,
    adultGroup: false,
    children: false,
    dog: false,
    daylightBuffer: 60,
    sunsetTime: "",
    startTime: ""
  };

  var PACE_MPH = { relaxed: 2.0, average: 2.5, strong: 3.0, very_fast: 3.5 };
  var TERRAIN_MULTIPLIER = { smooth: 1.0, moderate: 1.1, rocky_rooted: 1.25, very_rugged: 1.5 };
  var ALTITUDE_MULTIPLIER = { low: 1.0, moderate: 1.08, high: 1.2 };

  /* Mutable canonical-unit state for the three unit-toggling fields (distance, elevation, pack weight). */
  var state = {
    distanceUnit: DEFAULTS.distanceUnit,
    elevUnit: DEFAULTS.elevUnit,
    weightUnit: DEFAULTS.weightUnit
  };

  var els = {};

  /* ---------- Unit conversion helpers (canonical units: miles, feet, lb) ---------- */
  function distanceToDisplay(miles, unit) {
    return unit === "km" ? calc.convert.milesToKm(miles) : miles;
  }
  function distanceToMiles(value, unit) {
    return unit === "km" ? calc.convert.kmToMiles(value) : value;
  }
  function elevToDisplay(feet, unit) {
    return unit === "m" ? calc.convert.ftToM(feet) : feet;
  }
  function elevToFeet(value, unit) {
    return unit === "m" ? calc.convert.mToFt(value) : value;
  }
  function weightToDisplay(lb, unit) {
    return unit === "kg" ? calc.convert.lbToKg(lb) : lb;
  }
  function weightToLb(value, unit) {
    return unit === "kg" ? calc.convert.kgToLb(value) : value;
  }

  /* ---------- Time-of-day helpers (no Date object — plain minutes-since-midnight math) ---------- */
  function parseTimeToMinutes(value) {
    if (!value) return null;
    var parts = String(value).split(":");
    if (parts.length < 2) return null;
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  }

  function formatMinutesAsTime(totalMinutes) {
    if (!Number.isFinite(totalMinutes)) return "--";
    var m = Math.round(totalMinutes) % 1440;
    if (m < 0) m += 1440;
    var hh = Math.floor(m / 60);
    var mm = m % 60;
    var period = hh >= 12 ? "PM" : "AM";
    var displayHour = hh % 12;
    if (displayHour === 0) displayHour = 12;
    return displayHour + ":" + (mm < 10 ? "0" : "") + mm + " " + period;
  }

  /* ------------------------------------------------------------------------
   * Naismith-style hiking-time estimate, transparently adjusted: base moving
   * time (distance / pace) plus ~30 min per 1,000 ft of gain (and a smaller
   * add for loss), scaled up for terrain, pack weight, altitude, and group
   * composition, with break time added on top and the total shown as a range
   * skewed toward "could take longer" rather than one falsely exact number.
   * ---------------------------------------------------------------------- */
  function calculate(input) {
    var distanceMiles = Math.max(0, input.distanceMiles || 0);
    var gainFt = Math.max(0, input.elevGainFt || 0);
    var lossFt = Math.max(0, input.elevLossFt || 0);
    var packWeightLb = Math.max(0, input.packWeightLb || 0);
    var breakMinutes = Math.max(0, input.breakMinutes || 0);

    var paceMph = PACE_MPH[input.fitness] || PACE_MPH.average;
    var distanceTimeHours = paceMph > 0 ? distanceMiles / paceMph : 0;

    var elevationTimeHours = (gainFt / 1000) * 0.5 + (lossFt / 1000) * 0.2;

    var terrainMultiplier = TERRAIN_MULTIPLIER[input.terrain] || TERRAIN_MULTIPLIER.moderate;
    var packWeightMultiplier = 1 + (calc.clamp(packWeightLb - 15, 0, 60) / 60) * 0.35;
    var altitudeMultiplier = ALTITUDE_MULTIPLIER[input.altitude] || ALTITUDE_MULTIPLIER.low;

    var groupMultiplier = 1
      * (input.adultGroup ? 1.05 : 1)
      * (input.children ? 1.3 : 1)
      * (input.dog ? 1.05 : 1);

    var movingTimeHours = (distanceTimeHours + elevationTimeHours) *
      terrainMultiplier * packWeightMultiplier * altitudeMultiplier * groupMultiplier;

    var breakTimeHours = breakMinutes / 60;
    var totalTrailTimeHours = movingTimeHours + breakTimeHours;

    var lowEstimateHours = totalTrailTimeHours * 0.9;
    var highEstimateHours = totalTrailTimeHours * 1.15;

    var actualPaceMph = movingTimeHours > 0 ? distanceMiles / movingTimeHours : 0;

    return {
      distanceTimeHours: distanceTimeHours,
      elevationTimeHours: elevationTimeHours,
      movingTimeHours: movingTimeHours,
      breakTimeHours: breakTimeHours,
      totalTrailTimeHours: totalTrailTimeHours,
      lowEstimateHours: lowEstimateHours,
      highEstimateHours: highEstimateHours,
      actualPaceMph: actualPaceMph
    };
  }

  /* ------------------------------------------------------------------------
   * Turnaround / recommended-start-time planning aid — only computed when a
   * sunset time is provided. Assumes the return leg takes roughly as long as
   * the outbound leg, so it's a rough guide, not a guarantee (see the caveat
   * shown alongside these results in the UI).
   * ---------------------------------------------------------------------- */
  function calculateTurnaround(input, result) {
    var sunsetMin = parseTimeToMinutes(input.sunsetTime);
    if (sunsetMin === null) {
      return { hasSunset: false };
    }
    var startMin = parseTimeToMinutes(input.startTime);
    var daylightBuffer = Math.max(0, input.daylightBuffer || 0);
    var latestReturnMin = sunsetMin - daylightBuffer;

    var turnaroundMin;
    var usedStartTime = startMin !== null;
    if (usedStartTime) {
      var windowMinutes = latestReturnMin - startMin;
      turnaroundMin = startMin + windowMinutes / 2;
    } else {
      turnaroundMin = latestReturnMin - (result.highEstimateHours / 2) * 60;
    }

    var suggestedStartMin = latestReturnMin - result.highEstimateHours * 60;

    return {
      hasSunset: true,
      turnaroundMin: turnaroundMin,
      suggestedStartMin: suggestedStartMin
    };
  }

  /* ---------- Trail-progress diagram: decorative marker along the trail-line path ---------- */
  function updateDiagram(totalTrailTimeHours) {
    if (!els.trailFill) return;
    var safeHours = Number.isFinite(totalTrailTimeHours) ? Math.max(0, totalTrailTimeHours) : 0;
    // Map total trail time onto a 0-12 hour scale for a purely illustrative "how big a chunk of a day" marker.
    var percent = calc.clamp(safeHours / 12, 0, 1);

    var length = els.trailFill.getTotalLength();
    els.trailFill.style.strokeDasharray = String(length);
    els.trailFill.style.strokeDashoffset = String(length * (1 - percent));

    if (els.hiker) {
      var point = els.trailFill.getPointAtLength(percent * length);
      els.hiker.setAttribute("cx", String(point.x));
      els.hiker.setAttribute("cy", String(point.y));
    }
  }

  function readInputs() {
    var distanceMaxDisplay = state.distanceUnit === "km" ? 160 : 100;
    var distanceResult = calc.validateField(els.distance, {
      required: true, min: 0, max: distanceMaxDisplay,
      fallback: distanceToDisplay(DEFAULTS.distanceMi, state.distanceUnit),
      requiredMessage: "Enter a distance."
    });

    var elevMaxDisplay = state.elevUnit === "m" ? 9000 : 30000;
    var gainResult = calc.validateField(els.elevGain, {
      required: false, min: 0, max: elevMaxDisplay,
      fallback: elevToDisplay(DEFAULTS.elevGainFt, state.elevUnit)
    });
    var lossResult = calc.validateField(els.elevLoss, {
      required: false, min: 0, max: elevMaxDisplay,
      fallback: elevToDisplay(DEFAULTS.elevLossFt, state.elevUnit)
    });

    var weightMaxDisplay = state.weightUnit === "kg" ? 180 : 400;
    var packResult = calc.validateField(els.packWeight, {
      required: false, min: 0, max: weightMaxDisplay,
      fallback: weightToDisplay(DEFAULTS.packWeightLb, state.weightUnit)
    });

    var breakResult = calc.validateField(els.breakMinutes, { required: false, min: 0, max: 600, fallback: DEFAULTS.breakMinutes });
    var daylightResult = calc.validateField(els.daylightBuffer, { required: false, min: 0, max: 300, fallback: DEFAULTS.daylightBuffer });

    return {
      distanceMiles: distanceToMiles(distanceResult.value, state.distanceUnit),
      elevGainFt: elevToFeet(gainResult.value, state.elevUnit),
      elevLossFt: elevToFeet(lossResult.value, state.elevUnit),
      terrain: calc.getSegmentedValue(els.terrainGroup) || DEFAULTS.terrain,
      fitness: calc.getSegmentedValue(els.fitnessGroup) || DEFAULTS.fitness,
      packWeightLb: weightToLb(packResult.value, state.weightUnit),
      altitude: calc.getSegmentedValue(els.altitudeGroup) || DEFAULTS.altitude,
      breakMinutes: breakResult.value,
      adultGroup: els.adultGroup.checked,
      children: els.children.checked,
      dog: els.dog.checked,
      daylightBuffer: daylightResult.value,
      sunsetTime: els.sunsetTime.value,
      startTime: els.startTime.value
    };
  }

  var lastCopyState = null;

  function render() {
    var input = readInputs();
    var result = calculate(input);
    var turnaround = calculateTurnaround(input, result);

    var lowSafe = Number.isFinite(result.lowEstimateHours) ? Math.max(0, result.lowEstimateHours) : 0;
    var highSafe = Number.isFinite(result.highEstimateHours) ? Math.max(0, result.highEstimateHours) : 0;
    var movingSafe = Number.isFinite(result.movingTimeHours) ? Math.max(0, result.movingTimeHours) : 0;
    var breakSafe = Number.isFinite(result.breakTimeHours) ? Math.max(0, result.breakTimeHours) : 0;
    var paceSafe = Number.isFinite(result.actualPaceMph) ? Math.max(0, result.actualPaceMph) : 0;
    var fromDistanceSafe = Number.isFinite(result.distanceTimeHours) ? Math.max(0, result.distanceTimeHours) : 0;
    var fromElevationSafe = Number.isFinite(result.elevationTimeHours) ? Math.max(0, result.elevationTimeHours) : 0;
    var totalSafe = Number.isFinite(result.totalTrailTimeHours) ? Math.max(0, result.totalTrailTimeHours) : 0;

    calc.animateValue(els.lowValue, lowSafe, { decimals: 1 });
    calc.animateValue(els.highValue, highSafe, { decimals: 1 });
    els.rangeSub.textContent = "Moving time plus " + calc.formatNumber(breakSafe, 1) + " hr of breaks, shown as a range rather than one exact number.";

    els.movingTime.textContent = calc.formatNumber(movingSafe, 1);
    els.breakTime.textContent = calc.formatNumber(breakSafe, 1);
    var paceDisplay = state.distanceUnit === "km" ? calc.convert.milesToKm(paceSafe) : paceSafe;
    els.pace.textContent = calc.formatNumber(paceDisplay, 1);
    els.paceUnit.textContent = state.distanceUnit === "km" ? "km/h" : "mph";

    els.fromDistance.textContent = calc.formatNumber(fromDistanceSafe, 1);
    els.fromElevation.textContent = calc.formatNumber(fromElevationSafe, 1);

    updateDiagram(totalSafe);

    if (turnaround.hasSunset) {
      els.turnaroundEmpty.hidden = true;
      els.turnaroundResults.hidden = false;
      els.turnaroundTime.textContent = formatMinutesAsTime(turnaround.turnaroundMin);
      els.startSuggestion.textContent = formatMinutesAsTime(turnaround.suggestedStartMin);
    } else {
      els.turnaroundEmpty.hidden = false;
      els.turnaroundResults.hidden = true;
    }

    lastCopyState = {
      low: lowSafe, high: highSafe, moving: movingSafe, breakTime: breakSafe,
      pace: paceDisplay, paceUnit: els.paceUnit.textContent,
      fromDistance: fromDistanceSafe, fromElevation: fromElevationSafe,
      hasSunset: turnaround.hasSunset,
      turnaroundText: turnaround.hasSunset ? formatMinutesAsTime(turnaround.turnaroundMin) : null,
      startSuggestionText: turnaround.hasSunset ? formatMinutesAsTime(turnaround.suggestedStartMin) : null
    };
  }

  var debouncedRender = calc.debounce(render, 150);

  function setSegmented(container, value) {
    if (!container) return;
    var buttons = Array.prototype.slice.call(container.querySelectorAll("button"));
    buttons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-value") === value ? "true" : "false");
    });
  }

  function clearFieldError(input) {
    var wrap = input.closest(".field");
    if (wrap) wrap.classList.remove("invalid");
    var err = wrap ? wrap.querySelector(".error-msg") : null;
    if (err) err.textContent = "";
  }

  function resetForm() {
    state.distanceUnit = DEFAULTS.distanceUnit;
    state.elevUnit = DEFAULTS.elevUnit;
    state.weightUnit = DEFAULTS.weightUnit;

    setSegmented(els.distanceUnitToggle, DEFAULTS.distanceUnit);
    setSegmented(els.elevUnitToggle, DEFAULTS.elevUnit);
    setSegmented(els.weightUnitToggle, DEFAULTS.weightUnit);

    els.distance.value = DEFAULTS.distanceMi;
    els.elevGain.value = DEFAULTS.elevGainFt;
    els.elevLoss.value = DEFAULTS.elevLossFt;
    els.packWeight.value = DEFAULTS.packWeightLb;
    els.breakMinutes.value = DEFAULTS.breakMinutes;
    els.daylightBuffer.value = DEFAULTS.daylightBuffer;
    els.sunsetTime.value = DEFAULTS.sunsetTime;
    els.startTime.value = DEFAULTS.startTime;
    els.adultGroup.checked = DEFAULTS.adultGroup;
    els.children.checked = DEFAULTS.children;
    els.dog.checked = DEFAULTS.dog;

    setSegmented(els.terrainGroup, DEFAULTS.terrain);
    setSegmented(els.fitnessGroup, DEFAULTS.fitness);
    setSegmented(els.altitudeGroup, DEFAULTS.altitude);

    [els.distance, els.elevGain, els.elevLoss, els.packWeight, els.breakMinutes, els.daylightBuffer].forEach(clearFieldError);

    render();
  }

  function copyResultText() {
    if (!lastCopyState) return;
    var text = "Hiking Time Calculator — Camp Math\n" +
      "Estimated total trail time: " + calc.formatNumber(lastCopyState.low, 1) + "–" + calc.formatNumber(lastCopyState.high, 1) + " hours\n" +
      "Moving time: " + calc.formatNumber(lastCopyState.moving, 1) + " hr\n" +
      "Break time: " + calc.formatNumber(lastCopyState.breakTime, 1) + " hr\n" +
      "Pace estimate: " + calc.formatNumber(lastCopyState.pace, 1) + " " + lastCopyState.paceUnit + "\n" +
      "From distance: " + calc.formatNumber(lastCopyState.fromDistance, 1) + " hr\n" +
      "From elevation gain/loss: " + calc.formatNumber(lastCopyState.fromElevation, 1) + " hr" +
      (lastCopyState.hasSunset ?
        "\nSuggested turnaround time: " + lastCopyState.turnaroundText +
        "\nRecommended start time: " + lastCopyState.startSuggestionText : "");
    calc.copyResult(text);
  }

  function init() {
    els.distance = document.getElementById("ht-distance");
    els.distanceUnitToggle = document.querySelector('[data-unit-toggle="distance"]');
    els.elevUnitToggle = document.querySelector('[data-unit-toggle="elevation"]');
    els.elevGain = document.getElementById("ht-elev-gain");
    els.elevLoss = document.getElementById("ht-elev-loss");
    els.terrainGroup = document.querySelector('[data-segmented="terrain"]');
    els.fitnessGroup = document.querySelector('[data-segmented="fitness"]');
    els.packWeight = document.getElementById("ht-pack-weight");
    els.weightUnitToggle = document.querySelector('[data-unit-toggle="weight"]');
    els.altitudeGroup = document.querySelector('[data-segmented="altitude"]');
    els.breakMinutes = document.getElementById("ht-break-minutes");
    els.adultGroup = document.getElementById("ht-adult-group");
    els.children = document.getElementById("ht-children");
    els.dog = document.getElementById("ht-dog");
    els.daylightBuffer = document.getElementById("ht-daylight-buffer");
    els.sunsetTime = document.getElementById("ht-sunset-time");
    els.startTime = document.getElementById("ht-start-time");

    els.lowValue = document.getElementById("ht-low-value");
    els.highValue = document.getElementById("ht-high-value");
    els.rangeSub = document.getElementById("ht-range-sub");
    els.movingTime = document.getElementById("ht-moving-time");
    els.breakTime = document.getElementById("ht-break-time");
    els.pace = document.getElementById("ht-pace");
    els.paceUnit = document.getElementById("ht-pace-unit");
    els.fromDistance = document.getElementById("ht-from-distance");
    els.fromElevation = document.getElementById("ht-from-elevation");
    els.trailFill = document.getElementById("ht-trail-fill");
    els.hiker = document.getElementById("ht-hiker");
    els.turnaroundEmpty = document.getElementById("ht-turnaround-empty");
    els.turnaroundResults = document.getElementById("ht-turnaround-results");
    els.turnaroundTime = document.getElementById("ht-turnaround-time");
    els.startSuggestion = document.getElementById("ht-start-suggestion");
    els.resetBtn = document.getElementById("ht-reset");
    els.copyBtn = document.getElementById("ht-copy");

    if (!els.distance || !els.elevGain) return;

    [els.distance, els.elevGain, els.elevLoss, els.packWeight, els.breakMinutes, els.daylightBuffer].forEach(function (input) {
      input.addEventListener("input", debouncedRender);
      input.addEventListener("change", render);
    });
    [els.sunsetTime, els.startTime].forEach(function (input) {
      input.addEventListener("input", render);
      input.addEventListener("change", render);
    });
    [els.adultGroup, els.children, els.dog].forEach(function (input) {
      input.addEventListener("change", render);
    });

    calc.wireSegmented(els.terrainGroup, render);
    calc.wireSegmented(els.fitnessGroup, render);
    calc.wireSegmented(els.altitudeGroup, render);

    calc.wireSegmented(els.distanceUnitToggle, function (value) {
      if (value === state.distanceUnit) return;
      var distanceResult = calc.validateField(els.distance, { required: false, min: 0, fallback: distanceToDisplay(DEFAULTS.distanceMi, state.distanceUnit) });
      var miles = distanceToMiles(distanceResult.value, state.distanceUnit);
      state.distanceUnit = value;
      els.distance.value = calc.round(distanceToDisplay(miles, state.distanceUnit), 1);
      render();
    });

    calc.wireSegmented(els.elevUnitToggle, function (value) {
      if (value === state.elevUnit) return;
      var gainResult = calc.validateField(els.elevGain, { required: false, min: 0, fallback: elevToDisplay(DEFAULTS.elevGainFt, state.elevUnit) });
      var lossResult = calc.validateField(els.elevLoss, { required: false, min: 0, fallback: elevToDisplay(DEFAULTS.elevLossFt, state.elevUnit) });
      var gainFt = elevToFeet(gainResult.value, state.elevUnit);
      var lossFt = elevToFeet(lossResult.value, state.elevUnit);
      state.elevUnit = value;
      els.elevGain.value = calc.round(elevToDisplay(gainFt, state.elevUnit), 0);
      els.elevLoss.value = calc.round(elevToDisplay(lossFt, state.elevUnit), 0);
      render();
    });

    calc.wireSegmented(els.weightUnitToggle, function (value) {
      if (value === state.weightUnit) return;
      var packResult = calc.validateField(els.packWeight, { required: false, min: 0, fallback: weightToDisplay(DEFAULTS.packWeightLb, state.weightUnit) });
      var lb = weightToLb(packResult.value, state.weightUnit);
      state.weightUnit = value;
      els.packWeight.value = calc.round(weightToDisplay(lb, state.weightUnit), 1);
      render();
    });

    els.resetBtn.addEventListener("click", resetForm);
    els.copyBtn.addEventListener("click", copyResultText);

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
