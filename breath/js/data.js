"use strict";

(function setupDataLayer() {
  const { STATE_CODE_TO_NAME, STATE_NAME_TO_CODE, STATE_ORDER } = window.BreathDashboardConfig;
  const { toNumber, uniqueSorted } = window.BreathDashboardUtils;

  async function loadWorkbookData() {
    const response = await fetch("./breath_test_FIXED.xlsx");
    if (!response.ok) {
      throw new Error("Could not fetch breath_test_FIXED.xlsx");
    }

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    console.log("Available sheets:", Object.keys(workbook.Sheets));

    const mainSheet = workbook.Sheets.ALL_REGIONS_RATE_CORRECT;
    const locationSheet = workbook.Sheets.LOCATION_2023_2024_FIXED;
    if (!mainSheet || !locationSheet) {
      console.error("Missing sheets:", { mainSheet, locationSheet });
      throw new Error("Required sheet missing from workbook.");
    }

    const mainRows = XLSX.utils.sheet_to_json(mainSheet, { defval: null });
    const locationRows = XLSX.utils.sheet_to_json(locationSheet, { defval: null });

    const mainRecords = mainRows
      .filter((row) => {
        const location = String(row.LOCATION || "").trim().toLowerCase();
        const ageGroup = String(row.AGE_GROUP || "").trim().toLowerCase();
        return location === "all regions" && ageGroup === "all ages";
      })
      .map((row) => {
        const year = toNumber(row.YEAR);
        const jurisdiction = normalizeJurisdiction(row.JURISDICTION);
        const countTotal = toNumber(row.COUNT_total);
        const countPositive = toNumber(row.COUNT_positive);
        const fines = toNumber(row.FINES);
        const charges = toNumber(row.CHARGES);
        const arrests = toNumber(row.ARRESTS);
        const positiveRate = countTotal > 0 ? (countPositive / countTotal) * 100 : null;

        return {
          year,
          jurisdiction,
          countTotal,
          countPositive,
          fines,
          charges,
          arrests,
          positiveRate,
        };
      })
      .filter((row) => Number.isFinite(row.year) && row.jurisdiction);

    const locationRecords = locationRows
      .map((row) => {
        const year = toNumber(row.YEAR);
        const jurisdiction = normalizeJurisdiction(row.JURISDICTION);
        const location = String(row.LOCATION || "").trim();
        const rateReliable = String(row.RATE_RELIABLE || "").trim().toUpperCase() === "YES";
        const countPositive = toNumber(row.COUNT_positive);
        const countTotalSum = toNumber(row.COUNT_total_SUM);
        const countTotalUnique = toNumber(row.COUNT_total_UNIQUE);
        const arrests = toNumber(row.ARRESTS);
        const charges = toNumber(row.CHARGES);
        const locationPositiveRate =
          countTotalSum > 0 ? (countPositive / countTotalSum) * 100 : null;
        const efficiencyRatio = countPositive > 0 ? countTotalSum / countPositive : null;

        return {
          year,
          jurisdiction,
          location,
          rateReliable,
          countPositive,
          countTotalSum,
          countTotalUnique,
          arrests,
          charges,
          locationPositiveRate,
          efficiencyRatio,
        };
      })
      .filter((row) => Number.isFinite(row.year) && row.jurisdiction);

    return { mainRecords, locationRecords };
  }

  async function loadGeoJson() {
    try {
      const response = await fetch("../Drug/data/au-states.geojson");
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.warn("GeoJSON unavailable, using fallback map.", error);
      return null;
    }
  }

  function buildMainIndex(mainRecords) {
    const index = new Map();
    mainRecords.forEach((record) => {
      index.set(`${record.year}|${record.jurisdiction}`, record);
    });
    return index;
  }

  function populateFilters(refs, mainRecords, locationRecords) {
    const mainYears = uniqueSorted(mainRecords.map((row) => row.year));
    const locationYears = uniqueSorted(locationRecords.map((row) => row.year));
    const allYears = uniqueSorted([...mainYears, ...locationYears]);

    refs.yearFilter.innerHTML = "";
    refs.yearFilter.appendChild(createOption("ALL", "All years"));
    allYears.forEach((year) => {
      refs.yearFilter.appendChild(createOption(String(year), String(year)));
    });
    refs.yearFilter.value = "ALL";

    refs.locationFilter.innerHTML = "";
    refs.locationFilter.appendChild(createOption("ALL", "All regions"));
    ["Major Cities", "Regional", "Remote"].forEach((location) => {
      refs.locationFilter.appendChild(createOption(location, location));
    });
    refs.locationFilter.value = "ALL";
  }

  function createOption(value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    return option;
  }

  function buildContext(app) {
    const { state, mainRecords, locationRecords, mainYearStateIndex } = app;
    const selectedYear = state.selectedYear;
    const selectedLocation = state.selectedLocation || "ALL";
    const jurisdiction = state.jurisdiction;
    const selectedState = state.selectedState;
    const scenario3Year = state.scenario3Year;
    const mainYears = uniqueSorted(mainRecords.map((row) => row.year));
    const mainYearStart = mainYears[0] || null;
    const mainYearEnd = mainYears[mainYears.length - 1] || null;
    const aggregatePeriodLabel =
      mainYearStart && mainYearEnd ? `${mainYearStart}-${mainYearEnd}` : "No data";

    const isAllYears = selectedYear === "ALL";
    const snapshotYear = isAllYears ? null : selectedYear;
    const snapshotDisplayLabel = isAllYears ? aggregatePeriodLabel : String(selectedYear);
    const isSingleJurisdiction = jurisdiction !== "ALL";
    const mapFocusState = isSingleJurisdiction ? jurisdiction : selectedState;

    const mapData = isAllYears
      ? buildMapDataAggregate(mainYearStart, mainYearEnd, "ALL", mainRecords)
      : buildMapDataForYear(snapshotYear, "ALL", mainYearStateIndex);

    const rankingData = isAllYears
      ? buildRankingDataAggregate(
          mainYearStart,
          mainYearEnd,
          jurisdiction,
          state.rankingMetric,
          mainRecords,
        )
      : buildRankingDataForYear(
          snapshotYear,
          jurisdiction,
          state.rankingMetric,
          mainRecords,
        );
    const rankingComparisonData = isAllYears
      ? buildRankingDataAggregate(
          mainYearStart,
          mainYearEnd,
          "ALL",
          state.rankingMetric,
          mainRecords,
        )
      : buildRankingDataForYear(
          snapshotYear,
          "ALL",
          state.rankingMetric,
          mainRecords,
        );

    const trendScope = selectedState || (jurisdiction !== "ALL" ? jurisdiction : "ALL");
    const trendData = buildTrendData(trendScope, mainRecords, mainYearStateIndex);

    const kpiScope = selectedState || (jurisdiction !== "ALL" ? jurisdiction : "ALL");
    const kpiCurrent = isAllYears
      ? aggregateMainForPeriod(mainYearStart, mainYearEnd, kpiScope, mainRecords)
      : aggregateMainForYear(snapshotYear, kpiScope, mainRecords);
    const kpiPrevious = isAllYears
      ? null
      : aggregateMainForYear(snapshotYear - 1, kpiScope, mainRecords);
    const snapshotNational = isAllYears
      ? aggregateMainForPeriod(mainYearStart, mainYearEnd, "ALL", mainRecords)
      : aggregateMainForYear(snapshotYear, "ALL", mainRecords);

    const scenario3Data = buildScenario3LocationData(
      scenario3Year,
      jurisdiction,
      selectedLocation,
      locationRecords,
    );
    const scenario3GlobalYearMismatch =
      selectedYear === "ALL" || (Number.isFinite(selectedYear) && selectedYear < 2023);

    return {
      selectedYear,
      selectedLocation,
      isAllYears,
      snapshotYear,
      snapshotDisplayLabel,
      aggregatePeriodLabel,
      mainYearStart,
      mainYearEnd,
      jurisdiction,
      isSingleJurisdiction,
      selectedState,
      mapFocusState,
      mapData,
      rankingData,
      rankingComparisonData,
      trendData,
      trendScope,
      kpiScope,
      kpiCurrent,
      kpiPrevious,
      snapshotNational,
      scenario3Year,
      scenario3GlobalYearMismatch,
      scenario3Data,
    };
  }

  function buildMapDataForYear(snapshotYear, jurisdiction, mainYearStateIndex) {
    const mapData = new Map();
    STATE_ORDER.forEach((code) => {
      if (!Number.isFinite(snapshotYear)) {
        mapData.set(code, null);
        return;
      }
      if (jurisdiction !== "ALL" && code !== jurisdiction) {
        mapData.set(code, null);
        return;
      }
      const row = mainYearStateIndex.get(`${snapshotYear}|${code}`);
      mapData.set(code, row || null);
    });
    return mapData;
  }

  function buildMapDataAggregate(startYear, endYear, jurisdiction, mainRecords) {
    const mapData = new Map();
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
      STATE_ORDER.forEach((code) => mapData.set(code, null));
      return mapData;
    }

    const grouped = d3.rollup(
      mainRecords.filter(
        (row) =>
          row.year >= startYear &&
          row.year <= endYear &&
          (jurisdiction === "ALL" || row.jurisdiction === jurisdiction),
      ),
      (rows) => aggregateRows(rows),
      (row) => row.jurisdiction,
    );

    STATE_ORDER.forEach((code) => {
      if (jurisdiction !== "ALL" && code !== jurisdiction) {
        mapData.set(code, null);
        return;
      }
      mapData.set(code, grouped.get(code) || null);
    });

    return mapData;
  }

  function buildRankingDataForYear(snapshotYear, jurisdiction, rankingMetric, mainRecords) {
    if (!Number.isFinite(snapshotYear)) {
      return [];
    }

    const data = mainRecords.filter((row) => {
      const yearMatch = row.year === snapshotYear;
      const jurisdictionMatch = jurisdiction === "ALL" || row.jurisdiction === jurisdiction;
      return yearMatch && jurisdictionMatch;
    });

    return data
      .map((row) => ({
        ...row,
        metricValue: rankingMetric === "POSITIVE_RATE" ? row.positiveRate : row.countTotal,
      }))
      .filter((row) => Number.isFinite(row.metricValue))
      .sort((a, b) => d3.descending(a.metricValue, b.metricValue));
  }

  function buildRankingDataAggregate(
    startYear,
    endYear,
    jurisdiction,
    rankingMetric,
    mainRecords,
  ) {
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
      return [];
    }

    const grouped = d3.rollup(
      mainRecords.filter(
        (row) =>
          row.year >= startYear &&
          row.year <= endYear &&
          (jurisdiction === "ALL" || row.jurisdiction === jurisdiction),
      ),
      (rows) => aggregateRows(rows),
      (row) => row.jurisdiction,
    );

    return Array.from(grouped, ([jurisdictionCode, aggregate]) => ({
      ...aggregate,
      jurisdiction: jurisdictionCode,
      metricValue:
        rankingMetric === "POSITIVE_RATE" ? aggregate.positiveRate : aggregate.countTotal,
    }))
      .filter((row) => Number.isFinite(row.metricValue))
      .sort((a, b) => d3.descending(a.metricValue, b.metricValue));
  }

  function buildTrendData(scope, mainRecords, mainYearStateIndex) {
    const years = uniqueSorted(mainRecords.map((row) => row.year));

    if (scope === "ALL") {
      return years
        .map((year) => {
          const aggregate = aggregateMainForYear(year, "ALL", mainRecords);
          if (!aggregate) {
            return null;
          }
          return {
            year,
            countTotal: aggregate.countTotal,
            countPositive: aggregate.countPositive,
            positiveRate: aggregate.positiveRate,
          };
        })
        .filter(Boolean);
    }

    return years
      .map((year) => mainYearStateIndex.get(`${year}|${scope}`) || null)
      .filter(Boolean)
      .map((row) => ({
        year: row.year,
        countTotal: row.countTotal,
        countPositive: row.countPositive,
        positiveRate: row.positiveRate,
      }));
  }

  function buildScenario3LocationData(selectedYear, jurisdiction, selectedLocation, locationRecords) {
    const categoryOrder = ["Major Cities", "Regional", "Remote"];
    const filteredRows = locationRecords
      .filter((row) => row.year === selectedYear)
      .filter((row) => jurisdiction === "ALL" || row.jurisdiction === jurisdiction)
      .filter((row) => {
        if (selectedLocation === "ALL") return true;
        return toLocationCategory(row.location) === selectedLocation;
      });

    const scopedRows = filteredRows.filter((row) => row.rateReliable);

    if (!scopedRows.length) {
      return [];
    }

    const grouped = d3.rollup(
      scopedRows,
      (rows) => {
        const countTotalSum = d3.sum(rows, (row) => row.countTotalSum);
        const countPositive = d3.sum(rows, (row) => row.countPositive);
        return {
          countTotalSum,
          countPositive,
          locationPositiveRate: countTotalSum > 0 ? (countPositive / countTotalSum) * 100 : null,
          records: rows.length,
        };
      },
      (row) => toLocationCategory(row.location),
    );

    return categoryOrder.map((locationCategory) => {
      const aggregate = grouped.get(locationCategory);
      if (!aggregate) {
        return {
          year: selectedYear,
          locationCategory,
          countTotalSum: 0,
          countPositive: 0,
          locationPositiveRate: null,
          records: 0,
          hasData: false,
        };
      }

      return {
        year: selectedYear,
        locationCategory,
        countTotalSum: aggregate.countTotalSum,
        countPositive: aggregate.countPositive,
        locationPositiveRate: aggregate.locationPositiveRate,
        records: aggregate.records,
        hasData: Number.isFinite(aggregate.locationPositiveRate) && aggregate.countTotalSum > 0,
      };
    });
  }

  function toLocationCategory(rawLocation) {
    const value = String(rawLocation || "").trim().toLowerCase();
    if (value.includes("major")) {
      return "Major Cities";
    }
    if (value.includes("remote")) {
      return "Remote";
    }
    if (value.includes("regional") || value.includes("unknown")) {
      return "Regional";
    }
    return "Regional";
  }

  function aggregateMainForYear(year, scope, mainRecords) {
    if (!Number.isFinite(year)) {
      return null;
    }

    const rows = mainRecords.filter((row) => {
      const yearMatch = row.year === year;
      const scopeMatch = scope === "ALL" || row.jurisdiction === scope;
      return yearMatch && scopeMatch;
    });

    return aggregateRows(rows);
  }

  function aggregateMainForPeriod(startYear, endYear, scope, mainRecords) {
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
      return null;
    }

    const rows = mainRecords.filter((row) => {
      const yearMatch = row.year >= startYear && row.year <= endYear;
      const scopeMatch = scope === "ALL" || row.jurisdiction === scope;
      return yearMatch && scopeMatch;
    });

    return aggregateRows(rows);
  }

  function aggregateRows(rows) {
    if (!rows.length) {
      return null;
    }

    const countTotal = d3.sum(rows, (row) => row.countTotal);
    const countPositive = d3.sum(rows, (row) => row.countPositive);
    const positiveRate = countTotal > 0 ? (countPositive / countTotal) * 100 : null;

    return {
      countTotal,
      countPositive,
      positiveRate,
    };
  }

  function normalizeJurisdiction(rawValue) {
    if (rawValue === null || rawValue === undefined) {
      return "";
    }

    const value = String(rawValue).trim();
    const upper = value.toUpperCase();
    if (STATE_CODE_TO_NAME[upper]) {
      return upper;
    }

    const titleCase = value
      .toLowerCase()
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    return STATE_NAME_TO_CODE[titleCase] || "";
  }

  window.BreathDashboardData = {
    loadWorkbookData,
    loadGeoJson,
    buildMainIndex,
    populateFilters,
    buildContext,
  };
})();
