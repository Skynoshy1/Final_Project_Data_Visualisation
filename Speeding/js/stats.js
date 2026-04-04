"use strict";

(function setupSpeedingStats() {
  const app = window.SpeedingDashboard;

  window.SpeedingDashboard.initStats = function initStats(data) {
    window.updateStats = function updateStats() {
      let filteredData = data;
      if (app.globalFilter.jurisdiction !== "All") {
        filteredData = filteredData.filter((d) =>
          app.matchJurisdiction(d.JURISDICTION, app.globalFilter.jurisdiction),
        );
      }
      if (app.globalFilter.year !== "All") {
        filteredData = filteredData.filter((d) => d.YEAR === +app.globalFilter.year);
      }
      if (app.globalFilter.location !== "All") {
        filteredData = filteredData.filter((d) =>
          app.matchLocation(d.LOCATION, app.globalFilter.location),
        );
      }

      const totalFines = d3.sum(filteredData, (d) => d.FINES);
      const totalTickets = filteredData.length;
      const severityIndex = totalTickets > 0 ? (totalFines / totalTickets).toFixed(2) : 0;

      const cameraFines = d3.sum(
        filteredData.filter((d) => d.DETECTION_TYPE === "Camera Issued"),
        (d) => d.FINES,
      );
      const policeFines = d3.sum(
        filteredData.filter((d) => d.DETECTION_TYPE === "Police Issued"),
        (d) => d.FINES,
      );

      d3.select("#headline-fines").text(app.formatNum(totalFines));
      d3
        .select("#headline-label")
        .text(
          app.globalFilter.year !== "All"
            ? `Total fines, ${app.globalFilter.year}`
            : "Total fines, all years",
        );
      d3.select("#headline-severity").text(`$${app.formatNum(Math.round(severityIndex))}`);
      d3.select("#headline-camera").text(app.formatNum(cameraFines));
      d3.select("#headline-police").text(app.formatNum(policeFines));
    };
  };
})();
