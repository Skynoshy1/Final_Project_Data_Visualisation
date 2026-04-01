let cachedDrugGeoJson = null;

function getTopBreakdownItem(rawValue) {
  if (!rawValue) return null;
  if (rawValue.startsWith("All ages")) return null;
  if (rawValue.startsWith("All regions")) return null;

  const matches = Array.from(rawValue.matchAll(/([^,]+?)\((\d+)\)/g));
  if (!matches.length) return null;

  const topItem = matches
    .map((match) => ({
      label: match[1].trim(),
      count: +match[2],
    }))
    .filter((item) => item.label.toLowerCase() !== "unknown")
    .sort((a, b) => d3.descending(a.count, b.count))[0];

  return topItem || null;
}

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
  const selectedState = document.getElementById("state-select")?.value || "all";

  d3.select(`#${elementId}`).selectAll("*").remove();

  const svg = d3
    .select(`#${elementId}`)
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight);

  const grouped = d3.rollup(
    data,
    (values) => {
      const latestRow = values
        .slice()
        .sort((a, b) => d3.descending(a[COLS.year], b[COLS.year]))[0];

      return {
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
        rating: latestRow[COLS.rating],
        topAgeGroup: getTopBreakdownItem(latestRow[COLS.ageGroups]),
        topLocation: getTopBreakdownItem(latestRow[COLS.location]),
      };
    },
    (d) => stateNameMap[d[COLS.jurisdiction]],
  );

  const reverseStateNameMap = Object.fromEntries(
    Object.entries(stateNameMap).map(([shortName, fullName]) => [fullName, shortName]),
  );

  function selectJurisdictionByFeature(feature) {
    const stateCode = reverseStateNameMap[feature.properties.STATE_NAME];
    const stateSelect = document.getElementById("state-select");

    if (!stateCode || !stateSelect) return;

    stateSelect.value = stateSelect.value === stateCode ? "all" : stateCode;
    stateSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function getStateFill(row) {
    if (!row) return CHART_COLORS.neutral;
    if (row.rating === "Effective") return CHART_COLORS.effective;
    if (row.rating === "Moderate") return CHART_COLORS.moderate;
    if (row.rating === "Ineffective") return CHART_COLORS.ineffective;
    return CHART_COLORS.neutral;
  }

  // When a specific jurisdiction is selected, we fit the projection to only
  // that state so the map "zooms in" to the chosen area.
  // If "all" is selected, we fit the full Australia GeoJSON as usual.
  const selectedStateName = stateNameMap[selectedState];
  const selectedFeature =
    selectedState === "all"
      ? null
      : geoData.features.find(
          (feature) => feature.properties.STATE_NAME === selectedStateName,
        );

  const projection = d3.geoMercator();

  if (selectedFeature) {
    projection.fitExtent(
      [
        [24, 24],
        [chartWidth - 24, chartHeight - 24],
      ],
      selectedFeature,
    );
  } else {
    projection.fitSize([chartWidth - 24, chartHeight - 24], geoData);
  }

  const path = d3.geoPath(projection);

  // Very simple tooltip using native title to keep the code easy to edit.
  svg
    .selectAll("path")
    .data(geoData.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("transform", "translate(12,12)")
    .style("cursor", "pointer")
    .style("opacity", 0)
    .attr("fill", (feature) => {
      const row = grouped.get(feature.properties.STATE_NAME);
      return getStateFill(row);
    })
    .attr("stroke", "#fffdf8")
    .attr("stroke-width", 1.2)
    .on("mouseenter", function (event, feature) {
      d3.select(this).attr("stroke", "#000").attr("stroke-width", 2);
      const row = grouped.get(feature.properties.STATE_NAME);

      if (!row) {
        showTooltip(
          event,
          `<div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${feature.properties.STATE_NAME}</div>
           <div class="tooltip-body" style="color: white; font-weight: bold;">
               <span style="color: white">No data for current filters</span>
           </div>`
        );
        return;
      }

      showTooltip(
        event,
        `<div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${feature.properties.STATE_NAME}</div>
         <div class="tooltip-body" style="color: white; font-weight: bold;">
             <span style="color: white">Tests: <span style="color: #f1c40f">${formatNumber(row.tests)}</span></span><br/>
             <span style="color: white">Positive: <span style="color: #f1c40f">${formatNumber(row.positives)}</span></span><br/>
             <span style="color: white">Rate: <span style="color: #f1c40f">${formatPercent(row.positiveRate)}</span></span><br/>
             <span style="color: white">Fines: <span style="color: #f1c40f">${formatNumber(row.fines)}</span></span><br/>
             <span style="color: white">Arrests: <span style="color: #f1c40f">${formatNumber(row.arrests)}</span></span><br/>
             <span style="color: white">Charges: <span style="color: #f1c40f">${formatNumber(row.charges)}</span></span>
             ${
               row.topAgeGroup
                 ? `<br/><span style="color: white">Top age group: <span style="color: #f1c40f">${row.topAgeGroup.label} (${formatNumber(row.topAgeGroup.count)})</span></span>`
                 : ""
             }
             ${
               row.topLocation
                 ? `<br/><span style="color: white">Top location: <span style="color: #f1c40f">${row.topLocation.label} (${formatNumber(row.topLocation.count)})</span></span>`
                 : ""
             }
         </div>`
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", function () {
      d3.select(this).attr("stroke", "#fffdf8").attr("stroke-width", 1.2);
      hideTooltip();
    })
    .on("click", function (_, feature) {
      selectJurisdictionByFeature(feature);
    })
    .transition()
    .duration(500)
    .style("opacity", 1);

  // Add a label at the visual center of each state.
  // Using the short code keeps the map readable even for smaller regions.
  svg
    .selectAll(".map-label")
    .data(
      geoData.features.filter(
        (feature) =>
          grouped.has(feature.properties.STATE_NAME) || selectedState === "all",
      ),
    )
    .enter()
    .append("text")
    .attr("class", "map-label")
    .attr("transform", (feature) => {
      const [x, y] = path.centroid(feature);
      return `translate(${x + 12}, ${y + 12})`;
    })
    .text((feature) => reverseStateNameMap[feature.properties.STATE_NAME] || "")
    .attr("fill", "#4A4A4A")
    .style("font-weight", "bold")
    .style("cursor", "pointer")
    .on("click", function (_, feature) {
      selectJurisdictionByFeature(feature);
    })
    .style("opacity", 0)
    .transition()
    .delay(180)
    .duration(400)
    .style("opacity", 1);

  // Color legend for map rating categories.
  // Color legend for map rating categories.
  const legendData = [
    { label: "Effective (> 30%)", color: CHART_COLORS.effective },
    { label: "Moderate (15-30%)", color: CHART_COLORS.moderate },
    { label: "Ineffective (< 15%)", color: CHART_COLORS.ineffective },
  ];

  const legend = svg
    .append("g")
    .attr("transform", `translate(18, ${chartHeight - 100})`);

  legend
    .append("text")
    .attr("x", 0)
    .attr("y", -10)
    .attr("fill", "#5C4D3C")
    .attr("font-size", "12px")
    .attr("font-weight", 700)
    .text("Rating legend");

  legend
    .selectAll("rect.legend-swatch")
    .data(legendData)
    .enter()
    .append("rect")
    .attr("class", "legend-swatch")
    .attr("x", 0)
    .attr("y", (_, i) => i * 20)
    .attr("width", 12)
    .attr("height", 12)
    .attr("rx", 2)
    .attr("fill", (d) => d.color);

  legend
    .selectAll("text.legend-label")
    .data(legendData)
    .enter()
    .append("text")
    .attr("class", "legend-label")
    .attr("x", 18)
    .attr("y", (_, i) => i * 20 + 10)
    .attr("fill", "#5C4D3C")
    .attr("font-size", "12px")
    .attr("font-weight", 700)
    .text((d) => d.label);
}
