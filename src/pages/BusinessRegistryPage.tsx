import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { detectDelimiter, extractDateFromFilename, parseDelimitedText, toDelimitedText } from '@/lib/delimited'
import { phoneMatches } from '@/lib/phone'
import { assertNoDataErrors, dataClient, ensureAuthSession } from '@/lib/api-client'
import { getUrl, uploadData } from 'aws-amplify/storage'

type RegistryRow = Record<string, string>

type SortState = {
  columnKey: string
  direction: 'asc' | 'desc'
} | null

type StoredStateV1 = {
  version: 1
  sourceFilename: string | null
  sourceUpdatedUntil: string | null
  delimiter: string | null
  importedAtIso: string | null
  header: string[]
  rows: RegistryRow[]
}

const STORAGE_KEY = 'eterra.businessRegistry.v1'

const EXPECTED_HEADER = [
  'AktivitetiID',
  'AktivitetiKryesor',
  'AktivitetetTjera',
  'nRegjistriID',
  'EmriBiznesit',
  'EmriTregtar',
  'NumriBiznesit',
  'NUI',
  'NumriFiskal',
  'LlojiBiznesit',
  'Komuna',
  'Vendi',
  'Adresa',
  'Telefoni',
  'Email',
  'NumriPunetoreve',
  'Kapitali',
  'DataRegjistrimit',
  'StatusiARBK',
] as const

const COLUMN_LABELS: Partial<Record<(typeof EXPECTED_HEADER)[number], string>> = {
  AktivitetiID: 'Activity ID',
  AktivitetiKryesor: 'Primary activity',
  AktivitetetTjera: 'Other activities',
  nRegjistriID: 'Registry no.',
  EmriBiznesit: 'Business name',
  EmriTregtar: 'Trade name',
  NumriBiznesit: 'Business number',
  NUI: 'NUI',
  NumriFiskal: 'Fiscal number',
  LlojiBiznesit: 'Legal type',
  Komuna: 'Municipality',
  Vendi: 'Place',
  Adresa: 'Address',
  Telefoni: 'Phone',
  Email: 'Email',
  NumriPunetoreve: 'Employees',
  Kapitali: 'Capital',
  DataRegjistrimit: 'Registration date',
  StatusiARBK: 'Status',
}

const DEFAULT_VISIBLE_COLUMNS: (typeof EXPECTED_HEADER)[number][] = [
  'EmriBiznesit',
  'NUI',
  'NumriFiskal',
  'Komuna',
  'Vendi',
  'Telefoni',
  'NumriPunetoreve',
  'Kapitali',
  'DataRegjistrimit',
  'StatusiARBK',
  'AktivitetiKryesor',
]

const normalize = (value: string) =>
  (value ?? '')
    .toString()
    .normalize('NFD')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()

function compareValues(a: string, b: string) {
  const aNorm = (a ?? '').trim()
  const bNorm = (b ?? '').trim()

  const aNum = Number(aNorm.replace(',', '.'))
  const bNum = Number(bNorm.replace(',', '.'))
  const aIsNum = Number.isFinite(aNum) && aNorm.length > 0
  const bIsNum = Number.isFinite(bNum) && bNorm.length > 0

  if (aIsNum && bIsNum) return aNum - bNum
  return aNorm.localeCompare(bNorm, undefined, { numeric: true, sensitivity: 'base' })
}

function decodeSmart(bytes: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  const looksCorrupt = /[‰‡‹›œŽžŸ]/.test(utf8) || utf8.includes('�')
  if (!looksCorrupt) return utf8
  try {
    return new TextDecoder('windows-1252', { fatal: false }).decode(bytes)
  } catch {
    return utf8
  }
}

void decodeSmart

function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

type ActivityOption = { code: string; label: string }

function parseActivityOption(value: string): ActivityOption | null {
  const raw = (value ?? '').trim()
  const match = raw.match(/^(\d{2,4})\s*-\s*(.+)$/)
  if (!match) return null
  const code = match[1]
  const label = `${code} - ${match[2].trim()}`
  return { code, label }
}

function extractActivityCodes(value: string): string[] {
  const raw = value ?? ''
  return raw
    .split(';')
    .map((part) => part.trim())
    .map((part) => parseActivityOption(part)?.code)
    .filter((v): v is string => Boolean(v))
}

