(function () {
  const GAUGE_LENGTH = 298; // approx length of the semicircle path (pi * r95)
  let selectedModel = "logistic";

  const modelCards = document.querySelectorAll(".model-card");
  modelCards.forEach((card) => {
    card.addEventListener("click", () => {
      modelCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedModel = card.dataset.model;
    });
  });

  const form = document.getElementById("predictForm");
  const submitBtn = document.getElementById("submitBtn");
  const resultEmpty = document.getElementById("resultEmpty");
  const resultBody = document.getElementById("resultBody");
  const gaugeArc = document.getElementById("gaugeArc");
  const gaugePct = document.getElementById("gaugePct");
  const verdictBadge = document.getElementById("verdictBadge");
  const metaModel = document.getElementById("metaModel");
  const metaProb = document.getElementById("metaProb");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const payload = { model: selectedModel };
    let missing = [];
    for (const [key, value] of formData.entries()) {
      if (value === "") missing.push(key);
      payload[key] = value;
    }

    if (missing.length) {
      resultEmpty.style.display = "block";
      resultBody.style.display = "none";
      resultEmpty.style.color = "#ff6b6b";
      resultEmpty.textContent = `Please fill in every field before predicting (${missing.length} field${missing.length > 1 ? "s" : ""} still empty).`;
      const firstMissing = document.getElementById("f_" + missing[0]) || document.getElementById("c_" + missing[0]);
      if (firstMissing) firstMissing.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Scoring…";

    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.ok) throw new Error(data.error || "Prediction failed");

      resultEmpty.style.display = "none";
      resultBody.style.display = "block";

      const prob = data.probability; // 0-100
      const offset = GAUGE_LENGTH - (GAUGE_LENGTH * prob) / 100;

      requestAnimationFrame(() => {
        gaugeArc.style.transition = "stroke-dashoffset 0.9s cubic-bezier(.2,.8,.2,1), stroke 0.4s ease";
        gaugeArc.style.strokeDashoffset = offset;
        gaugeArc.style.stroke = data.approved ? "#22F89F" : "#ff6b6b";
      });

      gaugePct.textContent = prob.toFixed(2) + "%";
      gaugePct.className = "pct " + (data.approved ? "approved" : "rejected");

      verdictBadge.textContent = data.approved ? "✓ APPROVED" : "✕ REJECTED";
      verdictBadge.className = "verdict-badge " + (data.approved ? "approved" : "rejected");

      metaModel.textContent = data.model;
      metaProb.textContent = data.probability.toFixed(4) + "%";
    } catch (err) {
      resultEmpty.style.display = "block";
      resultBody.style.display = "none";
      resultEmpty.textContent = "Something went wrong: " + err.message;
      resultEmpty.style.color = "#ff6b6b";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Predict Approval →";
    }
  });
})();
