(function setupSharedDashboardUtils() {
  function formatNumber(value) {
    if (!value && value !== 0) return "N/A";
    return value.toLocaleString();
  }

  function formatPercent(value, digits = 2) {
    if (!value && value !== 0) return "N/A";
    return `${Number(value).toFixed(digits)}%`;
  }

  function parseNumericFields(row, fields) {
    const parsedRow = { ...row };
    fields.forEach((field) => {
      parsedRow[field] = +row[field];
    });
    return parsedRow;
  }

  window.SharedDashboardUtils = {
    formatNumber,
    formatPercent,
    parseNumericFields,
  };
})();
