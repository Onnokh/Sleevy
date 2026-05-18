import { useNavigate } from "@tanstack/react-router"

import { authClient } from "../../auth"
import { ContextMenu, type ContextMenuItem } from "../ui/context-menu/context-menu"
import styles from "./account-menu.module.scss"

type Props = {
  readonly user: {
    readonly id: string
    readonly name: string
    readonly email: string
    readonly image?: string | null
  }
}

export function AccountMenu({ user }: Props) {
  const navigate = useNavigate()

  const displayName = user.name.trim() || user.email
  const initial = displayName.charAt(0).toUpperCase()

  const goToSettings = () => {
    void navigate({ to: "/settings" })
  }

  const items: readonly ContextMenuItem[] = [
    { key: "settings", label: "Settings", onClick: goToSettings },
    { key: "logout", label: "Log out", destructive: true, onClick: () => void authClient.signOut() },
  ]

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.row} onClick={goToSettings}>
        {user.image ? (
          <img className={styles.avatar} src={user.image} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className={styles["avatar-fallback"]}>{initial}</span>
        )}
        <span className={styles.name}>{displayName}</span>
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
