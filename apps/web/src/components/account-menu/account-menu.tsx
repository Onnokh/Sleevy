import { useEffect, useId, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"

import { signOut, type AuthUser } from "../../auth"
import styles from "./account-menu.module.scss"

type Props = {
  readonly user: AuthUser
}

export function AccountMenu({ user }: Props) {
  const navigate = useNavigate()
  const menuId = useId()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const dotsRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isMenuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (menuRef.current?.contains(target)) return
      if (dotsRef.current?.contains(target)) return
      setIsMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [isMenuOpen])

  const initial = (user.name || user.email).charAt(0).toUpperCase()

  const goToSettings = () => {
    setIsMenuOpen(false)
    void navigate({ to: "/settings" })
  }

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.row} onClick={goToSettings}>
        {user.image ? (
          <img className={styles.avatar} src={user.image} alt="" />
        ) : (
          <span className={styles["avatar-fallback"]}>{initial}</span>
        )}
        <span className={styles.name}>{user.name || user.email}</span>
      </button>

      <button
        type="button"
        ref={dotsRef}
        className={styles.dots}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        aria-controls={menuId}
        onClick={() => setIsMenuOpen((v) => !v)}
      >
        ···
      </button>

      {isMenuOpen ? (
        <div ref={menuRef} id={menuId} role="menu" className={styles.menu}>
          <button
            type="button"
            role="menuitem"
            className={styles["menu-item"]}
            onClick={goToSettings}
          >
            Settings
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles["menu-item"]}
            onClick={() => void signOut()}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}
