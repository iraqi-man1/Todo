import { useEffect, useState } from 'react'
import type { WoodTheme } from '@/domain/types'
import { WOOD_PALETTES, woodTexture } from '@/lib/textures'

/** Preview tile using the real generated texture for that wood. */
export function WoodSwatch({ wood }: { wood: WoodTheme }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void woodTexture(wood).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [wood])
  return (
    <span
      className="block h-14"
      style={{
        backgroundColor: WOOD_PALETTES[wood].base,
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: '512px 512px',
        backgroundPosition: 'center',
      }}
    />
  )
}
