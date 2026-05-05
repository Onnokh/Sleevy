import clsx from "clsx"
import { type InputHTMLAttributes } from "react"

import styles from "./input-field.module.scss"

type Props = InputHTMLAttributes<HTMLInputElement>

export function InputField({ className, ...props }: Props) {
  return <input className={clsx(styles.input, className)} {...props} />
}
