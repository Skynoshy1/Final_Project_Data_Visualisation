let drugData = [];
const { formatNumber, formatPercent, parseNumericFields } = window.SharedDashboardUtils || {};

function populateDashboardFilters(data) {
  const stateSelect = document.getElementById("state-select");
  const yearSelect = document.getElementById("year-select");
  const ratingSelect = document.getElementById("rating-select");

  stateSelect.innerHTML = filters_jurisdiction
    .map((item) => `<option value="${item.id}">${item.label}</option>`)
    .join("");

  yearSelect.innerHTML = [`<option value="all">All years</option>`]
    .concat(yearOptions.map((year) => `<option value="${year}">${year}</option>`))
    .join("");

  ratingSelect.innerHTML = filters_rating
    .map((item) => `<option value="${item.id}">${item.label}</option>`)
    .join("");

  stateSelect.value = "all";
  yearSelect.value = "all";
  ratingSelect.value = "all";
}

function getFilteredData(data) {
  const selectedState = document.getElementById("state-select")?.value || "all";
  const selectedYear = document.getElementById("year-select")?.value || "all";
  const selectedRating = document.getElementById("rating-select")?.value || "all";

  return data.filter((d) => {
    const matchState =
      selectedState === "all" || d[COLS.jurisdiction] === selectedState;
    const matchYear =
      selectedYear === "all" || d[COLS.year] === +selectedYear;
    const matchRating =
      selectedRating === "all" || d[COLS.rating] === selectedRating;

    return matchState && matchYear && matchRating;
  });
}

function getTrendFilteredData(data) {
  const selectedState = document.getElementById("state-select")?.value || "all";
  const selectedRating = document.getElementById("rating-select")?.value || "all";

  return data.filter((d) => {
    const matchState =
      selectedState === "all" || d[COLS.jurisdiction] === selectedState;
    const matchRating =
      selectedRating === "all" || d[COLS.rating] === selectedRating;

    return matchState && matchRating;
  });
}

function updateSummaryCards(data) {
  const tests = d3.sum(data, (d) => d[COLS.totalTest]);
  const positives = d3.sum(data, (d) => d[COLS.totalPositive]);
  const fines = d3.sum(data, (d) => d[COLS.fines]);
  const arrests = d3.sum(data, (d) => d[COLS.arrests]);
  const charges = d3.sum(data, (d) => d[COLS.charges]);
  const rate = tests ? (positives / tests) * 100 : 0;

  const selectedYear = document.getElementById("year-select")?.value || "all";

  document.getElementById("headline-tests").textContent = formatNumber(tests);
  document.getElementById("headline-label").textContent =
    selectedYear === "all"
      ? "Drug tests conducted, all years"
      : `Drug tests conducted, ${selectedYear}`;
  document.getElementById("headline-rate").textContent = formatPercent(rate);
  document.getElementById("headline-fines").textContent = formatNumber(fines);
  document.getElementById("headline-arrests").textContent = formatNumber(arrests);
  document.getElementById("headline-charges").textContent = formatNumber(charges);
}

function renderDashboard() {
  const filteredData = getFilteredData(drugData);
  const trendData = getTrendFilteredData(drugData);
  updateSummaryCards(filteredData);
  animateChartContainers();

  // Pass filtered data to every chart so axes rescale based on the current selection.
  drawTrendChart(trendData, "chart1");
  drawMapChart(filteredData, "chart2");
  drawAgeChart(drugData, "chart3");
}

function bindDashboardEvents() {
  const stateSelect = document.getElementById("state-select");
  const yearSelect = document.getElementById("year-select");
  const ratingSelect = document.getElementById("rating-select");
  const resetButton = document.getElementById("reset-button");

  [stateSelect, yearSelect, ratingSelect].forEach((element) => {
    element.addEventListener("change", renderDashboard);
  });

  resetButton.addEventListener("click", function () {
    stateSelect.value = "all";
    yearSelect.value = "all";
    ratingSelect.value = "all";
    renderDashboard();
  });

  window.addEventListener("resize", function () {
    renderDashboard();
  });
}

Papa.parse("./data/drug.csv", {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: function (results) {
    drugData = results.data.map((d) =>
      parseNumericFields
        ? parseNumericFields(d, [
            "YEAR",
            "Total_Test",
            "Total_Positive",
            "Fines",
            "Arrests",
            "Charges",
            "Positive_Rate",
          ])
        : {
            ...d,
            YEAR: +d.YEAR,
            Total_Test: +d.Total_Test,
            Total_Positive: +d.Total_Positive,
            Fines: +d.Fines,
            Arrests: +d.Arrests,
            Charges: +d.Charges,
            Positive_Rate: +d.Positive_Rate,
          },
    );

    populateDashboardFilters(drugData);
    bindDashboardEvents();
    renderDashboard();
  },
});
