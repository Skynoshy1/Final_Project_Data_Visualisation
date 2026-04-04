"use strict";

(function setupSpeedingData() {
  const app = window.SpeedingDashboard;

  d3.csv("data/Speeding.csv").then((raw) => {
    const data = raw.map((d) => {
      const row = { ...d };
      row.YEAR = +row.YEAR;
      row.FINES = +row["Sum(FINES)"];

      const loc = row.LOCATION;
      if (!loc || loc.trim() === "" || loc === "Unknown") {
        row.LOCATION = "Not Specified";
      } else {
        row.LOCATION = loc.replace(/\b(of |in )?Australia\b/gi, "").trim();
      }
      return row;
    });

    app.data = data;
    app.formatNum = d3.format(",");

    const uniqueYears = [...new Set(data.map((d) => d.YEAR))].filter(Boolean).sort();
    const yearSelect = d3.select("#yearSelect");
    uniqueYears.forEach((y) => {
      yearSelect.append("option").text(y).attr("value", y);
    });

    const locationGroups = new Map();
    data.forEach((d) => {
      let group = d.LOCATION;
      if (group === "Inner Regional" || group === "Outer Regional") {
        group = "Regional";
      } else if (group === "Remote" || group === "Very Remote") {
        group = "Remote";
      }
      locationGroups.set(group, true);
    });
    const uniqueLocations = Array.from(locationGroups.keys())
      .filter((l) => l && l !== "Not Specified")
      .sort();
    const locSelect = d3.select("#locationSelect");
    locSelect.append("option").text("All Locations").attr("value", "All");
    uniqueLocations.forEach((l) => {
      locSelect.append("option").text(l).attr("value", l);
    });

    const resetButton = document.getElementById("reset-button");
    if (typeof app.bindFilterInteractions === "function") {
      app.bindFilterInteractions(yearSelect, locSelect, resetButton);
    }

    if (typeof app.initChart3 === "function") app.initChart3(data);
    if (typeof app.initChart1 === "function") app.initChart1(data);
    if (typeof app.initChart2 === "function") app.initChart2(data);
    if (typeof app.initStats === "function") app.initStats(data);

    setTimeout(() => {
      app.triggerGlobalUpdate();
    }, 50);
  });
})();
