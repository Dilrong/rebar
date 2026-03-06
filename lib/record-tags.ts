type SupabaseClientLike = {
  from: (table: string) => any
}

export async function getInvalidOwnedTagIds(
  supabase: SupabaseClientLike,
  userId: string,
  tagIds: string[]
): Promise<{ invalidTagIds: string[]; error: unknown | null }> {
  const uniqueTagIds = Array.from(new Set(tagIds))
  if (uniqueTagIds.length === 0) {
    return { invalidTagIds: [], error: null }
  }

  const ownedTags = await supabase.from("tags").select("id").eq("user_id", userId).in("id", uniqueTagIds)
  if (ownedTags.error) {
    return { invalidTagIds: [], error: ownedTags.error }
  }

  const ownedTagIds = new Set((ownedTags.data ?? []).map((row: { id: string }) => row.id))
  return {
    invalidTagIds: uniqueTagIds.filter((tagId) => !ownedTagIds.has(tagId)),
    error: null
  }
}

export function buildRecordTagLinks(recordIds: string[], tagIds: string[]): Array<{ record_id: string; tag_id: string }> {
  const links: Array<{ record_id: string; tag_id: string }> = []

  for (const recordId of recordIds) {
    for (const tagId of tagIds) {
      links.push({ record_id: recordId, tag_id: tagId })
    }
  }

  return links
}
