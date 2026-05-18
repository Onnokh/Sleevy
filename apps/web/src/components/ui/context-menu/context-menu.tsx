import clsx from "clsx"
import { useEffect, useId, useRef, useState, type ReactNode } from "react"

import styles from "./context-menu.module.scss"

export type ContextMenuItem = {
  readonly key: string
  readonly label: string
  readonly destructive?: boolean
  readonly disabled?: boolean
  readonly href?: string
  readonly onClick?: () => void
}

type ContextMenuProps = {
  readonly items: readonly ContextMenuItem[]
  readonly triggerLabel?: ReactNode
  readonly align?: "left" | "right"
  readonly side?: "top" | "bottom"
  readonly triggerClassName?: string
  readonly menuClassName?: string
}

export function ContextMenu({
  items,
  triggerLabel,
  align = "right",
  side = "bottom",
  triggerClassName,
  menuClassName,
}: ContextMenuProps) {
  const menuId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (menuRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      setIsOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [isOpen])

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((v) => !v)}
      >
        {triggerLabel}
      </button>

      {isOpen ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          className={clsx(
            styles.menu,
            styles[align],
            styles[side],
            menuClassName,
          )}
        >
          {items.map((item) =>
            item.href ? (
              <a
                key={item.key}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                role="menuitem"
                className={clsx(
                  styles["menu-item"],
                  item.destructive && styles.destructive,
                )}
                onClick={() => {
                  setIsOpen(false)
                  item.onClick?.()
                }}
              >
                {item.label}
              </a>
            ) : (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={clsx(
                  styles["menu-item"],
                  item.destructive && styles.destructive,
                )}
                onClick={() => {
                  setIsOpen(false)
                  item.onClick?.()
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </>
  )
}
