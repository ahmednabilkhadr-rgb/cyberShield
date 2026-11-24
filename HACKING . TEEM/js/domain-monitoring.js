const domainForm = document.getElementById("domainForm");
const originalInput = document.getElementById("originalDomain");
const candidateInput = document.getElementById("candidateDomain");
const resultBox = document.getElementById("domainResult");

// Validate a plain domain name
function normalizeDomain(value) {
  return value.trim().toLowerCase();
}

function isValidDomain(domain) {
  if (!domain || domain.length > 253) return false;

  // This tool accepts domain names only, not full URLs.
  if (domain.includes("://") || domain.includes("/") || domain.includes(" ")) {
    return false;
  }

  const labels = domain.split(".");

  if (labels.length < 2) return false;

  return labels.every(
    (label) =>
      label.length >= 1 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  );
}

// Calculate Levenshtein distance
function calculateDistance(first, second) {
  const matrix = Array.from({ length: first.length + 1 }, () =>
    Array(second.length + 1).fill(0),
  );

  for (let i = 0; i <= first.length; i++) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= second.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= first.length; i++) {
    for (let j = 1; j <= second.length; j++) {
      const cost = first[i - 1] === second[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[first.length][second.length];
}

function showResult(title, message, status) {
  resultBox.replaceChildren();

  const heading = document.createElement("h3");
  heading.textContent = title;

  const description = document.createElement("p");
  description.textContent = message;

  const badge = document.createElement("span");
  badge.className = "domain-result-status";
  badge.textContent = status;

  resultBox.append(heading, description, badge);
}

domainForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const original = normalizeDomain(originalInput.value);
  const candidate = normalizeDomain(candidateInput.value);

  if (!isValidDomain(original)) {
    showResult(
      "INVALID REFERENCE DOMAIN",
      "Enter a valid domain such as example.com. Do not include https:// or a page path.",
      "INPUT ERROR",
    );
    return;
  }

  if (!isValidDomain(candidate)) {
    showResult(
      "INVALID CANDIDATE DOMAIN",
      "Enter a valid domain such as examp1e.com. Do not include https:// or a page path.",
      "INPUT ERROR",
    );
    return;
  }

  if (original === candidate) {
    showResult(
      "EXACT DOMAIN MATCH",
      "Both entries are identical. No character difference was detected.",
      "EXACT MATCH",
    );
    return;
  }

  const distance = calculateDistance(original, candidate);
  const longestLength = Math.max(original.length, candidate.length);

  const similarity = Math.round((1 - distance / longestLength) * 100);

  let riskLevel;
  let explanation;

  if (similarity >= 85) {
    riskLevel = "HIGH SIMILARITY";
    explanation =
      "The candidate domain is highly similar to the reference. Review it carefully.";
  } else if (similarity >= 65) {
    riskLevel = "MEDIUM SIMILARITY";
    explanation =
      "Some similarities were detected. Manual investigation is recommended.";
  } else {
    riskLevel = "LOW SIMILARITY";
    explanation =
      "The character similarity is relatively low. This does not prove that the domain is safe.";
  }

  resultBox.replaceChildren();

  const heading = document.createElement("h3");
  heading.textContent = "DOMAIN ANALYSIS REPORT";

  const reference = document.createElement("p");
  reference.textContent = `Reference: ${original}`;

  const checked = document.createElement("p");
  checked.textContent = `Candidate: ${candidate}`;

  const distanceText = document.createElement("p");
  distanceText.textContent = `Character Distance: ${distance}`;

  const similarityText = document.createElement("p");
  similarityText.textContent = `Similarity Score: ${similarity}%`;

  const status = document.createElement("span");
  status.className = "domain-result-status";
  status.textContent = riskLevel;

  const explanationText = document.createElement("p");
  explanationText.textContent = explanation;

  const note = document.createElement("small");
  note.textContent =
    "Educational local analysis only. Similarity is a warning signal, not proof of malicious activity. No DNS lookup or live website inspection is performed.";

  resultBox.append(
    heading,
    reference,
    checked,
    distanceText,
    similarityText,
    status,
    explanationText,
    note,
  );
});
