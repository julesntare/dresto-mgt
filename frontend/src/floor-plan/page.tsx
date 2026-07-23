import { useEffect, useMemo, useRef, useState } from 'react'
import { floorPlanApi, tablesApi } from '../lib/api'
import type { Table, TableStatus } from '../lib/api'
import { useAuth } from '../lib/use-auth'
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Save,
  Map as MapIcon,
  X,
} from 'lucide-react'

// ---- constants ---------------------------------------------------------

const STATUS_FILL: Record<TableStatus, string> = {
  AVAILABLE: '#16a34a',
  OCCUPIED: '#dc2626',
  RESERVED: '#d97706',
}
const UNKNOWN_FILL = '#6b7280'

interface LandmarkKind {
  type: string
  label: string
  glyph: string
  vertical?: boolean
}

const LANDMARK_KINDS: LandmarkKind[] = [
  { type: 'kitchen', label: 'Kitchen', glyph: '🍳' },
  { type: 'restroom', label: 'Restroom', glyph: '🚻' },
  { type: 'bar', label: 'Bar', glyph: '🍸' },
  { type: 'entrance', label: 'Entrance', glyph: '🚪' },
  { type: 'counter', label: 'Counter', glyph: '🧾' },
  { type: 'stairs', label: 'Stairs', glyph: '🪜', vertical: true },
  { type: 'elevator', label: 'Elevator', glyph: '🛗', vertical: true },
  { type: 'other', label: 'Other', glyph: '📍' },
]

const kindOf = (type: string) =>
  LANDMARK_KINDS.find((k) => k.type === type) ?? LANDMARK_KINDS[LANDMARK_KINDS.length - 1]

// ---- working (client-side) model --------------------------------------

interface WLandmark {
  id: string
  type: string
  label?: string | null
  posX: number
  posY: number
}
interface WPlacement {
  tableId: string
  posX: number
  posY: number
}
interface WFloor {
  id: string
  name: string
  landmarks: WLandmark[]
  tables: WPlacement[]
}

