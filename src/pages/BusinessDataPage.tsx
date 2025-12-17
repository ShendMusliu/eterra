import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { detectDelimiter, extractDateFromFilename, parseDelimitedText, toDelimitedText } from '@/lib/delimited'

type Column = {
  id: string
  label: string
}

type DataRow = {
  id: string
  values: string[]
}

type ColumnFilter = {
  id: string
  columnId: string
  query: string
}

type SortState = {
  columnId: string
  direction: 'asc' | 'desc'
} | null

type StoredStateV1 = {
  version: 1
  columns: Column[]
  rows: DataRow[]
  sourceFilename: string | null
  sourceUpdatedUntil: string | null
  sourceDelimiter: string | null
  importedAtIso: string | null
  visibleColumnIds: string[] | null
}

const STORAGE_KEY = 'eterra.businessData.v1'

const createId = () =>
  globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `id_${Date.now()}_${Math.random()}`

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

export default function BusinessDataPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [columns, setColumns] = useState<Column[]>([])
  const [rows, setRows] = useState<DataRow[]>([])
  const [sourceFilename, setSourceFilename] = useState<string | null>(null)
  const [sourceUpdatedUntil, setSourceUpdatedUntil] = useState<string | null>(null)
  const [sourceDelimiter, setSourceDelimiter] = useState<string | null>(null)
  const [importedAtIso, setImportedAtIso] = useState<string | null>(null)

  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(new Set())
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())

  const [globalSearch, setGlobalSearch] = useState('')
  const [sortState, setSortState] = useState<SortState>(null)
  const [filters, setFilters] = useState<ColumnFilter[]>([])

  const [editMode, setEditMode] = useState(false)
  const [visibleLimit, setVisibleLimit] = useState(50)

  const [importHeaderRow, setImportHeaderRow] = useState(false)
  const [importDelimiter, setImportDelimiter] = useState<string>(',')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importText, setImportText] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const [newFilterColumnId, setNewFilterColumnId] = useState<string>('')
  const [newFilterQuery, setNewFilterQuery] = useState('')

  const [exportDelimiter, setExportDelimiter] = useState<string>(',')
  const [exportIncludeHeader, setExportIncludeHeader] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as StoredStateV1
      if (!parsed || parsed.version !== 1) return

      const loadedColumns = Array.isArray(parsed.columns) ? parsed.columns : []
      const loadedRows = Array.isArray(parsed.rows) ? parsed.rows : []

      setColumns(loadedColumns)
      setRows(loadedRows)
      setSourceFilename(parsed.sourceFilename ?? null)
      setSourceUpdatedUntil(parsed.sourceUpdatedUntil ?? null)
      setSourceDelimiter(parsed.sourceDelimiter ?? null)
      setImportedAtIso(parsed.importedAtIso ?? null)

      const initialVisible =
        parsed.visibleColumnIds?.length ? new Set(parsed.visibleColumnIds) : new Set(loadedColumns.map((c) => c.id))
      setVisibleColumnIds(initialVisible)

      setNewFilterColumnId(loadedColumns[0]?.id ?? '')
      setImportDelimiter(parsed.sourceDelimiter ?? ',')
    } catch {
      // ignore corrupted storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const state: StoredStateV1 = {
      version: 1,
      columns,
      rows,
      sourceFilename,
      sourceUpdatedUntil,
      sourceDelimiter,
      importedAtIso,
      visibleColumnIds: Array.from(visibleColumnIds),
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, [columns, rows, sourceFilename, sourceUpdatedUntil, sourceDelimiter, importedAtIso, visibleColumnIds])

  const columnIndexById = useMemo(() => {
    const map = new Map<string, number>()
    columns.forEach((col, idx) => map.set(col.id, idx))
    return map
  }, [columns])

  const visibleColumns = useMemo(() => columns.filter((c) => visibleColumnIds.has(c.id)), [columns, visibleColumnIds])

  const filteredRows = useMemo(() => {
    const global = normalize(globalSearch)
    const activeFilters = filters
      .map((f) => ({ ...f, queryNorm: normalize(f.query), columnIndex: columnIndexById.get(f.columnId) ?? -1 }))
      .filter((f) => f.queryNorm.length > 0 && f.columnIndex >= 0)

    const matches = (row: DataRow) => {
      if (activeFilters.length) {
        for (const filter of activeFilters) {
          const cell = row.values[filter.columnIndex] ?? ''
          if (!normalize(cell).includes(filter.queryNorm)) return false
        }
      }

      if (!global) return true
      return row.values.some((cell) => normalize(cell).includes(global))
    }

    return rows.filter(matches)
  }, [rows, globalSearch, filters, columnIndexById])

  const sortedRows = useMemo(() => {
    if (!sortState) return filteredRows
    const idx = columnIndexById.get(sortState.columnId)
    if (idx === undefined) return filteredRows
    const direction = sortState.direction === 'asc' ? 1 : -1

    return [...filteredRows].sort((a, b) => direction * compareValues(a.values[idx] ?? '', b.values[idx] ?? ''))
  }, [filteredRows, sortState, columnIndexById])

  const visibleRows = useMemo(() => sortedRows.slice(0, visibleLimit), [sortedRows, visibleLimit])

  const allVisibleSelected = useMemo(() => {
    if (visibleRows.length === 0) return false
    return visibleRows.every((r) => selectedRowIds.has(r.id))
  }, [selectedRowIds, visibleRows])

  const selectedCount = selectedRowIds.size

  const resetSelection = () => setSelectedRowIds(new Set())

  const handleBack = () => navigate('/dashboard')

  const handleChooseFile = () => fileInputRef.current?.click()

  const handleFileSelected = async (file: File | null) => {
    setImportError(null)
    setImportFile(file)
    setImportText(null)
    if (!file) return
    try {
      const text = await file.text()
      setImportText(text)
      setImportDelimiter(detectDelimiter(text))
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to read the file.')
    }
  }

  const buildColumns = (labels: string[], count: number) => {
    const normalizedLabels = Array.from({ length: count }, (_, i) => (labels[i] ?? '').trim())
    return normalizedLabels.map((label, idx) => ({
      id: `col_${idx + 1}`,
      label: label.length ? label : `Column ${idx + 1}`,
    }))
  }

  const handleImport = () => {
    setImportError(null)
    if (!importFile || !importText) {
      setImportError('Please choose a file first.')
      return
    }

    const delimiter = importDelimiter
    const parsed = parseDelimitedText(importText, delimiter)
    if (parsed.rows.length === 0) {
      setImportError('No rows found in the file.')
      return
    }

    const columnCount = Math.max(...parsed.rows.map((r) => r.length))
    const padded = parsed.rows.map((r) => r.concat(Array.from({ length: Math.max(0, columnCount - r.length) }, () => '')))

    const hasHeader = importHeaderRow
    const headerLabels = hasHeader ? padded[0] : []
    const dataRows = hasHeader ? padded.slice(1) : padded

    const nextColumns = buildColumns(headerLabels, columnCount)
    const nextRows: DataRow[] = dataRows.map((r) => ({
      id: createId(),
      values: r.map((v) => (v ?? '').trim()),
    }))

    const updatedUntil = extractDateFromFilename(importFile.name)

    setColumns(nextColumns)
    setRows(nextRows)
    setSourceFilename(importFile.name)
    setSourceDelimiter(delimiter)
    setSourceUpdatedUntil(updatedUntil)
    setImportedAtIso(new Date().toISOString())
    setVisibleColumnIds(new Set(nextColumns.map((c) => c.id)))
    setFilters([])
    setSortState(null)
    setGlobalSearch('')
    setVisibleLimit(50)
    setNewFilterColumnId(nextColumns[0]?.id ?? '')
    resetSelection()
  }

  const handleToggleVisibleColumn = (columnId: string) => {
    setVisibleColumnIds((prev) => {
      const next = new Set(prev)
      if (next.has(columnId)) next.delete(columnId)
      else next.add(columnId)
      return next
    })
  }

  const handleToggleRowSelected = (rowId: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  const handleToggleSelectAllVisible = () => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visibleRows.forEach((r) => next.delete(r.id))
      } else {
        visibleRows.forEach((r) => next.add(r.id))
      }
      return next
    })
  }

  const handleAddFilter = () => {
    const query = newFilterQuery.trim()
    if (!newFilterColumnId || !query) return
    setFilters((prev) => [...prev, { id: createId(), columnId: newFilterColumnId, query }])
    setNewFilterQuery('')
    setVisibleLimit(50)
    resetSelection()
  }

  const handleRemoveFilter = (filterId: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== filterId))
    setVisibleLimit(50)
    resetSelection()
  }

  const toggleSort = (columnId: string) => {
    setSortState((prev) => {
      if (!prev || prev.columnId !== columnId) return { columnId, direction: 'asc' }
      if (prev.direction === 'asc') return { columnId, direction: 'desc' }
      return null
    })
  }

  const updateCell = (rowId: string, columnId: string, value: string) => {
    const colIndex = columnIndexById.get(columnId)
    if (colIndex === undefined) return
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row
        const next = [...row.values]
        next[colIndex] = value
        return { ...row, values: next }
      }),
    )
  }

  const handleAddRow = () => {
    if (columns.length === 0) return
    const empty: DataRow = { id: createId(), values: Array.from({ length: columns.length }, () => '') }
    setRows((prev) => [empty, ...prev])
    setEditMode(true)
    setVisibleLimit((prev) => Math.max(prev, 50))
  }

  const handleDeleteSelectedRows = () => {
    if (selectedRowIds.size === 0) return
    setRows((prev) => prev.filter((r) => !selectedRowIds.has(r.id)))
    resetSelection()
  }

  const handleClearAll = () => {
    setColumns([])
    setRows([])
    setSourceFilename(null)
    setSourceUpdatedUntil(null)
    setSourceDelimiter(null)
    setImportedAtIso(null)
    setVisibleColumnIds(new Set())
    setSelectedRowIds(new Set())
    setGlobalSearch('')
    setSortState(null)
    setFilters([])
    setVisibleLimit(50)
    setNewFilterColumnId('')
  }

  const buildExportRows = (rowsToExport: DataRow[]) => {
    const exportColumns = columns.filter((c) => visibleColumnIds.has(c.id))
    const indices = exportColumns.map((c) => columnIndexById.get(c.id) ?? -1)
    const header = exportColumns.map((c) => c.label)

    const data = rowsToExport.map((row) => indices.map((i) => (i >= 0 ? row.values[i] ?? '' : '')))
    return exportIncludeHeader ? [header, ...data] : data
  }

  const downloadTextFile = (filename: string, contents: string) => {
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

  const exportData = (mode: 'all' | 'selected' | 'visible') => {
    if (columns.length === 0) return

    const rowsToExport =
      mode === 'all'
        ? rows
        : mode === 'visible'
          ? sortedRows
          : rows.filter((r) => selectedRowIds.has(r.id))

    const table = buildExportRows(rowsToExport)
    const delimiter = exportDelimiter
    const contents = toDelimitedText({ delimiter, rows: table })

    const safeBase = (sourceFilename ?? 'business-data').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_')
    const suffix = mode === 'all' ? 'all' : mode === 'visible' ? 'filtered' : 'selected'
    const ext = delimiter === '\t' ? 'tsv' : 'csv'
    const filename = `${safeBase}_${suffix}_${new Date().toISOString().slice(0, 10)}.${ext}`
    downloadTextFile(filename, contents)
  }

  const importSummary = useMemo(() => {
    if (!importText) return null
    const parsed = parseDelimitedText(importText, importDelimiter)
    if (parsed.rows.length === 0) return null
    const colCount = Math.max(...parsed.rows.map((r) => r.length))
    return { rows: parsed.rows.length, columns: colCount }
  }, [importText, importDelimiter])

  const updatedLabel = sourceUpdatedUntil ? `Data updated until ${sourceUpdatedUntil}` : 'Update date not found in filename'
  const sourceLabel = sourceFilename ? `Source: ${sourceFilename}` : 'No file imported yet'

  const renderTable = () => (
    <div className="overflow-auto rounded-md border border-[hsl(var(--border))]">
      <table className="min-w-full text-sm">
        <thead className="bg-[hsl(var(--card))]">
          <tr>
            <th className="w-12 px-3 py-2 text-left">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={allVisibleSelected}
                onChange={handleToggleSelectAllVisible}
                disabled={columns.length === 0 || visibleRows.length === 0}
                aria-label="Select all visible rows"
              />
            </th>
            {visibleColumns.map((col) => {
              const isSorted = sortState?.columnId === col.id
              const indicator = isSorted ? (sortState?.direction === 'asc' ? '▲' : '▼') : ''
              return (
                <th key={col.id} className="px-3 py-2 text-left whitespace-nowrap">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 font-semibold hover:underline"
                    onClick={() => toggleSort(col.id)}
                  >
                    <span>{col.label}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{indicator}</span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {columns.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-[hsl(var(--muted-foreground))]" colSpan={2}>
                Import a file to start.
              </td>
            </tr>
          ) : visibleRows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-[hsl(var(--muted-foreground))]" colSpan={1 + visibleColumns.length}>
                No rows match your search/filters.
              </td>
            </tr>
          ) : (
            visibleRows.map((row) => (
              <tr key={row.id} className="border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/10">
                <td className="px-3 py-2 align-top">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selectedRowIds.has(row.id)}
                    onChange={() => handleToggleRowSelected(row.id)}
                    aria-label="Select row"
                  />
                </td>
                {visibleColumns.map((col) => {
                  const idx = columnIndexById.get(col.id) ?? -1
                  const value = idx >= 0 ? row.values[idx] ?? '' : ''
                  return (
                    <td key={col.id} className="px-3 py-2 align-top whitespace-nowrap">
                      {editMode ? (
                        <Input value={value} onChange={(e) => updateCell(row.id, col.id, e.target.value)} />
                      ) : (
                        <span>{value || <span className="text-[hsl(var(--muted-foreground))]">—</span>}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <nav className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <span className="font-brand text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
                Business Data
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600"
                onClick={handleBack}
              >
                Dashboard
              </Button>
              <Button variant="outline" onClick={handleChooseFile}>
                Choose CSV/TSV
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600"
                onClick={handleImport}
                disabled={!importFile || !importText}
              >
                Import
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import & Metadata</CardTitle>
              <CardDescription>Import a CSV/TSV file, then search, filter, sort, edit, and export the data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                className="hidden"
                onChange={(e) => void handleFileSelected(e.target.files?.[0] ?? null)}
              />

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Delimiter</Label>
                  <select
                    className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
                    value={importDelimiter}
                    onChange={(e) => setImportDelimiter(e.target.value)}
                  >
                    <option value=",">Comma (,)</option>
                    <option value=";">Semicolon (;)</option>
                    <option value="\t">Tab (TSV)</option>
                    <option value="|">Pipe (|)</option>
                  </select>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Auto-detected, but you can override it.</p>
                </div>

                <div className="space-y-2">
                  <Label>Header row</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="header-row"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={importHeaderRow}
                      onChange={(e) => setImportHeaderRow(e.target.checked)}
                    />
                    <Label htmlFor="header-row" className="text-sm">
                      First row contains column names
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Import preview</Label>
                  <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm">
                    {importFile ? (
                      <div className="space-y-1">
                        <div className="font-semibold">{importFile.name}</div>
                        <div className="text-[hsl(var(--muted-foreground))]">
                          {importSummary ? `${importSummary.rows} rows, ${importSummary.columns} columns` : '—'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[hsl(var(--muted-foreground))]">No file selected</div>
                    )}
                  </div>
                </div>
              </div>

              {importError ? (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">{importError}</div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm">
                  <div className="font-semibold">{sourceLabel}</div>
                  <div className="text-[hsl(var(--muted-foreground))]">{updatedLabel}</div>
                  {importedAtIso ? (
                    <div className="text-[hsl(var(--muted-foreground))]">
                      Imported at {new Date(importedAtIso).toLocaleString()}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    className="bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600"
                    onClick={handleAddRow}
                    disabled={columns.length === 0}
                  >
                    Add row
                  </Button>
                  <Button variant="outline" onClick={() => setEditMode((v) => !v)} disabled={columns.length === 0}>
                    {editMode ? 'Stop editing' : 'Edit cells'}
                  </Button>
                  <Button variant="outline" onClick={handleDeleteSelectedRows} disabled={selectedCount === 0}>
                    Delete selected ({selectedCount})
                  </Button>
                  <Button variant="outline" onClick={handleClearAll} disabled={columns.length === 0 && rows.length === 0}>
                    Clear all
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Table</CardTitle>
                <CardDescription>
                  {columns.length === 0
                    ? 'Import a file to see the data here.'
                    : `Showing ${Math.min(visibleRows.length, sortedRows.length)} of ${sortedRows.length} filtered rows (${rows.length} total).`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="global-search">Search</Label>
                    <Input
                      id="global-search"
                      value={globalSearch}
                      onChange={(e) => {
                        setGlobalSearch(e.target.value)
                        setVisibleLimit(50)
                        resetSelection()
                      }}
                      placeholder="Search across all cells..."
                      disabled={columns.length === 0}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Add filter</Label>
                    <div className="flex gap-2">
                      <select
                        className="h-10 w-40 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
                        value={newFilterColumnId}
                        onChange={(e) => setNewFilterColumnId(e.target.value)}
                        disabled={columns.length === 0}
                      >
                        {columns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <Input
                        value={newFilterQuery}
                        onChange={(e) => setNewFilterQuery(e.target.value)}
                        placeholder="Contains..."
                        disabled={columns.length === 0}
                      />
                      <Button variant="outline" onClick={handleAddFilter} disabled={columns.length === 0 || !newFilterQuery.trim()}>
                        Add
                      </Button>
                    </div>
                  </div>
                </div>

                {filters.length ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">Active filters:</span>
                    {filters.map((f) => (
                      <button
                        key={f.id}
                        className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1 text-sm"
                        onClick={() => handleRemoveFilter(f.id)}
                        title="Click to remove"
                        type="button"
                      >
                        <span className="font-medium">{columns[columnIndexById.get(f.columnId) ?? 0]?.label ?? 'Column'}</span>
                        <span className="text-[hsl(var(--muted-foreground))]">contains</span>
                        <span className="font-medium">{f.query}</span>
                        <span className="text-[hsl(var(--muted-foreground))]">×</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-sm">Export format</Label>
                  <select
                    className="h-10 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
                    value={exportDelimiter}
                    onChange={(e) => setExportDelimiter(e.target.value)}
                    disabled={columns.length === 0}
                  >
                    <option value=",">CSV (comma)</option>
                    <option value=";">CSV (semicolon)</option>
                    <option value="\t">TSV (tab)</option>
                  </select>

                  <div className="flex items-center gap-2">
                    <input
                      id="export-header"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={exportIncludeHeader}
                      onChange={(e) => setExportIncludeHeader(e.target.checked)}
                      disabled={columns.length === 0}
                    />
                    <Label htmlFor="export-header" className="text-sm">
                      Include headers
                    </Label>
                  </div>

                  <Button variant="outline" onClick={() => exportData('all')} disabled={columns.length === 0}>
                    Export all
                  </Button>
                  <Button variant="outline" onClick={() => exportData('visible')} disabled={columns.length === 0 || sortedRows.length === 0}>
                    Export filtered
                  </Button>
                  <Button variant="outline" onClick={() => exportData('selected')} disabled={columns.length === 0 || selectedCount === 0}>
                    Export selected ({selectedCount})
                  </Button>
                </div>

                {renderTable()}

                {sortedRows.length > visibleLimit ? (
                  <div className="flex items-center justify-center">
                    <Button variant="outline" onClick={() => setVisibleLimit((v) => v + 50)}>
                      Load more ({Math.min(visibleLimit + 50, sortedRows.length)} of {sortedRows.length})
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Columns</CardTitle>
                <CardDescription>Select which columns are visible and exported.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleColumnIds(new Set(columns.map((c) => c.id)))}
                    disabled={columns.length === 0}
                  >
                    Show all
                  </Button>
                  <Button variant="outline" onClick={() => setVisibleColumnIds(new Set())} disabled={columns.length === 0}>
                    Hide all
                  </Button>
                </div>

                <div className="max-h-[420px] overflow-auto rounded-md border border-[hsl(var(--border))] p-3">
                  {columns.length === 0 ? (
                    <div className="text-sm text-[hsl(var(--muted-foreground))]">No columns yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {columns.map((col) => (
                        <label key={col.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={visibleColumnIds.has(col.id)}
                            onChange={() => handleToggleVisibleColumn(col.id)}
                          />
                          <span className="truncate" title={col.label}>
                            {col.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {sourceDelimiter ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Imported delimiter: {sourceDelimiter === '\t' ? 'Tab (TSV)' : sourceDelimiter}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