function decodeSmartV2(bytes: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  const looksCorrupt =
    /[\u2030\u2021\u2039\u203A\u0153\u017D\u017E\u0178]/.test(utf8) || // common mojibake characters
    utf8.includes('�') // replacement character
  if (!looksCorrupt) return utf8
  try {
    return new TextDecoder('windows-1252', { fatal: false }).decode(bytes)
  } catch {
    return utf8
  }
}

export default function BusinessRegistryPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [sourceFilename, setSourceFilename] = useState<string | null>(null)
  const [sourceUpdatedUntil, setSourceUpdatedUntil] = useState<string | null>(null)
  const [delimiter, setDelimiter] = useState<string | null>(null)
  const [importedAtIso, setImportedAtIso] = useState<string | null>(null)

  const [header, setHeader] = useState<string[]>([])
  const [rows, setRows] = useState<RegistryRow[]>([])

  const [file, setFile] = useState<File | null>(null)
  const [fileText, setFileText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingShared, setLoadingShared] = useState(false)

  const [searchForm, setSearchForm] = useState({
    businessName: '',
    nui: '',
    fiscalNumber: '',
    phone: '',
    mainActivityCode: 'all',
    otherActivityCode: 'all',
    status: 'all',
    municipality: 'all',
  })
  const [activeFilters, setActiveFilters] = useState(searchForm)
  const [sortState, setSortState] = useState<SortState>(null)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [visibleLimit, setVisibleLimit] = useState(100)
  const [showAllColumns, setShowAllColumns] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [notesLoading, setNotesLoading] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)
  const [notesNui, setNotesNui] = useState<string | null>(null)
  const [notesText, setNotesText] = useState('')

  const sharedModelsAvailable = useMemo(() => {
    const models = dataClient.models as unknown as Record<string, any>
    return Boolean(models?.ArbkDataset?.get && models?.ArbkDataset?.create && models?.ArbkDataset?.update)
  }, [])

  const notesModelAvailable = useMemo(() => {
    const models = dataClient.models as unknown as Record<string, any>
    return Boolean(models?.ArbkBusinessNote?.get && models?.ArbkBusinessNote?.create && models?.ArbkBusinessNote?.update)
  }, [])

  const explainBackendError = (err: unknown): string => {
    const message = err instanceof Error ? err.message : String(err)
    if (message.toLowerCase().includes('missing bucket name')) {
      return 'Storage is not configured for this environment. Run Amplify sandbox/deploy and regenerate outputs so the app has the Storage bucket.'
    }
    if (message.toLowerCase().includes('cannot read properties of undefined') || message.toLowerCase().includes('is not a function')) {
      return 'Backend outputs are out of date. Run Amplify sandbox/deploy and regenerate outputs, then reload the app.'
    }
    return message || 'Unknown error'
  }

  useEffect(() => {
    // Fast local fallback (optional), then load the shared dataset from the backend.
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as StoredStateV1
        if (parsed?.version === 1) {
          setSourceFilename(parsed.sourceFilename ?? null)
          setSourceUpdatedUntil(parsed.sourceUpdatedUntil ?? null)
          setDelimiter(parsed.delimiter ?? null)
          setImportedAtIso(parsed.importedAtIso ?? null)
          setHeader(Array.isArray(parsed.header) ? parsed.header : [])
          if (Array.isArray(parsed.rows) && parsed.rows.length) setRows(parsed.rows)
        }
      }
    } catch {}

    const loadShared = async () => {
      if (!sharedModelsAvailable) return
      setLoadingShared(true)
      setError(null)
      try {
        await ensureAuthSession()
        const latest = await (dataClient.models as any).ArbkDataset.get({ datasetKey: 'latest' })
        assertNoDataErrors(latest)
        const dataset = latest.data
        if (!dataset?.fileKey) return

        const urlResult = await getUrl({ key: dataset.fileKey })
        const url = (urlResult as { url: URL }).url
        const response = await fetch(url.toString(), { cache: 'no-store' })
        const bytes = await response.arrayBuffer()
        const text = decodeSmartV2(bytes)

        const detected = detectDelimiter(text)
        const parsed = parseDelimitedText(text, detected)
        if (parsed.rows.length < 2) return

        const headerRow = parsed.rows[0].map((c) => (c ?? '').trim())
        const dataRows = parsed.rows.slice(1)
        const columnCount = headerRow.length
        const mappedRows: RegistryRow[] = dataRows.map((cells, index) => {
          const row: RegistryRow = { __id: `${Date.now()}_${index}` }
          for (let i = 0; i < columnCount; i++) row[headerRow[i]] = (cells[i] ?? '').trim()
          return row
        })

        setHeader(headerRow)
        setRows(mappedRows)
        setDelimiter(detected)
        setSourceFilename(dataset.fileName ?? null)
        setSourceUpdatedUntil(dataset.updatedUntil ?? null)
        setImportedAtIso(dataset.importedAt ?? null)
      } catch (err) {
        setError(explainBackendError(err))
      } finally {
        setLoadingShared(false)
      }
    }

    void loadShared()
  }, [])

  useEffect(() => {
    const state: StoredStateV1 = {
      version: 1,
      sourceFilename,
      sourceUpdatedUntil,
      delimiter,
      importedAtIso,
      header,
      rows: [],
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, [sourceFilename, sourceUpdatedUntil, delimiter, importedAtIso, header, rows])

  const headerMatchesExpected = useMemo(() => {
    if (header.length === 0) return false
    const normalizedHeader = header.map((h) => h.trim())
    return EXPECTED_HEADER.every((key) => normalizedHeader.includes(key))
  }, [header])

  const effectiveColumns = useMemo(() => {
    if (headerMatchesExpected) {
      return showAllColumns ? [...EXPECTED_HEADER] : DEFAULT_VISIBLE_COLUMNS
    }
    return header
  }, [header, headerMatchesExpected, showAllColumns])

  const statusOptions = useMemo(() => {
    const values = new Set<string>()
    rows.forEach((r) => {
      const v = (r['StatusiARBK'] ?? '').trim()
      if (v) values.add(v)
    })
    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))]
  }, [rows])

  const municipalityOptions = useMemo(() => {
    const values = new Set<string>()
    rows.forEach((r) => {
      const v = (r['Komuna'] ?? '').trim()
      if (v) values.add(v)
    })
    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))]
  }, [rows])

  const activityLabelByCode = useMemo(() => {
    const map = new Map<string, string>()
    rows.forEach((r) => {
      const main = parseActivityOption(r['AktivitetiKryesor'] ?? '')
      if (main) map.set(main.code, main.label)
      ;(r['AktivitetetTjera'] ?? '')
        .split(';')
        .map((p) => parseActivityOption(p.trim()))
        .filter(Boolean)
        .forEach((opt) => map.set((opt as ActivityOption).code, (opt as ActivityOption).label))
    })
    return map
  }, [rows])

  const mainActivityOptions = useMemo(() => {
    const codes = new Set<string>()
    rows.forEach((r) => {
      const parsed = parseActivityOption(r['AktivitetiKryesor'] ?? '')
      if (parsed) codes.add(parsed.code)
    })
    return ['all', ...Array.from(codes).sort((a, b) => a.localeCompare(b))]
  }, [rows])

  const otherActivityOptions = useMemo(() => {
    const codes = new Set<string>()
    rows.forEach((r) => extractActivityCodes(r['AktivitetetTjera'] ?? '').forEach((c) => codes.add(c)))
    return ['all', ...Array.from(codes).sort((a, b) => a.localeCompare(b))]
  }, [rows])

  const filteredRows = useMemo(() => {
    const businessName = normalize(activeFilters.businessName)
    const nui = normalize(activeFilters.nui)
    const fiscal = normalize(activeFilters.fiscalNumber)
    const phone = activeFilters.phone
    const mainCode = activeFilters.mainActivityCode
    const otherCode = activeFilters.otherActivityCode
    const status = activeFilters.status
    const municipality = activeFilters.municipality

    return rows.filter((row) => {
      if (status !== 'all' && (row['StatusiARBK'] ?? '') !== status) return false
      if (municipality !== 'all' && (row['Komuna'] ?? '') !== municipality) return false

      if (businessName && !normalize(row['EmriBiznesit'] ?? '').includes(businessName)) return false
      if (nui && !normalize(row['NUI'] ?? '').includes(nui)) return false
      if (fiscal && !normalize(row['NumriFiskal'] ?? '').includes(fiscal)) return false
      if (phone && !phoneMatches(row['Telefoni'] ?? '', phone)) return false

      if (mainCode !== 'all') {
        const parsed = parseActivityOption(row['AktivitetiKryesor'] ?? '')
        if (!parsed || parsed.code !== mainCode) return false
      }

      if (otherCode !== 'all') {
        const codes = extractActivityCodes(row['AktivitetetTjera'] ?? '')
        if (!codes.includes(otherCode)) return false
      }

      return true
    })
  }, [rows, activeFilters])

  const sortedRows = useMemo(() => {
    if (!sortState) return filteredRows
    const direction = sortState.direction === 'asc' ? 1 : -1
    const key = sortState.columnKey
    return [...filteredRows].sort((a, b) => direction * compareValues(a[key] ?? '', b[key] ?? ''))
  }, [filteredRows, sortState])

  const visibleRows = useMemo(() => sortedRows.slice(0, visibleLimit), [sortedRows, visibleLimit])

  const allVisibleSelected = useMemo(() => {
    if (visibleRows.length === 0) return false
    return visibleRows.every((r) => selectedRowIds.has(r.__id ?? ''))
  }, [visibleRows, selectedRowIds])

  const importSummary = useMemo(() => {
    if (!fileText) return null
    const d = delimiter ?? detectDelimiter(fileText)
    const parsed = parseDelimitedText(fileText, d)
    if (parsed.rows.length === 0) return null
    const columns = Math.max(...parsed.rows.map((r) => r.length))
    return { rows: parsed.rows.length, columns }
  }, [fileText, delimiter])

  const handleGoDashboard = () => navigate('/dashboard')
  const handleChooseFile = () => fileInputRef.current?.click()
  const handleOpenImport = () => setIsImportOpen(true)
  const handleCloseImport = () => {
    setIsImportOpen(false)
    setError(null)
  }

  useEffect(() => {
    if (!isImportOpen && !isNotesOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isNotesOpen) closeNotes()
      else handleCloseImport()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isImportOpen, isNotesOpen])

  const handleFileSelected = async (nextFile: File | null) => {
    setError(null)
    setFile(nextFile)
    setFileText(null)
    if (!nextFile) return
    try {
      const bytes = await nextFile.arrayBuffer()
      const text = decodeSmartV2(bytes)
      setFileText(text)
      setDelimiter(detectDelimiter(text))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read the file.')
    }
  }

  const handleImport = () => {
    setError(null)
    if (!file || !fileText) {
      setError('Please choose a file first.')
      return
    }

    const run = async () => {
      if (!sharedModelsAvailable) {
        setError('Shared backend is not ready. Deploy the new Amplify models/storage and regenerate outputs, then try again.')
        return
      }
      setLoadingShared(true)
      try {
        await ensureAuthSession()
        const updatedUntil = extractDateFromFilename(file.name)
        const safeName = file.name.replace(/[^\w.\-]+/g, '_')
        const fileKey = `arbk/${Date.now()}_${safeName}`

        const upload = uploadData({ key: fileKey, data: file })
        await upload.result

        const nowIso = new Date().toISOString()
        const existing = await (dataClient.models as any).ArbkDataset.get({ datasetKey: 'latest' })
        assertNoDataErrors(existing)
        const upsert = existing.data
          ? await (dataClient.models as any).ArbkDataset.update({
              datasetKey: 'latest',
              fileKey,
              fileName: file.name,
              updatedUntil: updatedUntil ?? undefined,
              importedAt: nowIso,
            })
          : await (dataClient.models as any).ArbkDataset.create({
              datasetKey: 'latest',
              fileKey,
              fileName: file.name,
              updatedUntil: updatedUntil ?? undefined,
              importedAt: nowIso,
            })
        assertNoDataErrors(upsert)

        const d = delimiter ?? detectDelimiter(fileText)
        const parsed = parseDelimitedText(fileText, d)
        if (parsed.rows.length < 2) {
          setError('The file does not contain enough rows (needs a header + at least one data row).')
          return
        }

        const headerRow = parsed.rows[0].map((c) => (c ?? '').trim())
        const dataRows = parsed.rows.slice(1)
        const columnCount = headerRow.length
        const mappedRows: RegistryRow[] = dataRows.map((cells, index) => {
          const row: RegistryRow = { __id: `${Date.now()}_${index}` }
          for (let i = 0; i < columnCount; i++) row[headerRow[i]] = (cells[i] ?? '').trim()
          return row
        })

        setHeader(headerRow)
        setRows(mappedRows)
        setSourceFilename(file.name)
        setSourceUpdatedUntil(updatedUntil)
        setImportedAtIso(nowIso)
        setSortState(null)
        const cleared = {
          businessName: '',
          nui: '',
          fiscalNumber: '',
          phone: '',
          mainActivityCode: 'all',
          otherActivityCode: 'all',
          status: 'all',
          municipality: 'all',
        }
        setSearchForm(cleared)
        setActiveFilters(cleared)
        setSelectedRowIds(new Set())
        setVisibleLimit(100)
        setIsImportOpen(false)
      } catch (err) {
        setError(explainBackendError(err))
      } finally {
        setLoadingShared(false)
      }
    }

    void run()
  }

  const toggleSort = (columnKey: string) => {
    setSortState((prev) => {
      if (!prev || prev.columnKey !== columnKey) return { columnKey, direction: 'asc' }
      if (prev.direction === 'asc') return { columnKey, direction: 'desc' }
      return null
    })
  }

  const toggleRowSelected = (rowId: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  const toggleSelectAllVisible = () => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) visibleRows.forEach((r) => next.delete(r.__id ?? ''))
      else visibleRows.forEach((r) => next.add(r.__id ?? ''))
      return next
    })
  }

  const exportRows = (mode: 'all' | 'filtered' | 'selected') => {
    if (header.length === 0) return
    const rowsToExport =
      mode === 'all'
        ? rows
        : mode === 'filtered'
          ? sortedRows
          : rows.filter((r) => selectedRowIds.has(r.__id ?? ''))

    const headerRow = header
    const data = rowsToExport.map((row) => headerRow.map((key) => row[key] ?? ''))
    const contents = toDelimitedText({ delimiter: ',', rows: [headerRow, ...data] })

    const safeBase = (sourceFilename ?? 'business_registry').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_')
    const filename = `${safeBase}_${mode}_${new Date().toISOString().slice(0, 10)}.csv`
    downloadTextFile(filename, contents)
  }

  const updatedLabel = sourceUpdatedUntil ? `Data updated until ${sourceUpdatedUntil}` : 'Update date not found in filename'
  const sourceLabel = sourceFilename ? `Source: ${sourceFilename}` : 'No file imported yet'

  const selectedRow = useMemo(() => {
    if (selectedRowIds.size !== 1) return null
    const selectedId = Array.from(selectedRowIds)[0]
    return rows.find((r) => (r.__id ?? '') === selectedId) ?? null
  }, [selectedRowIds, rows])

  const selectedNui = (selectedRow?.NUI ?? '').trim() || null
  const selectedBusinessName = (selectedRow?.EmriBiznesit ?? '').trim()

  const openNotes = () => {
    if (!selectedNui) return
    if (!notesModelAvailable) {
      setNotesError('Notes backend is not ready. Deploy the new Amplify models and regenerate outputs, then reload the app.')
      return
    }
    setNotesError(null)
    setNotesNui(selectedNui)
    setNotesText('')
    setIsNotesOpen(true)

    const load = async () => {
      setNotesLoading(true)
      try {
        await ensureAuthSession()
        const result = await (dataClient.models as any).ArbkBusinessNote.get({ nui: selectedNui })
        assertNoDataErrors(result)
        setNotesText(result.data?.note ?? '')
      } catch (err) {
        setNotesError(explainBackendError(err))
      } finally {
        setNotesLoading(false)
      }
    }

    void load()
  }

  const closeNotes = () => {
    setIsNotesOpen(false)
    setNotesError(null)
    setNotesNui(null)
    setNotesText('')
  }

  const saveNotes = async () => {
    if (!notesNui) return
    if (!notesModelAvailable) {
      setNotesError('Notes backend is not ready. Deploy the new Amplify models and regenerate outputs, then reload the app.')
      return
    }
    setNotesLoading(true)
    setNotesError(null)
    try {
      await ensureAuthSession()
      const nowIso = new Date().toISOString()
      const existing = await (dataClient.models as any).ArbkBusinessNote.get({ nui: notesNui })
      assertNoDataErrors(existing)
      const op = existing.data
        ? (dataClient.models as any).ArbkBusinessNote.update({ nui: notesNui, note: notesText, updatedAt: nowIso })
        : (dataClient.models as any).ArbkBusinessNote.create({ nui: notesNui, note: notesText, updatedAt: nowIso })
      const result = await op
      assertNoDataErrors(result)
      closeNotes()
    } catch (err) {
      setNotesError(explainBackendError(err))
    } finally {
      setNotesLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-[hsl(var(--muted-foreground))]">eterra</p>
              <h1 className="text-3xl font-semibold">ARBK Data</h1>
              <p className="text-[hsl(var(--muted-foreground))]">
                Search, filter, sort, select rows, and export business records.{' '}
                <span className="font-medium text-[hsl(var(--foreground))]">{updatedLabel}</span>
              </p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{sourceLabel}</p>
              {!sharedModelsAvailable ? (
                <p className="text-sm text-amber-700">
                  Shared ARBK data is not configured yet. Deploy the updated Amplify backend and regenerate outputs to enable shared uploads and notes.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600"
                onClick={handleGoDashboard}
              >
                Dashboard
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600"
                onClick={handleOpenImport}
                disabled={loadingShared}
              >
                Import CSV
              </Button>
            </div>
          </div>
        </header>

        <main className="space-y-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => void handleFileSelected(e.target.files?.[0] ?? null)}
          />

          {isImportOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Import ARBK Data"
              onClick={handleCloseImport}
            >
              <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle>Import ARBK Data</CardTitle>
                        <CardDescription>
                          Upload a file like <span className="font-mono">DD.MM.YYYY_bizneset_regjistruar.csv</span> (header row required).
                        </CardDescription>
                      </div>
                      <Button variant="outline" onClick={handleCloseImport}>
                        Close
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm">
                        <div className="font-semibold">{sourceLabel}</div>
                        <div className="text-[hsl(var(--muted-foreground))]">{updatedLabel}</div>
                        {importedAtIso ? (
                          <div className="text-[hsl(var(--muted-foreground))]">
                            Imported at {new Date(importedAtIso).toLocaleString()}
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label>Detected delimiter</Label>
                        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm">
                          {delimiter === ','
                            ? 'Comma (,)'
                            : delimiter === ';'
                              ? 'Semicolon (;)'
                              : delimiter === '\t'
                                ? 'Tab (TSV)'
                                : delimiter ?? 'N/A'}
                        </div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          Encoding issues are auto-fixed (e.g. broken special characters).
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Preview</Label>
                        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm">
                          {file ? (
                            <div className="space-y-1">
                              <div className="font-semibold">{file.name}</div>
                              <div className="text-[hsl(var(--muted-foreground))]">
                                {importSummary ? `${importSummary.rows} rows, ${importSummary.columns} columns` : 'N/A'}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[hsl(var(--muted-foreground))]">No file selected</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {error ? (
                      <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">{error}</div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleChooseFile}>
                          Choose CSV
                        </Button>
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">
                          {file ? 'Ready to import' : 'Choose a file to continue'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleCloseImport}>
                          Cancel
                        </Button>
                        <Button
                          className="bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600"
                          onClick={handleImport}
                          disabled={!file || !fileText || loadingShared}
                        >
                          {loadingShared ? 'Importing...' : 'Import'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          {isNotesOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Business notes"
              onClick={closeNotes}
            >
              <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle>Notes</CardTitle>
                        <CardDescription>
                          {selectedBusinessName ? (
                            <span>
                              {selectedBusinessName} • <span className="font-mono">{notesNui ?? 'NUI'}</span>
                            </span>
                          ) : (
                            <span className="font-mono">{notesNui ?? 'NUI'}</span>
                          )}
                        </CardDescription>
                      </div>
                      <Button variant="outline" onClick={closeNotes}>
                        Close
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="notes-text">Business notes</Label>
                      <textarea
                        id="notes-text"
                        className="min-h-[140px] w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                        value={notesText}
                        onChange={(e) => setNotesText(e.target.value)}
                        placeholder="Write notes for this business..."
                        disabled={notesLoading}
                      />
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        Notes are saved by NUI and will stay even after importing a new ARBK file.
                      </p>
                    </div>

                    {notesError ? (
                      <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">{notesError}</div>
                    ) : null}

                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" onClick={closeNotes} disabled={notesLoading}>
                        Cancel
                      </Button>
                      <Button
                        className="bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600"
                        onClick={() => void saveNotes()}
                        disabled={notesLoading || !notesNui}
                      >
                        {notesLoading ? 'Saving...' : 'Save notes'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Businesses</CardTitle>
              <CardDescription>
                {header.length === 0
                  ? 'Import a file to see results.'
                  : `Showing ${Math.min(visibleRows.length, sortedRows.length)} of ${sortedRows.length} filtered rows (${rows.length} total).`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
                <div className="grid gap-4 md:grid-cols-12">
                  <div className="space-y-2 md:col-span-6">
                    <Label htmlFor="f-business-name">Business Name</Label>
                    <Input
                      id="f-business-name"
                      placeholder="Business Name"
                      value={searchForm.businessName}
                      onChange={(e) => setSearchForm((p) => ({ ...p, businessName: e.target.value }))}
                      disabled={header.length === 0}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-3">
                    <Label htmlFor="f-nui">Unique Identification Number</Label>
                    <Input
                      id="f-nui"
                      placeholder="Unique Identification Number"
                      value={searchForm.nui}
                      onChange={(e) => setSearchForm((p) => ({ ...p, nui: e.target.value }))}
                      disabled={header.length === 0}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-3">
                    <Label htmlFor="f-fiscal">Fiscal Number</Label>
                    <Input
                      id="f-fiscal"
                      placeholder="Fiscal Number"
                      value={searchForm.fiscalNumber}
                      onChange={(e) => setSearchForm((p) => ({ ...p, fiscalNumber: e.target.value }))}
                      disabled={header.length === 0}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-4">
                    <Label htmlFor="f-phone">Phone Number</Label>
                    <Input
                      id="f-phone"
                      placeholder="Phone Number"
                      value={searchForm.phone}
                      onChange={(e) => setSearchForm((p) => ({ ...p, phone: e.target.value }))}
                      disabled={header.length === 0}
                    />
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Works with any format (spaces, slashes, country code).
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-4">
                    <Label htmlFor="f-main-activity">Main Activity</Label>
                    <select
                      id="f-main-activity"
                      className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
                      value={searchForm.mainActivityCode}
                      onChange={(e) => setSearchForm((p) => ({ ...p, mainActivityCode: e.target.value }))}
                      disabled={header.length === 0}
                    >
                      <option value="all">Select</option>
                      {mainActivityOptions
                        .filter((v) => v !== 'all')
                        .map((code) => (
                          <option key={code} value={code}>
                            {activityLabelByCode.get(code) ?? code}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-4">
                    <Label htmlFor="f-other-activity">Other Activities</Label>
                    <select
                      id="f-other-activity"
                      className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
                      value={searchForm.otherActivityCode}
                      onChange={(e) => setSearchForm((p) => ({ ...p, otherActivityCode: e.target.value }))}
                      disabled={header.length === 0}
                    >
                      <option value="all">Select</option>
                      {otherActivityOptions
                        .filter((v) => v !== 'all')
                        .map((code) => (
                          <option key={code} value={code}>
                            {activityLabelByCode.get(code) ?? code}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <details className="mt-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
                  <summary className="cursor-pointer text-sm font-medium">More filters</summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <select
                        className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
                        value={searchForm.status}
                        onChange={(e) => setSearchForm((p) => ({ ...p, status: e.target.value }))}
                        disabled={header.length === 0}
                      >
                        {statusOptions.map((v) => (
                          <option key={v} value={v}>
                            {v === 'all' ? 'All' : v}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>Municipality</Label>
                      <select
                        className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
                        value={searchForm.municipality}
                        onChange={(e) => setSearchForm((p) => ({ ...p, municipality: e.target.value }))}
                        disabled={header.length === 0}
                      >
                        {municipalityOptions.map((v) => (
                          <option key={v} value={v}>
                            {v === 'all' ? 'All' : v}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </details>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      className="w-full sm:w-auto bg-slate-900 text-white hover:bg-slate-800"
                      onClick={() => {
                        setActiveFilters(searchForm)
                        setVisibleLimit(100)
                        setSelectedRowIds(new Set())
                      }}
                      disabled={header.length === 0}
                    >
                      Search
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const cleared = {
                          businessName: '',
                          nui: '',
                          fiscalNumber: '',
                          phone: '',
                          mainActivityCode: 'all',
                          otherActivityCode: 'all',
                          status: 'all',
                          municipality: 'all',
                        }
                        setSearchForm(cleared)
                        setActiveFilters(cleared)
                        setVisibleLimit(100)
                        setSelectedRowIds(new Set())
                      }}
                      disabled={header.length === 0}
                    >
                      Clear
                    </Button>
                    <div className="text-sm text-[hsl(var(--muted-foreground))]">{selectedRowIds.size} selected</div>
                    <Button variant="outline" onClick={openNotes} disabled={!selectedNui || selectedRowIds.size !== 1}>
                      Notes
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => exportRows('all')} disabled={header.length === 0}>
                      Export all
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => exportRows('filtered')}
                      disabled={header.length === 0 || sortedRows.length === 0}
                    >
                      Export filtered
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => exportRows('selected')}
                      disabled={header.length === 0 || selectedRowIds.size === 0}
                    >
                      Export selected ({selectedRowIds.size})
                    </Button>
                  </div>
                </div>
              </div>

              {header.length ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      id="show-all-columns"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={showAllColumns}
                      onChange={(e) => setShowAllColumns(e.target.checked)}
                      disabled={!headerMatchesExpected}
                    />
                    <Label htmlFor="show-all-columns" className="text-sm">
                      Show all columns
                    </Label>
                  </div>
                  {!headerMatchesExpected ? (
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      Header does not match the expected ARBK format; showing raw columns.
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="overflow-auto rounded-md border border-[hsl(var(--border))]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[hsl(var(--card))]">
                    <tr>
                      <th className="w-12 px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                          disabled={header.length === 0 || visibleRows.length === 0}
                          aria-label="Select all visible rows"
                        />
                      </th>
                      {effectiveColumns.map((key) => {
                        const label = (COLUMN_LABELS as Record<string, string>)[key] ?? key
                        const isSorted = sortState?.columnKey === key
                        const indicator = isSorted ? (sortState?.direction === 'asc' ? '▲' : '▼') : ''
                        return (
                          <th key={key} className="px-3 py-2 text-left whitespace-nowrap">
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 font-semibold hover:underline"
                              onClick={() => toggleSort(key)}
                            >
                              <span>{label}</span>
                              <span className="text-xs text-[hsl(var(--muted-foreground))]">{indicator}</span>
                            </button>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {header.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-[hsl(var(--muted-foreground))]" colSpan={2}>
                          Import a file to start.
                        </td>
                      </tr>
                    ) : visibleRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-[hsl(var(--muted-foreground))]" colSpan={1 + effectiveColumns.length}>
                          No rows match your search/filters.
                        </td>
                      </tr>
                    ) : (
                      visibleRows.map((row) => {
                        const rowId = row.__id ?? ''
                        return (
                          <tr key={rowId} className="border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/10">
                            <td className="px-3 py-2 align-top">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={selectedRowIds.has(rowId)}
                                onChange={() => toggleRowSelected(rowId)}
                                aria-label="Select row"
                              />
                            </td>
                            {effectiveColumns.map((key) => (
                              <td key={key} className="px-3 py-2 align-top whitespace-nowrap">
                                {row[key] ? row[key] : <span className="text-[hsl(var(--muted-foreground))]">—</span>}
                              </td>
                            ))}
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {sortedRows.length > visibleLimit ? (
                <div className="flex items-center justify-center">
                  <Button variant="outline" onClick={() => setVisibleLimit((v) => v + 200)}>
                    Load more ({Math.min(visibleLimit + 200, sortedRows.length)} of {sortedRows.length})
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
