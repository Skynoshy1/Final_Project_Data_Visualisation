// =========================================================================
// 🧠 BỘ NÃO TRUNG TÂM (GLOBAL FILTER STATE)
// =========================================================================
const globalFilter = {
    jurisdiction: "All",
    year: "All",
    location: "All"
};

// Từ điển thông dịch Map -> CSV
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

// Hàm gào thét báo động toàn Dashboard
function triggerGlobalUpdate() {
    console.log("🔥 BỘ LỌC ĐÃ THAY ĐỔI:", globalFilter);
    
    // Gọi Chart 3 múa
    if (typeof window.updateChart3 === "function") {
        const currentToggle = d3.select(".toggle-btn.active").attr("data-view") || "All";
        window.updateChart3(currentToggle);
    }
    
    // Gọi Chart 1 múa
    if (typeof window.updateChart1 === "function") {
        window.updateChart1();
    }
}

// =========================================================================
// 🗺️ VẼ BẢN ĐỒ ÚC (GEOJSON MAP) - KHỞI TẠO ĐỘC LẬP
// =========================================================================
const mapContainer = document.getElementById('map');
const mapWidth = mapContainer.clientWidth;
const mapHeight = 300; 

const svgMap = d3.select("#map")
    .append("svg")
    .attr("width", mapWidth)
    .attr("height", mapHeight);

const mapTooltip = d3.select("#tooltip");

d3.json("data/au-states.geojson").then(function(geoData) {
    const projection = d3.geoMercator().fitSize([mapWidth, mapHeight], geoData);
    const pathGenerator = d3.geoPath().projection(projection);

    svgMap.selectAll(".state")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("class", "state")
        .attr("d", pathGenerator)
        .on("mouseover", function(event, d) {
            const stateName = d.properties.STATE_NAME || d.properties.ste_name || d.properties.name || d.properties.STATE || "Unknown State";
            mapTooltip.style("visibility", "visible").style("opacity", 1).html(`
                <div class="tooltip-header" style="color: var(--primary-color)">📍 Jurisdiction</div>
                <div class="tooltip-body"><strong>${stateName}</strong></div>
            `);
        })
        .on("mousemove", function(event) { mapTooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); })
        .on("mouseout", function() { mapTooltip.style("visibility", "hidden").style("opacity", 0); });

    svgMap.selectAll(".state").on("click", function(event, d) {
        const stateName = d.properties.STATE_NAME || d.properties.ste_name || d.properties.name || d.properties.STATE || "Unknown State";
        
        if (d3.select(this).classed("active")) {
            d3.select(this).classed("active", false);
            globalFilter.jurisdiction = "All";
        } else {
            svgMap.selectAll(".state").classed("active", false); 
            d3.select(this).classed("active", true); 
            globalFilter.jurisdiction = stateName;
        }
        triggerGlobalUpdate();
    });
}).catch(error => console.error("Lỗi load Map:", error));


