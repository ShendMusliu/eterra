import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

type Language = {
  code: string
  label?: string
}

type Props = {
  className?: string
  languages?: Language[]
  autoHideOnScroll?: boolean
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function useIsMobile(breakpointPx = 640) {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpointPx : true,
  )

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`) // tailwind sm: 640
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [breakpointPx])

  return isMobile
}

export default function LanguageSwitcherFAB({
  className,
  languages,
  autoHideOnScroll = true,
}: Props) {
  const { i18n, t } = useTranslation()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const lastY = useRef<number>(0)
  const raf = useRef<number | null>(null)

  const supported: Language[] = useMemo(() => {
    if (languages?.length) return languages
    const rawSupported = (i18n?.options as any)?.supportedLngs
    const codesFromSupported = Array.isArray(rawSupported)
      ? (rawSupported as string[]).filter((l) => !!l && l !== 'cimode')
      : undefined
    const runtimeLangs = Array.isArray(i18n.languages) ? i18n.languages : []
    const resourceLangs = i18n.options?.resources ? Object.keys(i18n.options.resources) : []
    const codesFromRuntime = Array.from(
      new Set([
        ...runtimeLangs,
        ...resourceLangs,
      ]
        .map((l) => (l || '').split('-')[0])
        .filter(Boolean)),
    )
    const codes = (codesFromSupported?.length ? codesFromSupported : codesFromRuntime) || ['en']
    let display: Intl.DisplayNames | null = null
    try {
      display = new Intl.DisplayNames([i18n.language || 'en'], { type: 'language' })
    } catch {
      display = null
    }
    return codes.map((code) => ({ code, label: display?.of(code) || code }))
  }, [languages, i18n.language, i18n.languages, i18n.options?.supportedLngs, i18n.options?.resources])

  useEffect(() => {
    if (!autoHideOnScroll || !isMobile) {
      setHidden(false)
      return
    }
    const onScroll = () => {
      if (raf.current) cancelAnimationFrame(raf.current)
      raf.current = requestAnimationFrame(() => {
        const y = window.scrollY || 0
        const delta = y - (lastY.current || 0)
        const nearTop = y < 8
        const scrollingDown = delta > 6
        const scrollingUp = delta < -6
        if (open) return
        if (nearTop || scrollingUp) setHidden(false)
        else if (scrollingDown) setHidden(true)
        lastY.current = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [autoHideOnScroll, isMobile, open])

  const current = i18n.language?.split('-')[0] || 'en'
  const currentLabel = useMemo(() => {
    const display = new Intl.DisplayNames([i18n.language], { type: 'language' })
    return display.of(current) || current
  }, [current, i18n.language])

  const changeLanguage = async (code: string) => {
    if (code === current) return
    await i18n.changeLanguage(code)
    try {
      localStorage.setItem('i18nextLng', code)
    } catch {}
  }

  return (
    <div
      className={cn(
        'fixed z-50 right-4 motion-reduce:transition-none',
        // Safe-area aware bottom spacing for iOS; falls back nicely elsewhere
        'bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)]',
        'sm:right-6 sm:bottom-6',
        'transition-all duration-200',
        hidden && 'translate-y-24 opacity-0 pointer-events-none',
        className,
      )}
      role="region"
      aria-label={t('language.switcher_region', 'Language Switcher')}
      data-testid="language-switcher-fab"
    >
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              'h-10 w-10 rounded-full shadow-lg border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60',
              'ring-1 ring-border hover:ring-2 focus-visible:ring-2',
            )}
            aria-label={t('language.change', 'Change language')}
          >
            <GlobeIcon className="h-5 w-5" />
            <span className="sr-only">{currentLabel}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent sideOffset={8} align="end" className="min-w-[12rem]">
          {supported.map(({ code, label }) => (
            <DropdownMenuItem
              key={code}
              onSelect={(e) => {
                e.preventDefault()
                changeLanguage(code)
              }}
              className="justify-between"
              aria-checked={current === code}
              role="menuitemradio"
            >
              <span className="truncate">
                {label || code}
                <span className="ml-2 text-muted-foreground text-xs">{code}</span>
              </span>
              {current === code ? <CheckIcon className="h-4 w-4" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
