"use strict";

(function setupSpeedingMapChart() {
  const app = window.SpeedingDashboard;

  const mapContainer = document.getElementById("map");
  app.mapWidth = mapContainer.clientWidth;
  app.mapHeight = 550;
  app.svgMap = d3
    .select("#map")
    .append("svg")
    .attr("width", app.mapWidth)
    .attr("height", app.mapHeight);
  app.mapTooltip = d3.select("#tooltip");

  window.SpeedingDashboard.clearMapActive = function clearMapActive() {
    if (!app.svgMap) return;
    app.svgMap.selectAll(".state").classed("active", false);
  };

  function bindDefaultStateEvents() {
    app.svgMap
      .selectAll(".state")
      .on("click", function onClick(event, d) {
        const stateName = app.getFeatureStateName(d);
        if (d3.select(this).classed("active")) {
          d3.select(this).classed("active", false);
          app.globalFilter.jurisdiction = "All";
        } else {
          app.svgMap.selectAll(".state").classed("active", false);
          d3.select(this).classed("active", true);
          app.globalFilter.jurisdiction = stateName;
        }
        app.triggerGlobalUpdate();
      });
  }

  d3.json("data/au-states.geojson")
    .then((geoData) => {
      app.speedingGeoData = geoData;
      app.speedingGeoJsonFeatures = geoData.features;
      app.speedingPathGenerator = app.buildSpeedingPathGenerator();

      app.svgMap
        .selectAll(".state")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("class", "state")
        .attr("d", (d) => app.speedingPathGenerator(d))
        .attr("fill", "#e0d8d0")
        .on("mouseover", function onMouseOver(event, d) {
          const stateName = app.getFeatureStateName(d);
          app.mapTooltip
            .style("visibility", "visible")
            .style("opacity", 1)
            .html(`
              <div class="tooltip-header" style="color: var(--primary-color)"> Jurisdiction</div>
              <div class="tooltip-body"><strong>${stateName}</strong></div>
            `);
        })
        .on("mousemove", function onMouseMove(event) {
          app.mapTooltip
            .style("left", `${event.pageX + 15}px`)
            .style("top", `${event.pageY - 28}px`);
        })
        .on("mouseout", function onMouseOut() {
          app.mapTooltip.style("visibility", "hidden").style("opacity", 0);
        });

      bindDefaultStateEvents();

      app.svgMap
        .selectAll(".map-label")
        .data(geoData.features)
        .enter()
        .append("text")
        .attr("class", "map-label")
        .attr("transform", function transformLabel(feature) {
          const [x, y] = app.speedingPathGenerator.centroid(feature);
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return d3.select(this).attr("transform") || "translate(-999,-999)";
          }
          return `translate(${x}, ${y})`;
        })
        .text((feature) => {
          const stateName = app.getFeatureStateName(feature);
          return app.reverseStateNameMap[stateName]
            ? app.reverseStateNameMap[stateName].toUpperCase()
            : "";
        })
        .style("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#4A4A4A")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .transition()
        .delay(180)
        .duration(400)
        .style("opacity", 1);

      if (typeof window.updateMap === "function") window.updateMap();
    })
    .catch((error) => console.error("Map Loading Error:", error));

  window.updateMap = function updateMap() {
    if (!app.speedingGeoJsonFeatures || !app.data || !app.data.length) return;

    const nextPathGenerator = app.buildSpeedingPathGenerator();
    if (nextPathGenerator) app.speedingPathGenerator = nextPathGenerator;

    let filteredData = app.data;
    if (app.globalFilter.year !== "All") {
      filteredData = filteredData.filter((d) => d.YEAR === +app.globalFilter.year);
    }
    if (app.globalFilter.location !== "All") {
      filteredData = filteredData.filter((d) =>
        app.matchLocation(d.LOCATION, app.globalFilter.location),
      );
    }

    const shortToFullNameMap = Object.entries(app.reverseStateNameMap).reduce(
      (acc, [full, short]) => {
        acc[short] = full;
        return acc;
      },
      {},
    );

    const grouped = d3.rollup(
      filteredData,
      (v) => {
        const totalFines = d3.sum(v, (d) => d.FINES);
        const count = v.length;
        return { fines: totalFines, count, avg: count > 0 ? totalFines / count : 0 };
      },
      (d) => shortToFullNameMap[d.JURISDICTION] || d.JURISDICTION,
    );

    const allAvgs = Array.from(grouped.values()).map((d) => d.avg);
    const maxAvg = allAvgs.length > 0 ? d3.max(allAvgs) || 1 : 1;
    const riskScaleColors = ["#F6C36B", "#E89A2E", "#C96A12", "#8A3F00"];

    const getRiskColor = (percent) => {
      if (percent < 25) return riskScaleColors[0];
      if (percent < 50) return riskScaleColors[1];
      if (percent < 75) return riskScaleColors[2];
      return riskScaleColors[3];
    };

    app.mapTooltip.style("visibility", "hidden").style("opacity", 0);
    app.svgMap.selectAll("path.state, text.map-label").remove();
    const mapSceneTransition = d3.transition().duration(220).ease(d3.easeCubicOut);

    app.svgMap
      .selectAll("path.state")
      .data(app.speedingGeoJsonFeatures)
      .enter()
      .append("path")
      .attr("class", "state")
      .attr("d", (d) => app.speedingPathGenerator(d))
      .attr("fill", (d) => {
        const stateName = app.getFeatureStateName(d);
        if (!grouped.has(stateName)) return "#D1D5DB";
        const percent = (grouped.get(stateName).avg / maxAvg) * 100;
        return getRiskColor(percent);
      })
      .style("opacity", 0)
      .transition(mapSceneTransition)
      .style("opacity", 1)
      .selection()
      .classed(
        "active",
        (d) =>
          app.globalFilter.jurisdiction !== "All" &&
          app.matchJurisdiction(app.getFeatureStateName(d), app.globalFilter.jurisdiction),
      )
      .on("mouseover", function onMouseOver(event, d) {
        const stateName = app.getFeatureStateName(d);
        if (!grouped.has(stateName)) {
          app.mapTooltip.style("visibility", "visible").style("opacity", 1).html(`
            <div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${stateName}</div>
            <div class="tooltip-body" style="color: white; font-weight: bold;">No data available</div>
          `);
          return;
        }
        const stateData = grouped.get(stateName);
        const percent = (stateData.avg / maxAvg) * 100;

        app.mapTooltip.style("visibility", "visible").style("opacity", 1).html(`
          <div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${stateName}</div>
          <div class="tooltip-body" style="color: white; font-weight: bold;">
            <span style="color: white">Total Tickets: <span style="color: #f1c40f">${app.formatNum(stateData.count)}</span></span><br/>
            <span style="color: white">Total Fines: <span style="color: #f1c40f">${app.formatNum(stateData.fines)}</span></span><br/>
            <span style="color: white">Severity Index: <span style="color: ${percent > 75 ? "#ff4d4d" : "#f1c40f"}">${percent.toFixed(1)}%</span></span>
          </div>
        `);
      })
      .on("mousemove", function onMouseMove(event) {
        app.mapTooltip
          .style("left", `${event.pageX + 15}px`)
          .style("top", `${event.pageY - 28}px`);
      })
      .on("mouseout", function onMouseOut() {
        app.mapTooltip.style("visibility", "hidden").style("opacity", 0);
      });

    bindDefaultStateEvents();

    app.svgMap
      .selectAll("text.map-label")
      .data(app.speedingGeoJsonFeatures)
      .enter()
      .append("text")
      .attr("class", "map-label")
      .attr("transform", function transformLabel(feature) {
        const [x, y] = app.speedingPathGenerator.centroid(feature);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return d3.select(this).attr("transform") || "translate(-999,-999)";
        }
        return `translate(${x}, ${y})`;
      })
      .text((feature) => {
        const stateName = app.getFeatureStateName(feature);
        return app.reverseStateNameMap[stateName]
          ? app.reverseStateNameMap[stateName].toUpperCase()
          : "";
      })
      .style("text-anchor", "middle")
      .style("dominant-baseline", "middle")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .style("fill", "#4A4A4A")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .transition(mapSceneTransition)
      .style("opacity", 1);

    if (app.svgMap.select(".map-legend").empty()) {
      const legendGroup = app.svgMap
        .append("g")
        .attr("class", "map-legend")
        .attr("transform", `translate(18, ${app.mapHeight - 100})`);

      legendGroup
        .append("text")
        .attr("x", 0)
        .attr("y", -10)
        .attr("fill", "#5C4D3C")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .text("Severity Index");

      const legendData = [
        { label: "Low (< 25%)", color: riskScaleColors[0] },
        { label: "Moderate (25-50%)", color: riskScaleColors[1] },
        { label: "High (50-75%)", color: riskScaleColors[2] },
        { label: "Severe (> 75%)", color: riskScaleColors[3] },
      ];

      legendGroup
        .selectAll("rect.legend-swatch")
        .data(legendData)
        .enter()
        .append("rect")
        .attr("class", "legend-swatch")
        .attr("x", 0)
        .attr("y", (d, i) => i * 20)
        .attr("width", 12)
        .attr("height", 12)
        .attr("rx", 2)
        .attr("fill", (d) => d.color);

      legendGroup
        .selectAll("text.legend-label")
        .data(legendData)
        .enter()
        .append("text")
        .attr("class", "legend-label")
        .attr("x", 18)
        .attr("y", (d, i) => i * 20 + 10)
        .attr("fill", "#5C4D3C")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .text((d) => d.label);
    }

    app.svgMap.select(".map-legend").raise();
  };
})();
