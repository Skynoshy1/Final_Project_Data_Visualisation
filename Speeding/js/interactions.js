"use strict";

(function setupSpeedingInteractions() {
  const app = window.SpeedingDashboard;

  window.SpeedingDashboard.bindFilterInteractions = function bindFilterInteractions(
    yearSelect,
    locSelect,
    resetButton,
  ) {
    yearSelect.on("change", function onYearChange() {
      app.globalFilter.year = this.value;
      app.triggerGlobalUpdate();
    });
    locSelect.on("change", function onLocationChange() {
      app.globalFilter.location = this.value;
      app.triggerGlobalUpdate();
    });

    if (!resetButton) return;
    resetButton.addEventListener("click", () => {
      yearSelect.property("value", "All");
      locSelect.property("value", "All");
      app.globalFilter.year = "All";
      app.globalFilter.location = "All";
      app.globalFilter.jurisdiction = "All";
      if (typeof app.clearMapActive === "function") app.clearMapActive();
      app.triggerGlobalUpdate();
    });
  };
})();
