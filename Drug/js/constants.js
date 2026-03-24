const margin = { top: 60, right: 70, bottom: 60, left: 70 };
const width = 900;
const height = 450;

const filters_jurisdiction = [
  { id: "all", label: "All jurisdictions", isActive: true },
  { id: "NSW", label: "NSW", isActive: false },
  { id: "VIC", label: "VIC", isActive: false },
  { id: "QLD", label: "QLD", isActive: false },
  { id: "SA", label: "SA", isActive: false },
  { id: "WA", label: "WA", isActive: false },
  { id: "TAS", label: "TAS", isActive: false },
  { id: "ACT", label: "ACT", isActive: false },
  { id: "NT", label: "NT", isActive: false },
];

const filters_rating = [
  { id: "all", label: "All ratings", isActive: true },
  { id: "Effective", label: "Effective", isActive: false },
  { id: "Moderate", label: "Moderate", isActive: false },
  { id: "Ineffective", label: "Ineffective", isActive: false },
];

const yearOptions = d3.range(2008, 2025);

const geoJsonPath = "./data/au-states.geojson";

const stateNameMap = {
  ACT: "Australian Capital Territory",
  NSW: "New South Wales",
  NT: "Northern Territory",
  QLD: "Queensland",
  SA: "South Australia",
  TAS: "Tasmania",
  VIC: "Victoria",
  WA: "Western Australia",
};

const CHART_COLORS = {
  bar: "#5C4D3C",
  line: "#EE9B00",
  lineSoft: "#c27d00",
  map: "#EE9B00",
  neutral: "#f1e7d6",
  year2023: "#5C4D3C",
  year2024: "#EE9B00",
};

const COLS = {
  jurisdiction: "JURISDICTION",
  year: "YEAR",
  totalTest: "Total_Test",
  totalPositive: "Total_Positive",
  fines: "Fines",
  arrests: "Arrests",
  charges: "Charges",
  positiveRate: "Positive_Rate",
  rating: "Rating",
  ageGroups: "Age_Groups",
  location: "Location",
};
