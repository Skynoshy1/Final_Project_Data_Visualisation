(function setupSharedDashboardConstants() {
  const australiaStateCodeToName = {
    ACT: "Australian Capital Territory",
    NSW: "New South Wales",
    NT: "Northern Territory",
    QLD: "Queensland",
    SA: "South Australia",
    TAS: "Tasmania",
    VIC: "Victoria",
    WA: "Western Australia",
  };

  window.SharedDashboardConstants = {
    layout: {
      width: 900,
      height: 450,
      margin: { top: 60, right: 70, bottom: 60, left: 70 },
    },
    australiaStateCodeToName,
    australiaStateNameMap: australiaStateCodeToName,
    australiaStateNameToCode: Object.fromEntries(
      Object.entries(australiaStateCodeToName).map(([code, name]) => [name, code]),
    ),
    australiaStateOrder: ["WA", "NT", "SA", "QLD", "NSW", "VIC", "TAS", "ACT"],
    baseColors: {
      primary: "#EE9B00",
      primaryDark: "#c27d00",
      secondary: "#5C4D3C",
      neutral: "#f1e7d6",
      effective: "#4CAF50",
      moderate: "#FFC107",
      ineffective: "#FF5252",
    },
  };
})();
