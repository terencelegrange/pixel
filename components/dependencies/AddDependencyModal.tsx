"use client";

import { FormEvent, useState, useMemo } from "react";
import { X, Plus } from "lucide-react";
import { Asset, DependencyConnectionType, DependencyDirection } from "@/types";

const CONN_TYPES: DependencyConnectionType[] = [
  "API", "Database", "File Transfer", "Event / Message", "UI Embed", "Other",
];
const DIRECTIONS: DependencyDirection[] = ["outbound", "bidirectional"];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  allAssets: Pick<Asset, "id" | "name" | "shortCode">[];
  lockedSourceAssetId?: string;
  lockedSourceAssetName?: string;
  userId: string;
  userName: string;
}

export default function AddDependencyModal({
  open, onClose, onCreated, allAssets,
  lockedSourceAssetId, lockedSourceAssetName,
  userId, userName,
}: Props) {
  const [sourceId, setSourceId] = useState(lockedSourceAssetId ?? "");
  const [targetId, setTargetId] = useState("");
  const [type, setType] = useState<DependencyConnectionType>("API");
  const [direction, setDirection] = useState<DependencyDirection>("outbound");
  const [notes, setNotes] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredSources = useMemo(() =>
    allAssets.filter((a) =>
      a.id !== targetId &&
      `${a.name} ${a.shortCode ?? ""}`.toLowerCase().includes(sourceSearch.toLowerCase())
    ), [allAssets, sourceSearch, targetId]);

  const filteredTargets = useMemo(() =>
    allAssets.filter((a) =>
      a.id !== sourceId &&
      `${a.name} ${a.shortCode ?? ""}`.toLowerCase().includes(targetSearch.toLowerCase())
    ), [allAssets, targetSearch, sourceId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!sourceId) { setError("Source asset is required."); return; }
    if (!targetId) { setError("Target asset is required."); return; }
    setIsSaving(true);
    try {
      const res = await fetch("/api/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceAssetId: sourceId, targetAssetId: targetId, type, direction, notes: notes.trim() || null, userId, userName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");
      onCreated();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  }

  function resetForm() {
    setSourceId(lockedSourceAssetId ?? "");
    setTargetId("");
    setType("API");
    setDirection("outbound");
    setNotes("");
    setSourceSearch("");
    setTargetSearch("");
    setError(null);
  }

  function handleClose() {
    onClose();
    resetForm();
  }

  if (!open) return null;

  const selectCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200";
  const inputCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-500";
  const labelCls = "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70" onClick={handleClose} />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Plus className="h-4 w-4 text-brand-500" />
            Add Dependency
          </h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Source asset */}
          <div>
            <label className={labelCls}>Source Asset (caller)</label>
            {lockedSourceAssetId ? (
              <div className="h-9 flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                {lockedSourceAssetName}
              </div>
            ) : (
              <>
                <input
                  className={`${inputCls} mb-1`}
                  placeholder="Search assets..."
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                />
                <select className={selectCls} value={sourceId} onChange={(e) => setSourceId(e.target.value)} required>
                  <option value="">Select source asset…</option>
                  {filteredSources.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.shortCode ? ` (${a.shortCode})` : ""}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          {/* Target asset */}
          <div>
            <label className={labelCls}>Target Asset (dependency)</label>
            <input
              className={`${inputCls} mb-1`}
              placeholder="Search assets..."
              value={targetSearch}
              onChange={(e) => setTargetSearch(e.target.value)}
            />
            <select className={selectCls} value={targetId} onChange={(e) => setTargetId(e.target.value)} required>
              <option value="">Select target asset…</option>
              {filteredTargets.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.shortCode ? ` (${a.shortCode})` : ""}</option>
              ))}
            </select>
          </div>

          {/* Type + Direction */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Connection Type</label>
              <select className={selectCls} value={type} onChange={(e) => setType(e.target.value as DependencyConnectionType)}>
                {CONN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Direction</label>
              <select className={selectCls} value={direction} onChange={(e) => setDirection(e.target.value as DependencyDirection)}>
                {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. REST API, authenticated via OAuth2…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-500"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={handleClose} className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
