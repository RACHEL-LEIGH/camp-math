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

  /* Past this comfortable-capacity size, one tent stops being practical (weight, cost,
     pitch time, availability), so we recommend splitting into several smaller tents
     instead of one giant one. TARGET_TENT_SIZE is the size we split groups into. */
  var MAX_SINGLE_TENT_PEOPLE = 8;
  var TARGET_TENT_SIZE = 6;

  /* Diagram: draw at most this many individual sleeper/pet icons before collapsing
     the rest into a "+N more" note, so the floor plan stays legible for big groups. */
  var MAX_DRAWN_SLEEPERS = 16;
  var MAX_DRAWN_PETS = 6;

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

    /* Multiple-tent recommendation: past MAX_SINGLE_TENT_PEOPLE, suggest splitting
       into several TARGET_TENT_SIZE-ish tents rather than one oversized tent. This
       is a planning simplification, not an assignment of specific people/pets to
       specific tents. */
    var suggestMultipleTents = comfortCapacityPeople > MAX_SINGLE_TENT_PEOPLE;
    var recommendedTentCount = suggestMultipleTents
      ? Math.max(2, Math.ceil(comfortCapacityPeople / TARGET_TENT_SIZE))
      : 1;
    var sizePerTent = recommendedTentCount > 1
      ? Math.ceil(comfortCapacityPeople / recommendedTentCount)
      : comfortCapacityPeople;
    var peoplePerTent = recommendedTentCount > 1 && totalOccupants > 0
      ? Math.ceil(totalOccupants / recommendedTentCount)
      : totalOccupants;

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
      crowdingWarning: crowdingWarning,
      adults: adults,
      children: children,
      pets: pets,
      suggestMultipleTents: suggestMultipleTents,
      recommendedTentCount: recommendedTentCount,
      sizePerTent: sizePerTent,
      peoplePerTent: peoplePerTent
    };
  }

  /* ---------- Diagram scaling ----------
   * Draws one small rectangle per adult/child sleeper (children in a second color)
   * and one small circle per pet, arranged in a grid that fills the scaled tent
   * outline — so the diagram actually reflects how many people/pets were entered,
   * instead of always showing two fixed rectangles. Large groups are capped at
   * MAX_DRAWN_SLEEPERS/MAX_DRAWN_PETS icons with a "+N more" note so the grid
   * stays legible; the caption below the diagram always states the real totals.
   */
  var SVG_NS = "http://www.w3.org/2000/svg";

  function clearGroup(g) {
    while (g.firstChild) g.removeChild(g.firstChild);
  }

  function updateDiagram(roundedSide, adults, children, pets) {
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

    if (els.diagramLabel) {
      els.diagramLabel.textContent = calc.formatNumber(safeSide, safeSide % 1 === 0 ? 0 : 1) + " x " + calc.formatNumber(safeSide, safeSide % 1 === 0 ? 0 : 1) + " ft";
    }

    var totalSleepers = Math.max(0, Math.round(adults + children));
    var totalPets = Math.max(0, Math.round(pets));
    var drawnSleepers = Math.min(totalSleepers, MAX_DRAWN_SLEEPERS);
    var drawnPets = Math.min(totalPets, MAX_DRAWN_PETS);
    var drawnChildren = Math.min(children, drawnSleepers);
    var drawnAdults = drawnSleepers - drawnChildren;

    if (els.diagramPads) {
      clearGroup(els.diagramPads);

      var inset = boxSize * 0.09;
      var gridX0 = x + inset;
      var gridY0 = y + inset;
      var gridW = boxSize - inset * 2;
      var reserveForPets = drawnPets > 0 ? boxSize * 0.2 : 0;
      var sleeperGridH = boxSize - inset * 2 - reserveForPets;

      if (drawnSleepers > 0) {
        var cols = calc.clamp(Math.ceil(Math.sqrt(drawnSleepers * (gridW / sleeperGridH))), 1, 8);
        var rows = Math.ceil(drawnSleepers / cols);
        var cellW = gridW / cols;
        var cellH = sleeperGridH / rows;
        var padW = cellW * 0.62;
        var padH = cellH * 0.78;

        for (var i = 0; i < drawnSleepers; i++) {
          var col = i % cols;
          var row = Math.floor(i / cols);
          var cx = gridX0 + col * cellW + cellW / 2;
          var cy = gridY0 + row * cellH + cellH / 2;
          var rect = document.createElementNS(SVG_NS, "rect");
          // Draw children last, so with few sleepers the adult/child mix stays visually grouped.
          rect.setAttribute("class", i >= drawnAdults ? "tent-pad-child" : "tent-pad");
          rect.setAttribute("x", String(cx - padW / 2));
          rect.setAttribute("y", String(cy - padH / 2));
          rect.setAttribute("width", String(Math.max(2, padW)));
          rect.setAttribute("height", String(Math.max(2, padH)));
          rect.setAttribute("rx", String(Math.min(4, padW * 0.15)));
          els.diagramPads.appendChild(rect);
        }
      }

      if (drawnPets > 0) {
        var petRowY = gridY0 + sleeperGridH + boxSize * 0.06;
        var petCellW = gridW / drawnPets;
        var petR = Math.min(petCellW * 0.32, reserveForPets * 0.4);
        for (var p = 0; p < drawnPets; p++) {
          var pcx = gridX0 + p * petCellW + petCellW / 2;
          var pcy = petRowY + reserveForPets * 0.4;
          var circle = document.createElementNS(SVG_NS, "circle");
          circle.setAttribute("class", "tent-pet");
          circle.setAttribute("cx", String(pcx));
          circle.setAttribute("cy", String(pcy));
          circle.setAttribute("r", String(Math.max(2, petR)));
          els.diagramPads.appendChild(circle);
        }
      }
    }

    if (els.diagramOverflow) {
      var overflowSleepers = totalSleepers - drawnSleepers;
      var overflowPets = totalPets - drawnPets;
      var parts = [];
      if (overflowSleepers > 0) parts.push("+" + overflowSleepers + " more sleeper" + (overflowSleepers === 1 ? "" : "s"));
      if (overflowPets > 0) parts.push("+" + overflowPets + " more pet" + (overflowPets === 1 ? "" : "s"));
      els.diagramOverflow.textContent = parts.join(", ");
    }

    if (els.diagramSummary) {
      var sleeperWord = totalSleepers === 1 ? "sleeper" : "sleepers";
      var summary = "Showing " + totalSleepers + " " + sleeperWord;
      if (totalPets > 0) {
        summary += " and " + totalPets + " pet" + (totalPets === 1 ? "" : "s");
      }
      summary += " in a " + calc.formatNumber(safeSide, safeSide % 1 === 0 ? 0 : 1) + " x " + calc.formatNumber(safeSide, safeSide % 1 === 0 ? 0 : 1) + " ft footprint.";
      els.diagramSummary.textContent = summary;
    }

    if (els.diagramLegendPet) {
      els.diagramLegendPet.style.display = totalPets > 0 ? "" : "none";
    }
    if (els.diagramLegendChild) {
      els.diagramLegendChild.style.display = children > 0 ? "" : "none";
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

    if (result.suggestMultipleTents) {
      els.multiTent.hidden = false;
      els.multiTentText.textContent = "A single " + comfortCapacitySafe + "-person tent is impractical to buy, carry, and pitch. Plan for about " + result.recommendedTentCount + " tents sized around " + result.sizePerTent + "-person capacity each (roughly " + result.peoplePerTent + " people per tent) instead of one oversized tent.";
    } else {
      els.multiTent.hidden = true;
    }

    updateDiagram(roundedSideSafe, input.adults, input.children, input.pets);

    els.lastComfortCapacity = comfortCapacitySafe;
    els.lastFloorArea = comfortableAreaSafe;
    els.lastMinCapacity = minCapacitySafe;
    els.lastDimensions = roundedSideSafe;
    els.lastSuggestMultipleTents = result.suggestMultipleTents;
    els.lastRecommendedTentCount = result.recommendedTentCount;
    els.lastSizePerTent = result.sizePerTent;
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
    if (els.lastSuggestMultipleTents) {
      text += "\nConsider " + els.lastRecommendedTentCount + " tents at about " + els.lastSizePerTent + "-person capacity each instead of one large tent.";
    }
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
    els.multiTent = document.getElementById("ts-multi-tent");
    els.multiTentText = document.getElementById("ts-multi-tent-text");
    els.diagramOutline = document.getElementById("ts-diagram-outline");
    els.diagramPads = document.getElementById("ts-diagram-pads");
    els.diagramOverflow = document.getElementById("ts-diagram-overflow");
    els.diagramLabel = document.getElementById("ts-diagram-label");
    els.diagramSummary = document.getElementById("ts-diagram-summary");
    els.diagramLegendPet = document.getElementById("ts-diagram-legend-pet");
    els.diagramLegendChild = document.getElementById("ts-diagram-legend-child");
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
