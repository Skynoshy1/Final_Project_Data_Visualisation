"use strict";

window.SpeedingDashboard = window.SpeedingDashboard || {};

window.SpeedingDashboard.globalFilter = {
  jurisdiction: "All",
  year: "All",
  location: "All",
};

window.SpeedingDashboard.mapZoomPadding = 24;
window.SpeedingDashboard.speedingGeoData = null;
window.SpeedingDashboard.speedingGeoJsonFeatures = null;
window.SpeedingDashboard.speedingPathGenerator = null;
window.SpeedingDashboard.data = [];
window.SpeedingDashboard.formatNum = d3.format(",");

window.SpeedingDashboard.reverseStateNameMap = {
  "New South Wales": "NSW",
  Queensland: "QLD",
  "South Australia": "SA",
  Tasmania: "TAS",
  Victoria: "VIC",
  "Western Australia": "WA",
  "Australian Capital Territory": "ACT",
  "Northern Territory": "NT",
};

window.SpeedingDashboard.matchJurisdiction = function matchJurisdiction(csvVal, filterVal) {
  if (filterVal === "All") return true;
  if (!csvVal) return false;

  const a = csvVal.trim().toLowerCase();
  const b = filterVal.trim().toLowerCase();

  const stateMap = {
    "new south wales": "nsw",
    victoria: "vic",
    queensland: "qld",
    "south australia": "sa",
    "western australia": "wa",
    tasmania: "tas",
    "northern territory": "nt",
    "australian capital territory": "act",
  };
  return a === b || a === stateMap[b] || stateMap[a] === b;
};

window.SpeedingDashboard.matchLocation = function matchLocation(dLoc, filterLoc) {
  if (filterLoc === "All") return true;
  if (Array.isArray(filterLoc)) return filterLoc.includes(dLoc);

  if (filterLoc === "Regional") {
    return dLoc === "Inner Regional" || dLoc === "Outer Regional";
  }
  if (filterLoc === "Remote") {
    return dLoc === "Remote" || dLoc === "Very Remote";
  }

  return dLoc === filterLoc;
};

window.SpeedingDashboard.getFeatureStateName = function getFeatureStateName(feature) {
  return (
    feature.properties.STATE_NAME ||
    feature.properties.ste_name ||
    feature.properties.name ||
    feature.properties.STATE ||
    "Unknown State"
  );
};

window.SpeedingDashboard.buildSpeedingPathGenerator = function buildSpeedingPathGenerator() {
  const app = window.SpeedingDashboard;
  if (!app.speedingGeoData) return null;

  const projection = d3.geoMercator();
  const selectedFeature =
    app.globalFilter.jurisdiction === "All"
      ? null
      : app.speedingGeoData.features.find((feature) =>
          app.matchJurisdiction(app.getFeatureStateName(feature), app.globalFilter.jurisdiction),
        );

  if (selectedFeature) {
    projection.fitExtent(
      [
        [app.mapZoomPadding, app.mapZoomPadding],
        [app.mapWidth - app.mapZoomPadding, app.mapHeight - app.mapZoomPadding],
      ],
      selectedFeature,
    );
  } else {
    projection.fitExtent(
      [
        [app.mapZoomPadding, app.mapZoomPadding],
        [app.mapWidth - app.mapZoomPadding, app.mapHeight - app.mapZoomPadding],
      ],
      app.speedingGeoData,
    );
  }

  return d3.geoPath().projection(projection);
};

window.SpeedingDashboard.triggerGlobalUpdate = function triggerGlobalUpdate() {
  if (typeof window.updateChart3 === "function") {
    const currentToggle = d3.select(".toggle-btn.active").attr("data-view") || "All";
    window.updateChart3(currentToggle);
  }
  if (typeof window.updateChart1 === "function") window.updateChart1();
  if (typeof window.updateChart2 === "function") window.updateChart2();
  if (typeof window.updateStats === "function") window.updateStats();
  if (typeof window.updateMap === "function") window.updateMap();
};
