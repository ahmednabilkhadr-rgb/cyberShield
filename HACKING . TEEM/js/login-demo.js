"use strict";

// CyberShield - URL Security Analysis Engine

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("urlAnalysisForm");
  const targetInput = document.getElementById("targetUrl");
  const trustedInput = document.getElementById("trustedDomain");

  const emptyState = document.getElementById("emptyState");
  const analysisResult = document.getElementById("analysisResult");

  const riskScore = document.getElementById("riskScore");
  const riskLevel = document.getElementById("riskLevel");
  const indicatorCount = document.getElementById("indicatorCount");
  const domainMatch = document.getElementById("domainMatch");

  const protocolValue = document.getElementById("protocolValue");
  const hostnameValue = document.getElementById("hostnameValue");
  const pathValue = document.getElementById("pathValue");
  const queryValue = document.getElementById("queryValue");

  const indicatorList = document.getElementById("indicatorList");
  const recommendationList = document.getElementById("recommendationList");

  const timestamp = document.getElementById("analysisTimestamp");

  const clearButton = document.getElementById("clearButton");
  const exportButton = document.getElementById("exportReportButton");

  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");

  let latestReport = null;

  // Normalize a hostname for exact domain comparison.
  function normalizeDomain(value) {
    return value.trim().toLowerCase().replace(/\.$/, "");
  }

  // Safely create a visible report element.
  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }

  // Analyze URL characteristics locally.
  function analyzeURL(rawURL, trustedDomain) {
    const findings = [];
    const recommendations = [];
    let score = 0;

    let parsedURL;

    try {
      parsedURL = new URL(rawURL);
    } catch {
      return {
        valid: false,
        error: "Invalid URL format. Enter a complete URL.",
      };
    }

    if (!["http:", "https:"].includes(parsedURL.protocol)) {
      return {
        valid: false,
        error: "Only HTTP and HTTPS URLs are supported.",
      };
    }

    const hostname = normalizeDomain(parsedURL.hostname);
    const trusted = normalizeDomain(trustedDomain);

    if (!trusted || trusted.includes("/") || trusted.includes("@")) {
      return {
        valid: false,
        error: "Enter a valid trusted reference domain.",
      };
    }

    // 1. HTTPS inspection
    if (parsedURL.protocol !== "https:") {
      score += 15;

      findings.push({
        title: "Unencrypted HTTP",
        message: "The URL uses HTTP instead of HTTPS.",
        severity: "warning",
      });

      recommendations.push(
        "Prefer HTTPS, and verify the website identity separately.",
      );
    } else {
      findings.push({
        title: "HTTPS Scheme Detected",
        message:
          "The URL uses HTTPS. This does not prove the site is trustworthy.",
        severity: "safe",
      });
    }

    // 2. Exact hostname comparison
    const matchesTrusted = hostname === trusted;

    if (!matchesTrusted) {
      score += 35;

      findings.push({
        title: "Trusted Domain Mismatch",
        message: "The hostname does not exactly match the trusted reference.",
        severity: "danger",
      });

      recommendations.push(
        "Verify the hostname against an independently trusted source.",
      );
    } else {
      findings.push({
        title: "Exact Domain Match",
        message: "The hostname matches the configured reference domain.",
        severity: "safe",
      });
    }

    // 3. IP address hostname indicator
    const ipv4Pattern = /^(?:\d{1,3}\.){3}\d{1,3}$/;

    const ipv6Pattern = /^\[[0-9a-f:]+\]$/i;

    if (ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname)) {
      score += 20;

      findings.push({
        title: "IP Address Hostname",
        message: "The URL uses an IP address instead of a regular domain name.",
        severity: "warning",
      });

      recommendations.push(
        "Confirm that an IP-based address is expected before trusting it.",
      );
    }

    // 4. Unusual subdomain structure
    const labels = hostname.split(".");

    if (labels.length >= 5) {
      score += 10;

      findings.push({
        title: "Unusual Subdomain Depth",
        message: "The hostname contains many domain labels.",
        severity: "warning",
      });

      recommendations.push(
        "Identify the registrable domain instead of trusting familiar words in subdomains.",
      );
    }

    // 5. User information in URL
    if (parsedURL.username || parsedURL.password) {
      score += 25;

      findings.push({
        title: "User Information in URL",
        message: "The URL contains text before the actual hostname.",
        severity: "danger",
      });

      recommendations.push(
        "Inspect the actual hostname carefully. Do not trust text placed before @.",
      );
    }

    // 6. Hyphen indicator
    if (hostname.includes("-")) {
      score += 5;

      findings.push({
        title: "Hyphen in Hostname",
        message:
          "The hostname contains a hyphen. This is only a contextual indicator.",
        severity: "warning",
      });
    }

    // 7. Encoded URL characters
    if (/%[0-9a-f]{2}/i.test(rawURL)) {
      score += 10;

      findings.push({
        title: "Encoded URL Characters",
        message: "Percent-encoded characters were found in the URL.",
        severity: "warning",
      });

      recommendations.push(
        "Review encoded URL components to understand their meaning.",
      );
    }

    // 8. Unicode hostname indicator
    if (/[^\x00-\x7F]/.test(parsedURL.hostname)) {
      score += 15;

      findings.push({
        title: "Unicode Hostname",
        message:
          "The hostname contains non-ASCII characters that may need careful inspection.",
        severity: "warning",
      });

      recommendations.push(
        "Inspect internationalized domain names carefully for visually similar characters.",
      );
    }

    // 9. Suspicious URL symbols
    if (rawURL.includes("@")) {
      findings.push({
        title: "At Symbol Detected",
        message:
          "The URL contains @. Check whether it separates user information from the hostname.",
        severity: "warning",
      });
    }

    // 10. Query parameters
    if (parsedURL.searchParams.toString()) {
      findings.push({
        title: "Query Parameters Present",
        message:
          "The URL contains query parameters. Their presence alone is not malicious.",
        severity: "safe",
      });
    }

    score = Math.min(score, 100);

    let level = "Low";

    if (score >= 60) {
      level = "High";
    } else if (score >= 30) {
      level = "Medium";
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "Continue verifying the website using trusted organizational sources.",
      );
    }

    return {
      valid: true,
      url: rawURL,
      protocol: parsedURL.protocol,
      hostname,
      path: parsedURL.pathname || "/",
      query: parsedURL.search || "None",
      matchesTrusted,
      score,
      level,
      findings,
      recommendations,
      createdAt: new Date().toLocaleString(),
    };
  }

  // Render the analysis report.
  function renderReport(report) {
    emptyState.hidden = true;
    analysisResult.hidden = false;

    riskScore.textContent = `${report.score}/100`;
    riskLevel.textContent = `${report.level} Risk`;

    indicatorCount.textContent = report.findings.length;

    domainMatch.textContent = report.matchesTrusted ? "MATCH" : "MISMATCH";

    protocolValue.textContent = report.protocol;
    hostnameValue.textContent = report.hostname;
    pathValue.textContent = report.path;
    queryValue.textContent = report.query;

    indicatorList.replaceChildren();
    recommendationList.replaceChildren();

    report.findings.forEach((finding) => {
      const item = document.createElement("div");
      item.className = `indicator-item ${finding.severity}`;

      item.appendChild(createElement("strong", "", finding.title));

      item.appendChild(createElement("p", "", finding.message));

      indicatorList.appendChild(item);
    });

    report.recommendations.forEach((recommendation) => {
      const item = createElement("li", "", recommendation);

      recommendationList.appendChild(item);
    });

    timestamp.textContent = `Analysis generated: ${report.createdAt}`;
  }

  // Form submission
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const report = analyzeURL(targetInput.value, trustedInput.value);

    if (!report.valid) {
      emptyState.hidden = false;
      analysisResult.hidden = true;

      emptyState.querySelector("h3").textContent = "Analysis Error";

      emptyState.querySelector("p").textContent = report.error;

      return;
    }

    latestReport = report;
    renderReport(report);
  });

  // Sample test buttons
  document.querySelectorAll(".sample-button").forEach((button) => {
    button.addEventListener("click", () => {
      targetInput.value = button.dataset.url;

      form.requestSubmit();
    });
  });

  // Clear the form and previous report
  clearButton.addEventListener("click", () => {
    latestReport = null;

    analysisResult.hidden = true;
    emptyState.hidden = false;

    emptyState.querySelector("h3").textContent = "Waiting for Analysis";

    emptyState.querySelector("p").textContent =
      "Submit a URL above to generate a security report.";
  });

  // Export the latest report as a JSON file
  exportButton.addEventListener("click", () => {
    if (!latestReport) return;

    const content = JSON.stringify(latestReport, null, 4);

    const blob = new Blob([content], { type: "application/json" });

    const downloadURL = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = downloadURL;
    link.download = "cybershield-security-report.json";

    link.click();

    URL.revokeObjectURL(downloadURL);
  });

  // Mobile navigation
  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("show");

      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }
});
