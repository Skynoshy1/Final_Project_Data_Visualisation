"use strict";

const { debounce } = window.BreathDashboardUtils;
const dataLayer = window.BreathDashboardData;
const renderers = window.BreathDashboardRenderers;

const app = {
  mainRecords: [],
  locationRecords: [],
  mainYearStateIndex: new Map(),
  geoJson: null,
  state: {
    selectedYear: "ALL",
    jurisdiction: "ALL",
    selectedState: null,
    rankingMetric: "POSITIVE_RATE",
    scenario3Year: 2024,
  },
  refs: {},
};

document.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
  cacheDom();
  bindEvents();
  renderers.renderLoadingStates(app.refs);

  try {
    const [{ mainRecords, locationRecords }, geoJson] = await Promise.all([
      dataLayer.loadWorkbookData(),
      dataLayer.loadGeoJson(),
    ]);

    app.mainRecords = mainRecords;
    app.locationRecords = locationRecords;
    app.geoJson = geoJson;
    app.mainYearStateIndex = dataLayer.buildMainIndex(mainRecords);

    dataLayer.populateFilters(app.refs, mainRecords, locationRecords);
    updateRankingToggleStyles();
    updateScenario3ToggleStyles();
    renderDashboard();

    window.addEventListener("resize", debounce(renderDashboard, 160));
  } catch (error) {
    console.error(error);
    renderers.renderGlobalError(
      app.refs,
      "Failed to load dashboard data. Please confirm the workbook path and refresh the page.",
    );
  }
}

function cacheDom() {
  app.refs = {
    yearFilter: document.getElementById("year-filter"),
    jurisdictionFilter: document.getElementById("jurisdiction-filter"),
    resetButton: document.getElementById("reset-button"),
    rankRateBtn: document.getElementById("rank-rate-btn"),
    rankTotalBtn: document.getElementById("rank-total-btn"),
    mapChart: document.getElementById("map-chart"),
    mapTitle: document.getElementById("map-title"),
    mapNote: document.getElementById("map-note"),
    rankingChart: document.getElementById("ranking-chart"),
    rankingTitle: document.getElementById("ranking-title"),
    trendChart: document.getElementById("trend-chart"),
    trendTitle: document.getElementById("trend-title"),
    detailedSection: document.getElementById("detailed-section"),
    scatterChart: document.getElementById("scatter-chart"),
    scatterTitle: document.getElementById("scatter-title"),
    scenario3Year2023Btn: document.getElementById("scenario3-year-2023"),
    scenario3Year2024Btn: document.getElementById("scenario3-year-2024"),
    scenario3AvailabilityNote: document.getElementById("scenario3-availability-note"),
    scenario3Insight: document.getElementById("scenario3-insight"),
    mapContextLabel: document.getElementById("map-context-label"),
    rankingContextLabel: document.getElementById("ranking-context-label"),
    trendFocusLabel: document.getElementById("trend-focus-label"),
    scatterContextLabel: document.getElementById("scatter-context-label"),
    tooltip: document.getElementById("chart-tooltip"),
    kpiTotalTests: document.getElementById("kpi-total-tests"),
    kpiTotalTestsYear: document.getElementById("kpi-total-tests-year"),
    kpiTotalTestsDelta: document.getElementById("kpi-total-tests-delta"),
    kpiPositiveRate: document.getElementById("kpi-positive-rate"),
    kpiPositiveRateYear: document.getElementById("kpi-positive-rate-year"),
    kpiPositiveRateDelta: document.getElementById("kpi-positive-rate-delta"),
    kpiPositiveCases: document.getElementById("kpi-positive-cases"),
    kpiPositiveCasesYear: document.getElementById("kpi-positive-cases-year"),
    kpiPositiveCasesDelta: document.getElementById("kpi-positive-cases-delta"),
  };
}

