import '@fontsource-variable/inter'
import '@fontsource-variable/cairo'
import '@fontsource/caveat/500.css'
import '@fontsource/caveat/600.css'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import * as dbModule from './db/db'
import './lib/install'

if (import.meta.env.DEV) (window as unknown as { __dw: typeof dbModule }).__dw = dbModule

void dbModule.initDb().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
