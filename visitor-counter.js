(() => {
  "use strict";

  const DISPLAY_OFFSET = 101;
  const TOTAL_ENDPOINT =
    "https://ieltswithtahmid.goatcounter.com/counter/TOTAL.json";
  const CACHE_KEY = "ielts_tahmid_goatcounter_total_v1";

  const countElement = document.getElementById("visitorCount");
  const counterElement = document.getElementById("visitorCounter");

  if (!countElement || !counterElement) return;

  function parseCount(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.floor(value));
    }

    if (typeof value === "string") {
      const cleaned = value.replace(/[^\d.-]/g, "");
      const number = Number(cleaned);
      return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : null;
    }

    return null;
  }

  function formatCount(value) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  function render(value, status) {
    countElement.textContent = formatCount(value);
    counterElement.dataset.counterStatus = status;
    counterElement.setAttribute(
      "aria-label",
      `All-time website visitors: ${value}`
    );
  }

  function readCache() {
    try {
      return parseCount(localStorage.getItem(CACHE_KEY));
    } catch (error) {
      return null;
    }
  }

  function writeCache(value) {
    try {
      localStorage.setItem(CACHE_KEY, String(value));
    } catch (error) {
      // Continue without local caching.
    }
  }

  async function loadTotal() {
    const cached = readCache();
    const initial =
      cached !== null && cached >= DISPLAY_OFFSET ? cached : DISPLAY_OFFSET;

    render(initial, "loading");

    try {
      const response = await fetch(TOTAL_ENDPOINT, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error(`GoatCounter returned HTTP ${response.status}`);
      }

      const payload = await response.json();
      const tracked = parseCount(payload.count);

      if (tracked === null) {
        throw new Error("Invalid GoatCounter response");
      }

      const displayed = Math.max(initial, tracked + DISPLAY_OFFSET);
      render(displayed, "ready");
      writeCache(displayed);
    } catch (error) {
      render(initial, "offline");
      console.warn(
        "GoatCounter total is unavailable; showing the last saved count.",
        error
      );
    }
  }

  loadTotal();
})();