function bindEvents() {
  app.refs.yearFilter.addEventListener("change", (event) => {
    const value = event.target.value;
    app.state.selectedYear = value === "ALL" ? "ALL" : Number(value);
    renderDashboard();
  });

  app.refs.jurisdictionFilter.addEventListener("change", (event) => {
    const value = event.target.value;
    app.state.jurisdiction = value;
    app.state.selectedState = value === "ALL" ? null : value;
    renderDashboard();
  });

  app.refs.resetButton.addEventListener("click", () => {
    app.state.selectedYear = "ALL";
    app.state.jurisdiction = "ALL";
    app.state.selectedState = null;
    app.state.rankingMetric = "POSITIVE_RATE";
    app.state.scenario3Year = 2024;

    app.refs.yearFilter.value = "ALL";
    app.refs.jurisdictionFilter.value = "ALL";
    updateRankingToggleStyles();
    updateScenario3ToggleStyles();
    renderers.hideTooltip(app.refs);
    renderDashboard();
  });

  app.refs.rankRateBtn.addEventListener("click", () => {
    app.state.rankingMetric = "POSITIVE_RATE";
    updateRankingToggleStyles();
    renderDashboard();
  });

  app.refs.rankTotalBtn.addEventListener("click", () => {
    app.state.rankingMetric = "COUNT_TOTAL";
    updateRankingToggleStyles();
    renderDashboard();
  });

  if (app.refs.scenario3Year2023Btn) {
    app.refs.scenario3Year2023Btn.addEventListener("click", () => {
      app.state.scenario3Year = 2023;
      updateScenario3ToggleStyles();
      renderDashboard();
    });
  }

  if (app.refs.scenario3Year2024Btn) {
    app.refs.scenario3Year2024Btn.addEventListener("click", () => {
      app.state.scenario3Year = 2024;
      updateScenario3ToggleStyles();
      renderDashboard();
    });
  }
}

function updateRankingToggleStyles() {
  const isRate = app.state.rankingMetric === "POSITIVE_RATE";

  app.refs.rankRateBtn.className = isRate
    ? "rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#5C4D3C] shadow-sm"
    : "rounded-md px-3 py-1.5 text-xs font-semibold text-[#7B6F62]";

  app.refs.rankTotalBtn.className = !isRate
    ? "rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#5C4D3C] shadow-sm"
    : "rounded-md px-3 py-1.5 text-xs font-semibold text-[#7B6F62]";
}

function updateScenario3ToggleStyles() {
  const year = app.state.scenario3Year;

  if (app.refs.scenario3Year2023Btn) {
    app.refs.scenario3Year2023Btn.className =
      year === 2023
        ? "rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#5C4D3C] shadow-sm"
        : "rounded-md px-3 py-1.5 text-xs font-semibold text-[#7B6F62]";
  }

  if (app.refs.scenario3Year2024Btn) {
    app.refs.scenario3Year2024Btn.className =
      year === 2024
        ? "rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#5C4D3C] shadow-sm"
        : "rounded-md px-3 py-1.5 text-xs font-semibold text-[#7B6F62]";
  }
}

function handleStateSelection(code) {
  if (app.state.jurisdiction !== "ALL" && app.state.jurisdiction !== code) {
    app.state.jurisdiction = code;
    app.refs.jurisdictionFilter.value = code;
  }

  if (app.state.selectedState === code && app.state.jurisdiction === "ALL") {
    app.state.selectedState = null;
  } else {
    app.state.selectedState = code;
  }

  renderDashboard();
}

function renderDashboard() {
  renderers.hideTooltip(app.refs);
  const context = dataLayer.buildContext(app);

  renderers.renderKpis(context, app.refs);
  renderers.renderMap(context, app.refs, app.geoJson, handleStateSelection);
  renderers.renderRanking(context, app.refs, app.state.rankingMetric, handleStateSelection);
  renderers.renderTrend(context, app.refs);
  renderers.renderDetailedSection(context, app.refs);
  renderers.updateDynamicTitles(context, app.refs, app.state.rankingMetric);
  renderers.updateContextLabels(context, app.refs, app.state.rankingMetric);
}
