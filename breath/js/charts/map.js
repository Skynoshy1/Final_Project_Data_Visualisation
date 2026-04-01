"use strict";

(function setupMapChart() {
  const { COLORS, STATE_NAME_TO_CODE, FALLBACK_MAP_SHAPES } = window.BreathDashboardConfig;
  const { formatNumber, formatPercent, formatStateLabel, escapeHtml } = window.BreathDashboardUtils;
  const { showTooltip, hideTooltip, buildStandardTooltip, MOTION } = window.BreathChartHelpers;

  function renderMap(context, refs, geoJson, onSelectState) {
    const container = refs.mapChart;
    container.innerHTML = "";

    const width = Math.max(360, container.clientWidth || 360);
    const height = Math.max(410, Math.round(width * 0.68));
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

    if (geoJson && Array.isArray(geoJson.features) && geoJson.features.length) {
      renderGeoMap(svg, width, height, context, refs, geoJson, onSelectState);
      return;
    }

    renderFallbackMap(svg, width, height, context, refs, onSelectState);
  }

  function renderGeoMap(svg, width, height, context, refs, geoJson, onSelectState) {
    const features = geoJson.features.filter((feature) =>
      Boolean(STATE_NAME_TO_CODE[feature.properties.STATE_NAME]),
    );
    const activeState = context.mapFocusState || context.selectedState;

    const selectedFeature =
      activeState && activeState !== "ALL"
        ? features.find((feature) => STATE_NAME_TO_CODE[feature.properties.STATE_NAME] === activeState)
        : null;
    const projection = d3.geoMercator();
    if (selectedFeature) {
      projection.fitExtent(
        [
          [24, 24],
          [width - 24, height - 24],
        ],
        selectedFeature,
      );
    } else {
      projection.fitExtent(
        [
          [16, 16],
          [width - 16, height - 16],
        ],
        { type: "FeatureCollection", features },
      );
    }
    const path = d3.geoPath(projection);
    const colorScale = getRiskScale();

    const statePaths = svg
      .selectAll("path.state")
      .data(features)
      .join("path")
      .attr("d", path)
      .attr("cursor", "pointer")
      .attr("fill", (feature) => {
        const code = STATE_NAME_TO_CODE[feature.properties.STATE_NAME];
        return getStateFill(code, context.mapData, colorScale, context, activeState);
      })
      .attr("stroke", (feature) => {
        const code = STATE_NAME_TO_CODE[feature.properties.STATE_NAME];
        return code === activeState ? "#8A3F00" : "#ffffff";
      })
      .attr("stroke-width", (feature) => {
        const code = STATE_NAME_TO_CODE[feature.properties.STATE_NAME];
        return code === activeState ? 2.8 : 1.2;
      })
      .attr("opacity", (feature) => {
        const code = STATE_NAME_TO_CODE[feature.properties.STATE_NAME];
        return getStateOpacity(code, context, activeState);
      })
      .on("mousemove", (event, feature) => {
        const code = STATE_NAME_TO_CODE[feature.properties.STATE_NAME];
        showTooltip(event, buildMapTooltipHtml(code, context), refs);
      })
      .on("mouseleave", () => hideTooltip(refs))
      .on("mouseenter", function () {
        d3.select(this).attr("stroke-width", 2.8);
      })
      .on("mouseout", function (_, feature) {
        const code = STATE_NAME_TO_CODE[feature.properties.STATE_NAME];
        d3.select(this).attr("stroke-width", code === activeState ? 2.8 : 1.2);
      })
      .on("click", (_, feature) => {
        const code = STATE_NAME_TO_CODE[feature.properties.STATE_NAME];
        onSelectState(code);
      });

    statePaths
      .style("opacity", 0)
      .transition()
      .duration(220)
      .ease(d3.easeCubicOut)
      .style("opacity", 1);

    const labelData = features.map((feature) => ({
      feature,
      code: STATE_NAME_TO_CODE[feature.properties.STATE_NAME],
      centroid: path.centroid(feature),
    }));

    svg
      .selectAll("text.map-label")
      .data(labelData.filter((d) => d.code !== "TAS"))
      .join("text")
      .attr("x", (d) => d.centroid[0])
      .attr("y", (d) => d.centroid[1])
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", 800)
      .attr("fill", "#4A4A4A")
      .attr("opacity", 0)
      .attr("pointer-events", "none")
      .text((d) => d.code)
      .transition()
      .duration(MOTION.durationBase)
      .ease(MOTION.ease)
      .attr("opacity", 1);

    const tasLabel = labelData.find((d) => d.code === "TAS");
    if (!tasLabel) {
      return;
    }

    const [tx, ty] = tasLabel.centroid;
    const labelX = tx + 26;
    const labelY = ty + 14;

    svg
      .selectAll("line.tas-leader")
      .data([tasLabel])
      .join("line")
      .attr("class", "tas-leader")
      .attr("x1", tx + 4)
      .attr("y1", ty - 2)
      .attr("x2", labelX - 5)
      .attr("y2", labelY - 5)
      .attr("stroke", "#6B7280")
      .attr("stroke-width", 1.1)
      .attr("opacity", 0)
      .transition()
      .duration(MOTION.durationBase)
      .ease(MOTION.ease)
      .attr("opacity", 0.85);

    svg
      .selectAll("text.tas-label")
      .data([tasLabel])
      .join("text")
      .attr("class", "tas-label")
      .attr("x", labelX)
      .attr("y", labelY)
      .attr("text-anchor", "start")
      .attr("font-size", 12)
      .attr("font-weight", 800)
      .attr("fill", "#4A4A4A")
      .attr("opacity", 0)
      .attr("pointer-events", "none")
      .text("TAS")
      .transition()
      .duration(MOTION.durationBase)
      .ease(MOTION.ease)
      .attr("opacity", 1);
  }

  function renderFallbackMap(svg, width, height, context, refs, onSelectState) {
    const colorScale = getRiskScale();
    const activeState = context.mapFocusState || context.selectedState;
    const fallbackRoot = svg
      .append("g")
      .attr("transform", `translate(${width * 0.06}, ${height * 0.04}) scale(${width / 760})`);

    const statePaths = fallbackRoot
      .selectAll("path.state")
      .data(FALLBACK_MAP_SHAPES)
      .join("path")
      .attr("d", (shape) => shape.path)
      .attr("cursor", "pointer")
      .on("mousemove", (event, shape) => {
        showTooltip(event, buildMapTooltipHtml(shape.code, context), refs);
      })
      .on("mouseleave", () => hideTooltip(refs))
      .on("click", (_, shape) => onSelectState(shape.code));

    statePaths
      .attr("fill", COLORS.missing)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.3)
      .attr("opacity", 0)
      .transition()
      .duration(MOTION.durationSlow)
      .ease(MOTION.ease)
      .attr("fill", (shape) =>
        getStateFill(shape.code, context.mapData, colorScale, context, activeState),
      )
      .attr("stroke", (shape) => (shape.code === activeState ? "#8A3F00" : "#ffffff"))
      .attr("stroke-width", (shape) => (shape.code === activeState ? 2.9 : 1.3))
      .attr("opacity", (shape) => getStateOpacity(shape.code, context, activeState));

    fallbackRoot
      .selectAll("text.map-label")
      .data(FALLBACK_MAP_SHAPES.filter((shape) => shape.code !== "TAS"))
      .join("text")
      .attr("x", (shape) => shape.label[0])
      .attr("y", (shape) => shape.label[1])
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", 800)
      .attr("fill", "#4A4A4A")
      .attr("opacity", 0)
      .attr("pointer-events", "none")
      .text((shape) => shape.code)
      .transition()
      .duration(MOTION.durationBase)
      .ease(MOTION.ease)
      .attr("opacity", 1);

    const tasShape = FALLBACK_MAP_SHAPES.find((shape) => shape.code === "TAS");
    if (!tasShape) {
      return;
    }

    const [tx, ty] = tasShape.label;
    const labelX = tx + 30;
    const labelY = ty - 18;

    fallbackRoot
      .selectAll("line.tas-leader")
      .data([tasShape])
      .join("line")
      .attr("class", "tas-leader")
      .attr("x1", tx - 4)
      .attr("y1", ty - 8)
      .attr("x2", labelX - 6)
      .attr("y2", labelY + 3)
      .attr("stroke", "#6B7280")
      .attr("stroke-width", 1.2)
      .attr("opacity", 0)
      .transition()
      .duration(MOTION.durationBase)
      .ease(MOTION.ease)
      .attr("opacity", 0.85);

    fallbackRoot
      .selectAll("text.tas-label")
      .data([tasShape])
      .join("text")
      .attr("class", "tas-label")
      .attr("x", labelX)
      .attr("y", labelY)
      .attr("text-anchor", "start")
      .attr("font-size", 12)
      .attr("font-weight", 800)
      .attr("fill", "#4A4A4A")
      .attr("opacity", 0)
      .attr("pointer-events", "none")
      .text("TAS")
      .transition()
      .duration(MOTION.durationBase)
      .ease(MOTION.ease)
      .attr("opacity", 1);
  }

  function getRiskScale() {
    return d3.scaleThreshold().domain([0.5, 2, 5]).range(COLORS.riskScale);
  }

  function getStateFill(code, mapData, colorScale, context, activeState) {
    const record = mapData.get(code);
    if (context.isSingleJurisdiction && activeState && code !== activeState) {
      return "#EEF2F7";
    }
    if (!record || !Number.isFinite(record.positiveRate)) {
      return COLORS.missing;
    }
    return colorScale(record.positiveRate);
  }

  function getStateOpacity(code, context, activeState) {
    if (context.isSingleJurisdiction) {
      return 1;
    }
    if (!activeState) {
      return 1;
    }
    return code === activeState ? 1 : 0.82;
  }

  function buildMapTooltipHtml(code, context) {
    const record = context.mapData.get(code);
    const stateName = formatStateLabel(code);
    const yearLabel = context.snapshotDisplayLabel;
    const periodLabel = context.isAllYears ? "Period" : "Year";

    if (!record) {
    return buildStandardTooltip(escapeHtml(stateName), [
      `<span style="color: white">${periodLabel}: <span style="color: #f1c40f">${escapeHtml(yearLabel)}</span></span>`,
      `<span style="color: white">No data available for current filters.</span>`,
    ]);
  }

    return buildStandardTooltip(escapeHtml(stateName), [
      `<span style="color: white">${periodLabel}: <span style="color: #f1c40f">${escapeHtml(yearLabel)}</span></span>`,
      `<span style="color: white">Total tests: <span style="color: #f1c40f">${formatNumber(record.countTotal)}</span></span>`,
      `<span style="color: white">Positive rate: <span style="color: #f1c40f">${formatPercent(record.positiveRate)}</span></span>`,
    ]);
  }

  window.BreathMapChart = {
    renderMap,
  };
})();
