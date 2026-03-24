let dashboardTooltip = null;

function ensureTooltip() {
  if (!dashboardTooltip) {
    dashboardTooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip");
  }

  return dashboardTooltip;
}

function showTooltip(event, html) {
  const tooltip = ensureTooltip();

  tooltip
    .html(html)
    .style("opacity", 1)
    .style("left", `${event.pageX}px`)
    .style("top", `${event.pageY}px`);
}

function moveTooltip(event) {
  if (!dashboardTooltip) return;

  dashboardTooltip
    .style("left", `${event.pageX}px`)
    .style("top", `${event.pageY}px`);
}

function hideTooltip() {
  if (!dashboardTooltip) return;
  dashboardTooltip.style("opacity", 0);
}

function animateChartContainers() {
  d3.selectAll(".chart-container")
    .classed("chart-is-updating", true);

  window.setTimeout(() => {
    d3.selectAll(".chart-container")
      .classed("chart-is-updating", false);
  }, 320);
}
