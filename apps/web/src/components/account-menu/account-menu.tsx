import { useNavigate } from "@tanstack/react-router"

import { signOut, type AuthUser } from "../../auth"
import { ContextMenu, type ContextMenuItem } from "../ui/context-menu/context-menu"
import styles from "./account-menu.module.scss"

type Props = {
  readonly user: AuthUser
}

export function AccountMenu({ user }: Props) {
  const navigate = useNavigate()

  const initial = (user.name || user.email).charAt(0).toUpperCase()

  const goToSettings = () => {
    void navigate({ to: "/settings" })
  }

  const items: readonly ContextMenuItem[] = [
    { key: "settings", label: "Settings", onClick: goToSettings },
    { key: "logout", label: "Log out", destructive: true, onClick: () => void signOut() },
  ]

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.row} onClick={goToSettings}>
        {user.image ? (
          <img className={styles.avatar} src={user.image} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className={styles["avatar-fallback"]}>{initial}</span>
        )}
        <span className={styles.name}>{user.name || user.email}</span>
      </button>

      <ContextMenu
        items={items}
        triggerClassName={styles.dots}
        side="top"
        align="left"
      />
    </div>
  )
}
