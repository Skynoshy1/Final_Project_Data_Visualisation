"use strict";

const sharedConstants = window.SharedDashboardConstants || {};
const sharedStateCodeToName =
  sharedConstants.australiaStateCodeToName || sharedConstants.australiaStateNameMap || {};
const stateCodeToName = Object.keys(sharedStateCodeToName).length
  ? sharedStateCodeToName
  : {
      ACT: "Australian Capital Territory",
      NSW: "New South Wales",
      NT: "Northern Territory",
      QLD: "Queensland",
      SA: "South Australia",
      TAS: "Tasmania",
      VIC: "Victoria",
      WA: "Western Australia",
    };

window.BreathDashboardConfig = {
  COLORS: {
    neutralLight: "#A8B3C2",
    neutralMid: "#7B8794",
    neutralDark: "#4B5563",
    riskScale: ["#F6C36B", "#E89A2E", "#C96A12", "#8A3F00"],
    missing: "#D1D5DB",
  },
  STATE_CODE_TO_NAME: stateCodeToName,
  STATE_ORDER: sharedConstants.australiaStateOrder || ["WA", "NT", "SA", "QLD", "NSW", "VIC", "TAS", "ACT"],
  FALLBACK_MAP_SHAPES: [
    { code: "WA", path: "M40,120 L250,120 L250,320 L135,410 L40,320 Z", label: [130, 255] },
    { code: "NT", path: "M250,120 L390,120 L390,230 L250,230 Z", label: [320, 178] },
    { code: "SA", path: "M250,230 L390,230 L390,370 L250,370 Z", label: [320, 300] },
    { code: "QLD", path: "M390,120 L570,120 L600,250 L520,305 L390,230 Z", label: [495, 200] },
    { code: "NSW", path: "M390,230 L520,305 L520,380 L430,410 L390,360 Z", label: [455, 322] },
    { code: "VIC", path: "M390,360 L430,410 L470,430 L430,468 L368,435 Z", label: [420, 422] },
    { code: "TAS", path: "M472,463 L526,468 L534,510 L480,516 Z", label: [503, 494] },
    { code: "ACT", path: "M460,342 L470,342 L470,352 L460,352 Z", label: [465, 338] },
  ],
};

window.BreathDashboardConfig.STATE_NAME_TO_CODE =
  sharedConstants.australiaStateNameToCode ||
  Object.fromEntries(
    Object.entries(window.BreathDashboardConfig.STATE_CODE_TO_NAME).map(([code, name]) => [name, code]),
  );
