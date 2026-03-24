let cachedDrugGeoJson = null;

function drawMapChart(data, elementId) {
  // The map needs GeoJSON, so we load it once and reuse it.
  if (cachedDrugGeoJson) {
    renderDrugGeoMap(data, elementId, cachedDrugGeoJson);
    return;
  }

  d3.json(geoJsonPath).then((geoData) => {
    cachedDrugGeoJson = geoData;
    renderDrugGeoMap(data, elementId, geoData);
  });
}

function renderDrugGeoMap(data, elementId, geoData) {
  const container = document.getElementById(elementId);
  const chartWidth = container.clientWidth || 420;
  const chartHeight = 450;

  d3.select(`#${elementId}`).selectAll("*").remove();

  const svg = d3
    .select(`#${elementId}`)
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight);

  const grouped = d3.rollup(
    data,
    (values) => ({
      jurisdiction: values[0][COLS.jurisdiction],
      tests: d3.sum(values, (d) => d[COLS.totalTest]),
      positives: d3.sum(values, (d) => d[COLS.totalPositive]),
      positiveRate:
        (d3.sum(values, (d) => d[COLS.totalPositive]) /
          d3.sum(values, (d) => d[COLS.totalTest])) *
        100,
      fines: d3.sum(values, (d) => d[COLS.fines]),
      arrests: d3.sum(values, (d) => d[COLS.arrests]),
      charges: d3.sum(values, (d) => d[COLS.charges]),
    }),
    (d) => stateNameMap[d[COLS.jurisdiction]],
  );

  const rateValues = Array.from(grouped.values())
    .map((d) => d.positiveRate)
    .filter((d) => Number.isFinite(d));

  const color = d3
    .scaleLinear()
    .domain([d3.min(rateValues) || 0, d3.max(rateValues) || 1])
    .range(["#f3e8d4", "#EE9B00"]);

  const projection = d3
    .geoMercator()
    .fitSize([chartWidth - 24, chartHeight - 24], geoData);

  const path = d3.geoPath(projection);

  // Very simple tooltip using native title to keep the code easy to edit.
  svg
    .selectAll("path")
    .data(geoData.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("transform", "translate(12,12)")
    .style("opacity", 0)
    .attr("fill", (feature) => {
      const row = grouped.get(feature.properties.STATE_NAME);
      return row ? color(row.positiveRate) : CHART_COLORS.neutral;
    })
    .attr("stroke", "#fffdf8")
    .attr("stroke-width", 1.2)
    .on("mouseenter", function (event, feature) {
      const row = grouped.get(feature.properties.STATE_NAME);

      if (!row) {
        showTooltip(
          event,
          `<strong>${feature.properties.STATE_NAME}</strong>
           <div>No data for current filters</div>`,
        );
        return;
      }

      showTooltip(
        event,
        `<strong>${feature.properties.STATE_NAME}</strong>
         <div>Tests: ${formatNumber(row.tests)}</div>
         <div>Positive: ${formatNumber(row.positives)}</div>
         <div>Rate: ${formatPercent(row.positiveRate)}</div>
         <div>Fines: ${formatNumber(row.fines)}</div>
         <div>Arrests: ${formatNumber(row.arrests)}</div>
         <div>Charges: ${formatNumber(row.charges)}</div>`,
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(500)
    .style("opacity", 1);
}
