"use strict";

(function setupSpeedingChart1() {
  const app = window.SpeedingDashboard;

  window.SpeedingDashboard.initChart1 = function initChart1(data) {
    const tooltip = d3.select("#tooltip");
    const chart1Container = document.getElementById("chart1");
    const width1 = chart1Container.clientWidth;
    const height1 = 350;
    const margin1 = { top: 30, right: 60, bottom: 50, left: 60 };
    const innerW1 = width1 - margin1.left - margin1.right;
    const innerH1 = height1 - margin1.top - margin1.bottom;

    const svg1 = d3
      .select("#chart1")
      .append("svg")
      .attr("width", width1)
      .attr("height", height1)
      .append("g")
      .attr("transform", `translate(${margin1.left},${margin1.top})`);

    const x1 = d3.scaleBand().range([0, innerW1]).padding(0.3);
    const y1 = d3.scaleLinear().range([innerH1, 0]);
    const y1Line = d3.scaleLinear().range([innerH1, 0]);

    const xAxisGroup1 = svg1.append("g").attr("transform", `translate(0,${innerH1})`);
    const yAxisGroup1 = svg1.append("g");
    const yAxisGroup1Right = svg1.append("g").attr("transform", `translate(${innerW1},0)`);

    const barsGroup = svg1.append("g").attr("class", "bars-layer");
    const lineGroup = svg1.append("g").attr("class", "line-layer");
    const dotsGroup = svg1.append("g").attr("class", "dots-layer");
    const linePath1 = lineGroup
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "#f39c12")
      .attr("stroke-width", 3);

    window.updateChart1 = function updateChart1() {
      const transitionTime = 800;
      let filteredData = data;
      if (app.globalFilter.jurisdiction !== "All") {
        filteredData = filteredData.filter((d) =>
          app.matchJurisdiction(d.JURISDICTION, app.globalFilter.jurisdiction),
        );
      }
      if (app.globalFilter.location !== "All") {
        filteredData = filteredData.filter((d) =>
          app.matchLocation(d.LOCATION, app.globalFilter.location),
        );
      }

      const grouped = d3.rollup(
        filteredData,
        (v) => ({
          fines: d3.sum(v, (d) => d.FINES),
          count: v.length,
          avg: v.length > 0 ? d3.sum(v, (d) => d.FINES) / v.length : 0,
        }),
        (d) => d.YEAR,
      );
      const plotData = Array.from(grouped, ([year, vals]) => ({
        year,
        fines: vals.fines,
        count: vals.count,
        avg: vals.avg,
      })).sort((a, b) => a.year - b.year);

      plotData.forEach((d, i) => {
        if (i === 0) {
          d.yoyAvgText = `<span style="color: var(--light-text); font-size: 0.85em;"> First year</span>`;
        } else {
          const prevAvg = plotData[i - 1].avg;
          const prevYear = plotData[i - 1].year;
          if (prevAvg === 0) {
            d.yoyAvgText = `<span style="color: var(--light-text); font-size: 0.85em;"> Cannot compare to ${prevYear}</span>`;
          } else {
            const yoy = ((d.avg - prevAvg) / prevAvg) * 100;
            if (yoy > 0) {
              d.yoyAvgText = `<span style="color: white; font-size: 0.9em;"><span style="color: #f1c40f; font-weight: bold;">Increased</span> <span style="color: #f1c40f; font-weight: bold;">${yoy.toFixed(1)}%</span> vs ${prevYear}</span>`;
            } else if (yoy < 0) {
              d.yoyAvgText = `<span style="color: white; font-size: 0.9em;"><span style="color: #f1c40f; font-weight: bold;">Decreased</span> <span style="color: #f1c40f; font-weight: bold;">${Math.abs(yoy).toFixed(1)}%</span> vs ${prevYear}</span>`;
            } else {
              d.yoyAvgText = `<span style="color: white; font-size: 0.9em;">No change vs ${prevYear}</span>`;
            }
          }
        }
      });

      if (plotData.length === 0) {
        barsGroup
          .selectAll(".bar1")
          .transition()
          .duration(300)
          .attr("y", innerH1)
          .attr("height", 0)
          .remove();
        dotsGroup.selectAll(".dot-line").remove();
        linePath1.attr("d", "");
        xAxisGroup1.selectAll("*").remove();
        yAxisGroup1.selectAll("*").remove();
        yAxisGroup1Right.selectAll("*").remove();
        svg1
          .selectAll(".no-data")
          .data([1])
          .join("text")
          .attr("class", "no-data")
          .attr("x", innerW1 / 2)
          .attr("y", innerH1 / 2)
          .attr("text-anchor", "middle")
          .text("No data for this Jurisdiction")
          .style("fill", "var(--light-text)");
        return;
      }
      svg1.selectAll(".no-data").remove();

      const maxFines = d3.max(plotData, (d) => d.fines);
      const maxAvg = d3.max(plotData, (d) => d.avg);

      x1.domain(plotData.map((d) => d.year));
      y1.domain([0, maxFines * 1.02]).nice();
      y1Line.domain([0, maxAvg * 1.02]).nice();

      xAxisGroup1
        .transition()
        .duration(transitionTime)
        .call(d3.axisBottom(x1))
        .selectAll("text")
        .attr("transform", "rotate(-25)")
        .style("text-anchor", "end")
        .attr("dx", "-0.8em")
        .attr("dy", "0.15em");
      yAxisGroup1
        .transition()
        .duration(transitionTime)
        .call(d3.axisLeft(y1).tickFormat(d3.format("~s")));
      yAxisGroup1Right
        .transition()
        .duration(transitionTime)
        .call(d3.axisRight(y1Line).tickFormat((d) => `$${d3.format(",.0f")(d)}`))
        .selectAll("text")
        .style("fill", "#000000")
        .style("font-weight", "bold");

      const bars = barsGroup.selectAll(".bar1").data(plotData, (d) => d.year);
      bars.exit().transition().duration(300).attr("y", innerH1).attr("height", 0).remove();

      const barsEnter = bars
        .enter()
        .append("rect")
        .attr("class", "bar1")
        .attr("x", (d) => x1(d.year))
        .attr("y", innerH1)
        .attr("width", x1.bandwidth())
        .attr("height", 0)
        .attr("rx", 4)
        .on("mouseover", function onMouseOver(event, d) {
          d3.select(this).style("filter", "brightness(1.1)").style("opacity", 1);
          tooltip.style("visibility", "visible").style("opacity", 1).html(`
            <div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${d.year}</div>
            <div class="tooltip-body" style="color: white; font-weight: bold;">
              <span style="color: white">Total Fines: <span style="color: #f1c40f">$${app.formatNum(d.fines)}</span></span>
            </div>
          `);
        })
        .on("mousemove", function onMouseMove(event) {
          tooltip.style("left", `${event.pageX + 15}px`).style("top", `${event.pageY - 28}px`);
        })
        .on("mouseout", function onMouseOut(event, d) {
          d3.select(this).style("filter", "none").style("opacity", () => {
            if (app.globalFilter.year !== "All") return +app.globalFilter.year === d.year ? 1 : 0.4;
            return d.fines === maxFines ? 1 : 0.5;
          });
          tooltip.style("visibility", "hidden").style("opacity", 0);
        });

      bars
        .merge(barsEnter)
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .attr("x", (d) => x1(d.year))
        .attr("width", x1.bandwidth())
        .attr("y", (d) => y1(d.fines))
        .attr("height", (d) => innerH1 - y1(d.fines))
        .attr("fill", (d) => {
          if (app.globalFilter.year === "All") return "#8e7961";
          return +app.globalFilter.year === d.year ? "#8e7961" : "#d6c8b8";
        })
        .style("opacity", (d) => {
          if (app.globalFilter.year !== "All") return +app.globalFilter.year === d.year ? 1 : 0.4;
          return d.fines === maxFines ? 1 : 0.5;
        });

      const lineGen = d3
        .line()
        .x((d) => x1(d.year) + x1.bandwidth() / 2)
        .y((d) => y1Line(d.avg))
        .curve(d3.curveMonotoneX);

      linePath1.datum(plotData).transition().duration(transitionTime).ease(d3.easeCubicOut).attr("d", lineGen);

      const dots = dotsGroup.selectAll(".dot-line").data(plotData, (d) => d.year);
      dots.exit().transition().duration(300).style("opacity", 0).remove();

      const dotsEnter = dots
        .enter()
        .append("circle")
        .attr("class", "dot-line")
        .attr("r", 4)
        .attr("fill", "white")
        .attr("stroke", "#000000")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .on("mouseover", function onMouseOver(event, d) {
          d3.select(this).attr("r", 6).style("stroke-width", 3);
          tooltip.style("visibility", "visible").style("opacity", 1).html(`
            <div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${d.year}</div>
            <div class="tooltip-body" style="color: white; font-weight: bold;">
              <span style="color: white">Total Tickets: <span style="color: #f1c40f">${app.formatNum(d.count)}</span></span><br/>
              <span style="color: white">Total Fines: <span style="color: #f1c40f">$${app.formatNum(d.fines)}</span></span><br/>
              <span style="color: white">Average Fine: <span style="color: #f1c40f">$${app.formatNum(d.avg.toFixed(0))}</span></span><br/>
              ${d.yoyAvgText}
            </div>
          `);
        })
        .on("mousemove", function onMouseMove(event) {
          tooltip.style("left", `${event.pageX + 15}px`).style("top", `${event.pageY - 28}px`);
        })
        .on("mouseout", function onMouseOut() {
          d3.select(this).attr("r", 5).style("stroke-width", 2);
          tooltip.style("visibility", "hidden").style("opacity", 0);
        });

      dots
        .merge(dotsEnter)
        .transition()
        .duration(transitionTime)
        .ease(d3.easeCubicOut)
        .attr("cx", (d) => x1(d.year) + x1.bandwidth() / 2)
        .attr("cy", (d) => y1Line(d.avg));
    };
  };
})();
