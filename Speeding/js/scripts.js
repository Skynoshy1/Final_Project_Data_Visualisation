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

function matchLocation(d_loc, filter_loc) {
    if (filter_loc === "All") return true;
    if (Array.isArray(filter_loc)) return filter_loc.includes(d_loc);
    
    // Handle grouped locations
    if (filter_loc === "Regional") {
        return d_loc === "Inner Regional" || d_loc === "Outer Regional";
    }
    if (filter_loc === "Remote") {
        return d_loc === "Remote" || d_loc === "Very Remote";
    }
    
    return d_loc === filter_loc;
}

function triggerGlobalUpdate() {
    if (typeof window.updateChart3 === "function") {
        const currentToggle = d3.select(".toggle-btn.active").attr("data-view") || "All";
        window.updateChart3(currentToggle);
    }
    if (typeof window.updateChart1 === "function") window.updateChart1();
    if (typeof window.updateChart2 === "function") window.updateChart2();
    if (typeof window.updateStats === "function") window.updateStats();
    if (typeof window.updateMap === "function") window.updateMap();
}

const mapContainer = document.getElementById('map');
const mapWidth = mapContainer.clientWidth;
const mapHeight = 550; 

const svgMap = d3.select("#map").append("svg").attr("width", mapWidth).attr("height", mapHeight);
const mapTooltip = d3.select("#tooltip");
const mapZoomPadding = 24;
let speedingGeoData = null;
let speedingPathGenerator = null;

const reverseStateNameMap = {
    "New South Wales": "NSW",
    "Queensland": "QLD",
    "South Australia": "SA",
    "Tasmania": "TAS",
    "Victoria": "VIC",
    "Western Australia": "WA",
    "Australian Capital Territory": "ACT",
    "Northern Territory": "NT"
};

function getFeatureStateName(feature) {
    return feature.properties.STATE_NAME || feature.properties.ste_name || feature.properties.name || feature.properties.STATE || "Unknown State";
}

function buildSpeedingPathGenerator() {
    if (!speedingGeoData) return null;

    const projection = d3.geoMercator();
    const selectedFeature = globalFilter.jurisdiction === "All"
        ? null
        : speedingGeoData.features.find(feature => matchJurisdiction(getFeatureStateName(feature), globalFilter.jurisdiction));

    if (selectedFeature) {
        projection.fitExtent(
            [[mapZoomPadding, mapZoomPadding], [mapWidth - mapZoomPadding, mapHeight - mapZoomPadding]],
            selectedFeature
        );
    } else {
        projection.fitExtent(
            [[mapZoomPadding, mapZoomPadding], [mapWidth - mapZoomPadding, mapHeight - mapZoomPadding]],
            speedingGeoData
        );
    }

    return d3.geoPath().projection(projection);
}

