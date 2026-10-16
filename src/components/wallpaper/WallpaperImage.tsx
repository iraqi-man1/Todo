import { memo } from 'react'
import type { Wallpaper } from '@/domain/types'
import { parallaxLayer } from '@/hooks/useParallax'
import { wallpaperUrl, type WallpaperSettings } from '@/lib/wallpaper'
import { cn } from '@/lib/utils'

/**
 * Renders a wallpaper with its settings. Always aspect-correct: Fill crops (object-fit: cover), Fit
 * letterboxes (contain), Center shows the image at its own size. Crop zoom scales around the focal point.
 */
export const WallpaperImage = memo(function WallpaperImage({
  wallpaper,
  settings,
  parallaxDepth = 0,
  className,
  onError,
}: {
  wallpaper: Pick<Wallpaper, 'id' | 'data' | 'type'>
  settings: WallpaperSettings
  /** Max travel in px at full parallax; multiplied by the wallpaper's own parallax intensity. */
  parallaxDepth?: number
  className?: string
  onError?: () => void
}) {
  const s = settings
  const depth = parallaxDepth * s.parallax
  // Leave room so blur and parallax never reveal an edge.
  const bleed = 1 + (s.blur > 0 ? 0.04 : 0) + (depth > 0 && s.mode === 'fill' ? (depth * 2.2) / 1000 + 0.02 : 0)
  return (
    <div className={cn('absolute inset-0 overflow-hidden bg-[#0c1220]', className)} style={{ opacity: s.opacity }}>
      <div className="absolute inset-0" style={depth ? parallaxLayer(depth) : undefined}>
        <img
          src={wallpaperUrl(wallpaper)}
          alt=""
          draggable={false}
          decoding="async"
          onError={onError}
          className="absolute inset-0 h-full w-full select-none"
          style={{
            objectFit: s.mode === 'fill' ? 'cover' : s.mode === 'fit' ? 'contain' : 'none',
            objectPosition: `${s.posX}% ${s.posY}%`,
            transform: `scale(${s.zoom * bleed})`,
            transformOrigin: `${s.posX}% ${s.posY}%`,
            filter: `brightness(${s.brightness})${s.blur ? ` blur(${s.blur}px)` : ''}`,
          }}
        />
      </div>
      {s.overlay > 0 && <div className="absolute inset-0" style={{ background: `rgb(8 12 22 / ${s.overlay})` }} />}
    </div>
  )
})
