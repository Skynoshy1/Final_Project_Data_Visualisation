function drawAgeChart(data, elementId) {
  const state = document.getElementById("state-select")?.value || "all";

  // This chart focuses on age groups because age detail is only meaningful
  // in the recent rows where the CSV includes Age_Groups breakdown.
  let ageData = data.filter(
    (d) => d[COLS.year] === 2023 || d[COLS.year] === 2024,
  );

  if (state !== "all") {
    ageData = ageData.filter((d) => d[COLS.jurisdiction] === state);
  }

  const hasAgeData = ageData.some(
    (d) => d[COLS.ageGroups] && d[COLS.ageGroups] !== "All ages(1)",
  );

  d3.select(`#${elementId}`).selectAll("*").remove();

  if (!hasAgeData) {
    d3.select(`#${elementId}`)
      .append("div")
      .style("text-align", "center")
      .style("padding", "90px 16px")
      .style("color", "#7a7a7a")
      .html(
        "Age data only exists in detailed recent rows.<br>Select all states or a state with 2023-2024 breakdown.",
      );
    return;
  }

  const ages2023 = {};
  const ages2024 = {};

  ageData.forEach((d) => {
    const ageString = d[COLS.ageGroups];

    if (!ageString || ageString === "All ages(1)") {
      return;
    }

    // Example source format:
    // 17-25(346), 26-39(369), 40-64(307), 65 and over(65), 0-16(18)
    const pattern = /(\d+-\d+|0-16|65 and over)\((\d+)\)/g;
    let match;

    while ((match = pattern.exec(ageString)) !== null) {
      let group = match[1];
      const count = +match[2];

      if (group === "65 and over") {
        group = "65+";
      }

      if (d[COLS.year] === 2023) {
        ages2023[group] = (ages2023[group] || 0) + count;
      } else if (d[COLS.year] === 2024) {
        ages2024[group] = (ages2024[group] || 0) + count;
      }
    }
  });

  const groups = ["0-16", "17-25", "26-39", "40-64", "65+"];
  const container = document.getElementById(elementId);
  const chartWidth = container.clientWidth || 420;
  const chartHeight = 450;
  const ageMargin = { top: 60, right: 30, bottom: 50, left: 60 };
  const currentInnerWidth = chartWidth - ageMargin.left - ageMargin.right;
  const currentInnerHeight = chartHeight - ageMargin.top - ageMargin.bottom;

  const svg = d3
    .select(`#${elementId}`)
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight)
    .append("g")
    .attr("transform", `translate(${ageMargin.left},${ageMargin.top})`);

  const xScaleLocal = d3
    .scaleBand()
    .domain(groups)
    .range([0, currentInnerWidth])
    .padding(0.2);

  const maxValue = d3.max([
    ...Object.values(ages2023),
    ...Object.values(ages2024),
    1,
  ]);

  const yScaleLocal = d3
    .scaleLinear()
    .domain([0, maxValue * 1.1])
    .nice()
    .range([currentInnerHeight, 0]);

  // Left half of each band = 2023, right half = 2024.
  svg
    .selectAll(".bar2023")
    .data(groups)
    .enter()
    .append("rect")
    .attr("x", (d) => xScaleLocal(d))
    .attr("y", (d) => yScaleLocal(ages2023[d] || 0))
    .attr("width", xScaleLocal.bandwidth() / 2)
    .attr("height", 0)
    .attr("fill", CHART_COLORS.year2023)
    .on("mouseenter", function (event, d) {
      showTooltip(
        event,
        `<strong>${d} • 2023</strong>
         <div>Cases: ${formatNumber(ages2023[d] || 0)}</div>`,
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(650)
    .ease(d3.easeCubicOut)
    .attr("height", (d) => currentInnerHeight - yScaleLocal(ages2023[d] || 0));

  svg
    .selectAll(".bar2024")
    .data(groups)
    .enter()
    .append("rect")
    .attr("x", (d) => xScaleLocal(d) + xScaleLocal.bandwidth() / 2)
    .attr("y", (d) => yScaleLocal(ages2024[d] || 0))
    .attr("width", xScaleLocal.bandwidth() / 2)
    .attr("height", 0)
    .attr("fill", CHART_COLORS.year2024)
    .on("mouseenter", function (event, d) {
      showTooltip(
        event,
        `<strong>${d} • 2024</strong>
         <div>Cases: ${formatNumber(ages2024[d] || 0)}</div>`,
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip)
    .transition()
    .delay(120)
    .duration(650)
    .ease(d3.easeCubicOut)
    .attr("height", (d) => currentInnerHeight - yScaleLocal(ages2024[d] || 0));

  svg
    .append("g")
    .attr("transform", `translate(0,${currentInnerHeight})`)
    .call(d3.axisBottom(xScaleLocal));

  svg.append("g").call(d3.axisLeft(yScaleLocal));

  // Small legend kept directly inside the SVG to avoid extra HTML.
  svg
    .append("rect")
    .attr("x", currentInnerWidth - 90)
    .attr("y", -30)
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", CHART_COLORS.year2023);

  svg
    .append("text")
    .attr("x", currentInnerWidth - 74)
    .attr("y", -20)
    .text("2023");

  svg
    .append("rect")
    .attr("x", currentInnerWidth - 90)
    .attr("y", -10)
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", CHART_COLORS.year2024);

  svg
    .append("text")
    .attr("x", currentInnerWidth - 74)
    .attr("y", 0)
    .text("2024");
}
