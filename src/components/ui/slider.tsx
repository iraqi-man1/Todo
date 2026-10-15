import * as SliderPrimitive from '@radix-ui/react-slider'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Slider = React.forwardRef<HTMLSpanElement, React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { thumbLabel?: string }>(
  ({ className, thumbLabel, ...props }, ref) => (
    <SliderPrimitive.Root ref={ref} className={cn('relative flex h-8 w-full touch-none items-center select-none', className)} {...props}>
      <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-line">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb aria-label={thumbLabel} className="block size-6 rounded-full border border-line bg-white shadow-md" />
    </SliderPrimitive.Root>
  ),
)
Slider.displayName = 'Slider'
