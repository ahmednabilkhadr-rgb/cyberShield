const scenarioSelect = document.getElementById("certificateScenario");
const testButton = document.getElementById("certificateCheckBtn");
const resultBox = document.getElementById("certificateResult");

const scenarios = {
  valid: {
    name: "Valid Certificate",
    checks: [
      ["HTTPS Protocol", true, "Secure protocol is selected."],
      [
        "Certificate Expiration",
        true,
        "Certificate is within its validity period.",
      ],
      ["Domain Match", true, "Certificate hostname matches example.com."],
      ["Trusted Issuer", true, "Certificate issuer is trusted."],
    ],
  },

  expired: {
    name: "Expired Certificate",
    checks: [
      ["HTTPS Protocol", true, "HTTPS is enabled."],
      [
        "Certificate Expiration",
        false,
        "Certificate validity period has expired.",
      ],
      ["Domain Match", true, "Hostname matches example.com."],
      ["Trusted Issuer", true, "Issuer is trusted."],
    ],
  },

  mismatch: {
    name: "Domain Mismatch",
    checks: [
      ["HTTPS Protocol", true, "HTTPS is enabled."],
      [
        "Certificate Expiration",
        true,
        "Certificate is within its validity period.",
      ],
      [
        "Domain Match",
        false,
        "Certificate hostname does not match example.com.",
      ],
      ["Trusted Issuer", true, "Issuer is trusted."],
    ],
  },

  untrusted: {
    name: "Untrusted Issuer",
    checks: [
      ["HTTPS Protocol", true, "HTTPS is enabled."],
      [
        "Certificate Expiration",
        true,
        "Certificate is within its validity period.",
      ],
      ["Domain Match", true, "Hostname matches example.com."],
      ["Trusted Issuer", false, "Certificate issuer is not trusted."],
    ],
  },
};

function createElement(tag, className, content) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  element.textContent = content;
  return element;
}

function runCertificateTest() {
  const selectedScenario = scenarioSelect.value;
  const scenario = scenarios[selectedScenario];

  resultBox.replaceChildren();

  const heading = createElement("h3", "", "CERTIFICATE VALIDATION REPORT");

  const scenarioName = createElement("p", "", `Scenario: ${scenario.name}`);

  resultBox.append(heading, scenarioName);

  let passedChecks = 0;

  scenario.checks.forEach(([name, passed, message]) => {
    if (passed) passedChecks++;

    const checkCard = document.createElement("div");
    checkCard.className = "certificate-check";

    const checkName = createElement("strong", "", name);

    const status = createElement(
      "span",
      `certificate-status ${passed ? "pass" : "fail"}`,
      passed ? "PASS" : "FAIL",
    );

    const description = createElement("p", "", message);

    checkCard.append(checkName, status, description);
    resultBox.appendChild(checkCard);
  });

  const totalChecks = scenario.checks.length;
  const allPassed = passedChecks === totalChecks;

  const summary = createElement(
    "h3",
    "certificate-summary",
    allPassed
      ? "RESULT: ALL CHECKS PASSED"
      : `RESULT: ${passedChecks} / ${totalChecks} CHECKS PASSED`,
  );

  const explanation = createElement(
    "p",
    "",
    allPassed
      ? "The simulated certificate passed all configured checks."
      : "One or more certificate checks failed. The simulated certificate should not be trusted.",
  );

  const note = createElement(
    "small",
    "",
    "Educational simulation only. These results are predefined test scenarios, not a live SSL/TLS certificate inspection.",
  );

  resultBox.append(summary, explanation, note);
}

testButton.addEventListener("click", runCertificateTest);
