(function () {
  const SIGNAL = "#22F89F";
  const GRAPHITE = "#474747";

  const fmt = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const fmtMoney = (n) => "$" + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

  fetch("/api/dataset-overview")
    .then((r) => r.json())
    .then((d) => {
      // Stat cards
      const statGrid = document.getElementById("statGrid");
      statGrid.innerHTML = `
        <div class="stat-card"><div class="num">${fmt(d.rows)}</div><div class="label">Total Records</div></div>
        <div class="stat-card"><div class="num">${d.columns}</div><div class="label">Features</div></div>
        <div class="stat-card"><div class="num">${d.approval_rate}%</div><div class="label">Approval Rate</div></div>
        <div class="stat-card"><div class="num">${d.missing_values}</div><div class="label">Missing Values</div></div>
      `;

      // Donut
      const ctx = document.getElementById("donutChart").getContext("2d");
      new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Approved", "Rejected"],
          datasets: [{ data: [d.approved, d.rejected], backgroundColor: [SIGNAL, GRAPHITE], borderWidth: 0 }],
        },
        options: {
          cutout: "72%",
          plugins: { legend: { display: false }, tooltip: { enabled: true } },
        },
      });
      document.getElementById("donutLegend").innerHTML = `
        <div class="legend-row"><span class="legend-dot" style="background:${SIGNAL}"></span> Approved — ${fmt(d.approved)} (${d.approval_rate}%)</div>
        <div class="legend-row"><span class="legend-dot" style="background:${GRAPHITE}"></span> Rejected — ${fmt(d.rejected)} (${(100 - d.approval_rate).toFixed(2)}%)</div>
      `;

      // Snapshot
      document.getElementById("snapshotList").innerHTML = `
        <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-faint)">Date range</span><span class="mono">${d.date_range[0]} → ${d.date_range[1]}</span></div>
        <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-faint)">Avg. Credit Score</span><span class="mono">${d.avg_credit_score}</span></div>
        <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-faint)">Avg. Annual Income</span><span class="mono">${fmtMoney(d.avg_annual_income)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-faint)">Avg. Loan Amount</span><span class="mono">${fmtMoney(d.avg_loan_amount)}</span></div>
      `;

      // Columns
      document.getElementById("colList").innerHTML = d.columns_list
        .map((c) => `<span class="col-chip">${c.name}<span class="type">${c.dtype}</span></span>`)
        .join("");

      // Sample table
      const rows = d.sample_rows;
      if (rows.length) {
        const cols = Object.keys(rows[0]).slice(0, 10);
        const thead = "<tr>" + cols.map((c) => `<th>${c}</th>`).join("") + "</tr>";
        const tbody = rows
          .map((row) => "<tr>" + cols.map((c) => `<td>${row[c]}</td>`).join("") + "</tr>")
          .join("");
        document.getElementById("sampleTable").innerHTML = `<thead>${thead}</thead><tbody>${tbody}</tbody>`;
      }
    })
    .catch((err) => {
      console.error(err);
    });
})();
