/*!
 * Camp Math — calc-campsite-size.js
 * Page-specific logic for the Campsite Size calculator.
 * Depends on window.CampMath.calc (js/calculators.js) and js/shared.js.
 */
(function () {
  "use strict";

  var calc = window.CampMath && window.CampMath.calc;
  if (!calc) return;

  var DEFAULTS = {
    padLength: 30,
    padWidth: 20,
    tentLength: 10,
    tentWidth: 10,
    numVehicles: 1,
    vehicleLength: 17,
    vehicleWidth: 7,
    canopyLength: 0,
    canopyWidth: 0,
    clearance: 2,
    kitchenLength: 0,
    kitchenWidth: 0,
    layoutType: "one_pad"
  };

  var els = {};

  function byId(id) { return document.getElementById(id); }

  function cacheEls() {
    els.padLength = byId("padLength");
    els.padWidth = byId("padWidth");
    els.tentLength = byId("tentLength");
    els.tentWidth = byId("tentWidth");
    els.numVehicles = byId("numVehicles");
    els.vehicleLength = byId("vehicleLength");
    els.vehicleWidth = byId("vehicleWidth");
    els.canopyLength = byId("canopyLength");
    els.canopyWidth = byId("canopyWidth");
    els.clearance = byId("clearance");
    els.kitchenLength = byId("kitchenLength");
    els.kitchenWidth = byId("kitchenWidth");
    els.layoutType = byId("layoutType");

    els.fitResultValue = byId("fitResultValue");
    els.fitResultSub = byId("fitResultSub");
    els.orientationText = byId("orientationText");
    els.padAreaValue = byId("padAreaValue");
    els.occupiedAreaValue = byId("occupiedAreaValue");
    els.remainingAreaValue = byId("remainingAreaValue");
    els.diagramContainer = byId("diagramContainer");
    els.vehicleSeparateNote = byId("vehicleSeparateNote");
    els.resetBtn = byId("resetBtn");
    els.copyBtn = byId("copyBtn");
  }

  function getLayoutType() {
    return calc.getSegmentedValue(els.layoutType) || DEFAULTS.layoutType;
  }

  function readInputs() {
    var v = {};
    v.padLength = calc.validateField(els.padLength, { required: true, min: 5, max: 500, fallback: DEFAULTS.padLength }).value;
    v.padWidth = calc.validateField(els.padWidth, { required: true, min: 5, max: 500, fallback: DEFAULTS.padWidth }).value;
    v.tentLength = calc.validateField(els.tentLength, { required: true, min: 1, max: 100, fallback: DEFAULTS.tentLength }).value;
    v.tentWidth = calc.validateField(els.tentWidth, { required: true, min: 1, max: 100, fallback: DEFAULTS.tentWidth }).value;
    v.numVehicles = calc.validateField(els.numVehicles, { required: true, min: 0, max: 10, fallback: DEFAULTS.numVehicles }).value;
    v.vehicleLength = calc.validateField(els.vehicleLength, { required: true, min: 0, max: 60, fallback: DEFAULTS.vehicleLength }).value;
    v.vehicleWidth = calc.validateField(els.vehicleWidth, { required: true, min: 0, max: 30, fallback: DEFAULTS.vehicleWidth }).value;
    v.canopyLength = calc.validateField(els.canopyLength, { required: false, min: 0, max: 100, fallback: DEFAULTS.canopyLength }).value;
    v.canopyWidth = calc.validateField(els.canopyWidth, { required: false, min: 0, max: 100, fallback: DEFAULTS.canopyWidth }).value;
    v.clearance = calc.validateField(els.clearance, { required: true, min: 0, max: 20, fallback: DEFAULTS.clearance }).value;
    v.kitchenLength = calc.validateField(els.kitchenLength, { required: false, min: 0, max: 100, fallback: DEFAULTS.kitchenLength }).value;
    v.kitchenWidth = calc.validateField(els.kitchenWidth, { required: false, min: 0, max: 100, fallback: DEFAULTS.kitchenWidth }).value;
    v.layoutType = getLayoutType();
    return v;
  }

  /* How this estimate is calculated: pad area vs. the tent's footprint (with
   * clearance added on every side, tested in both orientations) plus the
   * footprint of any vehicle, canopy, and kitchen zone that share the pad —
   * the ratio of occupied space to total pad area drives the fit rating. */
  function computeResult(inputs) {
    var padArea = inputs.padLength * inputs.padWidth;

    var effectiveTentL = inputs.tentLength + 2 * inputs.clearance;
    var effectiveTentW = inputs.tentWidth + 2 * inputs.clearance;

    var fitsOrientationA = effectiveTentL <= inputs.padLength && effectiveTentW <= inputs.padWidth;
    var fitsOrientationB = effectiveTentW <= inputs.padLength && effectiveTentL <= inputs.padWidth;
    var tentDimensionFits = fitsOrientationA || fitsOrientationB;

    var suggestedOrientation;
    if (fitsOrientationA && fitsOrientationB) {
      suggestedOrientation = "Either orientation works";
    } else if (fitsOrientationA) {
      suggestedOrientation = "Place the tent's length along the pad's length";
    } else if (fitsOrientationB) {
      suggestedOrientation = "Rotate the tent 90° — place its length along the pad's width";
    } else {
      suggestedOrientation = "No orientation fits with your clearance — see warning";
    }

    var vehicleArea = inputs.numVehicles * inputs.vehicleLength * inputs.vehicleWidth;
    var canopyArea = inputs.canopyLength * inputs.canopyWidth;
    var kitchenArea = inputs.kitchenLength * inputs.kitchenWidth;
    var tentEffectiveArea = effectiveTentL * effectiveTentW;

    if (inputs.layoutType === "vehicle_separate") vehicleArea = 0;
    if (inputs.layoutType === "tent_pad_only") { vehicleArea = 0; canopyArea = 0; kitchenArea = 0; }

    var totalOccupiedFootprint = tentEffectiveArea + vehicleArea + canopyArea + kitchenArea;
    var remainingArea = Math.max(0, padArea - totalOccupiedFootprint);
    var occupiedRatio = padArea > 0 ? totalOccupiedFootprint / padArea : 1;

    var fitResult;
    if (!tentDimensionFits) {
      fitResult = "Unlikely to fit";
    } else if (occupiedRatio <= 0.6) {
      fitResult = "Comfortable fit";
    } else if (occupiedRatio <= 0.9) {
      fitResult = "Tight fit";
    } else {
      fitResult = "Unlikely to fit";
    }

    return {
      padArea: padArea,
      effectiveTentL: effectiveTentL,
      effectiveTentW: effectiveTentW,
      fitsOrientationA: fitsOrientationA,
      fitsOrientationB: fitsOrientationB,
      tentDimensionFits: tentDimensionFits,
      suggestedOrientation: suggestedOrientation,
      vehicleArea: vehicleArea,
      canopyArea: canopyArea,
      kitchenArea: kitchenArea,
      tentEffectiveArea: tentEffectiveArea,
      totalOccupiedFootprint: totalOccupiedFootprint,
      remainingArea: remainingArea,
      occupiedRatio: occupiedRatio,
      fitResult: fitResult
    };
  }

  function safeNumber(n) {
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function renderResult(inputs, result) {
    if (els.fitResultValue) {
      els.fitResultValue.textContent = result.fitResult;
    }
    if (els.fitResultSub) {
      var subMap = {
        "Comfortable fit": "Your tent, and everything else you're bringing, should fit with room to spare.",
        "Tight fit": "It should fit, but space will be snug — plan your layout carefully.",
        "Unlikely to fit": "Your gear likely won't fit comfortably on this pad as configured."
      };
      els.fitResultSub.textContent = subMap[result.fitResult] || "";
    }

    var primaryCard = els.fitResultValue ? els.fitResultValue.closest(".result-primary") : null;
    if (primaryCard) {
      primaryCard.classList.toggle("result-primary-warn", result.fitResult !== "Comfortable fit");
    }

    if (els.orientationText) {
      els.orientationText.textContent = result.suggestedOrientation;
    }

    if (els.padAreaValue) els.padAreaValue.textContent = calc.formatNumber(safeNumber(result.padArea), 0);
    if (els.occupiedAreaValue) els.occupiedAreaValue.textContent = calc.formatNumber(safeNumber(result.totalOccupiedFootprint), 0);
    if (els.remainingAreaValue) els.remainingAreaValue.textContent = calc.formatNumber(safeNumber(result.remainingArea), 0);

    if (els.vehicleSeparateNote) {
      els.vehicleSeparateNote.hidden = !(inputs.layoutType === "vehicle_separate" && inputs.numVehicles > 0);
    }

    renderDiagram(inputs, result);
  }

  /* ---------- Inline top-down SVG diagram ---------- */
  function renderDiagram(inputs, result) {
    if (!els.diagramContainer) return;

    var padWidth = inputs.padWidth;   // horizontal axis
    var padLength = inputs.padLength; // vertical axis

    var useOrientationA;
    if (result.fitsOrientationA && result.fitsOrientationB) {
      useOrientationA = true;
    } else if (result.fitsOrientationA) {
      useOrientationA = true;
    } else if (result.fitsOrientationB) {
      useOrientationA = false;
    } else {
      var overflowA = Math.max(0, result.effectiveTentL - padLength) + Math.max(0, result.effectiveTentW - padWidth);
      var overflowB = Math.max(0, result.effectiveTentW - padLength) + Math.max(0, result.effectiveTentL - padWidth);
      useOrientationA = overflowA <= overflowB;
    }

    var tentW = useOrientationA ? result.effectiveTentW : result.effectiveTentL;
    var tentH = useOrientationA ? result.effectiveTentL : result.effectiveTentW;

    var items = [
      { w: tentW, h: tentH, label: "Tent + clearance", fill: "#3c7d49", stroke: result.tentDimensionFits ? "#204a2c" : "#b3402c", dashed: !result.tentDimensionFits }
    ];

    if (inputs.layoutType !== "tent_pad_only") {
      if (inputs.layoutType === "one_pad" && inputs.numVehicles > 0 && inputs.vehicleLength > 0 && inputs.vehicleWidth > 0) {
        var maxDrawn = Math.min(inputs.numVehicles, 3);
        for (var i = 0; i < maxDrawn; i++) {
          items.push({ w: inputs.vehicleWidth, h: inputs.vehicleLength, label: "Vehicle", fill: "#5f95a8", stroke: "#3f6f80" });
        }
        if (inputs.numVehicles > 3) {
          var extra = inputs.numVehicles - 3;
          var extraArea = extra * inputs.vehicleLength * inputs.vehicleWidth;
          var side = Math.sqrt(extraArea) || 0;
          items.push({ w: side, h: side, label: "+" + extra + " more", fill: "#5f95a8", stroke: "#3f6f80" });
        }
      }
      if (inputs.canopyLength > 0 && inputs.canopyWidth > 0) {
        items.push({ w: inputs.canopyWidth, h: inputs.canopyLength, label: "Canopy", fill: "#dd7635", stroke: "#b85a20" });
      }
      if (inputs.kitchenLength > 0 && inputs.kitchenWidth > 0) {
        items.push({ w: inputs.kitchenWidth, h: inputs.kitchenLength, label: "Kitchen", fill: "#a67c52", stroke: "#7a5636" });
      }
    }

    /* Simple shelf packing: fill a row left-to-right up to the pad width,
       then wrap to a new row below — purely illustrative, not a real plan. */
    var rowLimit = Math.max(padWidth, tentW) * 1.15;
    var cursorX = 0, cursorY = 0, rowHeight = 0;
    var placed = [];
    var contentW = 0, contentH = 0;

    items.forEach(function (item) {
      if (cursorX > 0 && cursorX + item.w > rowLimit) {
        cursorY += rowHeight;
        cursorX = 0;
        rowHeight = 0;
      }
      placed.push({ x: cursorX, y: cursorY, w: item.w, h: item.h, label: item.label, fill: item.fill, stroke: item.stroke, dashed: item.dashed });
      cursorX += item.w;
      rowHeight = Math.max(rowHeight, item.h);
      contentW = Math.max(contentW, cursorX);
      contentH = Math.max(contentH, cursorY + rowHeight);
    });

    var extentW = Math.max(padWidth, contentW);
    var extentH = Math.max(padLength, contentH);
    var margin = Math.max(extentW, extentH) * 0.12 + 1;
    var vbW = extentW + margin * 2;
    var vbH = extentH + margin * 2;

    var displayPx = 320;
    var pxPerUnit = displayPx / vbW;
    function px(desiredPx) { return desiredPx / pxPerUnit; }

    var svg = '<svg viewBox="0 0 ' + calc.round(vbW, 2) + ' ' + calc.round(vbH, 2) + '" ' +
      'role="img" aria-label="Top-down diagram of a ' + calc.round(padLength, 0) + ' by ' + calc.round(padWidth, 0) +
      ' foot campsite pad with the tent and other gear sketched to scale" class="campsite-diagram-svg">';

    // Pad outline
    svg += '<rect x="' + margin + '" y="' + margin + '" width="' + padWidth + '" height="' + padLength +
      '" fill="#efe6cf" stroke="#204a2c" stroke-width="' + px(2.5) + '" rx="' + px(4) + '"/>';

    // Placed items
    placed.forEach(function (p) {
      var x = margin + p.x;
      var y = margin + p.y;
      var dash = p.dashed ? ' stroke-dasharray="' + px(6) + ' ' + px(4) + '"' : "";
      svg += '<rect x="' + x + '" y="' + y + '" width="' + p.w + '" height="' + p.h + '" fill="' + p.fill +
        '" fill-opacity="0.55" stroke="' + p.stroke + '" stroke-width="' + px(2) + '"' + dash + ' rx="' + px(3) + '"/>';
      if (p.w > 0 && p.h > 0) {
        svg += '<text x="' + (x + p.w / 2) + '" y="' + (y + p.h / 2) + '" text-anchor="middle" dominant-baseline="middle" ' +
          'font-size="' + px(11) + '" font-family="sans-serif" font-weight="700" fill="#17351f">' + p.label + '</text>';
      }
    });

    svg += '<text x="' + (margin + padWidth / 2) + '" y="' + (margin - px(6)) + '" text-anchor="middle" ' +
      'font-size="' + px(12) + '" font-family="sans-serif" font-weight="700" fill="#204a2c">Pad: ' +
      calc.round(padLength, 0) + ' × ' + calc.round(padWidth, 0) + ' ft</text>';

    svg += '</svg>';

    els.diagramContainer.innerHTML = svg;
  }

  function recalc() {
    var inputs = readInputs();
    var result = computeResult(inputs);
    renderResult(inputs, result);
    return { inputs: inputs, result: result };
  }

  function buildCopyText() {
    var data = recalc();
    var i = data.inputs, r = data.result;
    return "Campsite Size Calculator — " + r.fitResult + ". Site: " + calc.formatNumber(i.padLength, 0) + "x" +
      calc.formatNumber(i.padWidth, 0) + " ft (" + calc.formatNumber(r.padArea, 0) + " sq ft). Occupied: " +
      calc.formatNumber(r.totalOccupiedFootprint, 0) + " sq ft. Remaining: " + calc.formatNumber(r.remainingArea, 0) +
      " sq ft. Orientation: " + r.suggestedOrientation + ".";
  }

  function resetToDefaults() {
    Object.keys(DEFAULTS).forEach(function (key) {
      if (key === "layoutType") return;
      if (els[key]) els[key].value = DEFAULTS[key];
      var wrap = els[key] && els[key].closest(".field");
      if (wrap) wrap.classList.remove("invalid");
    });
    if (els.layoutType) {
      var buttons = Array.prototype.slice.call(els.layoutType.querySelectorAll("button"));
      buttons.forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-value") === DEFAULTS.layoutType ? "true" : "false");
      });
    }
    recalc();
  }

  function wireEvents() {
    var debouncedRecalc = calc.debounce(recalc, 150);
    var numberFields = [
      els.padLength, els.padWidth, els.tentLength, els.tentWidth, els.numVehicles,
      els.vehicleLength, els.vehicleWidth, els.canopyLength, els.canopyWidth,
      els.clearance, els.kitchenLength, els.kitchenWidth
    ];
    numberFields.forEach(function (input) {
      if (!input) return;
      input.addEventListener("input", debouncedRecalc);
      input.addEventListener("change", recalc);
    });

    calc.wireSegmented(els.layoutType, recalc);

    if (els.resetBtn) {
      els.resetBtn.addEventListener("click", resetToDefaults);
    }
    if (els.copyBtn) {
      els.copyBtn.addEventListener("click", function () {
        calc.copyResult(buildCopyText());
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    cacheEls();
    wireEvents();
    recalc();
  });
})();
