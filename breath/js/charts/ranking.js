"use strict";

(function setupRankingChart() {
  const { COLORS } = window.BreathDashboardConfig;
  const {
    formatNumber,
    formatNumberShort,
    formatAxisCompact,
    formatPercent,
    formatStateLabel,
    escapeHtml,
  } = window.BreathDashboardUtils;
  const { showTooltip, hideTooltip, renderEmptyState, buildStandardTooltip, MOTION } = window.BreathChartHelpers;

  function renderRanking(context, refs, rankingMetric, onSelectState) {
    const container = refs.rankingChart;
    container.innerHTML = "";

    const data = context.rankingData;
    if (!data.length) {
      renderEmptyState(
        container,
        "No ranking data for the current filters.",
      );
      return;
    }

    if (context.isSingleJurisdiction && data.length === 1) {
      renderSingleJurisdictionRanking(container, context, rankingMetric);
      return;
    }

    const width = Math.max(360, container.clientWidth || 360);
    const height = Math.max(410, 32 * data.length + 122);
    const margin = { top: 10, right: 20, bottom: 40, left: 184 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("opacity", 0);

    svg
      .transition()
      .duration(MOTION.durationFast)
      .ease(MOTION.ease)
      .style("opacity", 1);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const metricColor = rankingMetric === "POSITIVE_RATE" ? COLORS.riskScale[1] : COLORS.neutralMid;
    const metricSelected = rankingMetric === "POSITIVE_RATE" ? COLORS.riskScale[3] : COLORS.neutralDark;
    const xMax = d3.max(data, (row) => row.metricValue) || 1;

    const x = d3.scaleLinear().domain([0, xMax * 1.08]).range([0, innerWidth]).nice();
    const y = d3
      .scaleBand()
      .domain(data.map((row) => row.jurisdiction))
      .range([0, innerHeight])
      .padding(0.24);

    g.append("g")
      .attr("class", "axis-x")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(5)
          .tickFormat(
            rankingMetric === "POSITIVE_RATE"
              ? (value) => `${value.toFixed(1)}%`
              : formatAxisCompact,
          ),
      )
      .call((axis) => axis.selectAll("text").attr("fill", "#6B7280").attr("font-size", 12))
      .call((axis) => axis.selectAll("line").attr("stroke", "#E5DED2"))
      .call((axis) => axis.select(".domain").attr("stroke", "#D8CCBA"));

    g.append("g")
      .attr("class", "axis-y")
      .call(d3.axisLeft(y).tickSize(0))
      .call((axis) =>
        axis
          .selectAll("text")
          .text((code) => formatStateLabel(code))
          .attr("fill", "#4B5563")
          .attr("font-size", 12)
          .attr("font-weight", 700),
      )
      .call((axis) => axis.select(".domain").remove());

    g.selectAll("line.grid")
      .data(x.ticks(5))
      .join("line")
      .attr("class", "grid")
      .attr("x1", (value) => x(value))
      .attr("x2", (value) => x(value))
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("stroke", "#EFE7DA")
      .attr("stroke-dasharray", "2,4");

    const bars = g.selectAll("rect.rank-bar")
      .data(data, (row) => row.jurisdiction)
      .join("rect")
      .attr("class", "rank-bar")
      .attr("x", 0)
      .attr("y", (row) => y(row.jurisdiction))
      .attr("height", y.bandwidth())
      .attr("width", 0)
      .attr("rx", 6)
      .attr("fill", (row) =>
        row.jurisdiction === context.selectedState ? metricSelected : metricColor,
      )
      .attr("stroke", "#5C4D3C")
      .attr("stroke-width", 1)
      .attr("opacity", (row) =>
        context.selectedState && row.jurisdiction !== context.selectedState ? 0.45 : 0.95,
      )
      .attr("cursor", "pointer")
      .on("mousemove", (event, row) => {
        showTooltip(
          event,
          buildRankingTooltipHtml(row, context.snapshotDisplayLabel, rankingMetric),
          refs,
        );
      })
      .on("mouseleave", () => hideTooltip(refs))
      .on("click", (_, row) => onSelectState(row.jurisdiction));

    bars
      .transition()
      .duration(MOTION.durationSlow)
      .delay((_, index) => index * 28)
      .ease(MOTION.ease)
      .attr("width", (row) => x(row.metricValue));

    g.selectAll("text.rank-value")
      .data(data, (row) => row.jurisdiction)
      .join("text")
      .attr("class", "rank-value")
      .attr("x", (row) => Math.min(x(row.metricValue) + 6, innerWidth - 4))
      .attr("y", (row) => y(row.jurisdiction) + y.bandwidth() / 2 + 4)
      .attr("text-anchor", "start")
      .attr("font-size", 12)
      .attr("font-weight", 700)
      .attr("fill", "#374151")
      .attr("opacity", 0)
      .text((row) =>
        rankingMetric === "POSITIVE_RATE"
          ? `${row.metricValue.toFixed(2)}%`
          : formatNumberShort(row.metricValue),
      )
      .transition()
      .duration(MOTION.durationBase)
      .delay((_, index) => 120 + index * 28)
      .ease(MOTION.ease)
      .attr("opacity", 1);
  }

  function renderSingleJurisdictionRanking(container, context, rankingMetric) {
    const row = context.rankingData[0];
    if (!row) {
      renderEmptyState(container, "No ranking data is available for this jurisdiction.");
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "rounded-lg border border-[#e7ddce] bg-[#fbf8f2] p-4";
    container.appendChild(wrapper);

    const metricLabel = rankingMetric === "POSITIVE_RATE" ? "Positive Rate" : "Total Tests";
    const metricValue =
      rankingMetric === "POSITIVE_RATE"
        ? formatPercent(row.metricValue)
        : formatNumber(row.metricValue);
    const comparison = context.rankingComparisonData || [];
    const rankPositionRaw = comparison.findIndex((item) => item.jurisdiction === row.jurisdiction);
    const rankPosition = rankPositionRaw >= 0 ? rankPositionRaw + 1 : null;
    const totalRanks = comparison.length || 1;
    const medianMetric = d3.median(comparison, (item) => item.metricValue);
    const nationalMetric =
      rankingMetric === "POSITIVE_RATE"
        ? context.snapshotNational?.positiveRate
        : d3.mean(comparison, (item) => item.metricValue);

    const title = document.createElement("p");
    title.className = "text-sm font-bold uppercase tracking-[0.08em] text-[#7B6F62]";
    title.textContent = "Selected jurisdiction";
    wrapper.appendChild(title);

    const scope = document.createElement("p");
    scope.className = "mt-1 text-base font-semibold text-[#5C4D3C]";
    scope.textContent = formatStateLabel(row.jurisdiction);
    wrapper.appendChild(scope);

    const value = document.createElement("p");
    value.className = "mt-3 text-3xl font-bold text-[#4B5563]";
    value.textContent = metricValue;
    wrapper.appendChild(value);

    const valueLabel = document.createElement("p");
    valueLabel.className = "mt-1 text-sm font-medium text-[#7B6F62]";
    valueLabel.textContent = metricLabel;
    wrapper.appendChild(valueLabel);

    const subMetrics = document.createElement("p");
    subMetrics.className = "mt-3 text-sm font-medium text-[#6B7280]";
    subMetrics.textContent =
      `Total tests ${formatNumber(row.countTotal)} - Positive rate ${formatPercent(row.positiveRate)}`;
    wrapper.appendChild(subMetrics);

    const insightGrid = document.createElement("div");
    insightGrid.className = "mt-3 grid gap-2 md:grid-cols-3";
    wrapper.appendChild(insightGrid);
    insightGrid.appendChild(
      createInsightChip("Rank", rankPosition ? `${rankPosition} / ${totalRanks}` : "N/A"),
    );
    insightGrid.appendChild(
      createInsightChip(
        "vs national",
        formatMetricDelta(row.metricValue, nationalMetric, rankingMetric),
      ),
    );
    insightGrid.appendChild(
      createInsightChip("vs median", formatMetricDelta(row.metricValue, medianMetric, rankingMetric)),
    );

    const sparklineWrap = document.createElement("div");
    sparklineWrap.className = "mt-4";
    wrapper.appendChild(sparklineWrap);

    const width = Math.max(280, container.clientWidth - 40);
    const height = 140;
    const margin = { top: 8, right: 8, bottom: 12, left: 8 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const trendData = context.trendData || [];

    if (!trendData.length) {
      return;
    }

    const svg = d3
      .select(sparklineWrap)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    const x = d3
      .scaleLinear()
      .domain(d3.extent(trendData, (d) => d.year))
      .range([margin.left, margin.left + innerWidth]);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(trendData, (d) => d.countTotal) || 0])
      .nice()
      .range([margin.top + innerHeight, margin.top]);

    const sparkline = d3
      .line()
      .x((d) => x(d.year))
      .y((d) => y(d.countTotal))
      .curve(d3.curveMonotoneX);

    svg
      .append("path")
      .datum(trendData)
      .attr("fill", "none")
      .attr("stroke", "#7B8794")
      .attr("stroke-width", 2)
      .attr("d", sparkline)
      .attr("opacity", 0)
      .transition()
      .duration(MOTION.durationSlow)
      .ease(MOTION.ease)
      .attr("opacity", 1);

    const peak = trendData
      .slice()
      .sort((a, b) => d3.descending(a.countTotal, b.countTotal))[0];
    const latest = trendData[trendData.length - 1];
    const dropFromPeakPct =
      peak && latest && peak.countTotal > 0
        ? ((latest.countTotal - peak.countTotal) / peak.countTotal) * 100
        : null;

    if (peak) {
      svg
        .append("circle")
        .attr("cx", x(peak.year))
        .attr("cy", y(peak.countTotal))
        .attr("r", 3.2)
        .attr("fill", "#E89A2E");

      svg
        .append("text")
        .attr("x", x(peak.year) + 4)
        .attr("y", y(peak.countTotal) - 6)
        .attr("font-size", 10)
        .attr("fill", "#7B6F62")
        .text(`Peak ${peak.year}`);
    }

    if (latest) {
      svg
        .append("circle")
        .attr("cx", x(latest.year))
        .attr("cy", y(latest.countTotal))
        .attr("r", 3.5)
        .attr("fill", "#4B5563");

      if (Number.isFinite(dropFromPeakPct)) {
        svg
          .append("text")
          .attr("x", Math.max(margin.left, x(latest.year) - 90))
          .attr("y", y(latest.countTotal) - 6)
          .attr("font-size", 10)
          .attr("fill", "#7B6F62")
          .text(`Drop from peak ${dropFromPeakPct.toFixed(1)}%`);
      }
    }

    svg
      .append("text")
      .attr("x", margin.left)
      .attr("y", height - 2)
      .attr("font-size", 11)
      .attr("fill", "#7B6F62")
      .text(`Trend ${context.aggregatePeriodLabel}`);
  }

  function createInsightChip(label, value) {
    const card = document.createElement("div");
    card.className = "rounded-md border border-[#e7ddce] bg-white px-2.5 py-2";

    const title = document.createElement("p");
    title.className = "text-sm font-semibold uppercase tracking-[0.06em] text-[#7B6F62]";
    title.textContent = label;
    card.appendChild(title);

    const metric = document.createElement("p");
    metric.className = "mt-1 text-base font-semibold text-[#5C4D3C]";
    metric.textContent = value;
    card.appendChild(metric);

    return card;
  }

  function formatMetricDelta(current, baseline, rankingMetric) {
    if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline === 0) {
      return "N/A";
    }

    if (rankingMetric === "POSITIVE_RATE") {
      const delta = current - baseline;
      const arrow = delta > 0 ? "\u2191" : delta < 0 ? "\u2193" : "\u2192";
      return `${arrow} ${Math.abs(delta).toFixed(2)} pp`;
    }

    const deltaPct = ((current - baseline) / baseline) * 100;
    const arrow = deltaPct > 0 ? "\u2191" : deltaPct < 0 ? "\u2193" : "\u2192";
    return `${arrow} ${Math.abs(deltaPct).toFixed(1)}%`;
  }

  function buildRankingTooltipHtml(row, periodLabel, rankingMetric) {
    const metricLabel = rankingMetric === "POSITIVE_RATE" ? "Positive rate" : "Total tests";
    const metricValue =
      rankingMetric === "POSITIVE_RATE"
        ? formatPercent(row.metricValue)
        : formatNumber(row.metricValue);

    return buildStandardTooltip(escapeHtml(formatStateLabel(row.jurisdiction)), [
      `<span style="color: white">Period: <span style="color: #f1c40f">${periodLabel || "N/A"}</span></span>`,
      `<span style="color: white">${metricLabel}: <span style="color: #f1c40f">${metricValue}</span></span>`,
      `<span style="color: white">Total tests: <span style="color: #f1c40f">${formatNumber(row.countTotal)}</span></span>`,
      `<span style="color: white">Positive rate: <span style="color: #f1c40f">${formatPercent(row.positiveRate)}</span></span>`,
    ]);
  }

  window.BreathRankingChart = {
    renderRanking,
  };
})();
