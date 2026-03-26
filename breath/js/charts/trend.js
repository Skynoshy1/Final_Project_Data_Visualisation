"use strict";

(function setupTrendChart() {
  const { formatAxisCompact, formatNumber, formatPercent, formatScopeLabel } = window.BreathDashboardUtils;
  const { showTooltip, hideTooltip, renderEmptyState, MOTION } = window.BreathChartHelpers;

  function renderTrend(context, refs) {
    const container = refs.trendChart;
    container.innerHTML = "";

    const data = context.trendData;
    if (!data.length) {
      renderEmptyState(
        container,
        "No trend data for the current selection.",
      );
      return;
    }

    const width = Math.max(360, container.clientWidth || 360);
    const height = 450;
    const margin = { top: 22, right: 72, bottom: 46, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const trendLineColor = "#E67E22";
    const trendLineDark = "#8A3F00";

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
    const x = d3
      .scaleBand()
      .domain(data.map((row) => row.year))
      .range([0, innerWidth])
      .padding(0.22);
    const yLeft = d3
      .scaleLinear()
      .domain([0, (d3.max(data, (row) => row.countTotal) || 0) * 1.1])
      .nice()
      .range([innerHeight, 0]);
    const yRight = d3
      .scaleLinear()
      .domain([0, (d3.max(data, (row) => row.positiveRate) || 0) * 1.2])
      .nice()
      .range([innerHeight, 0]);

    g.selectAll("line.grid")
      .data(yLeft.ticks(5))
      .join("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", (value) => yLeft(value))
      .attr("y2", (value) => yLeft(value))
      .attr("stroke", "#EFE7DA")
      .attr("stroke-dasharray", "2,4");

    if (x.domain().includes(2020) && x.domain().includes(2021)) {
      const disruptionX = x(2020);
      const disruptionW = x(2021) + x.bandwidth() - disruptionX;

      g.append("rect")
        .attr("x", disruptionX)
        .attr("y", 0)
        .attr("width", disruptionW)
        .attr("height", innerHeight)
        .attr("fill", "#F6C36B")
        .attr("opacity", 0.18);

      g.append("text")
        .attr("x", disruptionX + disruptionW / 2)
        .attr("y", 14)
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("font-weight", 700)
        .attr("fill", "#8A3F00")
        .text("COVID disruption (2020-2021)");
    }

    const trendBars = g.selectAll("rect.trend-bar")
      .data(data, (row) => row.year)
      .join("rect")
      .attr("x", (row) => x(row.year))
      .attr("y", innerHeight)
      .attr("width", x.bandwidth())
      .attr("height", 0)
      .attr("rx", 4)
      .attr("fill", (row) =>
        context.selectedYear !== "ALL" && row.year === context.selectedYear ? "#8A6A44" : "#D4C4A8",
      )
      .attr("opacity", (row) =>
        context.selectedYear !== "ALL" && row.year !== context.selectedYear ? 0.45 : 0.92,
      )
      .on("mousemove", (event, row) => {
        showTooltip(event, buildTrendTooltipHtml(row, context.trendScope, context.selectedYear), refs);
      })
      .on("mouseleave", () => hideTooltip(refs));

    trendBars
      .transition()
      .duration(MOTION.durationSlow)
      .delay((_, index) => index * 24)
      .ease(MOTION.ease)
      .attr("y", (row) => yLeft(row.countTotal))
      .attr("height", (row) => innerHeight - yLeft(row.countTotal));

    const baselineRow = data.find((row) => row.year === 2008);
    if (baselineRow && x.domain().includes(2008)) {
      const baselineCenter = x(2008) + x.bandwidth() / 2;
      const baselineY = yLeft(baselineRow.countTotal);
      const baselineTextX = Math.min(innerWidth - 150, baselineCenter + 8);
      const baselineTextY = Math.max(20, baselineY - 16);

      g.append("line")
        .attr("x1", baselineCenter)
        .attr("x2", baselineCenter)
        .attr("y1", baselineY - 4)
        .attr("y2", baselineTextY + 2)
        .attr("stroke", "#8A6A44")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3")
        .attr("opacity", 0.8);

      g.append("circle")
        .attr("cx", baselineCenter)
        .attr("cy", baselineY)
        .attr("r", 3.2)
        .attr("fill", "#8A6A44");

      g.append("text")
        .attr("x", baselineTextX)
        .attr("y", baselineTextY)
        .attr("font-size", 11)
        .attr("font-weight", 600)
        .attr("fill", "#7B6F62")
        .text("2008 baseline peak");
    }

    const lineGenerator = d3
      .line()
      .x((row) => x(row.year) + x.bandwidth() / 2)
      .y((row) => yRight(row.positiveRate))
      .curve(d3.curveMonotoneX);

    const trendPath = g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", trendLineColor)
      .attr("stroke-width", 3)
      .attr("d", lineGenerator);

    const totalLength = trendPath.node()?.getTotalLength?.() || 0;
    if (totalLength > 0) {
      trendPath
        .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(MOTION.durationSlow + 120)
        .delay(120)
        .ease(MOTION.ease)
        .attr("stroke-dashoffset", 0);
    }

    g.selectAll("circle.trend-point")
      .data(data, (row) => row.year)
      .join("circle")
      .attr("cx", (row) => x(row.year) + x.bandwidth() / 2)
      .attr("cy", (row) => yRight(row.positiveRate))
      .attr("r", 0)
      .attr("fill", "#FFF7ED")
      .attr("stroke", trendLineDark)
      .attr("stroke-width", 2)
      .on("mousemove", (event, row) => {
        showTooltip(event, buildTrendTooltipHtml(row, context.trendScope, context.selectedYear), refs);
      })
      .on("mouseleave", () => hideTooltip(refs))
      .transition()
      .duration(MOTION.durationBase)
      .delay((_, index) => 180 + index * 22)
      .ease(MOTION.ease)
      .attr("r", 4);

    if (context.selectedYear !== "ALL" && x.domain().includes(context.selectedYear)) {
      const selectedCenter = x(context.selectedYear) + x.bandwidth() / 2;
      g.append("line")
        .attr("x1", selectedCenter)
        .attr("x2", selectedCenter)
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", "#8A3F00")
        .attr("stroke-width", 1.2)
        .attr("stroke-dasharray", "4,4")
        .attr("opacity", 0.6);

      g.append("text")
        .attr("x", selectedCenter + 4)
        .attr("y", innerHeight - 6)
        .attr("font-size", 11)
        .attr("font-weight", 600)
        .attr("fill", "#8A3F00")
        .text(`Focus ${context.selectedYear}`);
    }

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")))
      .call((axis) => axis.selectAll("text").attr("fill", "#6B7280").attr("font-size", 12))
      .call((axis) => axis.selectAll("line").attr("stroke", "#D8CCBA"))
      .call((axis) => axis.select(".domain").attr("stroke", "#D8CCBA"));

    g.append("g")
      .call(d3.axisLeft(yLeft).ticks(5).tickFormat(formatAxisCompact))
      .call((axis) => axis.selectAll("text").attr("fill", "#6B7280").attr("font-size", 12))
      .call((axis) => axis.selectAll("line").attr("stroke", "#D8CCBA"))
      .call((axis) => axis.select(".domain").attr("stroke", "#D8CCBA"));

    g.append("g")
      .attr("transform", `translate(${innerWidth},0)`)
      .call(d3.axisRight(yRight).ticks(5).tickFormat((value) => `${value.toFixed(1)}%`))
      .call((axis) => axis.selectAll("text").attr("fill", trendLineDark).attr("font-size", 12))
      .call((axis) => axis.selectAll("line").attr("stroke", "#D8CCBA"))
      .call((axis) => axis.select(".domain").attr("stroke", "#D8CCBA"));

    g.append("text")
      .attr("x", -innerHeight / 2)
      .attr("y", -44)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#4B5563")
      .text("Total tests");

    g.append("text")
      .attr("x", innerWidth + 46)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", trendLineDark)
      .text("Rate (%)");
  }

  function buildTrendTooltipHtml(row, scope, selectedYear) {
    const selectedYearNote =
      Number.isFinite(selectedYear) && row.year === selectedYear
        ? `<div class="mt-1 text-xs font-semibold text-amber-200">Selected year focus</div>`
        : "";

    return `
      <div class="font-semibold">${formatScopeLabel(scope)}</div>
      <div class="mt-1 text-xs text-slate-200">Year: ${row.year}</div>
      ${selectedYearNote}
      <div class="mt-1">Total tests: <span class="font-semibold">${formatNumber(row.countTotal)}</span></div>
      <div>Positive cases: <span class="font-semibold">${formatNumber(row.countPositive)}</span></div>
      <div>Positive rate: <span class="font-semibold">${formatPercent(row.positiveRate)}</span></div>
    `;
  }

  window.BreathTrendChart = {
    renderTrend,
  };
})();
