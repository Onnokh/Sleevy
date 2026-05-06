import { authClient } from "../../auth"
import styles from "./account.module.scss"

export function AccountPanel() {
  const { data: session } = authClient.useSession()

  if (!session) return null

  const { user } = session
  const initial = (user.name || user.email).charAt(0).toUpperCase()

  return (
    <section>
      <div className="section-header">
        <h2 className="section-title">Account</h2>
      </div>

      <ul className="item-list">
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
