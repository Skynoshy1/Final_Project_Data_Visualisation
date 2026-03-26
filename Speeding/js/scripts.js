const globalFilter = {
    jurisdiction: "All",
    year: "All",
    location: "All"
};

function matchJurisdiction(csvVal, filterVal) {
    if (filterVal === "All") return true;
    if (!csvVal) return false;
    
    const a = csvVal.trim().toLowerCase();
    const b = filterVal.trim().toLowerCase();
    
    const stateMap = {
        "new south wales": "nsw",
        "victoria": "vic",
        "queensland": "qld",
        "south australia": "sa",
        "western australia": "wa",
        "tasmania": "tas",
        "northern territory": "nt",
        "australian capital territory": "act"
    };
    return a === b || a === stateMap[b] || stateMap[a] === b;
}

function triggerGlobalUpdate() {
    if (typeof window.updateChart3 === "function") {
        const currentToggle = d3.select(".toggle-btn.active").attr("data-view") || "All";
        window.updateChart3(currentToggle);
    }
    if (typeof window.updateChart1 === "function") window.updateChart1();
    if (typeof window.updateChart2 === "function") window.updateChart2();
}

const mapContainer = document.getElementById('map');
const mapWidth = mapContainer.clientWidth;
const mapHeight = 300; 

const svgMap = d3.select("#map").append("svg").attr("width", mapWidth).attr("height", mapHeight);
const mapTooltip = d3.select("#tooltip");

d3.json("data/au-states.geojson").then(function(geoData) {
    const projection = d3.geoMercator().fitSize([mapWidth, mapHeight], geoData);
    const pathGenerator = d3.geoPath().projection(projection);

    svgMap.selectAll(".state").data(geoData.features).enter().append("path")
        .attr("class", "state").attr("d", pathGenerator)
        .on("mouseover", function(event, d) {
            const stateName = d.properties.STATE_NAME || d.properties.ste_name || d.properties.name || d.properties.STATE || "Unknown State";
            mapTooltip.style("visibility", "visible").style("opacity", 1).html(`
                <div class="tooltip-header" style="color: var(--primary-color)"> Jurisdiction</div>
                <div class="tooltip-body"><strong>${stateName}</strong></div>
            `);
        })
        .on("mousemove", function(event) { mapTooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); })
        .on("mouseout", function() { mapTooltip.style("visibility", "hidden").style("opacity", 0); });

    svgMap.selectAll(".state").on("click", function(event, d) {
        const stateName = d.properties.STATE_NAME || d.properties.ste_name || d.properties.name || d.properties.STATE || "Unknown State";
        if (d3.select(this).classed("active")) {
            d3.select(this).classed("active", false); globalFilter.jurisdiction = "All";
        } else {
            svgMap.selectAll(".state").classed("active", false); d3.select(this).classed("active", true); globalFilter.jurisdiction = stateName;
        }
        triggerGlobalUpdate();
    });
}).catch(error => console.error("Map Loading Error:", error));