d3.json("data/au-states.geojson").then(function(geoData) {
    speedingGeoData = geoData;
    speedingPathGenerator = buildSpeedingPathGenerator();

    svgMap.selectAll(".state").data(geoData.features).enter().append("path")
        .attr("class", "state").attr("d", d => speedingPathGenerator(d))
        .attr("fill", "#e0d8d0")
        .on("mouseover", function(event, d) {
            const stateName = getFeatureStateName(d);
            mapTooltip.style("visibility", "visible").style("opacity", 1).html(`
                <div class="tooltip-header" style="color: var(--primary-color)"> Jurisdiction</div>
                <div class="tooltip-body"><strong>${stateName}</strong></div>
            `);
        })
        .on("mousemove", function(event) { mapTooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); })
        .on("mouseout", function() { mapTooltip.style("visibility", "hidden").style("opacity", 0); });

    svgMap.selectAll(".state").on("click", function(event, d) {
        const stateName = getFeatureStateName(d);
        if (d3.select(this).classed("active")) {
            d3.select(this).classed("active", false); globalFilter.jurisdiction = "All";
        } else {
            svgMap.selectAll(".state").classed("active", false); d3.select(this).classed("active", true); globalFilter.jurisdiction = stateName;
        }
        triggerGlobalUpdate();
    });

    svgMap.selectAll(".map-label").data(geoData.features).enter().append("text")
        .attr("class", "map-label")
        .attr("transform", function(feature) {
            const [x, y] = speedingPathGenerator.centroid(feature);
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                return d3.select(this).attr("transform") || "translate(-999,-999)";
            }
            return `translate(${x}, ${y})`;
        })
        .text(feature => {
            const stateName = getFeatureStateName(feature);
            return reverseStateNameMap[stateName] ? reverseStateNameMap[stateName].toUpperCase() : "";
        })
        .style("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#4A4A4A")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .transition().delay(180).duration(400)
        .style("opacity", 1);
        
    window.speedingGeoJsonFeatures = geoData.features;
    if (typeof window.updateMap === "function") window.updateMap();

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

    // Group locations to match other dashboards: Major Cities, Regional, Remote
    const locationGroups = new Map();
    data.forEach(d => {
        let group = d.LOCATION;
        if (group === "Major Cities") {
            group = "Major Cities";
        } else if (group === "Inner Regional" || group === "Outer Regional") {
            group = "Regional";
        } else if (group === "Remote" || group === "Very Remote") {
            group = "Remote";
        }
        locationGroups.set(group, true);
    });
    const uniqueLocations = Array.from(locationGroups.keys()).filter(l => l && l !== "Not Specified").sort();
    const locSelect = d3.select("#locationSelect");
    uniqueLocations.forEach(l => { locSelect.append("option").text(l).attr("value", l); });

    yearSelect.on("change", function() { globalFilter.year = this.value; triggerGlobalUpdate(); });
    locSelect.on("change", function() { globalFilter.location = this.value; triggerGlobalUpdate(); });

    // Reset button functionality
    const resetButton = document.getElementById("reset-button");
    if (resetButton) {
        resetButton.addEventListener("click", function() {
            yearSelect.property("value", "All");
            locSelect.property("value", "All");
            globalFilter.year = "All";
            globalFilter.location = "All";
            globalFilter.jurisdiction = "All";
            
            // Clear active state from map
            svgMap.selectAll(".state").classed("active", false);
            
            triggerGlobalUpdate();
        });
    }

    window.updateMap = function() {
        if (!window.speedingGeoJsonFeatures) return;

        const nextPathGenerator = buildSpeedingPathGenerator();
        if (nextPathGenerator) speedingPathGenerator = nextPathGenerator;

        let filteredData = data;
        if (globalFilter.year !== "All") {
            filteredData = filteredData.filter(d => d.YEAR === +globalFilter.year);
        }
        if (globalFilter.location !== "All") {
            filteredData = filteredData.filter(d => matchLocation(d.LOCATION, globalFilter.location));
        }

        const shortToFullNameMap = Object.entries(reverseStateNameMap).reduce((acc, [full, short]) => {
            acc[short] = full;
            return acc;
        }, {});

        const grouped = d3.rollup(filteredData, 
            v => {
                const totalFines = d3.sum(v, d => d.FINES);
                const count = v.length;
                return { fines: totalFines, count: count, avg: count > 0 ? totalFines / count : 0 };
            }, 
            d => shortToFullNameMap[d.JURISDICTION] || d.JURISDICTION
        );

        const allAvgs = Array.from(grouped.values()).map(d => d.avg);
        const maxAvg = allAvgs.length > 0 ? d3.max(allAvgs) || 1 : 1;
        const riskScaleColors = ["#F6C36B", "#E89A2E", "#C96A12", "#8A3F00"];

        const getRiskColor = (percent) => {
            if (percent < 25) return riskScaleColors[0];
            if (percent < 50) return riskScaleColors[1];
            if (percent < 75) return riskScaleColors[2];
            return riskScaleColors[3];
        };

        mapTooltip.style("visibility", "hidden").style("opacity", 0);
        svgMap.selectAll("path.state, text.map-label").remove();
        const mapSceneTransition = d3.transition().duration(220).ease(d3.easeCubicOut);

        svgMap.selectAll("path.state")
            .data(window.speedingGeoJsonFeatures)
            .enter()
            .append("path")
            .attr("class", "state")
            .attr("d", d => speedingPathGenerator(d))
            .attr("fill", d => {
                const stateName = getFeatureStateName(d);
                if (!grouped.has(stateName)) return "#D1D5DB";
                const percent = (grouped.get(stateName).avg / maxAvg) * 100;
                return getRiskColor(percent);
            })
            .style("opacity", 0)
            .transition(mapSceneTransition)
            .style("opacity", 1)
            .selection()
            .classed("active", d => globalFilter.jurisdiction !== "All" && matchJurisdiction(getFeatureStateName(d), globalFilter.jurisdiction))
            .on("mouseover", function(event, d) {
                const stateName = getFeatureStateName(d);
                if (!grouped.has(stateName)) {
                    mapTooltip.style("visibility", "visible").style("opacity", 1).html(`
                        <div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${stateName}</div>
                        <div class="tooltip-body" style="color: white; font-weight: bold;">No data available</div>
                    `);
                    return;
                }
                const stateData = grouped.get(stateName);
                const percent = (stateData.avg / maxAvg) * 100;
                
                mapTooltip.style("visibility", "visible").style("opacity", 1).html(`
                    <div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${stateName}</div>
                    <div class="tooltip-body" style="color: white; font-weight: bold;">
                        <span style="color: white">Total Tickets: <span style="color: #f1c40f">${formatNum(stateData.count)}</span></span><br/>
                        <span style="color: white">Total Fines: <span style="color: #f1c40f">${formatNum(stateData.fines)}</span></span><br/>
                        <span style="color: white">Severity Index: <span style="color: ${percent > 75 ? '#ff4d4d' : '#f1c40f'}">${percent.toFixed(1)}%</span></span>
                    </div>
                `);
            })
            .on("mousemove", function(event) {
                mapTooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                mapTooltip.style("visibility", "hidden").style("opacity", 0);
            })
            .on("click", function(event, d) {
                const stateName = getFeatureStateName(d);
                if (globalFilter.jurisdiction !== "All" && matchJurisdiction(stateName, globalFilter.jurisdiction)) {
                    globalFilter.jurisdiction = "All";
                } else {
                    globalFilter.jurisdiction = stateName;
                }
                triggerGlobalUpdate();
            });

        svgMap.selectAll("text.map-label")
            .data(window.speedingGeoJsonFeatures)
            .enter()
            .append("text")
            .attr("class", "map-label")
            .attr("transform", function(feature) {
                const [x, y] = speedingPathGenerator.centroid(feature);
                if (!Number.isFinite(x) || !Number.isFinite(y)) {
                    return d3.select(this).attr("transform") || "translate(-999,-999)";
                }
                return `translate(${x}, ${y})`;
            })
            .text(feature => {
                const stateName = getFeatureStateName(feature);
                return reverseStateNameMap[stateName] ? reverseStateNameMap[stateName].toUpperCase() : "";
            })
            .style("text-anchor", "middle")
            .style("dominant-baseline", "middle")
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .style("fill", "#4A4A4A")
            .style("pointer-events", "none")
            .style("opacity", 0)
            .transition(mapSceneTransition)
            .style("opacity", 1)
            .selection()
            .raise();

        if (svgMap.select(".map-legend").empty()) {
            const legendGroup = svgMap.append("g").attr("class", "map-legend")
                .attr("transform", `translate(18, ${mapHeight - 100})`);
            
            legendGroup.append("text").attr("x", 0).attr("y", -10).attr("fill", "#5C4D3C")
                .attr("font-size", "12px").attr("font-weight", "bold").text("Severity Index");
            
            const legendData = [
                { label: "Low (< 25%)", color: riskScaleColors[0] },
                { label: "Moderate (25-50%)", color: riskScaleColors[1] },
                { label: "High (50-75%)", color: riskScaleColors[2] },
                { label: "Severe (> 75%)", color: riskScaleColors[3] }
            ];
            
            legendGroup.selectAll("rect.legend-swatch").data(legendData).enter().append("rect")
                .attr("class", "legend-swatch").attr("x", 0).attr("y", (d, i) => i * 20)
                .attr("width", 12).attr("height", 12).attr("rx", 2).attr("fill", d => d.color);
                
            legendGroup.selectAll("text.legend-label").data(legendData).enter().append("text")
                .attr("class", "legend-label").attr("x", 18).attr("y", (d, i) => i * 20 + 10)
                .attr("fill", "#5C4D3C").attr("font-size", "12px").attr("font-weight", "bold").text(d => d.label);
        }
        svgMap.select(".map-legend").raise();
    };

    const chart3Container = document.getElementById('chart3');
    const width3 = chart3Container.clientWidth; const height3 = 400; 
    const margin3 = {top: 20, right: 120, bottom: 50, left: 80};
    const innerW3 = width3 - margin3.left - margin3.right; const innerH3 = height3 - margin3.top - margin3.bottom;

    const svg3 = d3.select("#chart3").append("svg").attr("width", width3).attr("height", height3).append("g").attr("transform", `translate(${margin3.left},${margin3.top})`);
    const x3 = d3.scaleLinear().range([0, innerW3]); 
    const y3_left = d3.scaleLinear().range([innerH3, 0]);
    const y3_right = d3.scaleLinear().range([innerH3, 0]);
    
    const xAxisGroup3 = svg3.append("g").attr("transform", `translate(0,${innerH3})`); 
    const yAxisGroup3Left = svg3.append("g"); 
    const yAxisGroup3Right = svg3.append("g").attr("transform", `translate(${innerW3},0)`);
    
    const areaGroup3 = svg3.append("g").attr("class", "area-layer");
    const dotsGroup3 = svg3.append("g").attr("class", "dots-layer");

    window.updateChart3 = function(viewMode) {
        const transitionTime = 600; 
        let currentData = data.filter(d => d.DETECTION_TYPE === "Camera Issued" || d.DETECTION_TYPE === "Police Issued");
        if (globalFilter.jurisdiction !== "All") currentData = currentData.filter(d => matchJurisdiction(d.JURISDICTION, globalFilter.jurisdiction));
        if (globalFilter.location !== "All") currentData = currentData.filter(d => matchLocation(d.LOCATION, globalFilter.location));
        
        const groupedData = d3.rollup(currentData, v => d3.sum(v, d => d.FINES), d => d.YEAR, d => d.DETECTION_TYPE);
        
        let chartData = Array.from(groupedData, ([year, typesMap]) => {
            return {
                year: year,
                "Camera Issued": typesMap.has("Camera Issued") ? typesMap.get("Camera Issued") : null,
                "Police Issued": typesMap.has("Police Issued") ? typesMap.get("Police Issued") : null
            };
        }).sort((a, b) => a.year - b.year);

        if (chartData.length === 0 || currentData.length === 0) {
            areaGroup3.selectAll("*").remove(); dotsGroup3.selectAll("*").remove(); 
            xAxisGroup3.selectAll("*").remove(); yAxisGroup3Left.selectAll("*").remove(); yAxisGroup3Right.selectAll("*").remove();
            svg3.selectAll(".no-data").data([1]).join("text").attr("class", "no-data").attr("x", innerW3/2).attr("y", innerH3/2).attr("text-anchor", "middle").text("No data available").style("fill", "var(--light-text)");
            return;
        } else { svg3.selectAll(".no-data").remove(); }

        const minYear = d3.min(chartData, d => d.year);
        const maxYear = d3.max(chartData, d => d.year);

        const tickVals = chartData.map(d => d.year);
        tickVals.push(maxYear + 1);
        x3.domain([minYear - 0.8, maxYear + 1]); 
        xAxisGroup3.transition().duration(transitionTime).call(d3.axisBottom(x3).tickValues(tickVals).tickFormat(d3.format("d")))
            .selectAll("text").attr("transform", "rotate(-25)").style("text-anchor", "end").attr("dx", "-0.8em").attr("dy", "0.15em");
        
        const maxCamera = d3.max(chartData, d => d["Camera Issued"]) || 1;
        const maxPolice = d3.max(chartData, d => d["Police Issued"]) || 1;

        y3_left.domain([0, maxCamera * 1.1]);
        y3_right.domain([0, maxPolice * 1.1]);

        yAxisGroup3Left.transition().duration(transitionTime).call(d3.axisLeft(y3_left).tickFormat(d3.format("~s")))
            .selectAll("text").style("fill", "var(--primary-color)").style("font-weight", "bold");
        yAxisGroup3Left.selectAll("path, line").style("stroke", "var(--primary-color)");
            
        yAxisGroup3Right.transition().duration(transitionTime).call(d3.axisRight(y3_right).tickFormat(d3.format("~s")))
            .selectAll("text").style("fill", "var(--secondary-color)").style("font-weight", "bold");
        yAxisGroup3Right.selectAll("path, line").style("stroke", "var(--secondary-color)");

        svg3.selectAll(".y-axis-title").remove();
        yAxisGroup3Left.append("text").attr("class", "y-axis-title").attr("transform", "rotate(-90)").attr("y", -60).attr("x", -innerH3 / 2).attr("dy", "1em").style("text-anchor", "middle").style("fill", "var(--primary-color)").style("font-weight", "bold").text("Camera Fines").style("opacity", (viewMode === "All" || viewMode === "Camera Issued") ? 1 : 0);
        yAxisGroup3Right.append("text").attr("class", "y-axis-title").attr("transform", "rotate(90)").attr("y", -60).attr("x", innerH3 / 2).attr("dy", "1em").style("text-anchor", "middle").style("fill", "var(--secondary-color)").style("font-weight", "bold").text("Police Fines").style("opacity", (viewMode === "All" || viewMode === "Police Issued") ? 1 : 0);

        
        yAxisGroup3Left.style("opacity", (viewMode === "All" || viewMode === "Camera Issued") ? 1 : 0);
        yAxisGroup3Right.style("opacity", (viewMode === "All" || viewMode === "Police Issued") ? 1 : 0);

        const colorScale = d3.scaleOrdinal()
            .domain(["Camera Issued", "Police Issued"])
            .range(["var(--primary-color)", "var(--secondary-color)"]);

        const areaCamera = d3.area().defined(d => d["Camera Issued"] !== null).x(d => x3(d.year)).y0(innerH3).y1(d => y3_left(d["Camera Issued"])).curve(d3.curveMonotoneX);
        const areaPolice = d3.area().defined(d => d["Police Issued"] !== null).x(d => x3(d.year)).y0(innerH3).y1(d => y3_right(d["Police Issued"])).curve(d3.curveMonotoneX);
        const lineCamera = d3.line().defined(d => d["Camera Issued"] !== null).x(d => x3(d.year)).y(d => y3_left(d["Camera Issued"])).curve(d3.curveMonotoneX);
        const linePolice = d3.line().defined(d => d["Police Issued"] !== null).x(d => x3(d.year)).y(d => y3_right(d["Police Issued"])).curve(d3.curveMonotoneX);

        const seriesKeys = ["Police Issued", "Camera Issued"]; 
        const areaData = seriesKeys.map(k => ({ key: k, values: chartData }));

        const paths = areaGroup3.selectAll("path.area").data(areaData, d => d.key);
        paths.exit().transition().duration(300).style("opacity", 0).remove();
        
        paths.enter().append("path").attr("class", "area").attr("fill", d => colorScale(d.key)).style("opacity", 0)
            .merge(paths).transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("d", d => d.key === "Camera Issued" ? areaCamera(d.values) : areaPolice(d.values))
            .style("fill", d => colorScale(d.key))
            .style("opacity", d => (viewMode === "All" || d.key === viewMode) ? 0.25 : 0)
            .style("pointer-events", "none");

        const lines = areaGroup3.selectAll("path.line").data(areaData, d => d.key);
        lines.exit().transition().duration(300).style("opacity", 0).remove();

        lines.enter().append("path").attr("class", "line").attr("fill", "none")
            .attr("stroke", d => colorScale(d.key)).attr("stroke-width", 3).style("opacity", 0)
            .merge(lines).transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("d", d => d.key === "Camera Issued" ? lineCamera(d.values) : linePolice(d.values))
            .style("stroke", d => colorScale(d.key))
            .style("opacity", d => (viewMode === "All" || d.key === viewMode) ? 1 : 0)
            .style("pointer-events", "none");

        areaGroup3.selectAll("text.end-label").remove();

        const dotData = [];
        chartData.forEach(point => {
            seriesKeys.forEach(key => {
                if ((viewMode === "All" || viewMode === key) && point[key] !== null) {
                    dotData.push({
                        year: point.year,
                        key: key,
                        val: point[key],
                        cameraVal: point["Camera Issued"],
                        policeVal: point["Police Issued"],
                        yPos: key === "Camera Issued" ? y3_left(point[key]) : y3_right(point[key])
                    });
                }
            });
        });

        dotData.sort((a, b) => (a.key === "Police Issued" ? 1 : -1));

        const dots = dotsGroup3.selectAll("circle.area-dot").data(dotData, d => d.key + "-" + d.year);
        dots.exit().transition().duration(300).style("opacity", 0).attr("r", 0).remove();
        
        dots.enter().append("circle").attr("class", "area-dot").attr("r", 0).attr("fill", "white")
            .attr("stroke", d => colorScale(d.key)).attr("stroke-width", 2).style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                const activeR = 6;
                d3.select(this).attr("r", activeR).style("stroke-width", 2.5).style("filter", "brightness(1.15)");
                
                tooltip.style("visibility", "visible").style("opacity", 1).html(`
                    <div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${d.year}</div>
                    <div class="tooltip-body" style="color: white; font-weight: bold;">
                        <span style="color: white">Camera Fines: <span style="color: #f1c40f">$${formatNum(d.cameraVal || 0)}</span></span><br/>
                        <span style="color: white">Police Fines: <span style="color: #f1c40f">$${formatNum(d.policeVal || 0)}</span></span>
                    </div>
                `);
            })
            .on("mousemove", function(event) { tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); })
            .on("mouseout", function(event, d) {
                const isActiveYear = globalFilter.year !== "All" && +globalFilter.year === d.year;
                const baseR = 4.5;
                d3.select(this).attr("r", isActiveYear ? baseR + 1.5 : baseR).style("stroke-width", 2).style("filter", "none");
                tooltip.style("visibility", "hidden").style("opacity", 0);
            })
            .merge(dots).transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("cx", d => x3(d.year)).attr("cy", d => d.yPos)
            .style("opacity", d => {
               if (globalFilter.year !== "All" && +globalFilter.year !== d.year) return 0.2;
               return 1;
            })
            .attr("r", d => {
                const baseR = 4.5;
                return (globalFilter.year !== "All" && +globalFilter.year === d.year) ? baseR + 1.5 : baseR;
            });

        const cameraDots = dotData.filter(d => d.key === "Camera Issued");
        const policeDots = dotData.filter(d => d.key === "Police Issued");

        const actualMaxCamera = cameraDots.length ? d3.max(cameraDots, d => d.val) : null;
        const actualMaxPolice = policeDots.length ? d3.max(policeDots, d => d.val) : null;

        const maxLabelsData = [];
        if (actualMaxCamera !== null) {
            maxLabelsData.push(cameraDots.find(d => d.val === actualMaxCamera));
        }
        if (actualMaxPolice !== null) {
            maxLabelsData.push(policeDots.find(d => d.val === actualMaxPolice));
        }

        const maxLabels = dotsGroup3.selectAll("text.max-label").data(maxLabelsData, d => d.key);
        
        maxLabels.exit().transition().duration(300).style("opacity", 0).remove();
        
        maxLabels.enter().append("text").attr("class", "max-label")
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .style("fill", d => colorScale(d.key))
            .style("pointer-events", "none")
            .style("text-shadow", "1px 1px 3px rgba(255,255,255,0.8), -1px -1px 3px rgba(255,255,255,0.8), 0px 0px 3px rgba(255,255,255,1)")
            .attr("dy", "-10px")
            .style("opacity", 0)
            .attr("x", d => x3(d.year))
            .attr("y", d => d.yPos)
            .merge(maxLabels).transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("x", d => x3(d.year))
            .attr("y", d => d.yPos)
            .text(d => "$" + formatNum(d.val))
            .style("opacity", d => {
               if (globalFilter.year !== "All" && +globalFilter.year !== d.year) return 0.2;
               return 1;
            });

        svg3.selectAll(".bars-layer").remove();
    }
    d3.selectAll(".toggle-btn").on("click", function() { d3.selectAll(".toggle-btn").classed("active", false); d3.select(this).classed("active", true); triggerGlobalUpdate(); });

    const chart1Container = document.getElementById('chart1');
    const width1 = chart1Container.clientWidth; const height1 = 350; 
    const margin1 = {top: 30, right: 60, bottom: 50, left: 60};
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
        if (globalFilter.location !== "All") filteredData = filteredData.filter(d => matchLocation(d.LOCATION, globalFilter.location));

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
                        d.yoyAvgText = `<span style="color: white; font-size: 0.9em;"><span style="color: #f1c40f; font-weight: bold;">Increased</span> <span style="color: #f1c40f; font-weight: bold;">${yoy.toFixed(1)}%</span> vs ${prevYear}</span>`;
                    } else if (yoy < 0) {
                        d.yoyAvgText = `<span style="color: white; font-size: 0.9em;"><span style="color: #f1c40f; font-weight: bold;">Decreased</span> <span style="color: #f1c40f; font-weight: bold;">${Math.abs(yoy).toFixed(1)}%</span> vs ${prevYear}</span>`;
                    } else {
                        d.yoyAvgText = `<span style="color: white; font-size: 0.9em;">No change vs ${prevYear}</span>`;
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
            .attr("stroke", "#5C4D3C")
            .attr("stroke-width", 1)
            .on("mouseover", function(event, d) {
                d3.select(this).style("filter", "brightness(1.1)").style("opacity", 1);
                tooltip.style("visibility", "visible").style("opacity", 1).html(`
                    <div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${d.year}</div>
                    <div class="tooltip-body" style="color: white; font-weight: bold;">
                        <span style="color: white">Total Fines: <span style="color: #f1c40f">$${formatNum(d.fines)}</span></span>
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
            .attr("fill", d => { if (globalFilter.year === "All") return "#8e7961"; return +globalFilter.year === d.year ? "#8e7961" : "#d6c8b8"; })
            .attr("stroke", "#5C4D3C")
            .attr("stroke-width", 1)
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
                    <div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${d.year}</div>
                    <div class="tooltip-body" style="color: white; font-weight: bold;">
                        <span style="color: white">Total Tickets: <span style="color: #f1c40f">${formatNum(d.count)}</span></span><br/>
                        <span style="color: white">Total Fines: <span style="color: #f1c40f">$${formatNum(d.fines)}</span></span><br/>
                        <span style="color: white">Average Fine: <span style="color: #f1c40f">$${formatNum(d.avg.toFixed(0))}</span></span><br/>
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
    const width2 = chart2Container.clientWidth; const height2 = 350; 
    const margin2 = {top: 10, right: 140, bottom: 10, left: 10}; 
    const innerW2 = width2 - margin2.left - margin2.right; const innerH2 = height2 - margin2.top - margin2.bottom;

    const svg2 = d3.select("#chart2").append("svg").attr("width", width2).attr("height", height2).append("g").attr("transform", `translate(${margin2.left},${margin2.top})`);
    
    
    const riskScaleColors = ["#F6C36B", "#E89A2E", "#C96A12", "#8A3F00"];
    const getRiskColor = (percent) => {
        if (percent < 25) return riskScaleColors[0];
        if (percent < 50) return riskScaleColors[1];
        if (percent < 75) return riskScaleColors[2];
        return riskScaleColors[3];
    };

    window.updateChart2 = function() {
        const transitionTime = 800; 
        
        // Custom grouping specifically for Treemap
        let treemapData = data.filter(d => d.LOCATION !== "All regions").map(d => {
            let newObj = {...d};
            if (newObj.LOCATION === "Remote" || newObj.LOCATION === "Very Remote") {
                newObj.TreemapLoc = "Remote";
                newObj.RawLocs = ["Remote", "Very Remote"];
            } else if (newObj.LOCATION === "Inner Regional" || newObj.LOCATION === "Outer Regional") {
                newObj.TreemapLoc = "Regional";
                newObj.RawLocs = ["Inner Regional", "Outer Regional"];
            } else {
                newObj.TreemapLoc = newObj.LOCATION;
                newObj.RawLocs = [newObj.LOCATION];
            }
            return newObj;
        });

        if (globalFilter.jurisdiction !== "All") treemapData = treemapData.filter(d => matchJurisdiction(d.JURISDICTION, globalFilter.jurisdiction));
        if (globalFilter.year !== "All") treemapData = treemapData.filter(d => d.YEAR === +globalFilter.year);

        const grouped = d3.rollup(treemapData, 
            v => ({
                fines: d3.sum(v, d => d.FINES),
                count: v.length,
                avg: v.length > 0 ? d3.sum(v, d => d.FINES) / v.length : 0,
                rawLocs: v[0].RawLocs
            }), 
            d => d.TreemapLoc
        );
        const plotData = Array.from(grouped, ([location, vals]) => ({
            location, 
            fines: vals.fines, 
            count: vals.count, 
            avg: vals.avg,
            rawLocs: vals.rawLocs
        })).sort((a, b) => b.fines - a.fines);

        const totalAllLocations = d3.sum(plotData, d => d.fines);

        if(plotData.length === 0) {
            svg2.selectAll(".cell").transition().duration(300).style("opacity", 0).remove();
            svg2.selectAll(".no-data").data([1]).join("text").attr("class", "no-data").attr("x", innerW2/2).attr("y", innerH2/2).attr("text-anchor", "middle").text("No data for this filter").style("fill", "var(--light-text)");
            return;
        } else { svg2.selectAll(".no-data").remove(); }

        const maxAvg = d3.max(plotData, d => d.avg) || 1;

        const root = d3.hierarchy({children: plotData})
            .sum(d => d.fines)
            .sort((a, b) => b.value - a.value);

        d3.treemap()
            .size([innerW2, innerH2])
            .padding(2)
            .round(true)
            (root);

        const cells = svg2.selectAll("g.cell").data(root.leaves(), d => d.data.location);
        cells.exit().transition().duration(300).style("opacity", 0).remove();

        const cellsEnter = cells.enter().append("g").attr("class", "cell")
            .attr("transform", d => `translate(${d.x0},${d.y0})`)
            .style("cursor", "pointer")
            .style("opacity", 0);

        cellsEnter.append("rect")
            .attr("rx", 3)
            .style("stroke", "#fff")
            .style("stroke-width", "1px");

        cellsEnter.append("text")
            .style("pointer-events", "none")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("fill", "white")
            .attr("transform", d => {
                const w = d.x1 - d.x0;
                const h = d.y1 - d.y0;
                const cx = w / 2;
                const cy = h / 2;
                if (w < 60 && h > w * 1.5) {
                    return `translate(${cx}, ${cy}) rotate(-90)`;
                }
                return `translate(${cx}, ${cy})`;
            });
            
        cellsEnter.select("text").append("tspan").attr("class", "node-label")
            .style("font-weight", "bold")
            .attr("x", 0).attr("y", -10);
        cellsEnter.select("text").append("tspan").attr("class", "node-value")
            .style("fill", "rgba(255,255,255,0.9)")
            .style("font-weight", "bold")
            .attr("x", 0).attr("y", 12);

        cellsEnter.on("mouseover", function(event, d) {
            d3.select(this).select("rect").style("filter", "brightness(1.15)").style("stroke-width", "2px");
            
            const percent = totalAllLocations > 0 ? ((d.data.fines / totalAllLocations) * 100).toFixed(1) : 0;
            const sevPercent = (d.data.avg / maxAvg) * 100;
            
            tooltip.style("visibility", "visible").style("opacity", 1).html(`
                <div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${d.data.location}</div>
                <div class="tooltip-body" style="color: white; font-weight: bold;">
                    <span style="color: white">Jurisdiction: <span style="color: #f1c40f">${globalFilter.jurisdiction === "All" ? "All Australia" : globalFilter.jurisdiction}</span></span><br/>
                    <span style="color: white">Total Tickets: <span style="color: #f1c40f">${formatNum(d.data.count)}</span></span><br/>
                    <span style="color: white">Total Fines: <span style="color: #f1c40f">$${formatNum(d.data.fines)}</span></span><br/>
                    <span style="color: white">Severity Index: <span style="color: ${sevPercent > 75 ? '#ff4d4d' : '#f1c40f'}">${sevPercent.toFixed(1)}%</span></span>
                </div>
            `);
        })
        .on("mousemove", function(event) { tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); })
        .on("mouseout", function(event, d) {
            d3.select(this).select("rect").style("filter", "none").style("stroke-width", "1px");
            tooltip.style("visibility", "hidden").style("opacity", 0);
        })
        .on("click", function(event, d) {
            let isSelected = false;
            if (globalFilter.location !== "All") {
                if (Array.isArray(globalFilter.location)) {
                    isSelected = JSON.stringify(globalFilter.location) === JSON.stringify(d.data.rawLocs);
                } else {
                    isSelected = d.data.rawLocs ? d.data.rawLocs.includes(globalFilter.location) : globalFilter.location === d.data.location;
                }
            }
            
            if (isSelected) {
                globalFilter.location = "All"; 
                d3.select("#locationSelect").property("value", "All"); 
            } else {
                if (d.data.rawLocs && d.data.rawLocs.length > 1) {
                    globalFilter.location = d.data.rawLocs;
                    d3.select("#locationSelect").property("value", "All"); 
                } else {
                    globalFilter.location = d.data.location;
                    d3.select("#locationSelect").property("value", d.data.location);
                }
            }
            triggerGlobalUpdate();
        });

        const mergedCells = cellsEnter.merge(cells);
        
        mergedCells.transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("transform", d => `translate(${d.x0},${d.y0})`)
            .style("opacity", d => {
                if (globalFilter.location === "All") return 1;
                let isSelected = false;
                if (Array.isArray(globalFilter.location)) {
                     isSelected = JSON.stringify(globalFilter.location) === JSON.stringify(d.data.rawLocs);
                } else {
                     isSelected = d.data.rawLocs ? d.data.rawLocs.includes(globalFilter.location) : globalFilter.location === d.data.location;
                }
                return isSelected ? 1 : 0.3;
            });

        mergedCells.select("rect").transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("width", d => Math.max(0, d.x1 - d.x0))
            .attr("height", d => Math.max(0, d.y1 - d.y0))
            .attr("fill", d => {
                const percent = (d.data.avg / maxAvg) * 100;
                const baseColor = getRiskColor(percent);
                if (globalFilter.location === "All") return baseColor;
                
                let isSelected = false;
                if (Array.isArray(globalFilter.location)) {
                     isSelected = JSON.stringify(globalFilter.location) === JSON.stringify(d.data.rawLocs);
                } else {
                     isSelected = d.data.rawLocs ? d.data.rawLocs.includes(globalFilter.location) : globalFilter.location === d.data.location;
                }
                return isSelected ? baseColor : "#d6c8b8"; 
            });

        mergedCells.select("text").transition().duration(transitionTime).ease(d3.easeCubicOut)
            .style("opacity", d => {
                const w = d.x1 - d.x0;
                return w < 45 ? 0 : 1;
            })
            .attr("transform", d => {
                const w = d.x1 - d.x0;
                const h = d.y1 - d.y0;
                const cx = w / 2;
                const cy = h / 2;
                if (w < 60 && h > w * 1.5) {
                    return `translate(${cx}, ${cy}) rotate(-90)`;
                }
                return `translate(${cx}, ${cy})`;
            });

        mergedCells.select(".node-label")
            .text(d => d.data.location)
            .transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("x", 0)
            .attr("y", -10)
            .style("fill", d => {
                const percent = (d.data.avg / maxAvg) * 100;
                let isSel = globalFilter.location === "All";
                if (!isSel) {
                    isSel = Array.isArray(globalFilter.location) ? JSON.stringify(globalFilter.location) === JSON.stringify(d.data.rawLocs) : (d.data.rawLocs ? d.data.rawLocs.includes(globalFilter.location) : globalFilter.location === d.data.location);
                }
                return (!isSel || percent < 40) ? "#5C4D3C" : "white";
            })
            .style("font-size", d => {
                const w = d.x1 - d.x0;
                const h = d.y1 - d.y0;
                const effWidth = (w < 60 && h > w * 1.5) ? h : w;
                return effWidth > 100 ? "15px" : (effWidth > 60 ? "13px" : "11px");
            });

        mergedCells.select(".node-value")
            .text(d => "$" + formatNum(d.data.fines))
            .transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("x", 0)
            .attr("y", 12)
            .style("fill", d => {
                const percent = (d.data.avg / maxAvg) * 100;
                let isSel = globalFilter.location === "All";
                if (!isSel) {
                    isSel = Array.isArray(globalFilter.location) ? JSON.stringify(globalFilter.location) === JSON.stringify(d.data.rawLocs) : (d.data.rawLocs ? d.data.rawLocs.includes(globalFilter.location) : globalFilter.location === d.data.location);
                }
                return (!isSel || percent < 40) ? "#5C4D3C" : "white";
            })
            .style("font-size", d => {
                const w = d.x1 - d.x0;
                const h = d.y1 - d.y0;
                const effWidth = (w < 60 && h > w * 1.5) ? h : w;
                return effWidth > 100 ? "14px" : (effWidth > 60 ? "12px" : "10px");
            });

        const smallCells = root.leaves().filter(d => (d.x1 - d.x0) < 45);
        
        const callouts = svg2.selectAll("g.treemap-callout").data(smallCells, d => d.data.location);
        callouts.exit().transition().duration(300).style("opacity", 0).remove();
        
        const calloutsEnter = callouts.enter().append("g").attr("class", "treemap-callout").style("opacity", 0)
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                d3.select(this).select(".callout-bg").style("filter", "drop-shadow(0px 3px 6px rgba(0,0,0,0.3)) brightness(1.05)");
                
                const percent = totalAllLocations > 0 ? ((d.data.fines / totalAllLocations) * 100).toFixed(1) : 0;
                const sevPercent = (d.data.avg / maxAvg) * 100;
                
                tooltip.style("visibility", "visible").style("opacity", 1).html(`
                    <div class="tooltip-header" style="color: var(--primary-color); font-weight: bold; font-size: 1.1em;">${d.data.location}</div>
                    <div class="tooltip-body" style="color: white; font-weight: bold;">
                        <span style="color: white">Jurisdiction: <span style="color: #f1c40f">${globalFilter.jurisdiction === "All" ? "All Australia" : globalFilter.jurisdiction}</span></span><br/>
                        <span style="color: white">Total Tickets: <span style="color: #f1c40f">${formatNum(d.data.count)}</span></span><br/>
                        <span style="color: white">Total Fines: <span style="color: #f1c40f">$${formatNum(d.data.fines)}</span></span><br/>
                        <span style="color: white">Severity Index: <span style="color: ${sevPercent > 75 ? '#ff4d4d' : '#f1c40f'}">${sevPercent.toFixed(1)}%</span></span>
                    </div>
                `);
            })
            .on("mousemove", function(event) { tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); })
            .on("mouseout", function(event, d) {
                d3.select(this).select(".callout-bg").style("filter", "drop-shadow(0px 2px 4px rgba(0,0,0,0.15)) brightness(1)");
                tooltip.style("visibility", "hidden").style("opacity", 0);
            })
            .on("click", function(event, d) {
                let isSelected = false;
                if (globalFilter.location !== "All") {
                    if (Array.isArray(globalFilter.location)) {
                        isSelected = JSON.stringify(globalFilter.location) === JSON.stringify(d.data.rawLocs);
                    } else {
                        isSelected = d.data.rawLocs ? d.data.rawLocs.includes(globalFilter.location) : globalFilter.location === d.data.location;
                    }
                }
                
                if (isSelected) {
                    globalFilter.location = "All"; 
                    d3.select("#locationSelect").property("value", "All"); 
                } else {
                    if (d.data.rawLocs && d.data.rawLocs.length > 1) {
                        globalFilter.location = d.data.rawLocs;
                        d3.select("#locationSelect").property("value", "All"); 
                    } else {
                        globalFilter.location = d.data.location;
                        d3.select("#locationSelect").property("value", d.data.location);
                    }
                }
                triggerGlobalUpdate();
            });
        
        calloutsEnter.append("path").attr("class", "callout-line")
            .style("fill", "none")
            .style("stroke", "#8A3F00")
            .style("stroke-width", "1.5px")
            .style("stroke-dasharray", "3,3");
            
        calloutsEnter.append("circle").attr("class", "callout-dot")
            .attr("r", 3)
            .style("fill", "#8A3F00");
            
        calloutsEnter.append("rect").attr("class", "callout-bg")
            .attr("rx", 5)
            .style("fill", "#FDF5EB")
            .style("filter", "drop-shadow(0px 2px 4px rgba(0,0,0,0.15))");
            
        calloutsEnter.append("text").attr("class", "callout-text label")
            .style("font-size", "15px")
            .style("font-weight", "bold")
            .style("fill", "#5C4D3C");
            
        calloutsEnter.append("text").attr("class", "callout-text value")
            .style("font-size", "14px")
            .style("fill", "#8A3F00")
            .style("font-weight", "900");
            
        const mergedCallouts = calloutsEnter.merge(callouts);
        
        mergedCallouts.transition().duration(transitionTime).ease(d3.easeCubicOut)
            .style("opacity", d => {
                if (globalFilter.location === "All") return 1;
                let isSel = false;
                if (Array.isArray(globalFilter.location)) {
                     isSel = JSON.stringify(globalFilter.location) === JSON.stringify(d.data.rawLocs);
                } else {
                     isSel = d.data.rawLocs ? d.data.rawLocs.includes(globalFilter.location) : globalFilter.location === d.data.location;
                }
                return isSel ? 1 : 0;
            });
            
        mergedCallouts.select("path").transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("d", (d, i) => {
                const cx = d.x0 + (d.x1 - d.x0) / 2;
                const cy = d.y0 + (d.y1 - d.y0) / 2;
                const calloutY = Math.max(150, cy) + (i * 45);
                return `M ${cx} ${cy} L ${innerW2 + 5} ${calloutY} L ${innerW2 + 10} ${calloutY}`;
            });
            
        mergedCallouts.select("circle").transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("cx", d => d.x0 + (d.x1 - d.x0) / 2)
            .attr("cy", d => d.y0 + (d.y1 - d.y0) / 2);
            
        mergedCallouts.select(".callout-bg").transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("x", innerW2 + 10)
            .attr("y", (d, i) => Math.max(150, d.y0 + (d.y1 - d.y0) / 2) - 22 + (i * 45))
            .attr("width", 100)
            .attr("height", 48)
            .style("stroke", d => {
                const percent = (d.data.avg / maxAvg) * 100;
                return getRiskColor(percent);
            })
            .style("stroke-width", "2.5px");
            
        mergedCallouts.select(".label").transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("x", innerW2 + 20)
            .attr("y", (d, i) => Math.max(150, d.y0 + (d.y1 - d.y0) / 2) - 5 + (i * 45))
            .text(d => d.data.location);
            
        mergedCallouts.select(".value").transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("x", innerW2 + 20)
            .attr("y", (d, i) => Math.max(150, d.y0 + (d.y1 - d.y0) / 2) + 16 + (i * 45))
            .text(d => "$" + formatNum(d.data.fines));

        if (svg2.select(".treemap-legend").empty()) {
            const legendGroup = svg2.append("g").attr("class", "treemap-legend")
                .attr("transform", `translate(${innerW2 + 15}, 40)`);
            
            legendGroup.append("text").attr("x", 0).attr("y", -10).attr("fill", "#5C4D3C")
                .attr("font-size", "12px").attr("font-weight", "bold").text("Severity Index");
            
            const legendData = [
                { label: "Very High (> 75%)", color: riskScaleColors[3] },
                { label: "High (50-75%)", color: riskScaleColors[2] },
                { label: "Moderate (25-50%)", color: riskScaleColors[1] },
                { label: "Low (< 25%)", color: riskScaleColors[0] }
            ];
            
            legendGroup.selectAll("rect.legend-swatch").data(legendData).enter().append("rect")
                .attr("class", "legend-swatch").attr("x", 0).attr("y", (d, i) => i * 20)
                .attr("width", 12).attr("height", 12).attr("rx", 2).attr("fill", d => d.color);
                
            legendGroup.selectAll("text.legend-label").data(legendData).enter().append("text")
                .attr("class", "legend-label").attr("x", 18).attr("y", (d, i) => i * 20 + 10)
                .attr("fill", "#5C4D3C").attr("font-size", "12px").text(d => d.label);
        }
        svg2.select(".treemap-legend").raise();
    };

    window.updateStats = function() {
        let filteredData = data;
        if (globalFilter.jurisdiction !== "All") filteredData = filteredData.filter(d => matchJurisdiction(d.JURISDICTION, globalFilter.jurisdiction));
        if (globalFilter.year !== "All") filteredData = filteredData.filter(d => d.YEAR === +globalFilter.year);
        if (globalFilter.location !== "All") filteredData = filteredData.filter(d => matchLocation(d.LOCATION, globalFilter.location));

        const totalFines = d3.sum(filteredData, d => d.FINES);
        const totalTickets = filteredData.length;
        const severityIndex = totalTickets > 0 ? (totalFines / totalTickets).toFixed(2) : 0;
        
        const cameraFines = d3.sum(filteredData.filter(d => d.DETECTION_TYPE === "Camera Issued"), d => d.FINES);
        const policeFines = d3.sum(filteredData.filter(d => d.DETECTION_TYPE === "Police Issued"), d => d.FINES);

        d3.select("#headline-fines").text(formatNum(totalFines));
        d3.select("#headline-label").text(globalFilter.year !== "All" ? `Total fines, ${globalFilter.year}` : "Total fines, all years");
        d3.select("#headline-severity").text("$" + formatNum(Math.round(severityIndex)));
        d3.select("#headline-camera").text(formatNum(cameraFines));
        d3.select("#headline-police").text(formatNum(policeFines));
    };

    setTimeout(() => {
        triggerGlobalUpdate();
    }, 50);
});