// =========================================================================
// 🚀 LOAD CSV 1 LẦN DUY NHẤT & CHIA DATA CHO CÁC CHARTS
// =========================================================================
d3.csv("data/Speeding.csv").then(function(data) {
    
    // 1. LÀM SẠCH DATA CHUNG
    data.forEach(d => {
        d.YEAR = +d.YEAR;
        d.FINES = +d["Sum(FINES)"]; 
    });

    const formatNum = d3.format(",");
    const tooltip = d3.select("#tooltip");

    // ==========================================
    // ⚙️ SETUP DROPDOWN FILTERS
    // ==========================================
    const uniqueYears = [...new Set(data.map(d => d.YEAR))].filter(Boolean).sort();
    const yearSelect = d3.select("#yearSelect");
    uniqueYears.forEach(y => { yearSelect.append("option").text(y).attr("value", y); });

    const uniqueLocations = [...new Set(data.map(d => d.LOCATION))].filter(Boolean).sort();
    const locSelect = d3.select("#locationSelect");
    uniqueLocations.forEach(l => { locSelect.append("option").text(l).attr("value", l); });

    yearSelect.on("change", function() { globalFilter.year = this.value; triggerGlobalUpdate(); });
    locSelect.on("change", function() { globalFilter.location = this.value; triggerGlobalUpdate(); });

    // ==========================================
    // 📷 CHART 3: CAMERA VS POLICE
    // ==========================================
    const chart3Container = document.getElementById('chart3');
    const width3 = chart3Container.clientWidth;
    const height3 = 380; 
    const margin3 = {top: 20, right: 120, bottom: 40, left: 80};
    const innerW3 = width3 - margin3.left - margin3.right;
    const innerH3 = height3 - margin3.top - margin3.bottom;

    const svg3 = d3.select("#chart3").append("svg").attr("width", width3).attr("height", height3).append("g").attr("transform", `translate(${margin3.left},${margin3.top})`);
    const x3 = d3.scaleLinear().range([0, innerW3]);
    const y3 = d3.scaleLinear().range([innerH3, 0]);
    const xAxisGroup3 = svg3.append("g").attr("transform", `translate(0,${innerH3})`);
    const yAxisGroup3 = svg3.append("g"); 

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
            svg3.selectAll(".no-data").data([1]).join("text").attr("class", "no-data").attr("x", innerW3/2).attr("y", innerH3/2).attr("text-anchor", "middle").text("No data available 🥲").style("fill", "var(--light-text)");
            return;
        } else { svg3.selectAll(".no-data").remove(); }

        const activeData = viewMode === "All" ? chartData : chartData.filter(d => d.id === viewMode);
        if (activeData.length === 0) return; 

        const minYear = d3.min(activeData, c => d3.min(c.values, d => d.year));
        const maxYear = d3.max(activeData, c => d3.max(c.values, d => d.year));
        const maxFines = d3.max(activeData, c => d3.max(c.values, d => d.fines));
        const sequentialDelayScale = d3.scaleLinear().domain([minYear, maxYear]).range([0, transitionTime]); 

        x3.domain([minYear - 1.5, maxYear]);
        xAxisGroup3.transition().duration(600).call(d3.axisBottom(x3).tickFormat(d3.format("d")))
            .selectAll("text").attr("transform", "rotate(-25)").style("text-anchor", "end").attr("dx", "-0.8em").attr("dy", "0.15em");

        y3.domain([0, maxFines * 1.1]);
        yAxisGroup3.transition().duration(600).call(d3.axisLeft(y3).tickFormat(d3.format("~s")));

        const lineGenerator = d3.line().x(d => x3(d.year)).y(d => y3(d.fines)).curve(d3.curveMonotoneX); 

        svg3.selectAll(".line-path").data(chartData, d => d.id).join("path")
            .attr("class", d => d.id === "Camera Issued" ? "line-camera line-path" : "line-police line-path")
            .style("opacity", d => (viewMode === "All" || d.id === viewMode) ? 1 : 0)
            .attr("d", d => lineGenerator(d.values))
            .each(function(d) {
                if (viewMode === "All" || d.id === viewMode) {
                    const totalLength = this.getTotalLength() || 2000; 
                    d3.select(this).attr("stroke-dasharray", totalLength + " " + totalLength).attr("stroke-dashoffset", totalLength) 
                      .transition().duration(transitionTime).ease(d3.easeLinear).attr("stroke-dashoffset", 0); 
                }
            });

        const dotData = [];
        chartData.forEach(tg => { tg.values.forEach(v => { dotData.push({ id: tg.id, year: v.year, fines: v.fines }); }); });

        const dots = svg3.selectAll(".dot").data(dotData, d => d.id + d.year);
        dots.exit().transition().duration(300).style("opacity", 0).remove();
        
        dots.enter().append("circle").attr("class", d => d.id === "Camera Issued" ? "dot-camera dot" : "dot-police dot")
            .attr("r", 4)
            .on("mouseover", function(event, d) {
                const headerColor = d.id === "Camera Issued" ? "var(--primary-color)" : "var(--primary-color)";
                tooltip.style("visibility", "visible").style("opacity", 1).html(`
                    <div class="tooltip-header" style="color: ${headerColor}">${d.id}</div>
                    <div class="tooltip-body">Year: <strong>${d.year}</strong><br/>Total Fines: <strong>${formatNum(d.fines)}</strong></div>
                `);
            }).on("mousemove", function(event) { tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); })
            .on("mouseout", function() { tooltip.style("visibility", "hidden").style("opacity", 0); })
            .merge(dots).attr("cx", d => x3(d.year)).attr("cy", d => y3(d.fines))
            .style("pointer-events", d => (viewMode === "All" || d.id === viewMode) ? "auto" : "none")
            .style("opacity", 0).transition().delay(d => (viewMode === "All" || d.id === viewMode) ? sequentialDelayScale(d.year) : 0).duration(300) 
            .style("opacity", d => (viewMode === "All" || d.id === viewMode) ? 1 : 0)
            .attr("fill", d => (globalFilter.year === "All" || +globalFilter.year === d.year) ? "white" : "#e0e0e0")
            .attr("r", d => (globalFilter.year !== "All" && +globalFilter.year === d.year) ? 8 : 4);

        svg3.selectAll(".line-label").data(chartData, d => d.id).join("text").attr("class", "line-label") 
            .datum(d => { return {id: d.id, value: d.values[d.values.length - 1]}; })
            .attr("x", 10).attr("dy", ".35em").style("font-weight", "bold")
            .style("fill", d => d.id === "Camera Issued" ? "var(--primary-color)" : "var(--secondary-color)")
            .text(d => d.id).attr("transform", d => `translate(${x3(d.value.year)},${y3(d.value.fines)})`)
            .style("opacity", 0).transition().delay(d => (viewMode === "All" || d.id === viewMode) ? sequentialDelayScale(d.value.year) : 0).duration(300)
            .style("opacity", d => (viewMode === "All" || d.id === viewMode) ? 1 : 0);
            
        const maxPoints = [];
        chartData.forEach(group => {
            let maxObj = group.values[0];
            group.values.forEach(v => { if (v.fines > maxObj.fines) { maxObj = v; } });
            maxPoints.push({ id: group.id, year: maxObj.year, fines: maxObj.fines });
        });

        svg3.selectAll(".max-label").data(maxPoints, d => d.id).join("text").attr("class", "max-label") 
            .attr("text-anchor", "middle").attr("dy", "-10px").style("font-size", "12px").style("font-weight", "bold")
            .style("fill", d => d.id === "Camera Issued" ? "var(--primary-color)" : "var(--primary-color)")
            .text(d => formatNum(d.fines)).attr("x", d => x3(d.year)).attr("y", d => y3(d.fines))
            .style("opacity", 0).transition().delay(d => (viewMode === "All" || d.id === viewMode) ? sequentialDelayScale(d.year) : 0).duration(300)
            .style("opacity", d => (viewMode === "All" || d.id === viewMode) ? 1 : 0);
    }

    d3.selectAll(".toggle-btn").on("click", function() {
        d3.selectAll(".toggle-btn").classed("active", false); d3.select(this).classed("active", true); triggerGlobalUpdate(); 
    });


    // ==========================================
    // 📊 CHART 1: OVERALL TREND (COLUMN CHART)
    // ==========================================
    const chart1Container = document.getElementById('chart1');
    const width1 = chart1Container.clientWidth;
    const height1 = 300; 
    const margin1 = {top: 30, right: 30, bottom: 40, left: 60};
    const innerW1 = width1 - margin1.left - margin1.right;
    const innerH1 = height1 - margin1.top - margin1.bottom;

    const svg1 = d3.select("#chart1").append("svg").attr("width", width1).attr("height", height1).append("g").attr("transform", `translate(${margin1.left},${margin1.top})`);
    
    const x1 = d3.scaleBand().range([0, innerW1]).padding(0.3); 
    const y1 = d3.scaleLinear().range([innerH1, 0]);
    
    const xAxisGroup1 = svg1.append("g").attr("transform", `translate(0,${innerH1})`);
    const yAxisGroup1 = svg1.append("g");

    window.updateChart1 = function() {
        const transitionTime = 800; 

        // 1. Lọc Data
        let filteredData = data;
        if (globalFilter.jurisdiction !== "All") filteredData = filteredData.filter(d => matchJurisdiction(d.JURISDICTION, globalFilter.jurisdiction));
        if (globalFilter.location !== "All") filteredData = filteredData.filter(d => d.LOCATION === globalFilter.location);

        // 2. Gom nhóm theo Năm
        const grouped = d3.rollup(filteredData, v => d3.sum(v, d => d.FINES), d => d.YEAR);
        const plotData = Array.from(grouped, ([year, fines]) => ({year, fines})).sort((a, b) => a.year - b.year);

        if(plotData.length === 0) {
            svg1.selectAll(".bar1").transition().duration(300).attr("y", innerH1).attr("height", 0).remove(); 
            xAxisGroup1.selectAll("*").remove(); yAxisGroup1.selectAll("*").remove();
            svg1.selectAll(".no-data").data([1]).join("text").attr("class", "no-data").attr("x", innerW1/2).attr("y", innerH1/2).attr("text-anchor", "middle").text("No data for this Jurisdiction 🥲").style("fill", "var(--light-text)");
            return;
        } else { svg1.selectAll(".no-data").remove(); }

        const maxFines = d3.max(plotData, d => d.fines);

        // 3. Múa Trục
        x1.domain(plotData.map(d => d.year));
        y1.domain([0, maxFines * 1.15]); 

        xAxisGroup1.transition().duration(transitionTime).call(d3.axisBottom(x1))
            .selectAll("text").attr("transform", "rotate(-25)").style("text-anchor", "end").attr("dx", "-0.8em").attr("dy", "0.15em");
        yAxisGroup1.transition().duration(transitionTime).call(d3.axisLeft(y1).tickFormat(d3.format("~s")));

        // 4. Múa Cột (Bar Growing Animation)
        const bars = svg1.selectAll(".bar1").data(plotData, d => d.year);

        bars.exit().transition().duration(300).attr("y", innerH1).attr("height", 0).remove();

        const barsEnter = bars.enter().append("rect").attr("class", "bar1")
            .attr("x", d => x1(d.year))
            .attr("y", innerH1) 
            .attr("width", x1.bandwidth())
            .attr("height", 0)  
            .attr("rx", 4) 
            .on("mouseover", function(event, d) {
                // 🚨 Khi hover vô thì rực sáng mượt mà
                d3.select(this).style("filter", "brightness(1.1)").style("opacity", 1);
                
                tooltip.style("visibility", "visible").style("opacity", 1).html(`
                    <div class="tooltip-header" style="color: var(--primary-color)">📅 Year: ${d.year}</div>
                    <div class="tooltip-body">
                         ${globalFilter.jurisdiction === "All" ? "All Australia" : globalFilter.jurisdiction}<br/>
                         ${globalFilter.location === "All" ? "All Locations" : globalFilter.location}<br/>
                        💰 Total Fines: <strong>${formatNum(d.fines)}</strong>
                    </div>
                `);
            })
            .on("mousemove", function(event) { tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); })
            .on("mouseout", function(event, d) {
                // 🚨 Thả chuột ra thì trả lại độ sáng và Opacity đúng như ban đầu
                d3.select(this).style("filter", "none")
                  .style("opacity", () => {
                      if (globalFilter.year !== "All") return +globalFilter.year === d.year ? 1 : 0.4;
                      return d.fines === maxFines ? 1 : 0.5;
                  });
                tooltip.style("visibility", "hidden").style("opacity", 0);
            });
            
        bars.merge(barsEnter)
            .transition().duration(transitionTime).ease(d3.easeCubicOut)
            .attr("x", d => x1(d.year))
            .attr("width", x1.bandwidth())
            .attr("y", d => y1(d.fines))
            .attr("height", d => innerH1 - y1(d.fines))
            
            .attr("fill", d => {
                if (globalFilter.year === "All") return "var(--primary-color)"; 
                return +globalFilter.year === d.year ? "var(--primary-color)" : "#e0d8d0"; 
            })
            // 🚨 PHÉP THUẬT UX NẰM CHỖ NÀY: Giảm opacity các cột bình thường, tô đậm cột Max
            .style("opacity", d => {
                // Nếu đang dùng Dropdown chọn năm -> Đứa nào được chọn thì rõ 100%, còn lại mờ 40%
                if (globalFilter.year !== "All") {
                    return +globalFilter.year === d.year ? 1 : 0.4;
                }
                // Nếu xem All -> Cột cao nhất rõ 100%, mấy cột lùn mờ đi xíu (50%)
                return d.fines === maxFines ? 1 : 0.4;
            });
    };

    // ==========================================
    // 🚀 KHỞI ĐỘNG HỆ THỐNG TOÀN CỤC
    // ==========================================
    setTimeout(() => {
        triggerGlobalUpdate();
    }, 50);

});