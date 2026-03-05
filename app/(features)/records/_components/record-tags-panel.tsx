import { Hash } from "lucide-react"
import { LoadingDots } from "@shared/ui/loading"
import type { RecordTag, Translate } from "./types"

type RecordTagsPanelProps = {
  t: Translate
  tags: RecordTag[]
  selectedTagIds: Set<string>
  newTagName: string
  isTagMutating: boolean
  updateTagsError: string | null
  createTagPending: boolean
  onToggleTag: (tagId: string) => void
  onNewTagNameChange: (value: string) => void
  onCreateTag: () => void
}

export function RecordTagsPanel({
  t,
  tags,
  selectedTagIds,
  newTagName,
  isTagMutating,
  updateTagsError,
  createTagPending,
  onToggleTag,
  onNewTagNameChange,
  onCreateTag
}: RecordTagsPanelProps) {
  const unassignedTags = tags.filter((tag) => !selectedTagIds.has(tag.id))

  return (
    <div className="border-4 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <h3 className="font-black text-xl uppercase text-foreground mb-4 flex items-center gap-2 border-b-4 border-foreground pb-2">
        <Hash className="w-6 h-6" strokeWidth={3} /> {t("record.tagsEdit", "TAGS")}
      </h3>
      <div className="flex flex-wrap gap-2 mb-4">
        {tags.length === 0 ? (
          <span className="font-mono text-xs text-muted-foreground uppercase">{t("record.noTagsAvail", "NO TAGS AVAILABLE")}</span>
        ) : null}
        {tags
          .filter((tag) => selectedTagIds.has(tag.id))
          .map((tag) => (
            <div
              key={tag.id}
              className="flex items-center border-2 border-foreground bg-foreground text-background font-mono text-xs font-bold uppercase transition-transform hover:scale-105"
            >
              <span className="px-2 py-1">#{tag.name}</span>
              <button
                type="button"
                onClick={() => onToggleTag(tag.id)}
                disabled={isTagMutating}
                className="px-2 py-1 border-l-2 border-background/20 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                aria-label="Remove tag"
              >
                X
              </button>
            </div>
          ))}
      </div>

      {unassignedTags.length > 0 ? (
        <>
          <label htmlFor="record-add-existing-tag" className="sr-only">
            Add existing tag
          </label>
          <select
            id="record-add-existing-tag"
            onChange={(event) => {
              if (event.target.value) {
                onToggleTag(event.target.value)
              }
              event.target.value = ""
            }}
            disabled={isTagMutating}
            className="w-full bg-background border-2 border-dashed border-foreground/50 text-foreground font-mono text-xs font-bold p-2 focus:outline-none focus:border-accent appearance-none rounded-none cursor-pointer uppercase"
            defaultValue=""
          >
            <option value="" disabled>+ {t("record.addTag", "ADD TAG...")}</option>
            {unassignedTags.map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
        </>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (newTagName.trim()) {
            onCreateTag()
          }
        }}
        className="mt-4 flex gap-0"
      >
        <label htmlFor="record-new-tag" className="sr-only">
          + NEW TAG
        </label>
        <input
          id="record-new-tag"
          type="text"
          value={newTagName}
          onChange={(event) => onNewTagNameChange(event.target.value)}
          placeholder="+ NEW TAG"
          disabled={isTagMutating}
          className="flex-1 bg-background border-2 border-r-0 border-foreground font-mono text-xs font-bold p-2 focus:outline-none focus:border-accent uppercase min-w-0 placeholder:text-muted-foreground/50"
        />
        <button
          type="submit"
          disabled={!newTagName.trim() || isTagMutating}
          className="bg-foreground text-background font-mono text-xs font-bold px-3 py-2 uppercase hover:bg-accent hover:text-white disabled:opacity-50 border-2 border-foreground"
        >
          {createTagPending ? <LoadingDots /> : "ADD"}
        </button>
      </form>

      {updateTagsError ? (
        <p className="font-mono text-xs text-destructive mt-3">{updateTagsError}</p>
      ) : null}
    </div>
  )
}
