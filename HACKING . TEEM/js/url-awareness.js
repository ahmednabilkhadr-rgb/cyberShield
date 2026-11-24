const urlForm = document.getElementById("urlForm");
const urlInput = document.getElementById("urlInput");
const analysisResult = document.getElementById("analysisResult");

// Analyze URL locally without opening the website

function analyzeURL(value) {
  const rawURL = value.trim();

  if (!rawURL) {
    return {
      error: "Please enter a URL first.",
    };
  }

  let parsedURL;

  try {
    parsedURL = new URL(
      /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(rawURL) ? rawURL : "https://" + rawURL,
    );
  } catch {
    return {
      error: "Invalid URL format. Please check your input.",
    };
  }

  const hostname = parsedURL.hostname.toLowerCase();
  const protocol = parsedURL.protocol;
  const warnings = [];

  // Check HTTPS

  if (protocol !== "https:") {
    warnings.push("The URL does not use HTTPS.");
  }

  // Check unusual username or password fields

  if (parsedURL.username || parsedURL.password) {
    warnings.push("The URL contains user information before the hostname.");
  }

  // Check IP address instead of a domain name

  const isIPAddress =
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    (hostname.startsWith("[") && hostname.endsWith("]"));

  if (isIPAddress) {
    warnings.push(
      "The URL uses an IP address instead of a regular domain name.",
    );
  }

  // Check unusually long hostnames

  if (hostname.length > 50) {
    warnings.push("The hostname is unusually long.");
  }

  // Check for suspicious-looking domain patterns

  if (hostname.includes("xn--")) {
    warnings.push(
      "The hostname contains an internationalized domain encoding.",
    );
  }

  if (hostname.split(".").length > 4) {
    warnings.push("The hostname contains many subdomain levels.");
  }

  // Extract basic URL information

  const result = {
    hostname: hostname,
    protocol: protocol,
    port: parsedURL.port || "Default",
    path: parsedURL.pathname,
    warnings: warnings,
  };

  return result;
}

// Display analysis results

function displayResult(data) {
  if (data.error) {
    analysisResult.innerHTML = `
            <div class="result-warning">
                <h3>INPUT ERROR</h3>
                <p id="errorMessage"></p>
            </div>
        `;

    analysisResult.querySelector("#errorMessage").textContent = data.error;

    return;
  }

  const hasWarnings = data.warnings.length > 0;

  analysisResult.innerHTML = `
        <div class="result-header">
            <span class="result-icon">${hasWarnings ? "⚠" : "✓"}</span>
            <div>
                <h3>${hasWarnings ? "REVIEW REQUIRED" : "BASIC CHECK PASSED"}</h3>
                <p>${
                  hasWarnings
                    ? "Potential warning signs were detected."
                    : "No basic warning signs were detected."
                }</p>
            </div>
        </div>

        <div class="result-details">
            <div>
                <span>HOSTNAME</span>
                <strong id="resultHostname"></strong>
            </div>

            <div>
                <span>PROTOCOL</span>
                <strong id="resultProtocol"></strong>
            </div>

            <div>
                <span>PORT</span>
                <strong id="resultPort"></strong>
            </div>

            <div>
                <span>PATH</span>
                <strong id="resultPath"></strong>
            </div>
        </div>

        <div class="warning-list">
            <h4>ANALYSIS NOTES</h4>
            <ul id="warningItems"></ul>
        </div>

        <p class="demo-disclaimer">
            Educational analysis only. This tool does not verify
            website ownership, reputation, or certificate validity.
        </p>
    `;

  analysisResult.querySelector("#resultHostname").textContent = data.hostname;

  analysisResult.querySelector("#resultProtocol").textContent = data.protocol;

  analysisResult.querySelector("#resultPort").textContent = data.port;

  analysisResult.querySelector("#resultPath").textContent = data.path;

  const warningItems = analysisResult.querySelector("#warningItems");

  if (hasWarnings) {
    data.warnings.forEach((warning) => {
      const item = document.createElement("li");

      item.textContent = warning;

      warningItems.appendChild(item);
    });
  } else {
    const item = document.createElement("li");

    item.textContent = "No basic structural warning signs were detected.";

    warningItems.appendChild(item);
  }
}

// Form submission

if (urlForm) {
  urlForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const result = analyzeURL(urlInput.value);

    displayResult(result);
  });
}

// Sample buttons

document.querySelectorAll("[data-url]").forEach((button) => {
  button.addEventListener("click", () => {
    urlInput.value = button.dataset.url;

    displayResult(analyzeURL(urlInput.value));
  });
});
