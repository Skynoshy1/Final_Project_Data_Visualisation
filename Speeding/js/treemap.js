"use strict";

(function setupSpeedingChart3() {
  const app = window.SpeedingDashboard;

  window.SpeedingDashboard.initChart3 = function initChart3(data) {
    const tooltip = d3.select("#tooltip");
    const chart3Container = document.getElementById("chart3");
    const width3 = chart3Container.clientWidth;
    const height3 = 400;
    const margin3 = { top: 20, right: 120, bottom: 50, left: 80 };
    const innerW3 = width3 - margin3.left - margin3.right;
    const innerH3 = height3 - margin3.top - margin3.bottom;

    const svg3 = d3
      .select("#chart3")
      .append("svg")
      .attr("width", width3)
      .attr("height", height3)
      .append("g")
      .attr("transform", `translate(${margin3.left},${margin3.top})`);
    const x3 = d3.scaleLinear().range([0, innerW3]);
    const y3Left = d3.scaleLinear().range([innerH3, 0]);
    const y3Right = d3.scaleLinear().range([innerH3, 0]);

    const xAxisGroup3 = svg3.append("g").attr("transform", `translate(0,${innerH3})`);
    const yAxisGroup3Left = svg3.append("g");
    const yAxisGroup3Right = svg3.append("g").attr("transform", `translate(${innerW3},0)`);

    const areaGroup3 = svg3.append("g").attr("class", "area-layer");
    const dotsGroup3 = svg3.append("g").attr("class", "dots-layer");

    window.updateChart3 = function updateChart3(viewMode) {
      const transitionTime = 600;
      let currentData = data.filter(
        (d) => d.DETECTION_TYPE === "Camera Issued" || d.DETECTION_TYPE === "Police Issued",
      );
      if (app.globalFilter.jurisdiction !== "All") {
        currentData = currentData.filter((d) =>
          app.matchJurisdiction(d.JURISDICTION, app.globalFilter.jurisdiction),
        );
      }
      if (app.globalFilter.location !== "All") {
        currentData = currentData.filter((d) =>
          app.matchLocation(d.LOCATION, app.globalFilter.location),
        );
      }

      const groupedData = d3.rollup(
        currentData,
        (v) => d3.sum(v, (d) => d.FINES),
        (d) => d.YEAR,
        (d) => d.DETECTION_TYPE,
      );

      const chartData = Array.from(groupedData, ([year, typesMap]) => ({
        year,
        "Camera Issued": typesMap.has("Camera Issued") ? typesMap.get("Camera Issued") : null,
        "Police Issued": typesMap.has("Police Issued") ? typesMap.get("Police Issued") : null,
      })).sort((a, b) => a.year - b.year);

      if (chartData.length === 0 || currentData.length === 0) {
        areaGroup3.selectAll("*").remove();
        dotsGroup3.selectAll("*").remove();
        xAxisGroup3.selectAll("*").remove();
        yAxisGroup3Left.selectAll("*").remove();
        yAxisGroup3Right.selectAll("*").remove();
        svg3
          .selectAll(".no-data")
          .data([1])
          .join("text")
          .attr("class", "no-data")
          .attr("x", innerW3 / 2)
          .attr("y", innerH3 / 2)
          .attr("text-anchor", "middle")
          .text("No data available")
          .style("fill", "var(--light-text)");
        return;
      }
      svg3.selectAll(".no-data").remove();

      const minYear = d3.min(chartData, (d) => d.year);
      const maxYear = d3.max(chartData, (d) => d.year);

      const tickVals = chartData.map((d) => d.year);
      tickVals.push(maxYear + 1);
      x3.domain([minYear - 0.8, maxYear + 1]);
      xAxisGroup3
        .transition()
        .duration(transitionTime)
        .call(d3.axisBottom(x3).tickValues(tickVals).tickFormat(d3.format("d")))
        .selectAll("text")
        .attr("transform", "rotate(-25)")
        .style("text-anchor", "end")
        .attr("dx", "-0.8em")
        .attr("dy", "0.15em");

      const maxCamera = d3.max(chartData, (d) => d["Camera Issued"]) || 1;
      const maxPolice = d3.max(chartData, (d) => d["Police Issued"]) || 1;

      y3Left.domain([0, maxCamera * 1.1]);
      y3Right.domain([0, maxPolice * 1.1]);

      yAxisGroup3Left
        .transition()
        .duration(transitionTime)
        .call(d3.axisLeft(y3Left).tickFormat(d3.format("~s")))
        .selectAll("text")
        .style("fill", "var(--primary-color)")
        .style("font-weight", "bold");
      yAxisGroup3Left.selectAll("path, line").style("stroke", "var(--primary-color)");

      yAxisGroup3Right
        .transition()
        .duration(transitionTime)
        .call(d3.axisRight(y3Right).tickFormat(d3.format("~s")))
        .selectAll("text")
        .style("fill", "var(--secondary-color)")
        .style("font-weight", "bold");
      yAxisGroup3Right.selectAll("path, line").style("stroke", "var(--secondary-color)");

      svg3.selectAll(".y-axis-title").remove();
      yAxisGroup3Left
        .append("text")
        .attr("class", "y-axis-title")
        .attr("transform", "rotate(-90)")
        .attr("y", -60)
        .attr("x", -innerH3 / 2)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("fill", "var(--primary-color)")
        .style("font-weight", "bold")
        .text("Camera Fines")
        .style("opacity", viewMode === "All" || viewMode === "Camera Issued" ? 1 : 0);
      yAxisGroup3Right
        .append("text")
        .attr("class", "y-axis-title")
        .attr("transform", "rotate(90)")
        .attr("y", -60)
        .attr("x", innerH3 / 2)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("fill", "var(--secondary-color)")
        .style("font-weight", "bold")
        .text("Police Fines")
        .style("opacity", viewMode === "All" || viewMode === "Police Issued" ? 1 : 0);

      yAxisGroup3Left.style(
        "opacity",
        viewMode === "All" || viewMode === "Camera Issued" ? 1 : 0,
      );
      yAxisGroup3Right.style(
        "opacity",
        viewMode === "All" || viewMode === "Police Issued" ? 1 : 0,
      );

      const colorScale = d3
        .scaleOrdinal()
        .domain(["Camera Issued", "Police Issued"])
        .range(["var(--primary-color)", "var(--secondary-color)"]);

      const areaCamera = d3
        .area()
        .defined((d) => d["Camera Issued"] !== null)
        .x((d) => x3(d.year))
        .y0(innerH3)
        .y1((d) => y3Left(d["Camera Issued"]))
        .curve(d3.curveMonotoneX);
      const areaPolice = d3
        .area()
        .defined((d) => d["Police Issued"] !== null)
        .x((d) => x3(d.year))
        .y0(innerH3)
        .y1((d) => y3Right(d["Police Issued"]))
        .curve(d3.curveMonotoneX);
      const lineCamera = d3
        .line()
        .defined((d) => d["Camera Issued"] !== null)
        .x((d) => x3(d.year))
        .y((d) => y3Left(d["Camera Issued"]))
        .curve(d3.curveMonotoneX);
      const linePolice = d3
        .line()
        .defined((d) => d["Police Issued"] !== null)
        .x((d) => x3(d.year))
        .y((d) => y3Right(d["Police Issued"]))
        .curve(d3.curveMonotoneX);

      const seriesKeys = ["Police Issued", "Camera Issued"];
      const areaData = seriesKeys.map((k) => ({ key: k, values: chartData }));

      const paths = areaGroup3.selectAll("path.area").data(areaData, (d) => d.key);
      paths.exit().transition().duration(300).style("opacity", 0).remove();

      paths
        .enter()
        .append("path")
        .attr("class", "area")
        .attr("fill", (d) => colorScale(d.key))
        .style("opacity", 0)
        .merge(paths)
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .attr("d", (d) => (d.key === "Camera Issued" ? areaCamera(d.values) : areaPolice(d.values)))
        .style("fill", (d) => colorScale(d.key))
        .style("opacity", (d) => (viewMode === "All" || d.key === viewMode ? 0.25 : 0))
        .style("pointer-events", "none");

      const lines = areaGroup3.selectAll("path.line").data(areaData, (d) => d.key);
      lines.exit().transition().duration(300).style("opacity", 0).remove();

      lines
        .enter()
        .append("path")
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", (d) => colorScale(d.key))
        .attr("stroke-width", 3)
        .style("opacity", 0)
        .merge(lines)
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .attr("d", (d) => (d.key === "Camera Issued" ? lineCamera(d.values) : linePolice(d.values)))
        .style("stroke", (d) => colorScale(d.key))
        .style("opacity", (d) => (viewMode === "All" || d.key === viewMode ? 1 : 0))
        .style("pointer-events", "none");

      const dotData = [];
      chartData.forEach((point) => {
        seriesKeys.forEach((key) => {
          if ((viewMode === "All" || viewMode === key) && point[key] !== null) {
            dotData.push({
              year: point.year,
              key,
              val: point[key],
              cameraVal: point["Camera Issued"],
              policeVal: point["Police Issued"],
              yPos: key === "Camera Issued" ? y3Left(point[key]) : y3Right(point[key]),
            });
          }
        });
      });

      dotData.sort((a, b) => (a.key === "Police Issued" ? 1 : -1));

      const dots = dotsGroup3.selectAll("circle.area-dot").data(dotData, (d) => `${d.key}-${d.year}`);
      dots.exit().transition().duration(300).style("opacity", 0).attr("r", 0).remove();

      dots
        .enter()
        .append("circle")
        .attr("class", "area-dot")
        .attr("r", 0)
        .attr("fill", "white")
        .attr("stroke", (d) => colorScale(d.key))
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .on("mouseover", function onMouseOver(event, d) {
          const activeR = 6;
          d3.select(this)
            .attr("r", activeR)
            .style("stroke-width", 2.5)
            .style("filter", "brightness(1.15)");

          tooltip.style("visibility", "visible").style("opacity", 1).html(`
            <div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${d.year}</div>
            <div class="tooltip-body" style="color: white; font-weight: bold;">
              <span style="color: white">Camera Fines: <span style="color: #f1c40f">$${app.formatNum(d.cameraVal || 0)}</span></span><br/>
              <span style="color: white">Police Fines: <span style="color: #f1c40f">$${app.formatNum(d.policeVal || 0)}</span></span>
            </div>
          `);
        })
        .on("mousemove", function onMouseMove(event) {
          tooltip.style("left", `${event.pageX + 15}px`).style("top", `${event.pageY - 28}px`);
        })
        .on("mouseout", function onMouseOut(event, d) {
          const isActiveYear =
            app.globalFilter.year !== "All" && +app.globalFilter.year === d.year;
          const baseR = 4.5;
          d3.select(this)
            .attr("r", isActiveYear ? baseR + 1.5 : baseR)
            .style("stroke-width", 2)
            .style("filter", "none");
          tooltip.style("visibility", "hidden").style("opacity", 0);
        })
        .merge(dots)
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .attr("cx", (d) => x3(d.year))
        .attr("cy", (d) => d.yPos)
        .style("opacity", (d) => {
          if (app.globalFilter.year !== "All" && +app.globalFilter.year !== d.year) return 0.2;
          return 1;
        })
        .attr("r", (d) => {
          const baseR = 4.5;
          return app.globalFilter.year !== "All" && +app.globalFilter.year === d.year
            ? baseR + 1.5
            : baseR;
        });

      const cameraDots = dotData.filter((d) => d.key === "Camera Issued");
      const policeDots = dotData.filter((d) => d.key === "Police Issued");
      const actualMaxCamera = cameraDots.length ? d3.max(cameraDots, (d) => d.val) : null;
      const actualMaxPolice = policeDots.length ? d3.max(policeDots, (d) => d.val) : null;

      const maxLabelsData = [];
      if (actualMaxCamera !== null) maxLabelsData.push(cameraDots.find((d) => d.val === actualMaxCamera));
      if (actualMaxPolice !== null) maxLabelsData.push(policeDots.find((d) => d.val === actualMaxPolice));

      const maxLabels = dotsGroup3.selectAll("text.max-label").data(maxLabelsData, (d) => d.key);
      maxLabels.exit().transition().duration(300).style("opacity", 0).remove();

      maxLabels
        .enter()
        .append("text")
        .attr("class", "max-label")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", (d) => colorScale(d.key))
        .style("pointer-events", "none")
        .style(
          "text-shadow",
          "1px 1px 3px rgba(255,255,255,0.8), -1px -1px 3px rgba(255,255,255,0.8), 0px 0px 3px rgba(255,255,255,1)",
        )
        .attr("dy", "-10px")
        .style("opacity", 0)
        .attr("x", (d) => x3(d.year))
        .attr("y", (d) => d.yPos)
        .merge(maxLabels)
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .attr("x", (d) => x3(d.year))
        .attr("y", (d) => d.yPos)
        .text((d) => `$${app.formatNum(d.val)}`)
        .style("opacity", (d) => {
          if (app.globalFilter.year !== "All" && +app.globalFilter.year !== d.year) return 0.2;
          return 1;
        });

      svg3.selectAll(".bars-layer").remove();
    };

    d3.selectAll(".toggle-btn").on("click", function onToggleClick() {
      d3.selectAll(".toggle-btn").classed("active", false);
      d3.select(this).classed("active", true);
      app.triggerGlobalUpdate();
    });
  };
})();