const uid = () =>
  (crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(16).slice(2)}`)

// ---- page --------------------------------------------------------------

export default function FloorPlanPage() {
  const { user } = useAuth()
  const editable = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const [floors, setFloors] = useState<WFloor[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [planRes, tablesRes] = await Promise.all([
          floorPlanApi.get(),
          tablesApi.getAll(),
        ])
        setTables(tablesRes.tables)
        const loaded: WFloor[] = (planRes.floors ?? []).map((f) => ({
          id: f.id ?? uid(),
          name: f.name,
          landmarks: (f.landmarks ?? []).map((l) => ({
            id: l.id ?? uid(),
            type: l.type,
            label: l.label ?? null,
            posX: l.posX,
            posY: l.posY,
          })),
          tables: (f.tables ?? []).map((t) => ({
            tableId: t.tableId,
            posX: t.posX,
            posY: t.posY,
          })),
        }))
        setFloors(loaded.length ? loaded : [{ id: uid(), name: 'Ground floor', landmarks: [], tables: [] }])
      } catch {
        setError('Failed to load the floor plan.')
        setFloors([{ id: uid(), name: 'Ground floor', landmarks: [], tables: [] }])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Warn on tab close with unsaved edits.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const active = floors[activeIdx]
  const tableById = useMemo(
    () => new Map(tables.map((t) => [t.id, t])),
    [tables],
  )
  const placedIds = useMemo(
    () => new Set(floors.flatMap((f) => f.tables.map((t) => t.tableId))),
    [floors],
  )
  const unplaced = useMemo(
    () => tables.filter((t) => !placedIds.has(t.id)),
    [tables, placedIds],
  )

  // ---- mutations -------------------------------------------------------

  const patchActive = (updater: (f: WFloor) => WFloor) => {
    setFloors((prev) => prev.map((f, i) => (i === activeIdx ? updater(f) : f)))
    setDirty(true)
  }

  const moveTable = (tableId: string, x: number, y: number) =>
    patchActive((f) => ({
      ...f,
      tables: f.tables.map((t) => (t.tableId === tableId ? { ...t, posX: x, posY: y } : t)),
    }))

  const moveLandmark = (id: string, x: number, y: number) =>
    patchActive((f) => ({
      ...f,
      landmarks: f.landmarks.map((l) => (l.id === id ? { ...l, posX: x, posY: y } : l)),
    }))

  const removeTable = (tableId: string) =>
    patchActive((f) => ({ ...f, tables: f.tables.filter((t) => t.tableId !== tableId) }))

  const removeLandmark = (id: string) =>
    patchActive((f) => ({ ...f, landmarks: f.landmarks.filter((l) => l.id !== id) }))

  const addTable = (tableId: string) => {
    if (!tableId) return
    patchActive((f) => ({
      ...f,
      tables: [...f.tables, { tableId, posX: 0.5, posY: 0.5 }],
    }))
  }

  const addLandmark = (type: string) => {
    if (!type) return
    let label: string | null = null
    if (type === 'other') {
      const entered = window.prompt('Landmark label (e.g. VIP room):')?.trim()
      if (!entered) return
      label = entered
    }
    patchActive((f) => ({
      ...f,
      landmarks: [...f.landmarks, { id: uid(), type, label, posX: 0.5, posY: 0.35 }],
    }))
  }

  // ---- floor management ------------------------------------------------

  const addFloor = () => {
    const name = window.prompt('New floor name:', `Floor ${floors.length + 1}`)?.trim()
    if (!name) return
    setFloors((prev) => [...prev, { id: uid(), name, landmarks: [], tables: [] }])
    setActiveIdx(floors.length)
    setDirty(true)
  }

  const renameFloor = () => {
    if (!active) return
    const name = window.prompt('Rename floor:', active.name)?.trim()
    if (!name) return
    setFloors((prev) => prev.map((f, i) => (i === activeIdx ? { ...f, name } : f)))
    setDirty(true)
  }

  const moveFloor = (dir: -1 | 1) => {
    const to = activeIdx + dir
    if (to < 0 || to >= floors.length) return
    setFloors((prev) => {
      const next = [...prev]
      const [f] = next.splice(activeIdx, 1)
      next.splice(to, 0, f)
      return next
    })
    setActiveIdx(to)
    setDirty(true)
  }

  const deleteFloor = () => {
    if (!active || floors.length <= 1) return
    const hasContent = active.tables.length + active.landmarks.length > 0
    if (hasContent && !window.confirm(`Delete "${active.name}" and its ${active.tables.length} table(s) / ${active.landmarks.length} landmark(s)?`)) {
      return
    }
    setFloors((prev) => prev.filter((_, i) => i !== activeIdx))
    setActiveIdx((i) => Math.max(0, i - (activeIdx === floors.length - 1 ? 1 : 0)))
    setDirty(true)
  }

  // ---- save ------------------------------------------------------------

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await floorPlanApi.save(
        floors.map((f, i) => ({
          name: f.name,
          order: i,
          landmarks: f.landmarks.map((l) => ({
            type: l.type,
            label: l.label ?? null,
            posX: l.posX,
            posY: l.posY,
          })),
          tables: f.tables.map((t) => ({ tableId: t.tableId, posX: t.posX, posY: t.posY })),
        })),
      )
      setDirty(false)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError(
        status === 401 || status === 403
          ? 'Only a manager or admin can save the floor plan.'
          : 'Failed to save the floor plan.',
      )
    } finally {
      setSaving(false)
    }
  }

  // ---- render ----------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900 dark:border-gray-100" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MapIcon className="h-6 w-6" /> Floor Plan
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {editable
              ? 'Lay out tables and landmarks per floor. Drag to position, right-click or ✕ to remove.'
              : 'Read-only. Ask an admin or manager to edit the layout.'}
          </p>
        </div>
        {editable && (
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Floor tabs + management */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {floors.map((f, i) => (
          <button
            key={f.id}
            onClick={() => setActiveIdx(i)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              i === activeIdx
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {f.name}
          </button>
        ))}
        {editable && (
          <button
            onClick={addFloor}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" /> Add floor
          </button>
        )}

        {editable && active && (
          <div className="ml-auto flex items-center gap-1">
            <IconBtn title="Move floor left" onClick={() => moveFloor(-1)} disabled={activeIdx === 0}>
              <ArrowLeft className="h-4 w-4" />
            </IconBtn>
            <IconBtn title="Move floor right" onClick={() => moveFloor(1)} disabled={activeIdx === floors.length - 1}>
              <ArrowRight className="h-4 w-4" />
            </IconBtn>
            <IconBtn title="Rename floor" onClick={renameFloor}>
              <Pencil className="h-4 w-4" />
            </IconBtn>
            <IconBtn title="Delete floor" onClick={deleteFloor} disabled={floors.length <= 1} danger>
              <Trash2 className="h-4 w-4" />
            </IconBtn>
          </div>
        )}
      </div>

      {/* Add controls */}
      {editable && active && (
        <div className="flex items-center gap-3 mb-3">
          <select
            value=""
            onChange={(e) => { addTable(e.target.value); e.currentTarget.value = '' }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">
              {unplaced.length ? '+ Add table…' : 'All tables placed'}
            </option>
            {unplaced.map((t) => (
              <option key={t.id} value={t.id}>
                {t.number} · {t.capacity} seats
              </option>
            ))}
          </select>

          <select
            value=""
            onChange={(e) => { addLandmark(e.target.value); e.currentTarget.value = '' }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">+ Add landmark…</option>
            {LANDMARK_KINDS.map((k) => (
              <option key={k.type} value={k.type}>
                {k.glyph} {k.label}{k.vertical ? ' (connects floors)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden select-none"
        style={{
          aspectRatio: '4 / 3',
          backgroundImage:
            'linear-gradient(rgba(120,120,120,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(120,120,120,.12) 1px, transparent 1px)',
          backgroundSize: '8% 10.6667%',
        }}
      >
        {active?.landmarks.map((l) => {
          const k = kindOf(l.type)
          return (
            <DraggableMarker
              key={l.id}
              x={l.posX}
              y={l.posY}
              canvasRef={canvasRef}
              editable={editable}
              onMove={(x, y) => moveLandmark(l.id, x, y)}
              onRemove={() => removeLandmark(l.id)}
            >
              <div className="flex flex-col items-center px-2 py-1 rounded-lg bg-white/90 dark:bg-gray-900/80 shadow border border-gray-200 dark:border-gray-700">
                <span className="text-lg leading-none">{k.glyph}</span>
                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 mt-0.5 whitespace-nowrap">
                  {l.label && l.label.trim() ? l.label : k.label}
                </span>
              </div>
            </DraggableMarker>
          )
        })}

        {active?.tables.map((t) => {
          const table = tableById.get(t.tableId)
          const fill = table ? STATUS_FILL[table.status] ?? UNKNOWN_FILL : UNKNOWN_FILL
          return (
            <DraggableMarker
              key={t.tableId}
              x={t.posX}
              y={t.posY}
              canvasRef={canvasRef}
              editable={editable}
              onMove={(x, y) => moveTable(t.tableId, x, y)}
              onRemove={() => removeTable(t.tableId)}
            >
              <div
                className="flex items-center justify-center rounded-full text-white font-bold shadow-md border-2 border-white/80"
                style={{ width: 46, height: 46, backgroundColor: fill }}
                title={table ? `Table ${table.number} · ${table.status}` : 'Unknown table'}
              >
                {table?.number ?? '?'}
              </div>
            </DraggableMarker>
          )
        })}

        {active && active.tables.length === 0 && active.landmarks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500 pointer-events-none">
            {editable ? 'Add tables and landmarks using the controls above.' : 'This floor is empty.'}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-4 text-sm text-gray-600 dark:text-gray-300">
        <LegendDot color={STATUS_FILL.AVAILABLE} label="Available" />
        <LegendDot color={STATUS_FILL.OCCUPIED} label="Occupied" />
        <LegendDot color={STATUS_FILL.RESERVED} label="Reserved" />
      </div>
    </div>
  )
}

// ---- small components --------------------------------------------------

function DraggableMarker({
  x,
  y,
  canvasRef,
  editable,
  onMove,
  onRemove,
  children,
}: {
  x: number
  y: number
  canvasRef: React.RefObject<HTMLDivElement | null>
  editable: boolean
  onMove: (x: number, y: number) => void
  onRemove: () => void
  children: React.ReactNode
}) {
  const dragging = useRef(false)

  const clampToCanvas = (clientX: number, clientY: number) => {
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r) return null
    return {
      x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)),
    }
  }

  return (
    <div
      className="absolute group"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transform: 'translate(-50%, -50%)',
        touchAction: 'none',
        cursor: editable ? 'grab' : 'default',
      }}
      onPointerDown={(e) => {
        if (!editable) return
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        e.stopPropagation()
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return
        const p = clampToCanvas(e.clientX, e.clientY)
        if (p) onMove(p.x, p.y)
      }}
      onPointerUp={(e) => {
        dragging.current = false
        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
      }}
      onContextMenu={(e) => {
        if (!editable) return
        e.preventDefault()
        onRemove()
      }}
    >
      {children}
      {editable && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          title="Remove"
          className="absolute -top-2 -right-2 hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white shadow"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded-md border border-gray-300 dark:border-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
