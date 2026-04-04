"use strict";

(function setupSpeedingChart2() {
  const app = window.SpeedingDashboard;

  window.SpeedingDashboard.initChart2 = function initChart2(data) {
    const tooltip = d3.select("#tooltip");
    const chart2Container = document.getElementById("chart2");
    const width2 = chart2Container.clientWidth;
    const height2 = 350;
    const margin2 = { top: 10, right: 140, bottom: 10, left: 10 };
    const innerW2 = width2 - margin2.left - margin2.right;
    const innerH2 = height2 - margin2.top - margin2.bottom;

    const svg2 = d3
      .select("#chart2")
      .append("svg")
      .attr("width", width2)
      .attr("height", height2)
      .append("g")
      .attr("transform", `translate(${margin2.left},${margin2.top})`);

    const riskScaleColors = ["#F6C36B", "#E89A2E", "#C96A12", "#8A3F00"];
    const getRiskColor = (percent) => {
      if (percent < 25) return riskScaleColors[0];
      if (percent < 50) return riskScaleColors[1];
      if (percent < 75) return riskScaleColors[2];
      return riskScaleColors[3];
    };

    window.updateChart2 = function updateChart2() {
      const transitionTime = 800;

      let treemapData = data
        .filter((d) => d.LOCATION !== "All regions")
        .map((d) => {
          const newObj = { ...d };
          if (newObj.LOCATION === "Remote" || newObj.LOCATION === "Very Remote") {
            newObj.TreemapLoc = "Remote";
            newObj.RawLocs = ["Remote", "Very Remote"];
          } else if (
            newObj.LOCATION === "Inner Regional" ||
            newObj.LOCATION === "Outer Regional"
          ) {
            newObj.TreemapLoc = "Regional";
            newObj.RawLocs = ["Inner Regional", "Outer Regional"];
          } else {
            newObj.TreemapLoc = newObj.LOCATION;
            newObj.RawLocs = [newObj.LOCATION];
          }
          return newObj;
        });

      if (app.globalFilter.jurisdiction !== "All") {
        treemapData = treemapData.filter((d) =>
          app.matchJurisdiction(d.JURISDICTION, app.globalFilter.jurisdiction),
        );
      }
      if (app.globalFilter.year !== "All") {
        treemapData = treemapData.filter((d) => d.YEAR === +app.globalFilter.year);
      }

      const grouped = d3.rollup(
        treemapData,
        (v) => ({
          fines: d3.sum(v, (d) => d.FINES),
          count: v.length,
          avg: v.length > 0 ? d3.sum(v, (d) => d.FINES) / v.length : 0,
          rawLocs: v[0].RawLocs,
        }),
        (d) => d.TreemapLoc,
      );
      const plotData = Array.from(grouped, ([location, vals]) => ({
        location,
        fines: vals.fines,
        count: vals.count,
        avg: vals.avg,
        rawLocs: vals.rawLocs,
      })).sort((a, b) => b.fines - a.fines);

      if (plotData.length === 0) {
        svg2.selectAll(".cell").transition().duration(300).style("opacity", 0).remove();
        svg2
          .selectAll(".no-data")
          .data([1])
          .join("text")
          .attr("class", "no-data")
          .attr("x", innerW2 / 2)
          .attr("y", innerH2 / 2)
          .attr("text-anchor", "middle")
          .text("No data for this filter")
          .style("fill", "var(--light-text)");
        return;
      }
      svg2.selectAll(".no-data").remove();

      const maxAvg = d3.max(plotData, (d) => d.avg) || 1;

      const root = d3
        .hierarchy({ children: plotData })
        .sum((d) => d.fines)
        .sort((a, b) => b.value - a.value);

      d3.treemap().size([innerW2, innerH2]).padding(2).round(true)(root);

      const cells = svg2.selectAll("g.cell").data(root.leaves(), (d) => d.data.location);
      cells.exit().transition().duration(300).style("opacity", 0).remove();

      const cellsEnter = cells
        .enter()
        .append("g")
        .attr("class", "cell")
        .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
        .style("cursor", "pointer")
        .style("opacity", 0);

      cellsEnter.append("rect").attr("rx", 3).style("stroke", "#fff").style("stroke-width", "1px");

      cellsEnter
        .append("text")
        .style("pointer-events", "none")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", "white")
        .attr("transform", (d) => {
          const w = d.x1 - d.x0;
          const h = d.y1 - d.y0;
          const cx = w / 2;
          const cy = h / 2;
          if (w < 60 && h > w * 1.5) return `translate(${cx}, ${cy}) rotate(-90)`;
          return `translate(${cx}, ${cy})`;
        });

      cellsEnter
        .select("text")
        .append("tspan")
        .attr("class", "node-label")
        .style("font-weight", "bold")
        .attr("x", 0)
        .attr("y", -10);
      cellsEnter
        .select("text")
        .append("tspan")
        .attr("class", "node-value")
        .style("fill", "rgba(255,255,255,0.9)")
        .style("font-weight", "bold")
        .attr("x", 0)
        .attr("y", 12);

      cellsEnter
        .on("mouseover", function onMouseOver(event, d) {
          d3.select(this).select("rect").style("filter", "brightness(1.15)").style("stroke-width", "2px");

          const sevPercent = (d.data.avg / maxAvg) * 100;
          tooltip.style("visibility", "visible").style("opacity", 1).html(`
            <div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${d.data.location}</div>
            <div class="tooltip-body" style="color: white; font-weight: bold;">
              <span style="color: white">Jurisdiction: <span style="color: #f1c40f">${app.globalFilter.jurisdiction === "All" ? "All Australia" : app.globalFilter.jurisdiction}</span></span><br/>
              <span style="color: white">Total Tickets: <span style="color: #f1c40f">${app.formatNum(d.data.count)}</span></span><br/>
              <span style="color: white">Total Fines: <span style="color: #f1c40f">$${app.formatNum(d.data.fines)}</span></span><br/>
              <span style="color: white">Severity Index: <span style="color: ${sevPercent > 75 ? "#ff4d4d" : "#f1c40f"}">${sevPercent.toFixed(1)}%</span></span>
            </div>
          `);
        })
        .on("mousemove", function onMouseMove(event) {
          tooltip.style("left", `${event.pageX + 15}px`).style("top", `${event.pageY - 28}px`);
        })
        .on("mouseout", function onMouseOut() {
          d3.select(this).select("rect").style("filter", "none").style("stroke-width", "1px");
          tooltip.style("visibility", "hidden").style("opacity", 0);
        })
        .on("click", function onClick(event, d) {
          let isSelected = false;
          if (app.globalFilter.location !== "All") {
            if (Array.isArray(app.globalFilter.location)) {
              isSelected =
                JSON.stringify(app.globalFilter.location) === JSON.stringify(d.data.rawLocs);
            } else {
              isSelected = d.data.rawLocs
                ? d.data.rawLocs.includes(app.globalFilter.location)
                : app.globalFilter.location === d.data.location;
            }
          }

          if (isSelected) {
            app.globalFilter.location = "All";
            d3.select("#locationSelect").property("value", "All");
          } else if (d.data.rawLocs && d.data.rawLocs.length > 1) {
            app.globalFilter.location = d.data.rawLocs;
            d3.select("#locationSelect").property("value", "All");
          } else {
            app.globalFilter.location = d.data.location;
            d3.select("#locationSelect").property("value", d.data.location);
          }
          app.triggerGlobalUpdate();
        });

      const mergedCells = cellsEnter.merge(cells);

      mergedCells
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
        .style("opacity", (d) => {
          if (app.globalFilter.location === "All") return 1;
          let isSelected = false;
          if (Array.isArray(app.globalFilter.location)) {
            isSelected =
              JSON.stringify(app.globalFilter.location) === JSON.stringify(d.data.rawLocs);
          } else {
            isSelected = d.data.rawLocs
              ? d.data.rawLocs.includes(app.globalFilter.location)
              : app.globalFilter.location === d.data.location;
          }
          return isSelected ? 1 : 0.3;
        });

      mergedCells
        .select("rect")
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .attr("width", (d) => Math.max(0, d.x1 - d.x0))
        .attr("height", (d) => Math.max(0, d.y1 - d.y0))
        .attr("fill", (d) => {
          const percent = (d.data.avg / maxAvg) * 100;
          const baseColor = getRiskColor(percent);
          if (app.globalFilter.location === "All") return baseColor;

          let isSelected = false;
          if (Array.isArray(app.globalFilter.location)) {
            isSelected =
              JSON.stringify(app.globalFilter.location) === JSON.stringify(d.data.rawLocs);
          } else {
            isSelected = d.data.rawLocs
              ? d.data.rawLocs.includes(app.globalFilter.location)
              : app.globalFilter.location === d.data.location;
          }
          return isSelected ? baseColor : "#d6c8b8";
        });

      mergedCells
        .select("text")
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .style("opacity", (d) => ((d.x1 - d.x0 < 45 ? 0 : 1)))
        .attr("transform", (d) => {
          const w = d.x1 - d.x0;
          const h = d.y1 - d.y0;
          const cx = w / 2;
          const cy = h / 2;
          if (w < 60 && h > w * 1.5) return `translate(${cx}, ${cy}) rotate(-90)`;
          return `translate(${cx}, ${cy})`;
        });

      mergedCells
        .select(".node-label")
        .text((d) => d.data.location)
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .attr("x", 0)
        .attr("y", -10)
        .style("fill", (d) => {
          const percent = (d.data.avg / maxAvg) * 100;
          let isSel = app.globalFilter.location === "All";
          if (!isSel) {
            isSel = Array.isArray(app.globalFilter.location)
              ? JSON.stringify(app.globalFilter.location) === JSON.stringify(d.data.rawLocs)
              : d.data.rawLocs
                ? d.data.rawLocs.includes(app.globalFilter.location)
                : app.globalFilter.location === d.data.location;
          }
          return !isSel || percent < 40 ? "#5C4D3C" : "white";
        })
        .style("font-size", (d) => {
          const w = d.x1 - d.x0;
          const h = d.y1 - d.y0;
          const effWidth = w < 60 && h > w * 1.5 ? h : w;
          if (effWidth > 100) return "15px";
          if (effWidth > 60) return "13px";
          return "11px";
        });

      mergedCells
        .select(".node-value")
        .text((d) => `$${app.formatNum(d.data.fines)}`)
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .attr("x", 0)
        .attr("y", 12)
        .style("fill", (d) => {
          const percent = (d.data.avg / maxAvg) * 100;
          let isSel = app.globalFilter.location === "All";
          if (!isSel) {
            isSel = Array.isArray(app.globalFilter.location)
              ? JSON.stringify(app.globalFilter.location) === JSON.stringify(d.data.rawLocs)
              : d.data.rawLocs
                ? d.data.rawLocs.includes(app.globalFilter.location)
                : app.globalFilter.location === d.data.location;
          }
          return !isSel || percent < 40 ? "#5C4D3C" : "white";
        })
        .style("font-size", (d) => {
          const w = d.x1 - d.x0;
          const h = d.y1 - d.y0;
          const effWidth = w < 60 && h > w * 1.5 ? h : w;
          if (effWidth > 100) return "14px";
          if (effWidth > 60) return "12px";
          return "10px";
        });

      const smallCells = root.leaves().filter((d) => d.x1 - d.x0 < 45);

      const callouts = svg2.selectAll("g.treemap-callout").data(smallCells, (d) => d.data.location);
      callouts.exit().transition().duration(300).style("opacity", 0).remove();

      const calloutsEnter = callouts
        .enter()
        .append("g")
        .attr("class", "treemap-callout")
        .style("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function onMouseOver(event, d) {
          d3.select(this)
            .select(".callout-bg")
            .style("filter", "drop-shadow(0px 3px 6px rgba(0,0,0,0.3)) brightness(1.05)");

          const sevPercent = (d.data.avg / maxAvg) * 100;

          tooltip.style("visibility", "visible").style("opacity", 1).html(`
            <div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${d.data.location}</div>
            <div class="tooltip-body" style="color: white; font-weight: bold;">
              <span style="color: white">Jurisdiction: <span style="color: #f1c40f">${app.globalFilter.jurisdiction === "All" ? "All Australia" : app.globalFilter.jurisdiction}</span></span><br/>
              <span style="color: white">Total Tickets: <span style="color: #f1c40f">${app.formatNum(d.data.count)}</span></span><br/>
              <span style="color: white">Total Fines: <span style="color: #f1c40f">$${app.formatNum(d.data.fines)}</span></span><br/>
              <span style="color: white">Severity Index: <span style="color: ${sevPercent > 75 ? "#ff4d4d" : "#f1c40f"}">${sevPercent.toFixed(1)}%</span></span>
            </div>
          `);
        })
        .on("mousemove", function onMouseMove(event) {
          tooltip.style("left", `${event.pageX + 15}px`).style("top", `${event.pageY - 28}px`);
        })
        .on("mouseout", function onMouseOut() {
          d3.select(this)
            .select(".callout-bg")
            .style("filter", "drop-shadow(0px 2px 4px rgba(0,0,0,0.15)) brightness(1)");
          tooltip.style("visibility", "hidden").style("opacity", 0);
        })
        .on("click", function onClick(event, d) {
          let isSelected = false;
          if (app.globalFilter.location !== "All") {
            if (Array.isArray(app.globalFilter.location)) {
              isSelected =
                JSON.stringify(app.globalFilter.location) === JSON.stringify(d.data.rawLocs);
            } else {
              isSelected = d.data.rawLocs
                ? d.data.rawLocs.includes(app.globalFilter.location)
                : app.globalFilter.location === d.data.location;
            }
          }

          if (isSelected) {
            app.globalFilter.location = "All";
            d3.select("#locationSelect").property("value", "All");
          } else if (d.data.rawLocs && d.data.rawLocs.length > 1) {
            app.globalFilter.location = d.data.rawLocs;
            d3.select("#locationSelect").property("value", "All");
          } else {
            app.globalFilter.location = d.data.location;
            d3.select("#locationSelect").property("value", d.data.location);
          }
          app.triggerGlobalUpdate();
        });

      calloutsEnter
        .append("path")
        .attr("class", "callout-line")
        .style("fill", "none")
        .style("stroke", "#8A3F00")
        .style("stroke-width", "1.5px")
        .style("stroke-dasharray", "3,3");

      calloutsEnter.append("circle").attr("class", "callout-dot").attr("r", 3).style("fill", "#8A3F00");

      calloutsEnter
        .append("rect")
        .attr("class", "callout-bg")
        .attr("rx", 5)
        .style("fill", "#FDF5EB")
        .style("filter", "drop-shadow(0px 2px 4px rgba(0,0,0,0.15))");

      calloutsEnter
        .append("text")
        .attr("class", "callout-text label")
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .style("fill", "#5C4D3C");

      calloutsEnter
        .append("text")
        .attr("class", "callout-text value")
        .style("font-size", "14px")
        .style("fill", "#8A3F00")
        .style("font-weight", "900");

      const mergedCallouts = calloutsEnter.merge(callouts);

      mergedCallouts
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .style("opacity", (d) => {
          if (app.globalFilter.location === "All") return 1;
          let isSel = false;
          if (Array.isArray(app.globalFilter.location)) {
            isSel = JSON.stringify(app.globalFilter.location) === JSON.stringify(d.data.rawLocs);
          } else {
            isSel = d.data.rawLocs
              ? d.data.rawLocs.includes(app.globalFilter.location)
              : app.globalFilter.location === d.data.location;
          }
          return isSel ? 1 : 0;
        });

      mergedCallouts
        .select("path")
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .attr("d", (d, i) => {
          const cx = d.x0 + (d.x1 - d.x0) / 2;
          const cy = d.y0 + (d.y1 - d.y0) / 2;
          const calloutY = Math.max(150, cy) + i * 45;
          return `M ${cx} ${cy} L ${innerW2 + 5} ${calloutY} L ${innerW2 + 10} ${calloutY}`;
        });

      mergedCallouts
        .select("circle")
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .attr("cx", (d) => d.x0 + (d.x1 - d.x0) / 2)
        .attr("cy", (d) => d.y0 + (d.y1 - d.y0) / 2);

      mergedCallouts
        .select(".callout-bg")
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .attr("x", innerW2 + 10)
        .attr("y", (d, i) => Math.max(150, d.y0 + (d.y1 - d.y0) / 2) - 22 + i * 45)
        .attr("width", 100)
        .attr("height", 48)
        .style("stroke", (d) => {
          const percent = (d.data.avg / maxAvg) * 100;
          return getRiskColor(percent);
        })
        .style("stroke-width", "2.5px");

      mergedCallouts
        .select(".label")
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .attr("x", innerW2 + 20)
        .attr("y", (d, i) => Math.max(150, d.y0 + (d.y1 - d.y0) / 2) - 5 + i * 45)
        .text((d) => d.data.location);

      mergedCallouts
        .select(".value")
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .attr("x", innerW2 + 20)
        .attr("y", (d, i) => Math.max(150, d.y0 + (d.y1 - d.y0) / 2) + 16 + i * 45)
        .text((d) => `$${app.formatNum(d.data.fines)}`);

      if (svg2.select(".treemap-legend").empty()) {
        const legendGroup = svg2
          .append("g")
          .attr("class", "treemap-legend")
          .attr("transform", `translate(${innerW2 + 15}, 40)`);

        legendGroup
          .append("text")
          .attr("x", 0)
          .attr("y", -10)
          .attr("fill", "#5C4D3C")
          .attr("font-size", "12px")
          .attr("font-weight", "bold")
          .text("Severity Index");

        const legendData = [
          { label: "Very High (> 75%)", color: riskScaleColors[3] },
          { label: "High (50-75%)", color: riskScaleColors[2] },
          { label: "Moderate (25-50%)", color: riskScaleColors[1] },
          { label: "Low (< 25%)", color: riskScaleColors[0] },
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
          .text((d) => d.label);
      }
      svg2.select(".treemap-legend").raise();
    };
  };
})();
