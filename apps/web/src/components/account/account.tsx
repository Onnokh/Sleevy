import { authClient } from "../../auth"
import styles from "./account.module.scss"

export function AccountPanel() {
  const { data: session } = authClient.useSession()

  if (!session) return null

  const { user } = session
  const initial = (user.name || user.email).charAt(0).toUpperCase()

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
    </section>
  )
}
