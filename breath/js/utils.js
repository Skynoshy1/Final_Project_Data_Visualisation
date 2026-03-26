"use strict";

(function setupUtils() {
  const { STATE_CODE_TO_NAME } = window.BreathDashboardConfig;

  function toNumber(value) {
    if (value === null || value === undefined || value === "") {
      return 0;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) {
      return "N/A";
    }
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  }

  function formatNumberShort(value) {
    if (!Number.isFinite(value)) {
      return "N/A";
    }
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
    return String(Math.round(value));
  }

  function formatAxisCompact(value) {
    if (!Number.isFinite(value)) {
      return "";
    }

    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";

    if (abs >= 1_000_000_000) {
      return `${sign}${toCompactPrecision(abs / 1_000_000_000)}B`;
    }
    if (abs >= 1_000_000) {
      return `${sign}${toCompactPrecision(abs / 1_000_000)}M`;
    }
    if (abs >= 1_000) {
      return `${sign}${toCompactPrecision(abs / 1_000)}K`;
    }
    return `${Math.round(value)}`;
  }

  function toCompactPrecision(value) {
    if (value >= 100) {
      return value.toFixed(0);
    }
    if (value >= 10) {
      return value.toFixed(1).replace(/\.0$/, "");
    }
    return value.toFixed(2).replace(/\.?0+$/, "");
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) {
      return "N/A";
    }
    return `${value.toFixed(2)}%`;
  }

  function formatPercentReadable(value) {
    if (!Number.isFinite(value)) {
      return "N/A";
    }

    const abs = Math.abs(value);
    if (abs > 0 && abs < 0.01) {
      return `${value < 0 ? "-" : ""}<0.01%`;
    }

    return `${value.toFixed(2)}%`;
  }

  function formatStateLabel(code) {
    const stateName = STATE_CODE_TO_NAME[code];
    if (!stateName) {
      return String(code || "");
    }
    return `${stateName} (${code})`;
  }

  function formatEfficiencyRatio(value) {
    if (!Number.isFinite(value)) {
      return "N/A";
    }
    return `${value.toFixed(2)} tests/positive`;
  }

  function formatCountDelta(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
      return { text: "No previous year data", tone: "neutral" };
    }

    const delta = ((current - previous) / previous) * 100;
    if (Math.abs(delta) < 1e-9) {
      return { text: "-> 0.0% vs previous year", tone: "neutral" };
    }

    return {
      text: `${delta > 0 ? "\u2191" : "\u2193"} ${Math.abs(delta).toFixed(1)}% vs previous year`,
      tone: delta > 0 ? "up" : "down",
    };
  }

  function formatRateDelta(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) {
      return { text: "No previous year data", tone: "neutral" };
    }

    const delta = current - previous;
    if (Math.abs(delta) < 1e-9) {
      return { text: "-> 0.00 pp vs previous year", tone: "neutral" };
    }

    return {
      text: `${delta > 0 ? "\u2191" : "\u2193"} ${Math.abs(delta).toFixed(2)} pp vs previous year`,
      tone: delta > 0 ? "up" : "down",
    };
  }

  function formatScopeLabel(scope) {
    if (scope === "ALL") {
      return "All jurisdictions";
    }
    return formatStateLabel(scope);
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values)).sort((a, b) => a - b);
  }

  function debounce(fn, delay) {
    let timeoutId = null;
    return (...args) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => fn(...args), delay);
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  window.BreathDashboardUtils = {
    toNumber,
    formatNumber,
    formatNumberShort,
    formatAxisCompact,
    formatPercent,
    formatPercentReadable,
    formatStateLabel,
    formatEfficiencyRatio,
    formatCountDelta,
    formatRateDelta,
    formatScopeLabel,
    uniqueSorted,
    debounce,
    escapeHtml,
  };
})();
