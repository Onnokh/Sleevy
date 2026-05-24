import {
  connectToSleevy,
  disconnectFromSleevy,
  getCurrentConnection,
  type CurrentConnection,
} from "./connect.js"

const subtitleEl = document.getElementById("subtitle") as HTMLParagraphElement
const connectButton = document.getElementById("connect") as HTMLButtonElement
const disconnectButton = document.getElementById("disconnect") as HTMLButtonElement
const sourceNameInput = document.getElementById("source-name") as HTMLInputElement
const saveSourceNameButton = document.getElementById("save-source-name") as HTMLButtonElement
const feedback = document.getElementById("feedback") as HTMLDivElement

function showFeedback(message: string, type: "success" | "error") {
  feedback.textContent = message
  feedback.className = `feedback ${type}`
  window.setTimeout(() => {
    feedback.textContent = ""
    feedback.className = "feedback"
  }, 3000)
}

function renderConnection(connection: CurrentConnection) {
  if (connection.status === "connected") {
    subtitleEl.textContent = `Connected · ${connection.label}`
    connectButton.textContent = "Reconnect"
    disconnectButton.hidden = false
  } else {
    subtitleEl.textContent = "Connect Chrome to your Sleevy account."
    connectButton.textContent = "Connect to Sleevy"
    disconnectButton.hidden = true
  }
}

async function refresh() {
  renderConnection(await getCurrentConnection())
  const stored = await chrome.storage.local.get(["sourceName"])
  sourceNameInput.value = typeof stored.sourceName === "string" ? stored.sourceName : ""
}

async function onConnect() {
  connectButton.disabled = true
  try {
    const result = await connectToSleevy()
    renderConnection({ status: "connected", label: result.label, scopes: result.scopes })
    showFeedback(`Connected as ${result.label}.`, "success")
  } catch (error) {
    showFeedback(error instanceof Error ? error.message : "Could not connect.", "error")
  } finally {
    connectButton.disabled = false
  }
}

async function onDisconnect() {
  await disconnectFromSleevy()
  renderConnection({ status: "disconnected" })
  showFeedback("Disconnected.", "success")
}

async function onSaveSourceName() {
  const sourceName = sourceNameInput.value.trim()
  if (sourceName) {
    await chrome.storage.local.set({ sourceName })
  } else {
    await chrome.storage.local.remove(["sourceName"])
  }
  showFeedback("Source name saved.", "success")
}

connectButton.addEventListener("click", () => void onConnect())
disconnectButton.addEventListener("click", () => void onDisconnect())
saveSourceNameButton.addEventListener("click", () => void onSaveSourceName())

void refresh()
