"use strict";

(function setupTrendChart() {
  const { formatAxisCompact, formatNumber, formatPercent, formatScopeLabel } = window.BreathDashboardUtils;
  const { showTooltip, hideTooltip, renderEmptyState, buildStandardTooltip, MOTION } = window.BreathChartHelpers;

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

    const measuredWidth = container.clientWidth || 0;
    const width = Math.max(620, Math.min(980, measuredWidth || 980));
    const height = 450;
    const margin = { top: 22, right: 84, bottom: 52, left: 68 };
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

    const covidMarker = g.append("g")
      .attr("class", "covid-marker")
      .attr("transform", "translate(16,16)")
      .style("cursor", "pointer");

    covidMarker
      .append("circle")
      .attr("r", 12)
      .attr("fill", "#d6c8b8")
      .attr("stroke", "transparent")
      .attr("stroke-width", 1.4);

    covidMarker
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", 13)
      .attr("font-weight", 800)
      .attr("fill", "#5C4D3C")
      .text("!");

    covidMarker
      .on("mousemove", (event) => {
        showTooltip(
          event,
          buildStandardTooltip("Warning!", [
            `<span style="color: white">COVID Disruption (2020-2021)</span>`,
          ]),
          refs,
        );
      })
      .on("mouseenter", function () {
        d3.select(this).transition().duration(120).attr("transform", "translate(16,16) scale(1.06)");
        d3.select(this).select("circle").attr("stroke", "rgba(255,255,255,0.9)");
      })
      .on("mouseleave", function () {
        d3.select(this).transition().duration(120).attr("transform", "translate(16,16) scale(1)");
        d3.select(this).select("circle").attr("stroke", "transparent");
        hideTooltip(refs);
      });

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
      .attr("stroke", "#5C4D3C")
      .attr("stroke-width", 1)
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
      .call((axis) => axis.selectAll("text").attr("fill", "#6B7280").attr("font-size", 12).attr("font-weight", 700))
      .call((axis) => axis.selectAll("line").attr("stroke", "#D8CCBA"))
      .call((axis) => axis.select(".domain").attr("stroke", "#D8CCBA"));

    g.append("g")
      .call(d3.axisLeft(yLeft).ticks(5).tickFormat(formatAxisCompact))
      .call((axis) => axis.selectAll("text").attr("fill", "#6B7280").attr("font-size", 12).attr("font-weight", 700))
      .call((axis) => axis.selectAll("line").attr("stroke", "#D8CCBA"))
      .call((axis) => axis.select(".domain").attr("stroke", "#D8CCBA"));

    g.append("g")
      .attr("transform", `translate(${innerWidth},0)`)
      .call(d3.axisRight(yRight).ticks(5).tickFormat((value) => `${value.toFixed(1)}%`))
      .call((axis) => axis.selectAll("text").attr("fill", trendLineDark).attr("font-size", 12).attr("font-weight", 700))
      .call((axis) => axis.selectAll("line").attr("stroke", "#D8CCBA"))
      .call((axis) => axis.select(".domain").attr("stroke", "#D8CCBA"));

    g.append("text")
      .attr("x", -innerHeight / 2)
      .attr("y", -44)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", 700)
      .attr("fill", "#4B5563")
      .text("Total tests");

    g.append("text")
      .attr("x", innerWidth + 46)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", 700)
      .attr("fill", trendLineDark)
      .text("Rate (%)");
  }

  function buildTrendTooltipHtml(row, scope, selectedYear) {
    const selectedYearNote =
      Number.isFinite(selectedYear) && row.year === selectedYear
        ? `<span style="color: #f1c40f">Selected year focus</span>`
        : "";

    return buildStandardTooltip(`${formatScopeLabel(scope)} - ${row.year}`, [
      selectedYearNote,
      `<span style="color: white">Total tests: <span style="color: #f1c40f">${formatNumber(row.countTotal)}</span></span>`,
      `<span style="color: white">Positive cases: <span style="color: #f1c40f">${formatNumber(row.countPositive)}</span></span>`,
      `<span style="color: white">Positive rate: <span style="color: #f1c40f">${formatPercent(row.positiveRate)}</span></span>`,
    ]);
  }

  window.BreathTrendChart = {
    renderTrend,
  };
})();
