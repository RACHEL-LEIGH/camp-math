/*!
 * CampingMath — shared.js
 * Site-wide behavior used on every page: mobile nav, footer year,
 * the five-star rating widget, and a small toast helper.
 * No dependencies. Safe to load on pages that don't use every feature.
 */
(function () {
  "use strict";

  var CampingMath = window.CampingMath || {};

  /* ---------- Dark mode toggle ----------
   * The actual theme decision (stored preference, or system preference as a
   * fallback) is made synchronously by a tiny inline script in <head> before
   * first paint, so there's no flash of the wrong theme. This just wires the
   * toggle button and keeps its label/pressed-state in sync with reality.
   */
  var THEME_STORAGE_KEY = "campingmath_theme";

  function setStoredTheme(value) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch (err) {
      /* localStorage unavailable — theme still applies for this page view */
    }
  }

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyTheme(theme, toggle) {
    document.documentElement.setAttribute("data-theme", theme);
    if (!toggle) return;
    toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    toggle.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }

  function initTheme() {
    var toggle = document.querySelector("[data-theme-toggle]");
    applyTheme(currentTheme(), toggle);
    if (!toggle) return;

    toggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      setStoredTheme(next);
      applyTheme(next, toggle);
    });
  }

  /* ---------- Mobile navigation toggle ---------- */
  function initNav() {
    var toggle = document.querySelector("[data-nav-toggle]");
    var nav = document.querySelector("[data-primary-nav]");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    nav.addEventListener("click", function (event) {
      if (event.target.tagName === "A") {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* ---------- Footer year ---------- */
  function initFooterYear() {
    var els = document.querySelectorAll("[data-current-year]");
    var year = new Date().getFullYear();
    els.forEach(function (el) {
      el.textContent = String(year);
    });
  }

  /* ---------- Toast ---------- */
  var toastEl = null;
  var toastTimer = null;
  function showToast(message) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 2400);
  }
  CampingMath.showToast = showToast;

  /* ---------- Five-star rating widget ----------
   * Markup contract:
   * <section class="rating-widget" data-rating="<calculator-slug>">
   *   <div class="stars" role="radiogroup">
   *     <button class="star" type="button" data-value="1" aria-label="1 star">...</button>
   *     ... through data-value="5"
   *   </div>
   *   <p class="rating-thanks" hidden>Thanks for your feedback!</p>
   * </section>
   */
  function ratingStorageKey(slug) {
    return "campmath_rating_" + slug;
  }

  function paintStars(starButtons, value) {
    starButtons.forEach(function (btn) {
      var isFilled = Number(btn.getAttribute("data-value")) <= value;
      btn.classList.toggle("filled", isFilled);
      btn.setAttribute("aria-checked", isFilled ? "true" : "false");
    });
  }

  function initRatingWidgets() {
    var widgets = document.querySelectorAll("[data-rating]");
    widgets.forEach(function (widget) {
      var slug = widget.getAttribute("data-rating");
      var starsWrap = widget.querySelector(".stars");
      var thanks = widget.querySelector(".rating-thanks");
      if (!slug || !starsWrap) return;
      var starButtons = Array.prototype.slice.call(starsWrap.querySelectorAll(".star"));
      var submittedThisSession = false;

      var saved = null;
      try {
        saved = window.localStorage.getItem(ratingStorageKey(slug));
      } catch (err) {
        saved = null;
      }

      if (saved) {
        var savedValue = Number(saved);
        paintStars(starButtons, savedValue);
        starButtons.forEach(function (btn) {
          if (Number(btn.getAttribute("data-value")) === savedValue) {
            btn.classList.add("selected");
          }
          btn.disabled = true;
        });
        if (thanks) thanks.hidden = false;
        submittedThisSession = true;
      }

      starButtons.forEach(function (btn) {
        var value = Number(btn.getAttribute("data-value"));

        btn.addEventListener("mouseenter", function () {
          if (submittedThisSession) return;
          starsWrap.classList.add("is-hovering");
          paintStars(starButtons, value);
        });

        btn.addEventListener("focus", function () {
          if (submittedThisSession) return;
          starsWrap.classList.add("is-hovering");
          paintStars(starButtons, value);
        });

        btn.addEventListener("click", function () {
          if (submittedThisSession) return;
          submittedThisSession = true;

          starButtons.forEach(function (b) { b.disabled = true; });
          paintStars(starButtons, value);
          starButtons.forEach(function (b) {
            b.classList.toggle("selected", Number(b.getAttribute("data-value")) === value);
          });

          try {
            window.localStorage.setItem(ratingStorageKey(slug), String(value));
          } catch (err) {
            /* localStorage unavailable (private mode, etc.) — rating still works for this visit */
          }

          if (thanks) thanks.hidden = false;

          if (typeof window.gtag === "function") {
            window.gtag("event", "calculator_rating", {
              calculator_name: slug,
              rating: value,
              page_path: window.location.pathname
            });
          }
        });
      });

      starsWrap.addEventListener("mouseleave", function () {
        if (submittedThisSession) return;
        starsWrap.classList.remove("is-hovering");
        paintStars(starButtons, 0);
      });
    });
  }

  /* ---------- Confetti (used sparingly, respects reduced motion) ---------- */
  function launchConfetti(container) {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !container) return;
    var colors = ["#dd7635", "#3c7d49", "#5f95a8", "#f2b705"];
    for (var i = 0; i < 18; i++) {
      var piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = (Math.random() * 100) + "%";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = (Math.random() * 200) + "ms";
      container.appendChild(piece);
      /* eslint-disable-next-line no-loop-func */
      (function (el) {
        window.setTimeout(function () { el.remove(); }, 1800);
      })(piece);
    }
  }
  CampingMath.launchConfetti = launchConfetti;

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initNav();
    initFooterYear();
    initRatingWidgets();
  });

  window.CampingMath = CampingMath;
})();
