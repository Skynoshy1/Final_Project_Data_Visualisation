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
    const yearText = isAllYears
      ? `${scopeLabel} - ${context.snapshotDisplayLabel}`
      : `${scopeLabel} - ${selectedYear}`;

    refs.kpiTotalTestsYear.textContent = yearText;
    refs.kpiPositiveRateYear.textContent = yearText;
    refs.kpiPositiveCasesYear.textContent = yearText;

    if (!kpiCurrent) {
      refs.kpiTotalTests.textContent = "N/A";
      refs.kpiPositiveRate.textContent = "N/A";
      refs.kpiPositiveCases.textContent = "N/A";
      setDeltaText(refs.kpiTotalTestsDelta, "No previous year data", "neutral");
      setDeltaText(refs.kpiPositiveRateDelta, "No previous year data", "neutral");
      setDeltaText(refs.kpiPositiveCasesDelta, "No previous year data", "neutral");
      return;
    }

    refs.kpiTotalTests.textContent = formatNumber(kpiCurrent.countTotal);
    refs.kpiPositiveRate.textContent = formatPercent(kpiCurrent.positiveRate);
    refs.kpiPositiveCases.textContent = formatNumber(kpiCurrent.countPositive);

    if (isAllYears) {
      const acrossText = `Across ${aggregatePeriodLabel}`;
      setDeltaText(refs.kpiTotalTestsDelta, acrossText, "neutral");
      setDeltaText(refs.kpiPositiveRateDelta, acrossText, "neutral");
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

    setDeltaText(refs.kpiTotalTestsDelta, testsDelta.text, testsDelta.tone);
    setDeltaText(refs.kpiPositiveRateDelta, rateDelta.text, rateDelta.tone);
    setDeltaText(refs.kpiPositiveCasesDelta, positiveCasesDelta.text, positiveCasesDelta.tone);
  }

  function setDeltaText(element, text, tone) {
    element.textContent = text;
    element.classList.remove("text-[#B45309]", "text-[#166534]", "text-[#6B7280]");
    if (tone === "up") {
      element.classList.add("text-[#B45309]");
      return;
    }
    if (tone === "down") {
      element.classList.add("text-[#166534]");
      return;
    }
    element.classList.add("text-[#6B7280]");
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
    const jurisdictionLabel =
      context.jurisdiction === "ALL"
        ? "All jurisdictions"
        : formatStateLabel(context.jurisdiction);

    if (context.isSingleJurisdiction) {
      refs.mapContextLabel.textContent =
        `Showing selected jurisdiction in context of Australia · ${context.snapshotDisplayLabel}`;
    } else if (context.selectedState) {
      refs.mapContextLabel.textContent =
        `${formatStateLabel(context.selectedState)} selected · ${context.snapshotDisplayLabel}`;
    } else {
      refs.mapContextLabel.textContent = `${jurisdictionLabel} · ${context.snapshotDisplayLabel}`;
    }

    if (refs.mapNote) {
      refs.mapNote.textContent = context.isSingleJurisdiction
        ? "Other states are shown in neutral to keep Australia-wide context."
        : "Greyed-out states indicate unavailable or unreliable data.";
    }

    const rankingMetricLabel = rankingMetric === "POSITIVE_RATE" ? "positive rate" : "total tests";
    refs.rankingContextLabel.textContent = context.isSingleJurisdiction
      ? "Single jurisdiction view"
      : `${jurisdictionLabel} · ${context.snapshotDisplayLabel} · ranked by ${rankingMetricLabel}`;

    const trendScopeLabel = formatScopeLabel(context.trendScope);
    const yearInTrendRange =
      Number.isFinite(context.selectedYear) &&
      context.selectedYear >= context.mainYearStart &&
      context.selectedYear <= context.mainYearEnd;
    const yearContext = yearInTrendRange
      ? `highlight ${context.selectedYear}`
      : `${context.aggregatePeriodLabel} timeline`;
    refs.trendFocusLabel.textContent = context.trendScope !== "ALL"
      ? `${trendScopeLabel} · ${yearContext} · Scale adjusted for selected jurisdiction`
      : `${trendScopeLabel} · ${yearContext}`;
  }

  function updateDynamicTitles(context, refs, rankingMetric) {
    const scopeShort =
      context.jurisdiction === "ALL"
        ? "All jurisdictions"
        : formatStateLabel(context.jurisdiction);
    const rankMetricLabel = rankingMetric === "POSITIVE_RATE" ? "Positive Rate" : "Total Tests";

    refs.mapTitle.textContent = context.isAllYears
      ? `Where are higher positive rates by state? (${context.snapshotDisplayLabel})`
      : `Where are higher positive rates by state? (${context.selectedYear})`;
    refs.rankingTitle.textContent = context.isSingleJurisdiction
      ? `Single Jurisdiction Snapshot - ${scopeShort}`
      : `Which states rank highest by ${rankMetricLabel}? (${context.snapshotDisplayLabel})`;

    const trendScope = formatScopeLabel(context.trendScope);
    const yearInTrendRange =
      Number.isFinite(context.selectedYear) &&
      context.selectedYear >= context.mainYearStart &&
      context.selectedYear <= context.mainYearEnd;
    refs.trendTitle.textContent =
      yearInTrendRange
        ? `Testing volume vs positive rate over time - ${trendScope} (highlight ${context.selectedYear})`
        : `Testing volume vs positive rate over time - ${trendScope}`;

    refs.scatterTitle.textContent =
      `Recent Location Comparison (${context.scenario3Year}) - ${scopeShort}`;
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

