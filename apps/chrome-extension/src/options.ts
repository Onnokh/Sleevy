const apiKeyInput = document.getElementById("api-key") as HTMLInputElement;
const sourceNameInput = document.getElementById("source-name") as HTMLInputElement;
const saveButton = document.getElementById("save") as HTMLButtonElement;
const clearButton = document.getElementById("clear") as HTMLButtonElement;
const feedback = document.getElementById("feedback") as HTMLDivElement;

function showFeedback(message: string, type: "success" | "error") {
  feedback.textContent = message;
  feedback.className = `feedback ${type}`;
  setTimeout(() => {
    feedback.textContent = "";
    feedback.className = "feedback";
  }, 3000);
}

async function loadPreferences() {
  const result = await chrome.storage.local.get(["apiKey", "sourceName"]);
  apiKeyInput.value = result.apiKey || "";
  sourceNameInput.value = result.sourceName || "";
}

async function savePreferences() {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showFeedback("API Key is required.", "error");
    return;
  }

  const sourceName = sourceNameInput.value.trim();
  await chrome.storage.local.set({ apiKey, ...(sourceName ? { sourceName } : {}) });
  if (!sourceName) await chrome.storage.local.remove(["sourceName"]);
  showFeedback("Saved!", "success");
}

async function clearPreferences() {
  await chrome.storage.local.remove(["apiUrl", "apiKey", "sourceName"]);
  apiKeyInput.value = "";
  sourceNameInput.value = "";
  showFeedback("Cleared.", "success");
}

saveButton.addEventListener("click", savePreferences);
clearButton.addEventListener("click", clearPreferences);
loadPreferences();
