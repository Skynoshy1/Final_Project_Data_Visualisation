"use strict";

(function setupScenario3Chart() {
  const {
    formatNumber,
    formatNumberShort,
    formatAxisCompact,
    formatPercentReadable,
    formatStateLabel,
    escapeHtml,
  } = window.BreathDashboardUtils;
  const { showTooltip, hideTooltip, renderEmptyState, getLocationColor, buildStandardTooltip, MOTION } = window.BreathChartHelpers;

  function renderDetailedSection(context, refs) {
    refs.detailedSection.classList.remove("hidden");
    const sectionScope =
      context.jurisdiction === "ALL"
        ? "All jurisdictions"
        : formatStateLabel(context.jurisdiction);
    const locationScope =
      context.selectedLocation && context.selectedLocation !== "ALL"
        ? ` - ${context.selectedLocation}`
        : "";
    refs.scatterContextLabel.textContent = `${context.scenario3Year} - ${sectionScope}${locationScope}`;

    if (refs.scenario3AvailabilityNote) {
      refs.scenario3AvailabilityNote.textContent = context.scenario3GlobalYearMismatch
        ? "Scenario 3 uses 2023-2024 only."
        : "";
    }

    if (refs.scenario3Insight) {
      refs.scenario3Insight.textContent = "";
      refs.scenario3Insight.classList.add("hidden");
    }

    const container = refs.scatterChart;
    container.innerHTML = "";

    const data = context.scenario3Data || [];
    const hasAnyData = data.some((row) => row && row.hasData);
    if (!data.length || !hasAnyData) {
      renderEmptyState(container, "No location data for the current filter.");
      return;
    }

    const chartsGrid = document.createElement("div");
    chartsGrid.className = "grid gap-4 lg:grid-cols-2";
    container.appendChild(chartsGrid);

    const testsChart = createScenario3Card("Total tests");
    const rateChart = createScenario3Card("Positive rate");
    chartsGrid.appendChild(testsChart.card);
    chartsGrid.appendChild(rateChart.card);

    window.requestAnimationFrame(() => {
      renderScenario3BarChart({
        mountNode: testsChart.plot,
        data,
        refs,
        scopeLabel: sectionScope,
        yAxisLabel: "Total tests",
        valueAccessor: (row) => row.countTotalSum,
        yTickFormatter: formatAxisCompact,
        valueLabelFormatter: (row, meta) => {
          if (row.metricValue <= 0) {
            return "";
          }
          const share = meta.totalMetric > 0 ? (row.metricValue / meta.totalMetric) * 100 : 0;
          return `${formatNumberShort(row.metricValue)} (${share.toFixed(0)}%)`;
        },
        tooltipMetricLabel: "Total tests",
        tooltipMetricFormatter: (value) => formatNumber(value),
      });

      renderScenario3BarChart({
        mountNode: rateChart.plot,
        data,
        refs,
        scopeLabel: sectionScope,
        yAxisLabel: "Positive rate (%)",
        valueAccessor: (row) => row.locationPositiveRate,
        yTickFormatter: (value) => formatPercentReadable(value),
        valueLabelFormatter: (row) =>
          (row.metricValue > 0 ? formatPercentReadable(row.metricValue) : ""),
        tooltipMetricLabel: "Positive rate",
        tooltipMetricFormatter: (value) => formatPercentReadable(value),
      });

      if (refs.scenario3Insight) {
        refs.scenario3Insight.textContent = buildScenario3InsightText(data);
        refs.scenario3Insight.classList.remove("hidden");
      }
    });
  }

  function createScenario3Card(titleText) {
    const card = document.createElement("div");
    card.className = "overflow-hidden rounded-lg border border-[#efe6d8] bg-[#fcfaf6] p-3";

    const title = document.createElement("p");
    title.className = "text-sm font-bold uppercase tracking-[0.08em] text-[#7B6F62]";
    title.textContent = titleText;
    card.appendChild(title);

    const plot = document.createElement("div");
    plot.className = "mt-2 min-h-[300px] w-full";
    card.appendChild(plot);

    return { card, plot };
  }

  function renderScenario3BarChart({
    mountNode,
    data,
    refs,
    scopeLabel,
    yAxisLabel,
    valueAccessor,
    yTickFormatter,
    valueLabelFormatter,
    tooltipMetricLabel,
    tooltipMetricFormatter,
  }) {
    const categories = ["Major Cities", "Regional", "Remote"];
    const rowByCategory = new Map(data.map((row) => [row.locationCategory, row]));
    const chartData = categories.map((category) => {
      const row = rowByCategory.get(category);
      const rawValue = row ? valueAccessor(row) : 0;
      const metricValue = Number.isFinite(rawValue) ? rawValue : 0;
      return {
        locationCategory: category,
        metricValue,
        countTotalSum: row?.countTotalSum || 0,
        countPositive: row?.countPositive || 0,
        locationPositiveRate: row?.locationPositiveRate,
        hasData: Boolean(row?.hasData),
      };
    });

    const measuredWidth = Math.floor(
      mountNode.getBoundingClientRect().width || mountNode.clientWidth || 0,
    );
    const parentWidth = Math.floor(
      mountNode.parentElement?.getBoundingClientRect().width || 0,
    );
    const width = measuredWidth || parentWidth || 300;
    const height = 350;
    const margin = { top: 12, right: 14, bottom: 44, left: 72 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const maxValue = d3.max(chartData, (row) => row.metricValue) || 0;
    const totalMetric = d3.sum(chartData, (row) => row.metricValue);
    const highestRows = new Set(
      chartData
        .filter((row) => row.hasData && maxValue > 0 && Math.abs(row.metricValue - maxValue) < 1e-9)
        .map((row) => row.locationCategory),
    );
    const yMax = maxValue > 0 ? maxValue * 1.15 : 1;

    const svg = d3
      .select(mountNode)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("width", "100%")
      .style("height", `${height}px`)
      .style("opacity", 0);

    svg
      .transition()
      .duration(MOTION.durationFast)
      .ease(MOTION.ease)
      .style("opacity", 1);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3
      .scaleBand()
      .domain(categories)
      .range([0, innerWidth])
      .padding(0.28);
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

    g.selectAll("line.grid")
      .data(y.ticks(5))
      .join("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", (value) => y(value))
      .attr("y2", (value) => y(value))
      .attr("stroke", "#EFE7DA")
      .attr("stroke-dasharray", "2,4");

    const bars = g
      .selectAll("rect.location-bar")
      .data(chartData, (row) => row.locationCategory)
      .join("rect")
      .attr("class", "location-bar")
      .attr("x", (row) => x(row.locationCategory))
      .attr("y", innerHeight)
      .attr("width", x.bandwidth())
      .attr("height", 0)
      .attr("rx", 6)
      .attr("fill", (row) => {
        const baseColor = getLocationColor(row.locationCategory);
        if (!highestRows.has(row.locationCategory)) {
          return baseColor;
        }
        const darker = d3.color(baseColor)?.darker(0.35);
        return darker ? darker.formatHex() : baseColor;
      })
      .attr("opacity", (row) => {
        if (!row.hasData) {
          return 0.3;
        }
        return highestRows.has(row.locationCategory) ? 1 : 0.82;
      })
      .attr("stroke", "#5C4D3C")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mousemove", (event, row) => {
        showTooltip(
          event,
          buildScenario3BarTooltipHtml(
            row,
            scopeLabel,
            tooltipMetricLabel,
            tooltipMetricFormatter,
          ),
          refs,
        );
      })
      .on("mouseleave", () => hideTooltip(refs));

    bars
      .transition()
      .duration(MOTION.durationSlow)
      .delay((_, index) => index * 26)
      .ease(MOTION.ease)
      .attr("y", (row) => {
        if (row.metricValue <= 0) return y(0);
        const rawY = y(row.metricValue);
        const minBarHeight = 8;
        return Math.min(rawY, innerHeight - minBarHeight);
      })
      .attr("height", (row) => {
        if (row.metricValue <= 0) return 0;
        const rawHeight = innerHeight - y(row.metricValue);
        return Math.max(rawHeight, 8);
      });

    g.selectAll("text.location-value")
      .data(chartData, (row) => row.locationCategory)
      .join("text")
      .attr("class", "location-value")
      .attr("x", (row) => x(row.locationCategory) + x.bandwidth() / 2)
      .attr("y", (row) => y(row.metricValue) - 6)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("font-weight", 600)
      .attr("fill", "#5C4D3C")
      .attr("opacity", 0)
      .text((row) => valueLabelFormatter(row, { totalMetric, chartData }))
      .transition()
      .duration(MOTION.durationBase)
      .delay((_, index) => 140 + index * 26)
      .ease(MOTION.ease)
      .attr("opacity", 1);

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x))
      .call((axis) => axis.selectAll("text").attr("fill", "#6B7280").attr("font-size", 12).attr("font-weight", 700))
      .call((axis) => axis.selectAll("line").attr("stroke", "#D8CCBA"))
      .call((axis) => axis.select(".domain").attr("stroke", "#D8CCBA"));

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(yTickFormatter))
      .call((axis) => axis.selectAll("text").attr("fill", "#6B7280").attr("font-size", 12).attr("font-weight", 700))
      .call((axis) => axis.selectAll("line").attr("stroke", "#D8CCBA"))
      .call((axis) => axis.select(".domain").attr("stroke", "#D8CCBA"));

    g.append("text")
      .attr("x", -innerHeight / 2)
      .attr("y", -56)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", 700)
      .attr("fill", "#4B5563")
      .text(yAxisLabel);
  }

  function buildScenario3BarTooltipHtml(row, scopeLabel, metricLabel, metricFormatter) {
    if (!row.hasData) {
      return buildStandardTooltip(escapeHtml(row.locationCategory), [
        `<span style="color: white">${escapeHtml(scopeLabel)}</span>`,
        `<span style="color: white">No data available for this location type.</span>`,
      ]);
    }

    const regionalNote =
      row.locationCategory === "Regional"
        ? `<div class="text-xs text-slate-200">Includes inner and outer regional areas.</div>`
        : "";

    return buildStandardTooltip(escapeHtml(row.locationCategory), [
      `<span style="color: white">${escapeHtml(scopeLabel)}</span>`,
      regionalNote ? `<span style="color: white">${regionalNote.replace(/<[^>]*>/g, "")}</span>` : "",
      `<span style="color: white">${metricLabel}: <span style="color: #f1c40f">${metricFormatter(row.metricValue)}</span></span>`,
      `<span style="color: white">Total tests: <span style="color: #f1c40f">${formatNumber(row.countTotalSum)}</span></span>`,
      `<span style="color: white">Positive rate: <span style="color: #f1c40f">${formatPercentReadable(row.locationPositiveRate)}</span></span>`,
    ]);
  }

  function buildScenario3InsightText(data) {
    const validRows = data.filter(
      (row) =>
        row &&
        row.hasData &&
        Number.isFinite(row.countTotalSum) &&
        row.countTotalSum > 0 &&
        Number.isFinite(row.locationPositiveRate),
    );

    if (!validRows.length) {
      return "Location comparison is unavailable for the current filter.";
    }

    const byCategory = new Map(validRows.map((row) => [row.locationCategory, row]));
    const sortedByVolume = validRows
      .slice()
      .sort((a, b) => d3.descending(a.countTotalSum, b.countTotalSum));
    const highestVolume = sortedByVolume[0];
    const secondVolume = sortedByVolume[1];
    const highestRate = validRows
      .slice()
      .sort((a, b) => d3.descending(a.locationPositiveRate, b.locationPositiveRate))[0];
    const lowestRate = validRows
      .slice()
      .sort((a, b) => d3.ascending(a.locationPositiveRate, b.locationPositiveRate))[0];

    const major = byCategory.get("Major Cities");
    const remote = byCategory.get("Remote");
    const rateSpread = highestRate.locationPositiveRate - lowestRate.locationPositiveRate;

    if (
      major &&
      secondVolume &&
      secondVolume.countTotalSum > 0 &&
      highestVolume.locationCategory === "Major Cities"
    ) {
      const ratio = major.countTotalSum / secondVolume.countTotalSum;
      if (rateSpread < 0.2) {
        return `Major Cities run about ${ratio.toFixed(1)}x more tests, while rates stay similar across location types.`;
      }
      return `Major Cities lead testing volume, while ${highestRate.locationCategory} shows the highest positive rate.`;
    }

    if (remote && Number.isFinite(remote.locationPositiveRate) && remote.locationPositiveRate < 0.01) {
      return `${highestVolume.locationCategory} leads testing volume, while Remote remains very low in positive rate.`;
    }

    return `${highestVolume.locationCategory} leads testing volume, while ${highestRate.locationCategory} has the highest positive rate.`;
  }

  window.BreathScenario3Chart = {
    renderDetailedSection,
  };
})();
