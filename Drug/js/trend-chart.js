function drawTrendChart(data, elementId) {
  const state = document.getElementById("state-select")?.value || "all";
  const rating = document.getElementById("rating-select")?.value || "all";

  // Start from the current filtered dataset.
  // That means state / year / rating selections all affect the chart scale.
  let plotData = [...data];

  if (state !== "all") {
    plotData = plotData.filter((d) => d[COLS.jurisdiction] === state);
  }

  if (rating !== "all") {
    plotData = plotData.filter((d) => d[COLS.rating] === rating);
  }

  // If all states are selected, we aggregate by year so the chart shows one
  // bar and one point per year instead of many overlapping rows.
  if (state === "all") {
    plotData = Array.from(
      d3.rollup(
        plotData,
        (values) => ({
          YEAR: values[0][COLS.year],
          Total_Test: d3.sum(values, (d) => d[COLS.totalTest]),
          Total_Positive: d3.sum(values, (d) => d[COLS.totalPositive]),
          Positive_Rate:
            (d3.sum(values, (d) => d[COLS.totalPositive]) /
              d3.sum(values, (d) => d[COLS.totalTest])) *
            100,
        }),
        (d) => d[COLS.year],
      ).values(),
    );
  }

  plotData.sort((a, b) => a[COLS.year] - b[COLS.year]);

  const container = document.getElementById(elementId);
  const chartWidth = container.clientWidth || width;
  const chartHeight = height;
  const currentInnerWidth = chartWidth - margin.left - margin.right;
  const currentInnerHeight = chartHeight - margin.top - margin.bottom;

  d3.select(`#${elementId}`).selectAll("*").remove();

  if (!plotData.length) {
    d3.select(`#${elementId}`)
      .append("div")
      .style("padding", "60px 0")
      .style("text-align", "center")
      .style("color", "#7a7a7a")
      .text("No data available for this filter.");
    return;
  }

  const svg = d3
    .select(`#${elementId}`)
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const xScaleLocal = d3
    .scaleBand()
    .domain(plotData.map((d) => d[COLS.year]))
    .range([0, currentInnerWidth])
    .padding(0.18);

  const yLeftScale = d3
    .scaleLinear()
    .domain([0, d3.max(plotData, (d) => d[COLS.totalTest]) * 1.1])
    .nice()
    .range([currentInnerHeight, 0]);

  const yRightScale = d3
    .scaleLinear()
    .domain([0, d3.max(plotData, (d) => d[COLS.positiveRate]) * 1.1])
    .nice()
    .range([currentInnerHeight, 0]);

  // Highlight the top 5 bars with the highest test volume in the current view.
  const topFiveYears = new Set(
    plotData
      .slice()
      .sort((a, b) => d3.descending(a[COLS.totalTest], b[COLS.totalTest]))
      .slice(0, 5)
      .map((d) => d[COLS.year]),
  );

  // Horizontal guide lines make the chart easier to read.
  svg
    .append("g")
    .attr("class", "grid")
    .call(
      d3
        .axisLeft(yLeftScale)
        .ticks(5)
        .tickSize(-currentInnerWidth)
        .tickFormat(""),
    );

  // Bars show total test volume.
  svg
    .selectAll(".bar")
    .data(plotData)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", (d) => xScaleLocal(d[COLS.year]))
    .attr("y", (d) => yLeftScale(d[COLS.totalTest]))
    .attr("width", xScaleLocal.bandwidth())
    .attr("height", 0)
    .attr("fill", (d) =>
      topFiveYears.has(d[COLS.year]) ? CHART_COLORS.bar : "#d6c8b8",
    )
    .attr("rx", 3)
    .attr("ry", 3)
    .attr("stroke", "#5C4D3C")
    .attr("stroke-width", 1)
    .on("mouseenter", function (event, d) {
      showTooltip(
        event,
        `<div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">Year: ${d[COLS.year]}</div>
         <div class="tooltip-body" style="color: white; font-weight: bold;">
             <span style="color: white">Drug tests: <span style="color: #f1c40f">${formatNumber(d[COLS.totalTest])}</span></span><br/>
             <span style="color: white">Positive results: <span style="color: #f1c40f">${formatNumber(d[COLS.totalPositive])}</span></span><br/>
             <span style="color: white">Positive rate: <span style="color: #f1c40f">${formatPercent(d[COLS.positiveRate])}</span></span>
         </div>`
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(700)
    .ease(d3.easeCubicOut)
    .attr("height", (d) => currentInnerHeight - yLeftScale(d[COLS.totalTest]));

  // Line shows positive rate on the right-side axis.
  const line = d3
    .line()
    .x((d) => xScaleLocal(d[COLS.year]) + xScaleLocal.bandwidth() / 2)
    .y((d) => yRightScale(d[COLS.positiveRate]));

  const linePath = svg
    .append("path")
    .datum(plotData)
    .attr("fill", "none")
    .attr("stroke", CHART_COLORS.line)
    .attr("stroke-width", 4)
    .attr("d", line);

  const totalLineLength = linePath.node().getTotalLength();

  linePath
    .attr("stroke-dasharray", totalLineLength)
    .attr("stroke-dashoffset", totalLineLength)
    .transition()
    .duration(900)
    .ease(d3.easeCubicOut)
    .attr("stroke-dashoffset", 0);

  // Points make each yearly value visible on top of the line.
  svg
    .selectAll(".circle")
    .data(plotData)
    .enter()
    .append("circle")
    .attr("class", "circle")
    .attr("cx", (d) => xScaleLocal(d[COLS.year]) + xScaleLocal.bandwidth() / 2)
    .attr("cy", (d) => yRightScale(d[COLS.positiveRate]))
    .attr("r", 0)
    .attr("fill", "white")
    .attr("stroke", "#000000")
    .attr("stroke-width", 2)
    .style("cursor", "pointer")
    .on("mouseenter", function (event, d) {
      d3.select(this).attr("r", 6).style("stroke-width", 3);
      showTooltip(
        event,
        `<div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">Year: ${d[COLS.year]}</div>
         <div class="tooltip-body" style="color: white; font-weight: bold;">
             <span style="color: white">Drug tests: <span style="color: #f1c40f">${formatNumber(d[COLS.totalTest])}</span></span><br/>
             <span style="color: white">Positive results: <span style="color: #f1c40f">${formatNumber(d[COLS.totalPositive])}</span></span><br/>
             <span style="color: white">Positive rate: <span style="color: #f1c40f">${formatPercent(d[COLS.positiveRate])}</span></span>
         </div>`
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", function() {
      d3.select(this).attr("r", 4).style("stroke-width", 2);
      hideTooltip();
    })
    .transition()
    .delay(350)
    .duration(400)
    .attr("r", 4);

  svg
    .append("g")
    .attr("transform", `translate(0,${currentInnerHeight})`)
    .call(d3.axisBottom(xScaleLocal))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  // Left axis rescales automatically based on the filtered total test values.
  svg
    .append("g")
    .call(d3.axisLeft(yLeftScale).ticks(5).tickFormat(d3.format(".2s")));

  svg
    .append("g")
    .attr("transform", `translate(${currentInnerWidth},0)`)
    // Right axis also rescales automatically based on filtered positive rate.
    .call(d3.axisRight(yRightScale).ticks(5).tickFormat((d) => `${d}%`));
}
