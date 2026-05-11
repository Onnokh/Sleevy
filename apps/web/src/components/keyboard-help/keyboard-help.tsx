import { useKeyboardNav } from "../../contexts/keyboard-nav-context"
import { useHotkey } from "@tanstack/react-hotkeys"
import styles from "./keyboard-help.module.scss"

const shortcuts = [
  { keys: ["j"], description: "Move down" },
  { keys: ["k"], description: "Move up" },
  { keys: ["o"], description: "Open item" },
  { keys: ["r"], description: "Toggle read" },
  { keys: ["c"], description: "Copy URL" },
  { keys: ["d"], description: "Delete item" },
  { keys: ["n"], description: "Capture URL" },
  { keys: ["g", "i"], description: "Go to Inbox" },
  { keys: ["g", "l"], description: "Go to Library" },
  { keys: ["⌘", "K"], description: "Command palette" },
  { keys: ["?"], description: "This help" },
] as const

export function KeyboardHelp() {
  const { helpOpen, setHelpOpen } = useKeyboardNav()

  useHotkey("Escape", () => setHelpOpen(false), { enabled: helpOpen, conflictBehavior: "allow" })

  if (!helpOpen) return null

  return (
    <div className={styles.backdrop} onClick={() => setHelpOpen(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Keyboard shortcuts</h2>
        <div className={styles.grid}>
          {shortcuts.map((s) => (
            <div key={s.description} className={styles.row}>
              <span className={styles.keys}>
                {s.keys.map((key) => (
                  <kbd key={key} className={styles.kbd}>{key}</kbd>
                ))}
              </span>
              <span className={styles.desc}>{s.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
