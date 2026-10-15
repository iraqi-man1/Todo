import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 select-none',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-ink shadow-soft hover:brightness-110',
        secondary: 'bg-surface text-ink border border-line shadow-[0_1px_2px_rgb(64_42_20/0.05)] hover:bg-surface-2',
        ghost: 'text-ink hover:bg-surface-2',
        subtle: 'bg-surface-2 text-ink hover:bg-line/70',
        danger: 'bg-danger text-white hover:brightness-110',
        link: 'text-accent underline-offset-4 hover:underline px-0',
      },
      size: {
        sm: 'h-9 px-3 text-[13px]',
        md: 'h-11 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'size-11 rounded-full',
        iconSm: 'size-9 rounded-full',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp ref={ref} type={asChild ? undefined : (type ?? 'button')} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  },
)
Button.displayName = 'Button'
