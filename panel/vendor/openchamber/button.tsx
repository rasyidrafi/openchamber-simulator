import * as React from "react"
import type { VariantProps } from "class-variance-authority"

import { cn } from "./utils"
import { Slot } from "./slot"
import { buttonVariants } from "./button-variants"

function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  const typeProps = asChild
    ? (type === undefined ? {} : { type })
    : { type: type ?? "button" }

  return (
    <Comp
      data-slot="button"
      data-size={size ?? undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...typeProps}
      {...props}
    />
  )
}

export { Button }
