/*!
 * CampingMath — calc-tent-size.js
 * Tent Size Calculator: estimates a realistic tent capacity and floor area
 * from occupants, sleeping setup, pets, and stored gear.
 */
(function () {
  "use strict";

  var calc = window.CampingMath.calc;

  var DEFAULTS = {
    adults: 2,
    children: 0,
    pets: 0,
    petSize: "medium",
    sleepSetup: "wide",
    gear: "some",
    comfort: "comfortable"
  };

  /* Sleeping footprint per person, in inches (W x L), converted to sq ft as (W * L) / 144. */
  var SLEEP_DIMENSIONS_IN = {
    compact: { w: 20, l: 72 },  // compact sleeping pad  -> ~10.0 sq ft
    wide: { w: 25, l: 77 },     // wide sleeping pad      -> ~13.4 sq ft
    twin: { w: 38, l: 75 },     // twin air mattress      -> ~19.8 sq ft
    queen: { w: 60, l: 80 },    // queen air mattress     -> ~33.3 sq ft
    cot: { w: 25, l: 75 }       // cot                    -> ~13.0 sq ft
  };

  var PET_SQFT = { small: 3, medium: 6, large: 10 };
  var GEAR_SQFT = { minimal: 8, some: 16, most: 28 };
  var COMFORT_MULTIPLIER = { cozy: 1.05, comfortable: 1.25, spacious: 1.50 };
  var SQFT_PER_PERSON = 15; // rough floor area manufacturers assume per sleeper in a tight dome-tent layout

  function footprintSqFt(setup) {
    var dims = SLEEP_DIMENSIONS_IN[setup] || SLEEP_DIMENSIONS_IN.wide;
    return (dims.w * dims.l) / 144;
  }

  /* els: cached DOM references, filled in on init() */
  var els = {};

  /* ----------------------------------------------------------------------
   * Core calculation. Sleeping footprint per person (by setup) is summed for
   * adults (full footprint) and children (80% of an adult's footprint), then
   * pet floor space and a flat gear allowance are added. A 15% circulation
   * allowance covers sloped walls, poles, and vestibule overlap to produce a
   * "minimum," tight, manufacturer-style floor area. That minimum is scaled
   * by a comfort multiplier to get the comfortable floor area, and both areas
   * are converted to a person-rating equivalent using ~15 sq ft/person.
   * -------------------------------------------------------------------- */
  function calculate(input) {
    var adults = calc.clamp(input.adults, 0, 500);
    var children = calc.clamp(input.children, 0, 500);
    var pets = calc.clamp(input.pets, 0, 500);

    var perPersonSqFt = footprintSqFt(input.sleepSetup);

    var adultSleepArea = adults * perPersonSqFt;
    var childSleepArea = children * perPersonSqFt * 0.8;
    var baseSleepArea = adultSleepArea + childSleepArea;

    var petSizeSqFt = PET_SQFT[input.petSize] !== undefined ? PET_SQFT[input.petSize] : PET_SQFT.medium;
    var petArea = pets * petSizeSqFt;

    var gearArea = GEAR_SQFT[input.gear] !== undefined ? GEAR_SQFT[input.gear] : GEAR_SQFT.some;

    var circulation = 0.15 * (baseSleepArea + petArea);

    var minimumArea = baseSleepArea + petArea + gearArea + circulation;

    var comfortMultiplier = COMFORT_MULTIPLIER[input.comfort] !== undefined ? COMFORT_MULTIPLIER[input.comfort] : COMFORT_MULTIPLIER.comfortable;
    var comfortableArea = minimumArea * comfortMultiplier;

    var minCapacityPeople = Math.max(1, Math.ceil(minimumArea / SQFT_PER_PERSON));
    var comfortCapacityPeople = Math.max(1, Math.ceil(comfortableArea / SQFT_PER_PERSON));

    var side = Math.sqrt(comfortableArea);
    var roundedSide = Math.ceil(side * 2) / 2;

    var totalOccupants = adults + children;
    var crowdingWarning = totalOccupants > 0 && minCapacityPeople <= totalOccupants;

    return {
      baseSleepArea: baseSleepArea,
      petArea: petArea,
      gearArea: gearArea,
      circulation: circulation,
      minimumArea: minimumArea,
      comfortableArea: comfortableArea,
      minCapacityPeople: minCapacityPeople,
      comfortCapacityPeople: comfortCapacityPeople,
      roundedSide: roundedSide,
      totalOccupants: totalOccupants,
      crowdingWarning: crowdingWarning
    };
  }

  /* ---------- Diagram scaling ---------- */
  function updateDiagram(roundedSide) {
    if (!els.diagramOutline) return;
    var safeSide = Number.isFinite(roundedSide) && roundedSide > 0 ? roundedSide : 6;
    // Map a plausible 4-20 ft side range onto a 60-190px box within the 220x180 viewBox.
    var minFt = 4, maxFt = 20, minPx = 60, maxPx = 190;
    var clampedFt = calc.clamp(safeSide, minFt, maxFt);
    var boxSize = minPx + ((clampedFt - minFt) / (maxFt - minFt)) * (maxPx - minPx);
    var x = (220 - boxSize) / 2;
    var y = 14 + (150 - boxSize) / 2;

    els.diagramOutline.setAttribute("x", String(x));
    els.diagramOutline.setAttribute("y", String(y));
    els.diagramOutline.setAttribute("width", String(boxSize));
    els.diagramOutline.setAttribute("height", String(boxSize));

    var padW = boxSize * 0.32;
    var padH = boxSize * 0.46;
    var padY = y + boxSize * 0.14;
    var gap = boxSize * 0.06;
    var pad1X = x + boxSize * 0.5 - gap / 2 - padW;
    var pad2X = x + boxSize * 0.5 + gap / 2;

    if (els.diagramPad1) {
      els.diagramPad1.setAttribute("x", String(pad1X));
      els.diagramPad1.setAttribute("y", String(padY));
      els.diagramPad1.setAttribute("width", String(padW));
      els.diagramPad1.setAttribute("height", String(padH));
    }
    if (els.diagramPad2) {
      els.diagramPad2.setAttribute("x", String(pad2X));
      els.diagramPad2.setAttribute("y", String(padY));
      els.diagramPad2.setAttribute("width", String(padW));
      els.diagramPad2.setAttribute("height", String(padH));
    }
    if (els.diagramLabel) {
      els.diagramLabel.textContent = calc.formatNumber(safeSide, safeSide % 1 === 0 ? 0 : 1) + " x " + calc.formatNumber(safeSide, safeSide % 1 === 0 ? 0 : 1) + " ft";
    }
  }

  function readInput() {
    var adultsResult = calc.validateField(els.adults, { required: false, min: 0, max: 20, fallback: DEFAULTS.adults });
    var childrenResult = calc.validateField(els.children, { required: false, min: 0, max: 20, fallback: DEFAULTS.children });
    var petsResult = calc.validateField(els.pets, { required: false, min: 0, max: 10, fallback: DEFAULTS.pets });

    return {
      adults: adultsResult.value,
      children: childrenResult.value,
      pets: petsResult.value,
      petSize: calc.getSegmentedValue(els.petSizeGroup) || DEFAULTS.petSize,
      sleepSetup: els.sleepSetup.value || DEFAULTS.sleepSetup,
      gear: calc.getSegmentedValue(els.gearGroup) || DEFAULTS.gear,
      comfort: calc.getSegmentedValue(els.comfortGroup) || DEFAULTS.comfort
    };
  }

  function render() {
    var input = readInput();
    var result = calculate(input);

    var comfortableAreaSafe = Number.isFinite(result.comfortableArea) ? Math.max(0, result.comfortableArea) : 0;
    var minimumAreaSafe = Number.isFinite(result.minimumArea) ? Math.max(0, result.minimumArea) : 0;
    var comfortCapacitySafe = Number.isFinite(result.comfortCapacityPeople) ? Math.max(0, result.comfortCapacityPeople) : 0;
    var minCapacitySafe = Number.isFinite(result.minCapacityPeople) ? Math.max(0, result.minCapacityPeople) : 0;
    var roundedSideSafe = Number.isFinite(result.roundedSide) ? Math.max(0, result.roundedSide) : 0;

    calc.animateValue(els.comfortValue, comfortCapacitySafe, { decimals: 0 });
    els.comfortSub.textContent = "Based on " + calc.formatNumber(comfortableAreaSafe, 1) + " sq ft of comfortable floor space for your group.";

    els.minCapacity.textContent = calc.formatNumber(minCapacitySafe, 0);
    els.floorArea.textContent = calc.formatNumber(comfortableAreaSafe, 1);
    els.dimensions.textContent = calc.formatNumber(roundedSideSafe, roundedSideSafe % 1 === 0 ? 0 : 1) + " x " + calc.formatNumber(roundedSideSafe, roundedSideSafe % 1 === 0 ? 0 : 1) + " ft";

    if (result.crowdingWarning) {
      els.crowdWarning.hidden = false;
      els.crowdText.textContent = "A tent whose manufacturer rating just matches your " + result.totalOccupants + "-person group (minimum capacity: " + minCapacitySafe + "-person) would almost certainly feel crowded once gear and pets are inside. Consider sizing up to a " + comfortCapacitySafe + "-person tent.";
    } else {
      els.crowdWarning.hidden = true;
    }

    updateDiagram(roundedSideSafe);

    els.lastComfortCapacity = comfortCapacitySafe;
    els.lastFloorArea = comfortableAreaSafe;
    els.lastMinCapacity = minCapacitySafe;
    els.lastDimensions = roundedSideSafe;
    void minimumAreaSafe;
  }

  var debouncedRender = calc.debounce(render, 150);

  function resetForm() {
    els.adults.value = DEFAULTS.adults;
    els.children.value = DEFAULTS.children;
    els.pets.value = DEFAULTS.pets;
    els.sleepSetup.value = DEFAULTS.sleepSetup;

    setSegmented(els.petSizeGroup, DEFAULTS.petSize);
    setSegmented(els.gearGroup, DEFAULTS.gear);
    setSegmented(els.comfortGroup, DEFAULTS.comfort);

    [els.adults, els.children, els.pets].forEach(function (input) {
      var wrap = input.closest(".field");
      if (wrap) wrap.classList.remove("invalid");
      var err = wrap ? wrap.querySelector(".error-msg") : null;
      if (err) err.textContent = "";
    });

    render();
  }

  function setSegmented(container, value) {
    if (!container) return;
    var buttons = Array.prototype.slice.call(container.querySelectorAll("button"));
    buttons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-value") === value ? "true" : "false");
    });
  }

  function copyResultText() {
    var text = "Tent Size Calculator — CampingMath\n" +
      "Comfortable tent size: " + els.lastComfortCapacity + "-person tent\n" +
      "Minimum capacity: " + els.lastMinCapacity + "-person\n" +
      "Floor area needed: " + calc.formatNumber(els.lastFloorArea, 1) + " sq ft\n" +
      "Suggested dimensions: " + calc.formatNumber(els.lastDimensions, els.lastDimensions % 1 === 0 ? 0 : 1) + " x " + calc.formatNumber(els.lastDimensions, els.lastDimensions % 1 === 0 ? 0 : 1) + " ft";
    calc.copyResult(text);
  }

  function init() {
    els.adults = document.getElementById("ts-adults");
    els.children = document.getElementById("ts-children");
    els.pets = document.getElementById("ts-pets");
    els.sleepSetup = document.getElementById("ts-sleep-setup");
    els.petSizeGroup = document.getElementById("ts-pet-size");
    els.gearGroup = document.getElementById("ts-gear");
    els.comfortGroup = document.getElementById("ts-comfort");

    els.comfortValue = document.getElementById("ts-comfort-value");
    els.comfortSub = document.getElementById("ts-comfort-sub");
    els.minCapacity = document.getElementById("ts-min-capacity");
    els.floorArea = document.getElementById("ts-floor-area");
    els.dimensions = document.getElementById("ts-dimensions");
    els.crowdWarning = document.getElementById("ts-crowd-warning");
    els.crowdText = document.getElementById("ts-crowd-text");
    els.diagramOutline = document.getElementById("ts-diagram-outline");
    els.diagramPad1 = document.getElementById("ts-diagram-pad1");
    els.diagramPad2 = document.getElementById("ts-diagram-pad2");
    els.diagramLabel = document.getElementById("ts-diagram-label");
    els.resetBtn = document.getElementById("ts-reset");
    els.copyBtn = document.getElementById("ts-copy");

    if (!els.adults || !els.sleepSetup) return;

    [els.adults, els.children, els.pets].forEach(function (input) {
      input.addEventListener("input", debouncedRender);
      input.addEventListener("change", render);
    });
    els.sleepSetup.addEventListener("change", render);

    calc.wireSegmented(els.petSizeGroup, render);
    calc.wireSegmented(els.gearGroup, render);
    calc.wireSegmented(els.comfortGroup, render);

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
