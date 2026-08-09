(function () {
  const SIGNAL = "#22F89F";
  const GRAPHITE = "#6f6f6f";
  const GRID = "rgba(255,255,255,0.06)";
  const TICK = "#a6a6a6";

  Chart.defaults.font.family = "Inter, sans-serif";
  Chart.defaults.color = TICK;

  const baseGrid = { color: GRID, drawTicks: false };

  fetch("/api/eda")
    .then((r) => r.json())
    .then((d) => {
      renderCategoryCharts(d.category_approval);
      renderHistograms(d.histograms);
      renderCorrelation(d.correlations);
      renderScatter(d.scatter.credit_vs_risk);
    })
    .catch((err) => console.error(err));

  function renderCategoryCharts(catData) {
    Object.keys(catData).forEach((field) => {
      const el = document.getElementById("chart-" + field);
      if (!el) return;
      const info = catData[field];
      new Chart(el.getContext("2d"), {
        type: "bar",
        data: {
          labels: info.labels,
          datasets: [
            {
              label: "Approval Rate (%)",
              data: info.rates,
              backgroundColor: SIGNAL,
              borderRadius: 6,
              maxBarThickness: 46,
            },
          ],
        },
        options: {
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.parsed.y + "% approved" } } },
          scales: {
            x: { grid: { display: false }, ticks: { color: TICK, font: { size: 11 } } },
            y: { beginAtZero: true, max: Math.max(...info.rates) * 1.4, grid: baseGrid, ticks: { color: TICK } },
          },
        },
      });
    });
  }

  let histChartInstance = null;
  function renderHistograms(histograms) {
    const tabsEl = document.getElementById("histTabs");
    const features = Object.keys(histograms);
    tabsEl.innerHTML = features
      .map((f, i) => `<div class="eda-tab ${i === 0 ? "active" : ""}" data-feature="${f}">${f}</div>`)
      .join("");

    function draw(feature) {
      const info = histograms[feature];
      if (histChartInstance) histChartInstance.destroy();
      histChartInstance = new Chart(document.getElementById("histChart").getContext("2d"), {
        type: "bar",
        data: {
          labels: info.labels,
          datasets: [
            { label: "Approved", data: info.approved, backgroundColor: SIGNAL, borderRadius: 4, maxBarThickness: 28 },
            { label: "Rejected", data: info.rejected, backgroundColor: GRAPHITE, borderRadius: 4, maxBarThickness: 28 },
          ],
        },
        options: {
          plugins: {
            legend: { position: "top", labels: { color: TICK, boxWidth: 12, usePointStyle: true, pointStyle: "circle" } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: TICK, font: { size: 10 } }, title: { display: true, text: feature + " (bin start)", color: GRAPHITE } },
            y: { beginAtZero: true, grid: baseGrid, ticks: { color: TICK } },
          },
        },
      });
    }

    tabsEl.querySelectorAll(".eda-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        tabsEl.querySelectorAll(".eda-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        draw(tab.dataset.feature);
      });
    });

    draw(features[0]);
  }

  function renderCorrelation(corr) {
    const colors = corr.values.map((v) => (v >= 0 ? SIGNAL : "#ff6b6b"));
    new Chart(document.getElementById("corrChart").getContext("2d"), {
      type: "bar",
      data: {
        labels: corr.labels,
        datasets: [{ data: corr.values, backgroundColor: colors, borderRadius: 4, maxBarThickness: 18 }],
      },
      options: {
        indexAxis: "y",
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => "r = " + c.parsed.x } } },
        scales: {
          x: { grid: baseGrid, ticks: { color: TICK } },
          y: { grid: { display: false }, ticks: { color: TICK, font: { size: 11 } } },
        },
      },
    });
  }

  function renderScatter(scatter) {
    new Chart(document.getElementById("scatterChart").getContext("2d"), {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Approved",
            data: scatter.approved.map(([x, y]) => ({ x, y })),
            backgroundColor: "rgba(34,248,159,0.65)",
            pointRadius: 3,
          },
          {
            label: "Rejected",
            data: scatter.rejected.map(([x, y]) => ({ x, y })),
            backgroundColor: "rgba(71,71,71,0.55)",
            pointRadius: 3,
          },
        ],
      },
      options: {
        plugins: {
          legend: { position: "top", labels: { color: TICK, boxWidth: 12, usePointStyle: true, pointStyle: "circle" } },
        },
        scales: {
          x: { title: { display: true, text: "Credit Score", color: GRAPHITE }, grid: baseGrid, ticks: { color: TICK } },
          y: { title: { display: true, text: "Risk Score", color: GRAPHITE }, grid: baseGrid, ticks: { color: TICK } },
        },
      },
    });
  }
})();