d3.csv("data/Speeding.csv").then(function(data) {
    
    data.forEach(d => {
        d.YEAR = +d.YEAR; 
        d.FINES = +d["Sum(FINES)"]; 
        
        let loc = d.LOCATION;
        if (!loc || loc.trim() === "" || loc === "Unknown") {
            d.LOCATION = "Not Specified"; 
        } else {
            d.LOCATION = loc.replace(/\b(of |in )?Australia\b/gi, "").trim();
        }
    });

    const formatNum = d3.format(",");
    const tooltip = d3.select("#tooltip");

    const uniqueYears = [...new Set(data.map(d => d.YEAR))].filter(Boolean).sort();
    const yearSelect = d3.select("#yearSelect");
    uniqueYears.forEach(y => { yearSelect.append("option").text(y).attr("value", y); });

    const uniqueLocations = [...new Set(data.map(d => d.LOCATION))].filter(Boolean).sort();
    const locSelect = d3.select("#locationSelect");
    uniqueLocations.forEach(l => { locSelect.append("option").text(l).attr("value", l); });

    yearSelect.on("change", function() { globalFilter.year = this.value; triggerGlobalUpdate(); });
    locSelect.on("change", function() { globalFilter.location = this.value; triggerGlobalUpdate(); });

    const chart3Container = document.getElementById('chart3');
    const width3 = chart3Container.clientWidth; const height3 = 320; 
    const margin3 = {top: 20, right: 120, bottom: 40, left: 80};
    const innerW3 = width3 - margin3.left - margin3.right; const innerH3 = height3 - margin3.top - margin3.bottom;

    const svg3 = d3.select("#chart3").append("svg").attr("width", width3).attr("height", height3).append("g").attr("transform", `translate(${margin3.left},${margin3.top})`);
    const x3 = d3.scaleLinear().range([0, innerW3]); const y3 = d3.scaleLinear().range([innerH3, 0]);
    const xAxisGroup3 = svg3.append("g").attr("transform", `translate(0,${innerH3})`); const yAxisGroup3 = svg3.append("g"); 

    window.updateChart3 = function(viewMode) {
        const transitionTime = 600; 
        let currentData = data.filter(d => d.DETECTION_TYPE === "Camera Issued" || d.DETECTION_TYPE === "Police Issued");
        if (globalFilter.jurisdiction !== "All") currentData = currentData.filter(d => matchJurisdiction(d.JURISDICTION, globalFilter.jurisdiction));
        if (globalFilter.location !== "All") currentData = currentData.filter(d => d.LOCATION === globalFilter.location);
        
        const groupedData = d3.rollup(currentData, v => d3.sum(v, d => d.FINES), d => d.DETECTION_TYPE, d => d.YEAR);
        const chartData = Array.from(groupedData, ([type, yearMap]) => ({
            id: type, values: Array.from(yearMap, ([year, fines]) => ({year, fines})).sort((a, b) => a.year - b.year)
        }));

        if (chartData.length === 0 || currentData.length === 0) {
            svg3.selectAll(".line-path").remove(); svg3.selectAll(".dot").remove(); svg3.selectAll(".line-label").remove(); svg3.selectAll(".max-label").remove();
            svg3.selectAll(".no-data").data([1]).join("text").attr("class", "no-data").attr("x", innerW3/2).attr("y", innerH3/2).attr("text-anchor", "middle").text("No data available").style("fill", "var(--light-text)");
            return;
        } else { svg3.selectAll(".no-data").remove(); }

        const activeData = viewMode === "All" ? chartData : chartData.filter(d => d.id === viewMode);
        if (activeData.length === 0) return; 

        const minYear = d3.min(activeData, c => d3.min(c.values, d => d.year)); const maxYear = d3.max(activeData, c => d3.max(c.values, d => d.year)); const maxFines = d3.max(activeData, c => d3.max(c.values, d => d.fines));
        const sequentialDelayScale = d3.scaleLinear().domain([minYear, maxYear]).range([0, transitionTime]); 

        x3.domain([minYear - 1.5, maxYear]); xAxisGroup3.transition().duration(600).call(d3.axisBottom(x3).tickFormat(d3.format("d"))).selectAll("text").attr("transform", "rotate(-25)").style("text-anchor", "end").attr("dx", "-0.8em").attr("dy", "0.15em");
        y3.domain([0, maxFines * 1.1]); yAxisGroup3.transition().duration(600).call(d3.axisLeft(y3).tickFormat(d3.format("~s")));

        const lineGenerator = d3.line().x(d => x3(d.year)).y(d => y3(d.fines)).curve(d3.curveMonotoneX); 

        svg3.selectAll(".line-path").data(chartData, d => d.id).join("path")
            .attr("class", d => d.id === "Camera Issued" ? "line-camera line-path" : "line-police line-path")
            .style("opacity", d => (viewMode === "All" || d.id === viewMode) ? 1 : 0).attr("d", d => lineGenerator(d.values))
            .each(function(d) {
                if (viewMode === "All" || d.id === viewMode) {
                    const totalLength = this.getTotalLength() || 2000; 
                    d3.select(this).attr("stroke-dasharray", totalLength + " " + totalLength).attr("stroke-dashoffset", totalLength).transition().duration(transitionTime).ease(d3.easeLinear).attr("stroke-dashoffset", 0); 
                }
            });

        const dotData = []; chartData.forEach(tg => { tg.values.forEach(v => { dotData.push({ id: tg.id, year: v.year, fines: v.fines }); }); });
        const dots = svg3.selectAll(".dot").data(dotData, d => d.id + d.year); dots.exit().transition().duration(300).style("opacity", 0).remove();
        
        dots.enter().append("circle").attr("class", d => d.id === "Camera Issued" ? "dot-camera dot" : "dot-police dot").attr("r", 4)
            .on("mouseover", function(event, d) {
                const headerColor = d.id === "Camera Issued" ? "var(--primary-color)" : "var(--primary-color)";
                tooltip.style("visibility", "visible").style("opacity", 1).html(`
                    <div class="tooltip-header" style="color: ${headerColor}">${d.id}</div>
                    <div class="tooltip-body">Year: <strong>${d.year}</strong><br/>Total Fines: <strong>${formatNum(d.fines)}</strong></div>
                `);
            }).on("mousemove", function(event) { tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); })
            .on("mouseout", function() { tooltip.style("visibility", "hidden").style("opacity", 0); })
            .merge(dots).attr("cx", d => x3(d.year)).attr("cy", d => y3(d.fines)).style("pointer-events", d => (viewMode === "All" || d.id === viewMode) ? "auto" : "none")
            .style("opacity", 0).transition().delay(d => (viewMode === "All" || d.id === viewMode) ? sequentialDelayScale(d.year) : 0).duration(300) 
            .style("opacity", d => (viewMode === "All" || d.id === viewMode) ? 1 : 0)
            .attr("fill", d => (globalFilter.year === "All" || +globalFilter.year === d.year) ? "white" : "#e0e0e0")
            .attr("r", d => (globalFilter.year !== "All" && +globalFilter.year === d.year) ? 8 : 4);

        svg3.selectAll(".line-label").data(chartData, d => d.id).join("text").attr("class", "line-label") 
            .datum(d => { return {id: d.id, value: d.values[d.values.length - 1]}; }).attr("x", 10).attr("dy", ".35em").style("font-weight", "bold")
            .style("fill", d => d.id === "Camera Issued" ? "var(--primary-color)" : "var(--secondary-color)")
            .text(d => d.id).attr("transform", d => `translate(${x3(d.value.year)},${y3(d.value.fines)})`)
            .style("opacity", 0).transition().delay(d => (viewMode === "All" || d.id === viewMode) ? sequentialDelayScale(d.value.year) : 0).duration(300).style("opacity", d => (viewMode === "All" || d.id === viewMode) ? 1 : 0);
            
        const maxPoints = []; chartData.forEach(group => { let maxObj = group.values[0]; group.values.forEach(v => { if (v.fines > maxObj.fines) { maxObj = v; } }); maxPoints.push({ id: group.id, year: maxObj.year, fines: maxObj.fines }); });
        svg3.selectAll(".max-label").data(maxPoints, d => d.id).join("text").attr("class", "max-label") 
            .attr("text-anchor", "middle").attr("dy", "-10px").style("font-size", "12px").style("font-weight", "bold")
            .style("fill", d => d.id === "Camera Issued" ? "var(--primary-color)" : "var(--primary-color)")
            .text(d => formatNum(d.fines)).attr("x", d => x3(d.year)).attr("y", d => y3(d.fines))
            .style("opacity", 0).transition().delay(d => (viewMode === "All" || d.id === viewMode) ? sequentialDelayScale(d.year) : 0).duration(300).style("opacity", d => (viewMode === "All" || d.id === viewMode) ? 1 : 0);
    }
    d3.selectAll(".toggle-btn").on("click", function() { d3.selectAll(".toggle-btn").classed("active", false); d3.select(this).classed("active", true); triggerGlobalUpdate(); });

    const chart1Container = document.getElementById('chart1');
    const width1 = chart1Container.clientWidth; const height1 = 300; 
    const margin1 = {top: 30, right: 60, bottom: 40, left: 60};
    const innerW1 = width1 - margin1.left - margin1.right; const innerH1 = height1 - margin1.top - margin1.bottom;

    const svg1 = d3.select("#chart1").append("svg").attr("width", width1).attr("height", height1).append("g").attr("transform", `translate(${margin1.left},${margin1.top})`);
    
    const x1 = d3.scaleBand().range([0, innerW1]).padding(0.3); 
    const y1 = d3.scaleLinear().range([innerH1, 0]); 
    const y1_line = d3.scaleLinear().range([innerH1, 0]); 

    const xAxisGroup1 = svg1.append("g").attr("transform", `translate(0,${innerH1})`); 
    const yAxisGroup1 = svg1.append("g");
    const yAxisGroup1Right = svg1.append("g").attr("transform", `translate(${innerW1},0)`); 

    const barsGroup = svg1.append("g").attr("class", "bars-layer");
    const lineGroup = svg1.append("g").attr("class", "line-layer");
    const dotsGroup = svg1.append("g").attr("class", "dots-layer");

    const linePath1 = lineGroup.append("path").attr("fill", "none").attr("stroke", "#f39c12").attr("stroke-width", 3);

    window.updateChart1 = function() {
        const transitionTime = 800; 
        let filteredData = data;
        if (globalFilter.jurisdiction !== "All") filteredData = filteredData.filter(d => matchJurisdiction(d.JURISDICTION, globalFilter.jurisdiction));
        if (globalFilter.location !== "All") filteredData = filteredData.filter(d => d.LOCATION === globalFilter.location);

        const grouped = d3.rollup(filteredData, 
            v => ({
                fines: d3.sum(v, d => d.FINES),
                count: v.length, 
                avg: v.length > 0 ? d3.sum(v, d => d.FINES) / v.length : 0 
            }), 
            d => d.YEAR
        );
        const plotData = Array.from(grouped, ([year, vals]) => ({year, fines: vals.fines, count: vals.count, avg: vals.avg})).sort((a, b) => a.year - b.year);

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
                        d.yoyAvgText = `<span style="color: var(--success); font-size: 0.9em;"> Increased <strong>${yoy.toFixed(1)}%</strong> vs ${prevYear}</span>`;
                    } else if (yoy < 0) {
                        d.yoyAvgText = `<span style="color: var(--danger); font-size: 0.9em;"> Decreased <strong>${yoy.toFixed(1)}%</strong> vs ${prevYear}</span>`;
                    } else {
                        d.yoyAvgText = `<span style="color: var(--light-text); font-size: 0.9em;"> No change vs ${prevYear}</span>`;
                    }
                }
            }
        });

        if(plotData.length === 0) {
            barsGroup.selectAll(".bar1").transition().duration(300).attr("y", innerH1).attr("height", 0).remove(); 
            dotsGroup.selectAll(".dot-line").remove(); linePath1.attr("d", "");
            xAxisGroup1.selectAll("*").remove(); yAxisGroup1.selectAll("*").remove(); yAxisGroup1Right.selectAll("*").remove();
            svg1.selectAll(".no-data").data([1]).join("text").attr("class", "no-data").attr("x", innerW1/2).attr("y", innerH1/2).attr("text-anchor", "middle").text("No data for this Jurisdiction").style("fill", "var(--light-text)");
            return;
        } else { svg1.selectAll(".no-data").remove(); }

        const maxFines = d3.max(plotData, d => d.fines);
        const maxAvg = d3.max(plotData, d => d.avg);
        
        x1.domain(plotData.map(d => d.year)); 
        y1.domain([0, maxFines * 1.02]).nice(); 
        y1_line.domain([0, maxAvg * 1.02]).nice(); 

        xAxisGroup1.transition().duration(transitionTime).call(d3.axisBottom(x1)).selectAll("text").attr("transform", "rotate(-25)").style("text-anchor", "end").attr("dx", "-0.8em").attr("dy", "0.15em");
        yAxisGroup1.transition().duration(transitionTime).call(d3.axisLeft(y1).tickFormat(d3.format("~s")));
        yAxisGroup1Right.transition().duration(transitionTime).call(d3.axisRight(y1_line).tickFormat(d => "$" + d3.format(",.0f")(d))).selectAll("text").style("fill", "#000000").style("font-weight", "bold");

        const bars = barsGroup.selectAll(".bar1").data(plotData, d => d.year);
        bars.exit().transition().duration(300).attr("y", innerH1).attr("height", 0).remove();

        const barsEnter = bars.enter().append("rect").attr("class", "bar1")
            .attr("x", d => x1(d.year)).attr("y", innerH1).attr("width", x1.bandwidth()).attr("height", 0).attr("rx", 4) 
            .on("mouseover", function(event, d) {
                d3.select(this).style("filter", "brightness(1.1)").style("opacity", 1);
                tooltip.style("visibility", "visible").style("opacity", 1).html(`
                    <div class="tooltip-header" style="color: var(--primary-color)"> Year: ${d.year}</div>
                    <div class="tooltip-body">
                        Total Fines: <strong>${formatNum(d.fines)}</strong>
                    </div>
                `); 
            })
            .on("mousemove", function(event) { tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); })
            .on("mouseout", function(event, d) {
                d3.select(this).style("filter", "none").style("opacity", () => {
                    if (globalFilter.year !== "All") return +globalFilter.year === d.year ? 1 : 0.4;
                    return d.fines === maxFines ? 1 : 0.5;
                });
                tooltip.style("visibility", "hidden").style("opacity", 0);
            });
            
        bars.merge(barsEnter).transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("x", d => x1(d.year)).attr("width", x1.bandwidth()).attr("y", d => y1(d.fines)).attr("height", d => innerH1 - y1(d.fines))
            .attr("fill", d => { if (globalFilter.year === "All") return "var(--primary-color)"; return +globalFilter.year === d.year ? "var(--primary-color)" : "#e0d8d0"; })
            .style("opacity", d => { if (globalFilter.year !== "All") { return +globalFilter.year === d.year ? 1 : 0.4; } return d.fines === maxFines ? 1 : 0.5; });

        const lineGen = d3.line()
            .x(d => x1(d.year) + x1.bandwidth() / 2) 
            .y(d => y1_line(d.avg))
            .curve(d3.curveMonotoneX);

        linePath1.datum(plotData)
            .transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("d", lineGen);

        const dots = dotsGroup.selectAll(".dot-line").data(plotData, d => d.year);
        dots.exit().transition().duration(300).style("opacity", 0).remove();

        const dotsEnter = dots.enter().append("circle").attr("class", "dot-line")
            .attr("r", 4).attr("fill", "white").attr("stroke", "#000000").attr("stroke-width", 2)
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                d3.select(this).attr("r", 6).style("stroke-width", 3);
                tooltip.style("visibility", "visible").style("opacity", 1).html(`
                    <div class="tooltip-header" style="color: #f39c12"> Year: ${d.year}</div>
                    <div class="tooltip-body">
                         Total Tickets: <strong>${formatNum(d.count)}</strong><br/>
                         Total Fines: <strong>${formatNum(d.fines)}</strong><br/>
                         Average Fine: <strong style="color: #f39c12">$${formatNum(d.avg.toFixed(0))}</strong><br/>
                        ${d.yoyAvgText} 
                    </div>
                `); 
            })
            .on("mousemove", function(event) { tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); })
            .on("mouseout", function(event, d) {
                d3.select(this).attr("r", 5).style("stroke-width", 2);
                tooltip.style("visibility", "hidden").style("opacity", 0);
            });

        dots.merge(dotsEnter)
            .transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("cx", d => x1(d.year) + x1.bandwidth() / 2)
            .attr("cy", d => y1_line(d.avg));
    };

    const chart2Container = document.getElementById('chart2');
    const width2 = chart2Container.clientWidth; const height2 = 300; 
    const margin2 = {top: 30, right: 60, bottom: 40, left: 160}; 
    const innerW2 = width2 - margin2.left - margin2.right; const innerH2 = height2 - margin2.top - margin2.bottom;

    const svg2 = d3.select("#chart2").append("svg").attr("width", width2).attr("height", height2).append("g").attr("transform", `translate(${margin2.left},${margin2.top})`);
    const x2 = d3.scaleLinear().range([0, innerW2]); const y2 = d3.scaleBand().range([0, innerH2]).padding(0.3);
    const xAxisGroup2 = svg2.append("g").attr("transform", `translate(0,${innerH2})`); const yAxisGroup2 = svg2.append("g");

    window.updateChart2 = function() {
        const transitionTime = 800; 
        let filteredData = data;
        if (globalFilter.jurisdiction !== "All") filteredData = filteredData.filter(d => matchJurisdiction(d.JURISDICTION, globalFilter.jurisdiction));
        if (globalFilter.year !== "All") filteredData = filteredData.filter(d => d.YEAR === +globalFilter.year);

        const grouped = d3.rollup(filteredData, 
            v => ({
                fines: d3.sum(v, d => d.FINES),
                count: v.length
            }), 
            d => d.LOCATION
        );
        const plotData = Array.from(grouped, ([location, vals]) => ({location, fines: vals.fines, count: vals.count})).sort((a, b) => b.fines - a.fines);

        const totalAllLocations = d3.sum(plotData, d => d.fines);

        if(plotData.length === 0) {
            svg2.selectAll(".bar2").transition().duration(300).attr("width", 0).remove(); svg2.selectAll(".bar-label").transition().duration(300).style("opacity", 0).remove(); 
            xAxisGroup2.selectAll("*").remove(); yAxisGroup2.selectAll("*").remove();
            svg2.selectAll(".no-data").data([1]).join("text").attr("class", "no-data").attr("x", innerW2/2).attr("y", innerH2/2).attr("text-anchor", "middle").text("No data for this filter").style("fill", "var(--light-text)");
            return;
        } else { svg2.selectAll(".no-data").remove(); }

        const maxFines = d3.max(plotData, d => d.fines);
        x2.domain([0, maxFines * 1.15]); y2.domain(plotData.map(d => d.location));

        xAxisGroup2.transition().duration(transitionTime).call(d3.axisBottom(x2).tickFormat(d3.format("~s")).ticks(5));
        yAxisGroup2.transition().duration(transitionTime).call(d3.axisLeft(y2)).selectAll("text").style("font-weight", "bold").style("fill", "var(--text-color)").style("font-size", "11px");

        const bars = svg2.selectAll(".bar2").data(plotData, d => d.location);
        bars.exit().transition().duration(300).attr("width", 0).remove();

        const barsEnter = bars.enter().append("rect").attr("class", "bar2")
            .attr("y", d => y2(d.location)).attr("x", 0).attr("height", y2.bandwidth()).attr("width", 0).attr("rx", 4).style("cursor", "pointer") 
            .on("mouseover", function(event, d) {
                d3.select(this).style("filter", "brightness(1.15)").style("opacity", 1);
                
                const percent = totalAllLocations > 0 ? ((d.fines / totalAllLocations) * 100).toFixed(1) : 0;
                
                tooltip.style("visibility", "visible").style("opacity", 1).html(`
                    <div class="tooltip-header" style="color: var(--primary-color)"> ${d.location}</div>
                    <div class="tooltip-body">
                        ${globalFilter.jurisdiction === "All" ? "All Australia" : globalFilter.jurisdiction}<br/>
                        ${globalFilter.year === "All" ? "All Years" : "Year: " + globalFilter.year}<br/>
                         Total Tickets: <strong>${formatNum(d.count)}</strong><br/>
                         Total Fines: <strong>${formatNum(d.fines)}</strong><br/>
                        <span style="color: var(--primary-color); font-size: 1; font-weight: bold;">(${percent}% of total fines)</span>
                    </div>
                `);
            })
            .on("mousemove", function(event) { tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); })
            .on("mouseout", function(event, d) {
                d3.select(this).style("filter", "none").style("opacity", () => {
                    if (globalFilter.location !== "All") return globalFilter.location === d.location ? 1 : 0.3;
                    return d.fines === maxFines ? 1 : 0.6; 
                });
                tooltip.style("visibility", "hidden").style("opacity", 0);
            })
            .on("click", function(event, d) {
                if (globalFilter.location === d.location) {
                    globalFilter.location = "All"; d3.select("#locationSelect").property("value", "All"); 
                } else {
                    globalFilter.location = d.location; d3.select("#locationSelect").property("value", d.location);
                }
                triggerGlobalUpdate();
            });
            
        bars.merge(barsEnter).transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("y", d => y2(d.location)).attr("height", y2.bandwidth()).attr("x", 0)
            .attr("width", d => d.fines > 0 ? Math.max(3, x2(d.fines)) : 0) 
            .attr("fill", d => { if (globalFilter.location === "All") return "var(--primary-color)"; return globalFilter.location === d.location ? "var(--primary-color)" : "#e0d8d0"; })
            .style("opacity", d => { if (globalFilter.location !== "All") return globalFilter.location === d.location ? 1 : 0.3; return d.fines === maxFines ? 1 : 0.6; });
            
        const labels = svg2.selectAll(".bar-label").data(plotData, d => d.location);
        labels.exit().transition().duration(300).style("opacity", 0).remove();
        
        labels.enter().append("text").attr("class", "bar-label")
            .attr("y", d => y2(d.location) + y2.bandwidth() / 2).attr("x", 0).attr("dy", "0.35em").attr("dx", "5px")
            .style("font-size", "11px").style("font-weight", "bold").style("fill", "var(--text-color)").style("opacity", 0)
            .merge(labels).text(d => formatNum(d.fines)).transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("y", d => y2(d.location) + y2.bandwidth() / 2)
            .attr("x", d => d.fines > 0 ? Math.max(3, x2(d.fines)) : 0) 
            .style("opacity", d => { if (globalFilter.location !== "All" && globalFilter.location !== d.location) return 0.2; return 1; });
    };

    setTimeout(() => {
        triggerGlobalUpdate();
    }, 50);
});