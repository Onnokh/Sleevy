import clsx from "clsx"
import { type InputHTMLAttributes, type Ref } from "react"

import styles from "./input-field.module.scss"

type Props = InputHTMLAttributes<HTMLInputElement> & {
  readonly ref?: Ref<HTMLInputElement>
}

export function InputField({ className, ref, ...props }: Props) {
  return <input ref={ref} className={clsx(styles.input, className)} {...props} />
}
