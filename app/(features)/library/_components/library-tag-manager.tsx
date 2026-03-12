import { useState } from "react"
import { Tag, Trash2 } from "lucide-react"
import type { TagRow } from "@/lib/types"
import { LoadingDots } from "@shared/ui/loading"

type LibraryTagManagerProps = {
  t: (key: string, fallback?: string) => string
  tags: TagRow[]
  newTagName: string
  editingTagId: string | null
  editingTagName: string
  createPending: boolean
  createError: string | null
  renameError: string | null
  deleteError: string | null
  onNewTagNameChange: (value: string) => void
  onCreateTag: () => void
  onStartRenameTag: (tag: TagRow) => void
  onEditingTagNameChange: (value: string) => void
  onSubmitRenameTag: (id: string) => void
  onCancelRenameTag: () => void
  onDeleteTag: (id: string) => void
}

export function LibraryTagManager({
  t,
  tags,
  newTagName,
  editingTagId,
  editingTagName,
  createPending,
  createError,
  renameError,
  deleteError,
  onNewTagNameChange,
  onCreateTag,
  onStartRenameTag,
  onEditingTagNameChange,
  onSubmitRenameTag,
  onCancelRenameTag,
  onDeleteTag
}: LibraryTagManagerProps) {
  const [open, setOpen] = useState(false)

  return (
    <section className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex min-h-[52px] w-full items-center justify-between gap-2 border-4 border-foreground px-4 py-3 font-mono text-xs font-bold uppercase transition-all active:translate-x-1 active:translate-y-1 ${open
          ? "bg-foreground text-background"
          : "bg-card text-foreground hover:bg-foreground hover:text-background shadow-brutal-sm"
        }`}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Tag className="w-4 h-4" /> 05 / {t("library.tagManager", "Tag Manager")}
          <span className="border border-current px-2 py-0.5 font-mono text-[10px] opacity-80">{tags.length}</span>
        </span>
        <span className="text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {!open ? null : (
      <div className="animate-fade-in-up border-4 border-t-0 border-foreground bg-card p-4 shadow-brutal-sm md:p-5 md:shadow-brutal">
      <div className="mb-6 border-b-4 border-foreground pb-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">TAG OPERATIONS</p>
        <p className="mt-3 max-w-none font-sans text-sm font-bold leading-relaxed text-foreground/80">
          {t("library.tagManagerDesc", "Create and refactor taxonomy without leaving the vault workspace.")}
        </p>
      </div>
      <div className="mb-6 flex flex-col gap-3 md:flex-row">
        <label htmlFor="library-new-tag" className="sr-only">
          {t("library.newTag", "new tag")}
        </label>
        <input
          id="library-new-tag"
          value={newTagName}
          onChange={(event) => onNewTagNameChange(event.target.value)}
          placeholder={t("library.newTag", "new tag")}
          className="min-h-[44px] bg-background border-4 border-foreground text-foreground px-4 py-2 font-mono text-sm w-full md:w-auto flex-1 focus:outline-none focus:ring-0 rounded-none shadow-brutal-sm focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all duration-200"
        />
        <button
          type="button"
          onClick={onCreateTag}
          disabled={!newTagName.trim() || createPending}
          className="min-h-[44px] flex items-center justify-center px-4 py-2 border-4 border-foreground font-mono text-xs font-bold uppercase bg-background text-foreground w-full md:w-auto hover:bg-foreground hover:text-background transition-all duration-200 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-y-1 active:translate-x-1"
        >
          {createPending ? <LoadingDots /> : t("library.create", "Create")}
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        {tags.map((tag) => (
          <div key={tag.id} className="min-h-[44px] inline-flex items-center justify-between gap-3 border-4 border-foreground bg-background pl-3 pr-1 py-1 shadow-brutal-sm flex-grow md:flex-grow-0">
            {editingTagId === tag.id ? (
              <>
                <label htmlFor={`library-edit-tag-${tag.id}`} className="sr-only">
                  Edit tag {tag.name}
                </label>
                <input
                  id={`library-edit-tag-${tag.id}`}
                  value={editingTagName}
                  onChange={(event) => onEditingTagNameChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onSubmitRenameTag(tag.id)
                    if (event.key === "Escape") onCancelRenameTag()
                  }}
                  onBlur={() => onSubmitRenameTag(tag.id)}
                  autoFocus
                  className="bg-background border-b-2 border-foreground font-mono text-xs font-bold w-[120px] focus:outline-none"
                />
              </>
            ) : (
              <span className="font-mono text-xs font-bold truncate max-w-[150px]">#{tag.name}</span>
            )}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onStartRenameTag(tag)}
                className="min-h-[32px] min-w-[32px] flex items-center justify-center font-mono text-[10px] font-bold uppercase border-2 border-transparent hover:border-foreground hover:bg-foreground hover:text-background transition-colors"
              >
                {t("library.tagEdit", "편집")}
              </button>
              <button
                type="button"
                onClick={() => onDeleteTag(tag.id)}
                className="min-h-[32px] min-w-[32px] flex items-center justify-center font-mono text-[10px] font-bold uppercase border-2 border-transparent hover:border-destructive hover:bg-destructive hover:text-white transition-colors text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {createError ? <p className="font-mono text-xs text-destructive mt-2">{createError}</p> : null}
      {renameError ? <p className="font-mono text-xs text-destructive mt-2">{renameError}</p> : null}
      {deleteError ? <p className="font-mono text-xs text-destructive mt-2">{deleteError}</p> : null}
      </div>
      )}
    </section>
  )
}
