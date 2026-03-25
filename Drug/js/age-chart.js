function drawAgeChart(data, elementId) {
  // We keep the existing function name so imports and controller code stay simple.
  // This chart now shows year-over-year change in positive rate by jurisdiction.
  const selectedState = document.getElementById("state-select")?.value || "all";
  const selectedYear = document.getElementById("year-select")?.value || "all";
  const selectedRating = document.getElementById("rating-select")?.value || "all";

  const container = document.getElementById(elementId);
  const chartWidth = container.clientWidth || 420;
  const chartHeight = 450;
  const chartMargin = { top: 36, right: 24, bottom: 46, left: 78 };
  const currentInnerWidth = chartWidth - chartMargin.left - chartMargin.right;
  const currentInnerHeight = chartHeight - chartMargin.top - chartMargin.bottom;

  d3.select(`#${elementId}`).selectAll("*").remove();

  // We need all years in memory so we can compare one year against the year before it.
  let plotData = [...data];

  if (selectedState !== "all") {
    plotData = plotData.filter((d) => d[COLS.jurisdiction] === selectedState);
  }

  if (selectedRating !== "all") {
    plotData = plotData.filter((d) => d[COLS.rating] === selectedRating);
  }

  const byState = d3.group(plotData, (d) => d[COLS.jurisdiction]);
  const changeData = [];

  byState.forEach((rows, jurisdiction) => {
    const sortedRows = rows.slice().sort((a, b) => d3.ascending(a[COLS.year], b[COLS.year]));

    if (sortedRows.length < 2) return;

    let currentRow;
    let previousRow;

    if (selectedYear === "all") {
      // Use the latest available year for this state and compare it to the previous available year.
      currentRow = sortedRows[sortedRows.length - 1];
      previousRow = sortedRows[sortedRows.length - 2];
    } else {
      const targetYear = +selectedYear;
      const currentIndex = sortedRows.findIndex((row) => row[COLS.year] === targetYear);

      if (currentIndex <= 0) return;

      currentRow = sortedRows[currentIndex];
      previousRow = sortedRows[currentIndex - 1];
    }

    if (!currentRow || !previousRow || previousRow[COLS.positiveRate] === 0) return;

    const deltaPercent =
      ((currentRow[COLS.positiveRate] - previousRow[COLS.positiveRate]) /
        previousRow[COLS.positiveRate]) *
      100;

    changeData.push({
      jurisdiction,
      currentYear: currentRow[COLS.year],
      previousYear: previousRow[COLS.year],
      currentRate: currentRow[COLS.positiveRate],
      previousRate: previousRow[COLS.positiveRate],
      deltaPercent,
    });
  });

  changeData.sort((a, b) => d3.descending(a.deltaPercent, b.deltaPercent));

  if (!changeData.length) {
    d3.select(`#${elementId}`)
      .append("div")
      .style("text-align", "center")
      .style("padding", "90px 16px")
      .style("color", "#7a7a7a")
      .html("Not enough year-over-year data for the current filter.");
    return;
  }

  const svg = d3
    .select(`#${elementId}`)
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight)
    .append("g")
    .attr("transform", `translate(${chartMargin.left},${chartMargin.top})`);

  const xExtent = d3.extent(changeData, (d) => d.deltaPercent);
  const maxAbs = Math.max(Math.abs(xExtent[0] || 0), Math.abs(xExtent[1] || 0));

  const xScaleLocal = d3
    .scaleLinear()
    .domain([-maxAbs * 1.1, maxAbs * 1.1])
    .nice()
    .range([0, currentInnerWidth]);

  const yScaleLocal = d3
    .scaleBand()
    .domain(changeData.map((d) => d.jurisdiction))
    .range([0, currentInnerHeight])
    .padding(0.24);

  // Vertical grid lines help compare positive vs negative movement.
  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0, ${currentInnerHeight})`)
    .call(
      d3
        .axisBottom(xScaleLocal)
        .ticks(5)
        .tickSize(-currentInnerHeight)
        .tickFormat(""),
    );

  // Emphasize the zero line because the chart is about increase vs decrease.
  svg
    .append("line")
    .attr("x1", xScaleLocal(0))
    .attr("x2", xScaleLocal(0))
    .attr("y1", 0)
    .attr("y2", currentInnerHeight)
    .attr("stroke", "#5C4D3C")
    .attr("stroke-width", 1.4)
    .attr("stroke-dasharray", "4 4");

  svg
    .selectAll(".change-bar")
    .data(changeData)
    .enter()
    .append("rect")
    .attr("class", "change-bar")
    .attr("x", xScaleLocal(0))
    .attr("y", (d) => yScaleLocal(d.jurisdiction))
    .attr("width", 0)
    .attr("height", yScaleLocal.bandwidth())
    .attr("rx", 4)
    .attr("fill", (d) =>
      d.deltaPercent >= 0 ? CHART_COLORS.line : CHART_COLORS.bar,
    )
    .on("mouseenter", function (event, d) {
      const direction = d.deltaPercent >= 0 ? "Increase" : "Decrease";

      showTooltip(
        event,
        `<strong>${d.jurisdiction}</strong>
         <div>${d.previousYear}: ${formatPercent(d.previousRate)}</div>
         <div>${d.currentYear}: ${formatPercent(d.currentRate)}</div>
         <div>${direction}: ${formatPercent(Math.abs(d.deltaPercent))}</div>`,
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(700)
    .ease(d3.easeCubicOut)
    .attr("x", (d) =>
      d.deltaPercent >= 0 ? xScaleLocal(0) : xScaleLocal(d.deltaPercent),
    )
    .attr("width", (d) => Math.abs(xScaleLocal(d.deltaPercent) - xScaleLocal(0)));

  svg
    .selectAll(".change-label")
    .data(changeData)
    .enter()
    .append("text")
    .attr("class", "change-label")
    .attr("x", (d) =>
      d.deltaPercent >= 0
        ? xScaleLocal(d.deltaPercent) + 6
        : xScaleLocal(d.deltaPercent) - 6,
    )
    .attr("y", (d) => yScaleLocal(d.jurisdiction) + yScaleLocal.bandwidth() / 2 + 4)
    .attr("text-anchor", (d) => (d.deltaPercent >= 0 ? "start" : "end"))
    .attr("fill", "#5C4D3C")
    .attr("font-size", "11px")
    .attr("font-weight", 700)
    .style("opacity", 0)
    .text((d) => `${d.deltaPercent >= 0 ? "+" : ""}${d.deltaPercent.toFixed(1)}%`)
    .transition()
    .delay(240)
    .duration(300)
    .style("opacity", 1);

  svg.append("g").call(d3.axisLeft(yScaleLocal).tickSize(0));

  svg
    .append("g")
    .attr("transform", `translate(0,${currentInnerHeight})`)
    .call(d3.axisBottom(xScaleLocal).ticks(5).tickFormat((d) => `${d}%`));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", currentInnerWidth / 2)
    .attr("y", currentInnerHeight + 40)
    .attr("text-anchor", "middle")
    .text("Change in positive rate vs previous year (%)");
}
