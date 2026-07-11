/*!
 * Camp Math — calculators.js
 * Shared math, unit-conversion, formatting, and DOM helpers used by every
 * calculator's page-specific script (js/calc-*.js). Keeping these in one
 * place means every calculator rounds, converts, and validates the same way.
 */
(function () {
  "use strict";

  var CampMath = window.CampMath || {};
  var calc = {};

  /* ---------- Basic math helpers ---------- */
  calc.clamp = function (value, min, max) {
    return Math.min(max, Math.max(min, value));
  };

  /** Parses user input defensively. Returns `fallback` for blank, non-numeric, or non-finite input. */
  calc.toNumber = function (value, fallback) {
    if (value === null || value === undefined || value === "") return fallback;
    var n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  };

  calc.round = function (value, decimals) {
    var d = decimals || 0;
    var factor = Math.pow(10, d);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  };

  /** Rounds up to the nearest multiple of `step` — used for "how many bags/bundles/cylinders to buy" outputs. */
  calc.roundUpTo = function (value, step) {
    if (value <= 0) return 0;
    return Math.ceil(value / step) * step;
  };

  calc.formatNumber = function (value, decimals) {
    if (!Number.isFinite(value)) return "--";
    var d = decimals === undefined ? 0 : decimals;
    return value.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  calc.formatRange = function (low, high, decimals) {
    return calc.formatNumber(low, decimals) + "–" + calc.formatNumber(high, decimals);
  };

  calc.debounce = function (fn, wait) {
    var t = null;
    return function () {
      var args = arguments, ctx = this;
      window.clearTimeout(t);
      t = window.setTimeout(function () { fn.apply(ctx, args); }, wait || 150);
    };
  };

  /* ---------- Unit conversions (single source of truth — do not duplicate) ---------- */
  calc.convert = {
    ftToM: function (ft) { return ft * 0.3048; },
    mToFt: function (m) { return m / 0.3048; },
    inToCm: function (inch) { return inch * 2.54; },
    cmToIn: function (cm) { return cm / 2.54; },
    milesToKm: function (mi) { return mi * 1.60934; },
    kmToMiles: function (km) { return km / 1.60934; },
    lbToKg: function (lb) { return lb * 0.453592; },
    kgToLb: function (kg) { return kg / 0.453592; },
    fToC: function (f) { return (f - 32) * (5 / 9); },
    cToF: function (c) { return c * (9 / 5) + 32; },
    qtToL: function (qt) { return qt * 0.946353; },
    lToQt: function (l) { return l / 0.946353; },
    cuFtToCuYd: function (cf) { return cf / 27; },
    literToGal: function (l) { return l / 3.78541; },
    galToLiter: function (g) { return g * 3.78541; }
  };

  /** 1 L of water ≈ 2.2 lb; 1 US gallon ≈ 8.34 lb (used by the backpack-weight calculator). */
  calc.waterWeight = {
    lbPerLiter: 2.2,
    lbPerGallon: 8.34
  };

  /* ---------- Inline field validation ----------
   * Expects markup: <div class="field" data-field>
   *   <label>...</label><input>...
   *   <span class="error-msg" data-error></span>
   * </div>
   */
  calc.validateField = function (input, options) {
    var opts = options || {};
    var wrap = input.closest(".field");
    var errorEl = wrap ? wrap.querySelector(".error-msg") : null;
    var raw = input.value;
    var value = calc.toNumber(raw, null);
    var message = "";

    if (raw === "" && opts.required) {
      message = opts.requiredMessage || "Enter a value.";
    } else if (raw !== "" && value === null) {
      message = "Enter a valid number.";
    } else if (value !== null && !opts.allowNegative && value < 0) {
      message = "Enter zero or a positive number.";
    } else if (value !== null && opts.min !== undefined && value < opts.min) {
      message = "Minimum is " + opts.min + ".";
    } else if (value !== null && opts.max !== undefined && value > opts.max) {
      message = "That's higher than expected (max " + opts.max + "). Double-check the value.";
    }

    var isValid = message === "";
    if (wrap) wrap.classList.toggle("invalid", !isValid);
    if (errorEl) errorEl.textContent = message;

    var clamped = value === null ? (opts.fallback !== undefined ? opts.fallback : 0) : value;
    if (opts.min !== undefined || opts.max !== undefined) {
      clamped = calc.clamp(clamped, opts.min !== undefined ? opts.min : -Infinity, opts.max !== undefined ? opts.max : Infinity);
    }
    if (!opts.allowNegative) clamped = Math.max(0, clamped);

    return { valid: isValid, value: clamped, raw: value, message: message };
  };

  /* ---------- Animated count-up for result numbers ---------- */
  calc.animateValue = function (el, toValue, options) {
    if (!el) return;
    var opts = options || {};
    var decimals = opts.decimals || 0;
    var suffix = opts.suffix || "";
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      el.textContent = calc.formatNumber(toValue, decimals) + suffix;
      return;
    }

    var fromValue = calc.toNumber(el.getAttribute("data-raw-value"), 0);
    el.setAttribute("data-raw-value", String(toValue));
    var duration = opts.duration || 500;
    var start = null;

    function step(timestamp) {
      if (start === null) start = timestamp;
      var progress = Math.min(1, (timestamp - start) / duration);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = fromValue + (toValue - fromValue) * eased;
      el.textContent = calc.formatNumber(current, decimals) + suffix;
      if (progress < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  };

  /* ---------- Gauge helper ---------- */
  calc.setGauge = function (fillEl, percent, warnAbove) {
    if (!fillEl) return;
    var pct = calc.clamp(percent, 0, 100);
    fillEl.style.width = pct + "%";
    fillEl.classList.toggle("warn", warnAbove !== undefined && percent > warnAbove);
    fillEl.parentElement && fillEl.parentElement.setAttribute("aria-valuenow", String(Math.round(percent)));
  };

  /* ---------- Copy result to clipboard ---------- */
  calc.copyResult = function (text) {
    function done(success) {
      CampMath.showToast(success ? "Result copied to clipboard" : "Couldn't copy — select and copy manually");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done(true);
      } catch (err) {
        done(false);
      }
    }
  };

  /* ---------- Segmented control / unit toggle wiring ----------
   * Wires a group of buttons sharing [data-segmented] so exactly one has
   * aria-pressed="true" at a time, and calls onChange(value) on change.
   */
  calc.wireSegmented = function (container, onChange) {
    if (!container) return;
    var buttons = Array.prototype.slice.call(container.querySelectorAll("button"));
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
        btn.setAttribute("aria-pressed", "true");
        onChange(btn.getAttribute("data-value"), btn);
      });
    });
  };

  calc.getSegmentedValue = function (container) {
    if (!container) return null;
    var active = container.querySelector('button[aria-pressed="true"]');
    return active ? active.getAttribute("data-value") : null;
  };

  CampMath.calc = calc;
  window.CampMath = CampMath;
})();
