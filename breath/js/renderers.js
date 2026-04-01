"use strict";

(function setupRenderers() {
  const {
    formatNumber,
    formatPercent,
    formatCountDelta,
    formatRateDelta,
    formatScopeLabel,
    formatStateLabel,
  } = window.BreathDashboardUtils;

  const chartHelpers = window.BreathChartHelpers;
  const mapChart = window.BreathMapChart;
  const rankingChart = window.BreathRankingChart;
  const trendChart = window.BreathTrendChart;
  const scenario3Chart = window.BreathScenario3Chart;

  function renderKpis(context, refs) {
    const {
      selectedYear,
      isAllYears,
      aggregatePeriodLabel,
      kpiScope,
      kpiCurrent,
      kpiPrevious,
    } = context;

    const scopeLabel = formatScopeLabel(kpiScope);
    const yearText =
      isAllYears && kpiScope === "ALL"
        ? `Across ${aggregatePeriodLabel}`
        : isAllYears
          ? `${scopeLabel} - ${context.snapshotDisplayLabel}`
          : `${scopeLabel} - ${selectedYear}`;

    // Keep metric labels static - don't overwrite them
    // refs.kpiTotalTestsYear.textContent = yearText;
    // refs.kpiPositiveRateYear.textContent = yearText;
    // refs.kpiPositiveCasesYear.textContent = yearText;

    if (!kpiCurrent) {
      refs.kpiTotalTests.textContent = "N/A";
      refs.kpiPositiveRate.textContent = "N/A";
      refs.kpiPositiveCases.textContent = "N/A";
      setDeltaText(refs.kpiPositiveCasesDelta, "No previous year data", "neutral");
      return;
    }

    refs.kpiTotalTests.textContent = formatNumber(kpiCurrent.countTotal);
    refs.kpiPositiveRate.textContent = formatPercent(kpiCurrent.positiveRate);
    refs.kpiPositiveCases.textContent = formatNumber(kpiCurrent.countPositive);

    if (isAllYears) {
      const acrossText = `Across ${aggregatePeriodLabel}`;
      setDeltaText(refs.kpiPositiveCasesDelta, acrossText, "neutral");
      return;
    }

    const testsDelta = formatCountDelta(
      kpiCurrent.countTotal,
      kpiPrevious ? kpiPrevious.countTotal : null,
    );
    const rateDelta = formatRateDelta(
      kpiCurrent.positiveRate,
      kpiPrevious ? kpiPrevious.positiveRate : null,
    );
    const positiveCasesDelta = formatCountDelta(
      kpiCurrent.countPositive,
      kpiPrevious ? kpiPrevious.countPositive : null,
    );

    setDeltaText(refs.kpiPositiveCasesDelta, positiveCasesDelta.text, positiveCasesDelta.tone);
  }

  function setDeltaText(element, text, tone) {
    element.textContent = text;
    element.style.color = "#fffaf4";
    element.style.fontWeight = "800";
  }

  function renderMap(context, refs, geoJson, onSelectState) {
    mapChart.renderMap(context, refs, geoJson, onSelectState);
  }

  function renderRanking(context, refs, rankingMetric, onSelectState) {
    rankingChart.renderRanking(context, refs, rankingMetric, onSelectState);
  }

  function renderTrend(context, refs) {
    trendChart.renderTrend(context, refs);
  }

  function renderDetailedSection(context, refs) {
    scenario3Chart.renderDetailedSection(context, refs);
  }

  function updateContextLabels(context, refs, rankingMetric) {
    if (context.isSingleJurisdiction) {
      refs.mapContextLabel.textContent =
        `${formatStateLabel(context.jurisdiction)} - ${context.snapshotDisplayLabel}`;
    } else if (context.selectedState) {
      refs.mapContextLabel.textContent =
        `${formatStateLabel(context.selectedState)} - ${context.snapshotDisplayLabel}`;
    } else {
      refs.mapContextLabel.textContent = `Australia - ${context.snapshotDisplayLabel}`;
    }

    if (refs.mapNote) {
      refs.mapNote.textContent = context.isSingleJurisdiction
        ? "Other states stay neutral for context."
        : "Grey = unavailable.";
    }

    const rankingMetricLabel = rankingMetric === "POSITIVE_RATE" ? "positive rate" : "total tests";
    refs.rankingContextLabel.textContent = context.isSingleJurisdiction
      ? "Compared with all states"
      : `${context.snapshotDisplayLabel} - ${rankingMetricLabel}`;

    const trendScopeLabel = formatScopeLabel(context.trendScope);
    const yearInTrendRange =
      Number.isFinite(context.selectedYear) &&
      context.selectedYear >= context.mainYearStart &&
      context.selectedYear <= context.mainYearEnd;
    const yearContext = yearInTrendRange
      ? `Focus ${context.selectedYear}`
      : `Timeline ${context.aggregatePeriodLabel}`;
    refs.trendFocusLabel.textContent = `${trendScopeLabel} - ${yearContext}`;
  }

  function updateDynamicTitles(context, refs, rankingMetric) {
    const scopeShort =
      context.jurisdiction === "ALL"
        ? "All jurisdictions"
        : formatStateLabel(context.jurisdiction);
    const rankMetricLabel = rankingMetric === "POSITIVE_RATE" ? "Positive Rate" : "Total Tests";

    refs.mapTitle.textContent = `Positive Rate by State (${context.snapshotDisplayLabel})`;
    refs.rankingTitle.textContent = context.isSingleJurisdiction
      ? `Snapshot - ${scopeShort}`
      : `State Ranking by ${rankMetricLabel}`;

    const trendScope = formatScopeLabel(context.trendScope);
    refs.trendTitle.textContent = `Testing Volume vs Positive Rate - ${trendScope}`;

    refs.scatterTitle.textContent =
      scopeShort === "All jurisdictions"
        ? `Recent Location Comparison (${context.scenario3Year})`
        : `Recent Location Comparison - ${scopeShort} (${context.scenario3Year})`;
  }

  function hideTooltip(refs) {
    chartHelpers.hideTooltip(refs);
  }

  function renderLoadingStates(refs) {
    chartHelpers.renderEmptyState(refs.mapChart, "Loading map data...");
    chartHelpers.renderEmptyState(refs.rankingChart, "Loading ranking chart...");
    chartHelpers.renderEmptyState(refs.trendChart, "Loading trend chart...");
  }

  function renderGlobalError(refs, message) {
    chartHelpers.renderEmptyState(refs.mapChart, message);
    chartHelpers.renderEmptyState(refs.rankingChart, message);
    chartHelpers.renderEmptyState(refs.trendChart, message);
  }

  window.BreathDashboardRenderers = {
    renderKpis,
    renderMap,
    renderRanking,
    renderTrend,
    renderDetailedSection,
    updateContextLabels,
    updateDynamicTitles,
    hideTooltip,
    renderLoadingStates,
    renderGlobalError,
  };
})();
