import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import clsx from "clsx"
import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"

import styles from "./context-menu.module.scss"

export type ContextMenuItem = {
  readonly key: string
  readonly label: string
  readonly destructive?: boolean
  readonly disabled?: boolean
  readonly href?: string
  readonly onClick?: () => void
  readonly items?: readonly ContextMenuItem[]
}

type ContextMenuProps = {
  readonly items: readonly ContextMenuItem[]
  readonly triggerLabel?: ReactNode
  readonly align?: "left" | "right"
  readonly side?: "top" | "bottom"
  readonly triggerClassName?: string
  readonly menuClassName?: string
}

const menuItemClassName = (item: ContextMenuItem) =>
  clsx(styles["menu-item"], item.destructive && styles.destructive)

function MenuItems({ items }: { readonly items: readonly ContextMenuItem[] }) {
  return items.map((item) => {
    if (item.items?.length) {
      return (
        <DropdownMenu.Sub key={item.key}>
          <DropdownMenu.SubTrigger
            disabled={item.disabled}
            className={styles["menu-item"]}
          >
            <span>{item.label}</span>
            <ChevronRight size={14} className={styles.chevron} />
          </DropdownMenu.SubTrigger>
          <DropdownMenu.Portal>
            <DropdownMenu.SubContent className={clsx(styles.menu, styles.submenu)} sideOffset={4} alignOffset={-4}>
              <MenuItems items={item.items} />
            </DropdownMenu.SubContent>
          </DropdownMenu.Portal>
        </DropdownMenu.Sub>
      )
    }

    if (item.href) {
      return (
        <DropdownMenu.Item key={item.key} asChild onSelect={item.onClick} disabled={item.disabled}>
          <a href={item.href} target="_blank" rel="noreferrer" className={menuItemClassName(item)}>
            {item.label}
          </a>
        </DropdownMenu.Item>
      )
    }

    return (
      <DropdownMenu.Item
        key={item.key}
        disabled={item.disabled}
        className={menuItemClassName(item)}
        onSelect={item.onClick}
      >
        {item.label}
      </DropdownMenu.Item>
    )
  })
}

export function ContextMenu({
  items,
  triggerLabel,
  align = "right",
  side = "bottom",
  triggerClassName,
  menuClassName,
}: ContextMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className={triggerClassName} aria-label="Open menu">
          {triggerLabel}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={side}
          align={align === "left" ? "start" : "end"}
          sideOffset={4}
          className={clsx(styles.menu, menuClassName)}
        >
          <MenuItems items={items} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
