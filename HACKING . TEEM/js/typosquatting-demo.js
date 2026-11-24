/* =========================================
   CYBERSHIELD
   DOMAIN SIMILARITY DETECTION ENGINE
   Local defensive educational analysis
========================================= */

(() => {
  "use strict";

  const form = document.getElementById("domainForm");
  const trustedInput = document.getElementById("trustedDomain");
  const candidateInput = document.getElementById("candidateDomain");

  const analyzeBtn = document.getElementById("analyzeBtn");
  const emptyState = document.getElementById("emptyState");
  const analysisResult = document.getElementById("analysisResult");

  const scoreOutput = document.getElementById("similarityScore");
  const similarityBar = document.getElementById("similarityBar");
  const riskOutput = document.getElementById("riskLevel");

  const referenceOutput = document.getElementById("referenceOutput");
  const candidateOutput = document.getElementById("candidateOutput");

  const findingsList = document.getElementById("findingsList");
  const recommendationText = document.getElementById("recommendationText");
  const exportButton = document.getElementById("exportReport");

  let latestReport = null;

  const samples = {
    similar: {
      reference: "example.test",
      candidate: "examples.test",
    },

    different: {
      reference: "example.test",
      candidate: "unrelated.test",
    },

    typo: {
      reference: "example.test",
      candidate: "examp1e.test",
    },
  };

  /* =====================================
       DOMAIN NORMALIZATION
    ===================================== */

  function normalizeDomain(value) {
    const input = String(value || "")
      .trim()
      .toLowerCase();

    if (!input) {
      throw new Error("Domain field cannot be empty.");
    }

    if (
      input.includes("://") ||
      input.includes("/") ||
      input.includes("@") ||
      input.includes("?") ||
      input.includes("#") ||
      input.includes("\\")
    ) {
      throw new Error("Enter a hostname only, without a URL path or protocol.");
    }

    let hostname;

    try {
      hostname = new URL("https://" + input).hostname;
    } catch {
      throw new Error("Enter a valid domain name.");
    }

    hostname = hostname.replace(/\.$/, "");

    if (!hostname || hostname.length > 253 || !hostname.includes(".")) {
      throw new Error("Enter a valid fully qualified domain name.");
    }

    const labels = hostname.split(".");

    const validLabels = labels.every(
      (label) =>
        label.length >= 1 &&
        label.length <= 63 &&
        /^[a-z0-9-]+$/.test(label) &&
        !label.startsWith("-") &&
        !label.endsWith("-"),
    );

    if (!validLabels) {
      throw new Error("Domain contains invalid characters.");
    }

    return hostname;
  }

  /* =====================================
       LEVENSHTEIN DISTANCE
    ===================================== */

  function levenshteinDistance(first, second) {
    const rows = first.length + 1;
    const columns = second.length + 1;

    let previous = Array.from({ length: columns }, (_, index) => index);

    for (let i = 1; i < rows; i++) {
      const current = [i];

      for (let j = 1; j < columns; j++) {
        const cost = first[i - 1] === second[j - 1] ? 0 : 1;

        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + cost,
        );
      }

      previous = current;
    }

    return previous[columns - 1];
  }

  /* =====================================
       SIMILARITY CALCULATION
    ===================================== */

  function calculateSimilarity(first, second) {
    const distance = levenshteinDistance(first, second);

    const longest = Math.max(first.length, second.length);

    if (longest === 0) {
      return {
        distance: 0,
        score: 100,
      };
    }

    const score = Math.round((1 - distance / longest) * 100);

    return {
      distance,
      score: Math.max(0, score),
    };
  }

  /* =====================================
       DOMAIN FINDINGS
    ===================================== */

  function generateFindings(reference, candidate, distance, score) {
    const findings = [];

    if (reference === candidate) {
      findings.push("Both normalized domain names are identical.");
    } else {
      findings.push(`Character-level edit distance: ${distance}.`);
    }

    if (score >= 85 && reference !== candidate) {
      findings.push("High character-level similarity detected.");
    } else if (score >= 65 && reference !== candidate) {
      findings.push("Moderate character-level similarity detected.");
    } else if (reference !== candidate) {
      findings.push("Low character-level similarity detected.");
    }

    const referenceLabels = reference.split(".");
    const candidateLabels = candidate.split(".");

    const referenceSuffix = referenceLabels.slice(1).join(".");
    const candidateSuffix = candidateLabels.slice(1).join(".");

    if (referenceSuffix === candidateSuffix) {
      findings.push("Both domains use the same suffix after the first label.");
    } else {
      findings.push("The domain suffixes differ.");
    }

    if (reference.length !== candidate.length) {
      findings.push("The domain names have different character lengths.");
    }

    if (reference.includes("-") || candidate.includes("-")) {
      findings.push("A hyphen is present in at least one domain.");
    }

    if (/[0-9]/.test(reference) || /[0-9]/.test(candidate)) {
      findings.push("A numeric character is present in at least one domain.");
    }

    return findings;
  }

  /* =====================================
       RISK CLASSIFICATION
    ===================================== */

  function classifyRisk(reference, candidate, score) {
    if (reference === candidate) {
      return {
        level: "EXACT MATCH",
        cssClass: "",
        auditResult: "COMPLETED",
        recommendation:
          "The normalized names match exactly. This comparison alone does not establish that either domain is trustworthy.",
      };
    }

    if (score >= 85) {
      return {
        level: "HIGH SIMILARITY",
        cssClass: "danger",
        auditResult: "WARNING",
        recommendation:
          "Review the candidate carefully. High character similarity can be a warning sign, but it does not prove impersonation. Verify ownership through an independent trusted source.",
      };
    }

    if (score >= 65) {
      return {
        level: "MODERATE SIMILARITY",
        cssClass: "warning",
        auditResult: "REVIEW_REQUIRED",
        recommendation:
          "Perform an additional manual review. Compare the domain with an independently verified reference before trusting it.",
      };
    }

    return {
      level: "LOW SIMILARITY",
      cssClass: "",
      auditResult: "COMPLETED",
      recommendation:
        "The names have relatively low character similarity. This does not guarantee safety; inspect the full context before trusting a domain.",
    };
  }

  /* =====================================
       SAFE RESULT RENDERING
    ===================================== */

  function renderFindings(findings) {
    findingsList.replaceChildren();

    findings.forEach((item) => {
      const li = document.createElement("li");

      li.textContent = item;

      findingsList.appendChild(li);
    });
  }

  function renderReport(report) {
    emptyState.hidden = true;
    analysisResult.hidden = false;

    scoreOutput.textContent = `${report.score}%`;

    similarityBar.style.width = `${report.score}%`;

    riskOutput.textContent = report.risk.level;

    riskOutput.className = report.risk.cssClass;

    referenceOutput.textContent = report.reference;
    candidateOutput.textContent = report.candidate;

    recommendationText.textContent = report.risk.recommendation;

    renderFindings(report.findings);
  }

  /* =====================================
       AUDIT INTEGRATION
    ===================================== */

  async function recordAnalysis(result) {
    if (
      !window.CyberShieldAudit ||
      typeof window.CyberShieldAudit.log !== "function"
    ) {
      console.warn("CyberShield Audit integration is unavailable.");

      return;
    }

    await window.CyberShieldAudit.log("DOMAIN_MONITORING", result);
  }

  /* =====================================
       MAIN ANALYSIS
    ===================================== */

  async function analyzeDomains(referenceValue, candidateValue) {
    const reference = normalizeDomain(referenceValue);
    const candidate = normalizeDomain(candidateValue);

    const comparison = calculateSimilarity(reference, candidate);

    const risk = classifyRisk(reference, candidate, comparison.score);

    const findings = generateFindings(
      reference,
      candidate,
      comparison.distance,
      comparison.score,
    );

    const report = {
      tool: "CyberShield Domain Similarity Lab",
      generatedAt: new Date().toISOString(),
      reference,
      candidate,
      score: comparison.score,
      editDistance: comparison.distance,
      risk,
      findings,
      analysisType: "Local character-level comparison",
    };

    latestReport = report;

    renderReport(report);

    await recordAnalysis(risk.auditResult);
  }

  /* =====================================
       FORM SUBMISSION
    ===================================== */

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "ANALYZING...";

    try {
      await analyzeDomains(trustedInput.value, candidateInput.value);
    } catch (error) {
      emptyState.hidden = false;
      analysisResult.hidden = true;

      const message = document.createElement("p");

      message.className = "validation-error";
      message.textContent = error.message;

      const previousError = document.getElementById("domainValidationError");

      if (previousError) {
        previousError.remove();
      }

      message.id = "domainValidationError";

      form.appendChild(message);
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = "ANALYZE DOMAIN <span>→</span>";
    }
  });

  /* =====================================
       TRAINING SCENARIOS
    ===================================== */

  document.querySelectorAll("[data-sample]").forEach((button) => {
    button.addEventListener("click", () => {
      const sample = samples[button.dataset.sample];

      if (!sample) return;

      trustedInput.value = sample.reference;
      candidateInput.value = sample.candidate;

      const error = document.getElementById("domainValidationError");

      if (error) error.remove();

      form.requestSubmit();
    });
  });

  /* =====================================
       JSON REPORT EXPORT
    ===================================== */

  exportButton.addEventListener("click", () => {
    if (!latestReport) return;

    const fileContent = JSON.stringify(latestReport, null, 4);

    const blob = new Blob([fileContent], { type: "application/json" });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "cybershield-domain-report.json";

    document.body.appendChild(link);

    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  });
})();
