"use strict";

(function setupChartHelpers() {
  const MOTION = {
    durationFast: 220,
    durationBase: 340,
    durationSlow: 520,
    ease: d3.easeCubicOut,
  };

  function showTooltip(event, html, refs) {
    refs.tooltip.innerHTML = html;
    refs.tooltip.classList.remove("hidden");
    moveTooltip(event, refs);
  }

  function moveTooltip(event, refs) {
    if (refs.tooltip.classList.contains("hidden")) {
      return;
    }

    const offset = 14;
    const tooltipWidth = refs.tooltip.offsetWidth || 220;
    const tooltipHeight = refs.tooltip.offsetHeight || 80;
    const maxX = window.innerWidth - tooltipWidth - 8;
    const maxY = window.innerHeight - tooltipHeight - 8;
    const left = Math.min(maxX, event.clientX + offset);
    const top = Math.min(maxY, event.clientY + offset);

    refs.tooltip.style.left = `${left}px`;
    refs.tooltip.style.top = `${top}px`;
  }

  function hideTooltip(refs) {
    refs.tooltip.classList.add("hidden");
  }

  function renderEmptyState(container, message) {
    container.innerHTML = "";
    const empty = document.createElement("div");
    empty.className =
      "flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-[#e7ddce] bg-[#fbf8f2] px-4 text-center text-sm text-[#7B6F62]";
    empty.textContent = message;
    container.appendChild(empty);
  }

  function getLocationColor(category) {
    if (category === "Major Cities") {
      return "#F6C36B";
    }
    if (category === "Remote") {
      return "#8A3F00";
    }
    return "#E89A2E";
  }

  window.BreathChartHelpers = {
    MOTION,
    showTooltip,
    hideTooltip,
    renderEmptyState,
    getLocationColor,
  };
})();
