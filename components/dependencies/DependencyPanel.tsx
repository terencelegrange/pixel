"use client";

import { useState } from "react";
import { X, Pencil, Trash2, Check, ArrowRight, ArrowLeftRight } from "lucide-react";
import { AssetDependency, DependencyConnectionType, DependencyDirection } from "@/types";

const CONN_TYPES: DependencyConnectionType[] = [
  "API", "Database", "File Transfer", "Event / Message", "UI Embed", "Other",
];
const DIRECTIONS: DependencyDirection[] = ["outbound", "bidirectional"];

const TYPE_BADGE: Record<DependencyConnectionType, string> = {
  "API":             "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "Database":        "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "File Transfer":   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "Event / Message": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "UI Embed":        "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "Other":           "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

interface Props {
  dependency: AssetDependency;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  userId: string;
  userName: string;
}

export default function DependencyPanel({
  dependency, onClose, onUpdated, onDeleted, userId, userName,
}: Props) {
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [editType, setEditType] = useState<DependencyConnectionType>(dependency.type);
  const [editDirection, setEditDirection] = useState<DependencyDirection>(dependency.direction);
  const [editNotes, setEditNotes] = useState(dependency.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setPanelError(null);
    try {
      const res = await fetch(`/api/dependencies/${dependency.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: editType, direction: editDirection, notes: editNotes.trim() || null, userId, userName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      onUpdated();
      setMode("view");
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsSaving(true);
    setPanelError(null);
    try {
      const res = await fetch(`/api/dependencies/${dependency.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      onDeleted();
      onClose();
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Delete failed.");
      setIsSaving(false);
    }
  }

  const selectCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200";

  return (
    <div className="flex h-full flex-col border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dependency</span>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Connection summary */}
      <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100 flex-wrap">
          <span className="truncate max-w-[110px]">{dependency.sourceAssetName}</span>
          {dependency.direction === "bidirectional"
            ? <ArrowLeftRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
            : <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
          }
          <span className="truncate max-w-[110px]">{dependency.targetAssetName}</span>
        </div>
        <div className="mt-2 flex gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_BADGE[dependency.type]}`}>
            {dependency.type}
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {dependency.direction}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {mode === "view" && (
          <>
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">Notes</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {dependency.notes ?? <span className="italic text-slate-300 dark:text-slate-600">No notes</span>}
              </p>
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              Added by {dependency.createdByName}
            </div>
          </>
        )}

        {mode === "edit" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Connection Type</label>
              <select className={selectCls} value={editType} onChange={(e) => setEditType(e.target.value as DependencyConnectionType)}>
                {CONN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Direction</label>
              <select className={selectCls} value={editDirection} onChange={(e) => setEditDirection(e.target.value as DependencyDirection)}>
                {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
              />
            </div>
            {panelError && <p className="text-xs text-red-600 dark:text-red-400">{panelError}</p>}
          </div>
        )}

        {mode === "confirmDelete" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Delete the dependency between{" "}
              <span className="font-medium">{dependency.sourceAssetName}</span> and{" "}
              <span className="font-medium">{dependency.targetAssetName}</span>?
            </p>
            {panelError && <p className="text-xs text-red-600 dark:text-red-400">{panelError}</p>}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        {mode === "view" && (
          <div className="flex gap-2">
            <button
              onClick={() => setMode("edit")}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button
              onClick={() => { setPanelError(null); setMode("confirmDelete"); }}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        )}

        {mode === "edit" && (
          <div className="flex gap-2">
            <button
              onClick={() => { setMode("view"); setPanelError(null); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Check className="h-3 w-3" /> {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        )}

        {mode === "confirmDelete" && (
          <div className="flex gap-2">
            <button
              onClick={() => { setMode("view"); setPanelError(null); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isSaving ? "Deleting…" : "Confirm Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
