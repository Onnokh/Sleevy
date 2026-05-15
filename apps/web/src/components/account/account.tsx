import { useState } from "react"

import { authClient } from "../../auth"
import styles from "./account.module.scss"

export function AccountPanel() {
  const { data: session } = authClient.useSession()
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (!session) return null

  const { user } = session
  const initial = (user.name || user.email).charAt(0).toUpperCase()

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4001"}/api/auth/delete-account`,
        {
          method: "POST",
          credentials: "include",
          headers: { Authorization: `Bearer ${session.session.token}` },
        },
      )
      if (!res.ok) {
        let message = "Account deletion failed. Please try again."
        try {
          const payload = await res.json()
          if (typeof payload.error === "string" && payload.error.length > 0) {
            message = payload.error
          }
        } catch {
          // Keep the generic message when the server does not return JSON.
        }
        setDeleteError(message)
        return
      }

      await authClient.signOut()
      setIsConfirming(false)
    } catch {
      setDeleteError("Account deletion failed. Check your connection and try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="settings-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">Account</h2>
          <p className="section-description">Currently signed in as</p>
        </div>
      </div>

      <ul className="item-list settings-list">
        <li>
          <div className={styles.row}>
            {user.image ? (
              <img className={styles.avatar} src={user.image} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className={styles["avatar-fallback"]}>{initial}</span>
            )}
            <div className={styles.body}>
              <span className={styles.name}>{user.name}</span>
              <span className={styles.meta}>{user.email}</span>
            </div>
            <span className={styles.provider}>Google</span>
          </div>
        </li>
      </ul>

      {isConfirming ? (
        <div className={styles["delete-confirm"]}>
          <p className={styles["delete-warning"]}>
            This will permanently delete your account and all saved data. This cannot be undone.
          </p>
          {deleteError ? (
            <p className={styles["delete-error"]}>{deleteError}</p>
          ) : null}
          <div className={styles["delete-actions"]}>
            <button
              type="button"
              className={styles["delete-cancel"]}
              onClick={() => setIsConfirming(false)}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles["delete-confirm-btn"]}
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Yes, delete my account"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles["delete-link"]}
          onClick={() => setIsConfirming(true)}
        >
          Delete Account
        </button>
      )}
    </section>
  )
}
