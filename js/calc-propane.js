/*!
 * Camp Math — calc-propane.js
 * Page logic for the Propane Calculator: a multi-row appliance repeater plus
 * cylinder/reserve/cost settings, with live-updating results.
 */
(function () {
  "use strict";

  var calc = window.CampMath && window.CampMath.calc;
  if (!calc) return;

  var BTU_PER_LB_PROPANE = 21600; // standard planning conversion — an approximation, not an exact constant
  var MAX_ROWS = 10;

  var PRESETS = {
    twoBurnerStove: { name: "Two-burner camp stove", btu: 30000, duty: 100 },
    singleBurnerStove: { name: "Single-burner stove", btu: 10000, duty: 100 },
    lantern: { name: "Propane lantern", btu: 2000, duty: 100 },
    firePit: { name: "Portable propane fire pit", btu: 50000, duty: 100 },
    griddle: { name: "Camp griddle", btu: 15000, duty: 100 },
    heater: { name: "Portable heater", btu: 9000, duty: 60 },
    furnace: { name: "RV furnace", btu: 20000, duty: 35 },
    fridge: { name: "Refrigerator", btu: 2500, duty: 25 },
    waterHeater: { name: "Water heater", btu: 34000, duty: 20 },
    custom: { name: "", btu: 0, duty: 100 }
  };

  var PRESET_ORDER = [
    "twoBurnerStove", "singleBurnerStove", "lantern", "firePit", "griddle",
    "heater", "furnace", "fridge", "waterHeater", "custom"
  ];

  var state = {
    rows: [],
    nextId: 1,
    cylinderType: "20", // "1" | "5" | "10" | "20" | "custom"
    customWeight: 20,
    reservePercent: 20,
    cylinderPrice: 25
  };

  var lastResults = null;

  /* ---------- DOM refs (assigned in init) ---------- */
  var rowsContainer, addBtn, addHelp, cylinderSegmented, customWeightField, customWeightInput,
    reserveInput, priceInput, resultCylinders, resultCylinderUnit, resultSub,
    resultTotalBtu, resultLbNeeded, resultCost, resultRuntime, breakdownBody,
    reserveDetail, gaugeFill, gaugePercentLabel, copyBtn, resetBtn;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    rowsContainer = document.getElementById("appliance-rows");
    addBtn = document.getElementById("add-appliance-btn");
    addHelp = document.getElementById("add-appliance-help");
    cylinderSegmented = document.getElementById("cylinder-type-segmented");
    customWeightField = document.getElementById("custom-weight-field");
    customWeightInput = document.getElementById("custom-weight");
    reserveInput = document.getElementById("reserve-percent");
    priceInput = document.getElementById("cylinder-price");
    resultCylinders = document.getElementById("result-cylinders");
    resultCylinderUnit = document.getElementById("result-cylinder-unit");
    resultSub = document.getElementById("result-sub");
    resultTotalBtu = document.getElementById("result-total-btu");
    resultLbNeeded = document.getElementById("result-lb-needed");
    resultCost = document.getElementById("result-cost");
    resultRuntime = document.getElementById("result-runtime");
    breakdownBody = document.getElementById("breakdown-body");
    reserveDetail = document.getElementById("reserve-detail");
    gaugeFill = document.getElementById("gauge-fill");
    gaugePercentLabel = document.getElementById("gauge-percent-label");
    copyBtn = document.getElementById("copy-btn");
    resetBtn = document.getElementById("reset-btn");

    state.rows = [makeRow("twoBurnerStove")];
    renderAllRows();
    wireRowEvents();
    wireGlobalInputs();
    wireActions();
    updateResults();
  }

  /* ---------- Row model ---------- */
  function makeRow(presetKey) {
    var preset = PRESETS[presetKey] || PRESETS.custom;
    return {
      id: state.nextId++,
      preset: presetKey,
      name: preset.name,
      btu: preset.btu,
      hours: 1,
      days: 3,
      duty: preset.duty,
      qty: 1
    };
  }

  function getRowById(id) {
    for (var i = 0; i < state.rows.length; i++) {
      if (state.rows[i].id === id) return state.rows[i];
    }
    return null;
  }

  /* ---------- Row DOM building ---------- */
  function buildPresetOptions(selectedKey) {
    return PRESET_ORDER.map(function (key) {
      var label = PRESETS[key].name || "Custom appliance";
      var sel = key === selectedKey ? " selected" : "";
      return '<option value="' + key + '"' + sel + ">" + label + "</option>";
    }).join("");
  }

  function escapeHtml(str) {
    return String(str === null || str === undefined ? "" : str)
      .replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function buildRowElement(row) {
    var el = document.createElement("div");
    el.className = "repeater-row";
    el.setAttribute("data-row-id", String(row.id));
    el.innerHTML =
      '<button type="button" class="remove-row" data-action="remove-row" aria-label="Remove this appliance">&times;</button>' +
      '<div class="field">' +
        "<label>Appliance type</label>" +
        '<select data-key="preset">' + buildPresetOptions(row.preset) + "</select>" +
      "</div>" +
      '<div class="field-row cols-3">' +
        '<div class="field" data-field>' +
          "<label>Appliance name</label>" +
          '<input type="text" data-key="name" maxlength="60" placeholder="e.g. Camp stove" value="' + escapeHtml(row.name) + '">' +
        "</div>" +
        '<div class="field" data-field>' +
          "<label>BTU per hour</label>" +
          '<input type="number" data-key="btu" min="0" max="200000" step="500" value="' + row.btu + '">' +
          '<span class="error-msg" data-error></span>' +
        "</div>" +
        '<div class="field" data-field>' +
          "<label>Number of these</label>" +
          '<input type="number" data-key="qty" min="1" max="20" step="1" value="' + row.qty + '">' +
          '<span class="error-msg" data-error></span>' +
        "</div>" +
      "</div>" +
      '<div class="field-row cols-3">' +
        '<div class="field" data-field>' +
          "<label>Hours used per day</label>" +
          '<input type="number" data-key="hours" min="0" max="24" step="0.5" value="' + row.hours + '">' +
          '<span class="error-msg" data-error></span>' +
        "</div>" +
        '<div class="field" data-field>' +
          "<label>Number of days</label>" +
          '<input type="number" data-key="days" min="0" max="60" step="1" value="' + row.days + '">' +
          '<span class="error-msg" data-error></span>' +
        "</div>" +
        '<div class="field" data-field>' +
          "<label>Duty cycle (%)</label>" +
          '<input type="number" data-key="duty" min="1" max="100" step="1" value="' + row.duty + '">' +
          '<span class="help">For thermostatic appliances like heaters, furnaces, and refrigerators, this is the percent of time they’re actually firing, not just plugged in.</span>' +
          '<span class="error-msg" data-error></span>' +
        "</div>" +
      "</div>";
    return el;
  }

  function renderAllRows() {
    rowsContainer.innerHTML = "";
    state.rows.forEach(function (row) {
      rowsContainer.appendChild(buildRowElement(row));
    });
    syncRemoveButtons();
    syncAddButton();
  }

  function syncRemoveButtons() {
    var onlyOne = state.rows.length <= 1;
    var buttons = rowsContainer.querySelectorAll(".remove-row");
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.disabled = onlyOne;
      btn.hidden = onlyOne;
    });
  }

  function syncAddButton() {
    var atMax = state.rows.length >= MAX_ROWS;
    addBtn.disabled = atMax;
    addHelp.textContent = atMax ? "Maximum of " + MAX_ROWS + " appliances reached." : "";
  }

  function clearFieldError(input) {
    if (!input) return;
    var wrap = input.closest(".field");
    if (wrap) wrap.classList.remove("invalid");
    var err = wrap ? wrap.querySelector(".error-msg") : null;
    if (err) err.textContent = "";
  }

  /* ---------- Row events (delegated so re-renders don't need re-binding) ---------- */
  var debouncedUpdate = calc.debounce(updateResults, 150);

  function fieldValidationOptions(key) {
    switch (key) {
      case "btu": return { min: 0, max: 200000, fallback: 0 };
      case "hours": return { min: 0, max: 24, fallback: 1 };
      case "days": return { min: 0, max: 60, fallback: 3 };
      case "duty": return { min: 1, max: 100, fallback: 100 };
      case "qty": return { min: 1, max: 20, fallback: 1 };
      default: return {};
    }
  }

  function wireRowEvents() {
    rowsContainer.addEventListener("input", function (e) {
      var target = e.target;
      var key = target.getAttribute("data-key");
      if (!key || key === "preset") return;
      var rowEl = target.closest(".repeater-row");
      if (!rowEl) return;
      var row = getRowById(parseInt(rowEl.getAttribute("data-row-id"), 10));
      if (!row) return;

      if (key === "name") {
        row.name = target.value;
        debouncedUpdate();
        return;
      }
      var result = calc.validateField(target, fieldValidationOptions(key));
      row[key] = result.value;
      debouncedUpdate();
    });

    rowsContainer.addEventListener("change", function (e) {
      var target = e.target;
      if (target.getAttribute("data-key") !== "preset") return;
      var rowEl = target.closest(".repeater-row");
      if (!rowEl) return;
      var row = getRowById(parseInt(rowEl.getAttribute("data-row-id"), 10));
      if (!row) return;

      var presetKey = target.value;
      var preset = PRESETS[presetKey] || PRESETS.custom;
      row.preset = presetKey;
      row.btu = preset.btu;
      row.duty = preset.duty;
      row.name = preset.name;

      var nameInput = rowEl.querySelector('[data-key="name"]');
      var btuInput = rowEl.querySelector('[data-key="btu"]');
      var dutyInput = rowEl.querySelector('[data-key="duty"]');
      if (nameInput) { nameInput.value = row.name; clearFieldError(nameInput); }
      if (btuInput) { btuInput.value = row.btu; clearFieldError(btuInput); }
      if (dutyInput) { dutyInput.value = row.duty; clearFieldError(dutyInput); }
      updateResults();
    });

    rowsContainer.addEventListener("click", function (e) {
      var btn = e.target.closest('[data-action="remove-row"]');
      if (!btn) return;
      if (state.rows.length <= 1) return;
      var rowEl = btn.closest(".repeater-row");
      var id = parseInt(rowEl.getAttribute("data-row-id"), 10);
      state.rows = state.rows.filter(function (r) { return r.id !== id; });
      rowEl.parentNode.removeChild(rowEl);
      syncRemoveButtons();
      syncAddButton();
      updateResults();
    });
  }

  /* ---------- Global inputs ---------- */
  function setSegmentedActive(container, value) {
    var buttons = container.querySelectorAll("button");
    Array.prototype.forEach.call(buttons, function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-value") === value ? "true" : "false");
    });
  }

  function wireGlobalInputs() {
    calc.wireSegmented(cylinderSegmented, function (value) {
      state.cylinderType = value;
      customWeightField.hidden = value !== "custom";
      updateResults();
    });

    customWeightInput.addEventListener("input", calc.debounce(function () {
      var result = calc.validateField(customWeightInput, { min: 0.5, max: 1000, fallback: 20 });
      state.customWeight = result.value;
      updateResults();
    }, 150));

    reserveInput.addEventListener("input", calc.debounce(function () {
      var result = calc.validateField(reserveInput, { min: 0, max: 200, fallback: 20 });
      state.reservePercent = result.value;
      updateResults();
    }, 150));

    priceInput.addEventListener("input", calc.debounce(function () {
      var result = calc.validateField(priceInput, { min: 0, max: 1000, fallback: 25 });
      state.cylinderPrice = result.value;
      updateResults();
    }, 150));
  }

  /* ---------- Add / Reset / Copy ---------- */
  function wireActions() {
    addBtn.addEventListener("click", function () {
      if (state.rows.length >= MAX_ROWS) return;
      var row = makeRow("custom");
      state.rows.push(row);
      rowsContainer.appendChild(buildRowElement(row));
      syncRemoveButtons();
      syncAddButton();
      updateResults();
      var newRowEl = rowsContainer.lastElementChild;
      var firstField = newRowEl && newRowEl.querySelector("select");
      if (firstField) firstField.focus();
    });

    resetBtn.addEventListener("click", function () {
      state.rows = [makeRow("twoBurnerStove")];
      state.cylinderType = "20";
      state.customWeight = 20;
      state.reservePercent = 20;
      state.cylinderPrice = 25;

      renderAllRows();
      setSegmentedActive(cylinderSegmented, "20");
      customWeightField.hidden = true;
      customWeightInput.value = "20";
      reserveInput.value = "20";
      priceInput.value = "25";
      clearFieldError(customWeightInput);
      clearFieldError(reserveInput);
      clearFieldError(priceInput);

      updateResults();
    });

    copyBtn.addEventListener("click", function () {
      calc.copyResult(buildCopyText());
    });
  }

  /* ---------- Core math ----------
   * rowBTU = btuPerHour * hoursPerDay * days * (dutyCyclePercent / 100) * quantity
   * totalBTU = sum(rowBTU for all rows)
   * lbPropaneNeeded = totalBTU / BTU_PER_LB_PROPANE (21,600 BTU per lb — a planning approximation)
   * lbPropaneWithReserve = lbPropaneNeeded * (1 + reservePercent / 100)
   * usableFraction = cylinderType === "1" ? 0.9 : 0.8 (refillable tanks fill to ~80% of nominal weight;
   *   1 lb disposable bottles fill to ~90% — both leave vapor-space safety margin)
   * usableLbPerCylinder = nominalCylinderLb * usableFraction
   * cylindersNeeded = ceil(lbPropaneWithReserve / usableLbPerCylinder)
   * totalCost = cylindersNeeded * cylinderPrice
   * totalPropaneAvailableLb = cylindersNeeded * usableLbPerCylinder
   * avgDailyBTU = totalBTU / max(1, maxDaysAcrossRows)
   * estimatedRuntimeDays = (totalPropaneAvailableLb * BTU_PER_LB_PROPANE) / max(1, avgDailyBTU)
   */
  function computeResults() {
    var rowResults = state.rows.map(function (row) {
      var rowBTU = row.btu * row.hours * row.days * (row.duty / 100) * row.qty;
      if (!Number.isFinite(rowBTU) || rowBTU < 0) rowBTU = 0;
      return { id: row.id, name: (row.name || "").trim() || "Unnamed appliance", rowBTU: rowBTU, days: row.days };
    });

    var totalBTU = rowResults.reduce(function (sum, r) { return sum + r.rowBTU; }, 0);

    var nominalCylinderLb = state.cylinderType === "custom" ? state.customWeight : parseFloat(state.cylinderType);
    if (!Number.isFinite(nominalCylinderLb) || nominalCylinderLb <= 0) nominalCylinderLb = 20;
    var usableFraction = state.cylinderType === "1" ? 0.9 : 0.8;
    var usableLbPerCylinder = nominalCylinderLb * usableFraction;

    var lbPropaneNeeded = totalBTU / BTU_PER_LB_PROPANE;
    var lbPropaneWithReserve = lbPropaneNeeded * (1 + state.reservePercent / 100);

    var cylindersNeeded = 0;
    if (totalBTU > 0 && usableLbPerCylinder > 0) {
      cylindersNeeded = Math.ceil(lbPropaneWithReserve / usableLbPerCylinder);
    }

    var totalCost = cylindersNeeded * state.cylinderPrice;
    var totalPropaneAvailableLb = cylindersNeeded * usableLbPerCylinder;

    var maxDays = state.rows.reduce(function (max, row) { return Math.max(max, row.days); }, 0);
    var avgDailyBTU = totalBTU / Math.max(1, maxDays);
    var estimatedRuntimeDays = avgDailyBTU > 0
      ? (totalPropaneAvailableLb * BTU_PER_LB_PROPANE) / Math.max(1, avgDailyBTU)
      : 0;

    var reserveLb = lbPropaneWithReserve - lbPropaneNeeded;
    var utilizationPercent = totalPropaneAvailableLb > 0
      ? calc.clamp((lbPropaneWithReserve / totalPropaneAvailableLb) * 100, 0, 100)
      : 0;

    return {
      rows: rowResults,
      totalBTU: totalBTU,
      lbPropaneNeeded: lbPropaneNeeded,
      lbPropaneWithReserve: lbPropaneWithReserve,
      reserveLb: reserveLb,
      usableLbPerCylinder: usableLbPerCylinder,
      cylindersNeeded: cylindersNeeded,
      totalCost: totalCost,
      totalPropaneAvailableLb: totalPropaneAvailableLb,
      estimatedRuntimeDays: estimatedRuntimeDays,
      utilizationPercent: utilizationPercent
    };
  }

  function roundToHalf(value) {
    return Math.round(value * 2) / 2;
  }

  function cylinderUnitLabel() {
    if (state.cylinderType === "custom") {
      var w = Number.isFinite(state.customWeight) && state.customWeight > 0 ? state.customWeight : 20;
      return calc.formatNumber(w, w % 1 === 0 ? 0 : 1) + " lb cylinders";
    }
    return state.cylinderType + " lb cylinders";
  }

  function renderBreakdown(r) {
    breakdownBody.innerHTML = "";
    if (r.totalBTU <= 0) {
      var emptyRow = document.createElement("tr");
      emptyRow.className = "propane-empty-row";
      emptyRow.innerHTML = '<td colspan="4">Add an appliance above to see its share of your propane usage.</td>';
      breakdownBody.appendChild(emptyRow);
      return;
    }
    r.rows.forEach(function (row) {
      var lb = row.rowBTU / BTU_PER_LB_PROPANE;
      var share = r.totalBTU > 0 ? (row.rowBTU / r.totalBTU) * 100 : 0;
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + escapeHtml(row.name) + "</td>" +
        '<td class="num">' + calc.formatNumber(row.rowBTU, 0) + "</td>" +
        '<td class="num">' + calc.formatNumber(lb, 2) + "</td>" +
        '<td class="num">' + calc.formatNumber(share, 0) + "%</td>";
      breakdownBody.appendChild(tr);
    });
  }

  function buildCopyText() {
    if (!lastResults || lastResults.totalBTU <= 0) {
      return "Propane estimate: add an appliance's BTU/hr to generate a result.";
    }
    var r = lastResults;
    return "Propane estimate: " + r.cylindersNeeded + " x " + cylinderUnitLabel() +
      " (~" + calc.formatNumber(r.lbPropaneWithReserve, 1) + " lb incl. " + state.reservePercent + "% reserve), " +
      "~$" + calc.formatNumber(r.totalCost, 0) + " total, ~" + calc.formatNumber(roundToHalf(r.estimatedRuntimeDays), 1) + " day runtime.";
  }

  function updateResults() {
    var r = computeResults();
    lastResults = r;
    var hasUsage = r.totalBTU > 0;

    resultCylinderUnit.textContent = cylinderUnitLabel();

    if (hasUsage) {
      calc.animateValue(resultCylinders, r.cylindersNeeded, { decimals: 0 });
      resultSub.textContent = "≈ " + calc.formatNumber(r.lbPropaneWithReserve, 1) + " lb of propane needed, including your reserve.";
    } else {
      resultCylinders.textContent = "0";
      resultCylinders.setAttribute("data-raw-value", "0");
      resultSub.textContent = "Add an appliance's BTU/hr above to see your estimate.";
    }

    resultTotalBtu.textContent = hasUsage ? calc.formatNumber(r.totalBTU, 0) : "--";
    resultLbNeeded.textContent = hasUsage ? calc.formatNumber(r.lbPropaneWithReserve, 1) : "--";
    resultCost.textContent = hasUsage ? ("$" + calc.formatNumber(r.totalCost, 0)) : "--";
    resultRuntime.textContent = hasUsage ? (calc.formatNumber(roundToHalf(r.estimatedRuntimeDays), 1) + " days") : "--";

    reserveDetail.textContent = hasUsage
      ? (state.reservePercent + "% reserve adds about " + calc.formatNumber(r.reserveLb, 1) + " lb of propane to your plan, so you don’t run out mid-trip.")
      : "Add an appliance to see how much reserve propane this adds to your plan.";

    renderBreakdown(r);

    var gaugePct = hasUsage ? calc.clamp(r.utilizationPercent, 0, 100) : 0;
    calc.setGauge(gaugeFill, gaugePct, 90);
    gaugePercentLabel.textContent = calc.formatNumber(gaugePct, 0) + "% of purchased propane used";
  }
})();
