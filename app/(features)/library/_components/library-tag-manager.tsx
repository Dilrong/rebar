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
  return (
    <section className="mb-10 border-4 border-foreground bg-card p-4">
      <div className="flex items-center gap-2 mb-4 font-mono text-xs font-bold uppercase">
        <Tag className="w-4 h-4" /> {t("library.tagManager", "Tag Manager")}
      </div>
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <label htmlFor="library-new-tag" className="sr-only">
          {t("library.newTag", "new tag")}
        </label>
        <input
          id="library-new-tag"
          value={newTagName}
          onChange={(event) => onNewTagNameChange(event.target.value)}
          placeholder={t("library.newTag", "new tag")}
          className="min-h-[44px] bg-background border-4 border-foreground text-foreground px-4 py-2 font-mono text-sm w-full md:w-auto flex-1 focus:outline-none focus:ring-0 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[inset_4px_4px_0px_0px_rgba(255,255,255,0.1)] rounded-none"
        />
        <button
          type="button"
          onClick={onCreateTag}
          disabled={!newTagName.trim() || createPending}
          className="min-h-[44px] flex items-center justify-center px-4 py-2 border-4 border-foreground font-mono text-xs font-bold uppercase bg-background text-foreground w-full md:w-auto hover:bg-foreground hover:text-background transition-transform active:translate-y-[2px] active:translate-x-[2px] shadow-brutal-sm"
        >
          {createPending ? <LoadingDots /> : t("library.create", "Create")}
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        {tags.map((tag) => (
          <div key={tag.id} className="min-h-[44px] inline-flex items-center justify-between gap-3 border-4 border-foreground pl-3 pr-1 py-1 bg-background flex-grow md:flex-grow-0 shadow-brutal-sm">
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
                className="min-h-[32px] min-w-[32px] flex items-center justify-center font-mono text-[10px] font-bold uppercase border-2 border-transparent hover:border-foreground hover:bg-muted"
              >
                {t("library.tagEdit", "편집")}
              </button>
              <button
                type="button"
                onClick={() => onDeleteTag(tag.id)}
                className="min-h-[32px] min-w-[32px] flex items-center justify-center font-mono text-[10px] font-bold uppercase border-2 border-transparent hover:border-foreground hover:bg-muted hover:text-destructive"
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
    </section>
  )
}
