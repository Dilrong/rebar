"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { BriefcaseBusiness, Copy, Network, Users } from "lucide-react"
import AuthGate from "@shared/auth/auth-gate"
import AppNav from "@shared/layout/app-nav"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"

type ProjectMetrics = {
  tag_id: string
  name: string
  total: number
  inbox: number
  active: number
  pinned: number
  archived: number
  last_updated_at: string | null
}

type ProjectRecord = {
  id: string
  kind: string
  state: "INBOX" | "ACTIVE" | "PINNED" | "ARCHIVED"
  source_title: string | null
  content_preview: string
  review_count: number
  updated_at: string
}

type TeamDigest = {
  reviewed_7d: number
  archived_7d: number
  todo_7d: number
  share_7d: number
  experiment_7d: number
  top_records: Array<{
    id: string
    title: string | null
    preview: string
    state: string
    review_count: number
  }>
}

type GraphNode = {
  id: string
  label: string
  kind: "project" | "record" | "tag"
  weight: number
}

type GraphEdge = {
  source: string
  target: string
  weight: number
}

type ProjectsResponse = {
  projects: ProjectMetrics[]
  selected: {
    project: ProjectMetrics
    records: ProjectRecord[]
    team_digest: TeamDigest
    graph: {
      nodes: GraphNode[]
      edges: GraphEdge[]
    }
  } | null
}

export default function ProjectsPage() {
  const { t } = useI18n()
  const [selectedTagId, setSelectedTagId] = useState("")
  const [copiedDigest, setCopiedDigest] = useState(false)

  const projectsQuery = useQuery({
    queryKey: ["projects", selectedTagId],
    queryFn: () =>
      apiFetch<ProjectsResponse>(
        selectedTagId ? `/api/projects?tag_id=${selectedTagId}` : "/api/projects"
      ),
    staleTime: 1000 * 30
  })

  useEffect(() => {
    const firstProject = projectsQuery.data?.projects[0]
    if (!selectedTagId && firstProject) {
      setSelectedTagId(firstProject.tag_id)
      return
    }

    if (
      selectedTagId &&
      projectsQuery.data?.projects.length &&
      !projectsQuery.data.projects.some((project) => project.tag_id === selectedTagId)
    ) {
      setSelectedTagId(projectsQuery.data.projects[0].tag_id)
    }
  }, [projectsQuery.data?.projects, selectedTagId])

  const selected = projectsQuery.data?.selected

  const graphLayout = useMemo(() => {
    if (!selected) {
      return null
    }

    const width = 920
    const height = 460
    const center = { x: width / 2, y: height / 2 }
    const nodes = selected.graph.nodes
    const recordNodes = nodes.filter((node) => node.kind === "record")
    const tagNodes = nodes.filter((node) => node.kind === "tag")
    const projectNode = nodes.find((node) => node.kind === "project")

    const positions = new Map<string, { x: number; y: number }>()
    if (projectNode) {
      positions.set(projectNode.id, center)
    }

    recordNodes.forEach((node, index) => {
      const angle = (index / Math.max(recordNodes.length, 1)) * Math.PI * 2
      const radius = 130
      positions.set(node.id, {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      })
    })

    tagNodes.forEach((node, index) => {
      const angle = (index / Math.max(tagNodes.length, 1)) * Math.PI * 2 + Math.PI / 10
      const radius = 215
      positions.set(node.id, {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      })
    })

    return {
      width,
      height,
      positions,
      nodes,
      edges: selected.graph.edges
    }
  }, [selected])

  const digestMarkdown = useMemo(() => {
    if (!selected) {
      return ""
    }

    const digest = selected.team_digest
    const lines = [
      `# ${selected.project.name} · ${t("projects.teamDigest", "TEAM DIGEST")}`,
      "",
      `- Reviewed (7d): ${digest.reviewed_7d}`,
      `- Archived (7d): ${digest.archived_7d}`,
      `- TODO actions (7d): ${digest.todo_7d}`,
      `- SHARE actions (7d): ${digest.share_7d}`,
      `- EXPERIMENT actions (7d): ${digest.experiment_7d}`,
      "",
      `## ${t("projects.topInsights", "TOP INSIGHTS")}`
    ]

    digest.top_records.forEach((record) => {
      lines.push(`- ${record.title ?? record.preview} (state: ${record.state}, reviews: ${record.review_count})`)
    })

    return lines.join("\n")
  }, [selected, t])

  const copyDigest = async () => {
    if (!digestMarkdown) {
      return
    }

    await navigator.clipboard.writeText(digestMarkdown)
    setCopiedDigest(true)
    window.setTimeout(() => setCopiedDigest(false), 1800)
  }

  return (
    <div className="min-h-screen p-6 bg-background font-sans selection:bg-accent selection:text-white">
      <AuthGate>
        <main className="max-w-6xl mx-auto animate-fade-in-up pb-24">
          <AppNav />

          <header className="mb-8 flex flex-col gap-3 border-b-4 border-foreground pb-4">
            <h1 className="font-black text-5xl uppercase text-foreground leading-none flex items-center gap-3">
              <BriefcaseBusiness className="w-10 h-10" strokeWidth={3} />
              {t("projects.title", "PROJECT MODE")}
            </h1>
            <p className="font-mono text-xs font-bold uppercase text-muted-foreground">
              {t("projects.subtitle", "PROJECT-FOCUSED FLOW + TEAM DIGEST + KNOWLEDGE GRAPH")}
            </p>
          </header>

          <section className="mb-8 border-4 border-foreground bg-card p-4">
            <p className="mb-3 font-mono text-xs font-bold uppercase text-muted-foreground">
              {t("projects.list", "PROJECTS")}
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {(projectsQuery.data?.projects ?? []).map((project) => {
                const done = project.archived + project.pinned
                const progress = project.total > 0 ? Math.min(100, Math.round((done / project.total) * 100)) : 0
                const selectedCard = selectedTagId === project.tag_id
                return (
                  <button
                    key={project.tag_id}
                    type="button"
                    onClick={() => setSelectedTagId(project.tag_id)}
                    className={`min-h-[44px] border-4 p-4 text-left transition-colors ${
                      selectedCard
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <p className="font-black text-xl uppercase">#{project.name}</p>
                    <p className="mt-1 font-mono text-[10px] font-bold uppercase">
                      {t("projects.cards.total", "TOTAL")}: {project.total} · {t("projects.cards.inbox", "INBOX")}: {project.inbox}
                    </p>
                    <div className="mt-3 h-2 border border-current">
                      <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-2 font-mono text-[10px] font-bold uppercase">
                      {t("projects.cards.progress", "PROGRESS")}: {progress}%
                    </p>
                  </button>
                )
              })}
            </div>
          </section>

          {selected ? (
            <>
              <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="border-4 border-foreground bg-card p-4">
                  <p className="font-black text-2xl uppercase">#{selected.project.name}</p>
                  <p className="mt-2 font-mono text-xs font-bold uppercase text-muted-foreground">
                    {t("projects.workflow", "PROJECT WORKFLOW")}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <p className="border-2 border-foreground p-2 font-mono text-xs font-bold uppercase">INBOX {selected.project.inbox}</p>
                    <p className="border-2 border-foreground p-2 font-mono text-xs font-bold uppercase">ACTIVE {selected.project.active}</p>
                    <p className="border-2 border-foreground p-2 font-mono text-xs font-bold uppercase">PINNED {selected.project.pinned}</p>
                    <p className="border-2 border-foreground p-2 font-mono text-xs font-bold uppercase">ARCHIVED {selected.project.archived}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/library?tag_id=${selected.project.tag_id}`}
                      className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background"
                    >
                      {t("projects.openVault", "OPEN VAULT")}
                    </Link>
                    <Link
                      href={`/search?tag_id=${selected.project.tag_id}&semantic=1`}
                      className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background"
                    >
                      {t("projects.openSemantic", "SEMANTIC SEARCH")}
                    </Link>
                  </div>
                </div>

                <div className="border-4 border-foreground bg-card p-4 lg:col-span-2">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b-2 border-foreground pb-2">
                    <p className="font-black text-xl uppercase flex items-center gap-2">
                      <Users className="h-5 w-5" /> {t("projects.teamDigest", "TEAM DIGEST (7D)")}
                    </p>
                    <button
                      type="button"
                      onClick={copyDigest}
                      className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background inline-flex items-center gap-1"
                    >
                      <Copy className="h-4 w-4" />
                      {copiedDigest ? t("projects.digestCopied", "COPIED") : t("projects.copyDigest", "COPY REPORT")}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                    <p className="border-2 border-foreground p-2 font-mono text-xs font-bold uppercase">REV {selected.team_digest.reviewed_7d}</p>
                    <p className="border-2 border-foreground p-2 font-mono text-xs font-bold uppercase">ARCH {selected.team_digest.archived_7d}</p>
                    <p className="border-2 border-foreground p-2 font-mono text-xs font-bold uppercase">TODO {selected.team_digest.todo_7d}</p>
                    <p className="border-2 border-foreground p-2 font-mono text-xs font-bold uppercase">SHARE {selected.team_digest.share_7d}</p>
                    <p className="border-2 border-foreground p-2 font-mono text-xs font-bold uppercase">EXP {selected.team_digest.experiment_7d}</p>
                  </div>
                  <p className="mt-4 font-mono text-[10px] font-bold uppercase text-muted-foreground">
                    {t("projects.topInsights", "TOP INSIGHTS")}
                  </p>
                  <div className="mt-2 space-y-2">
                    {selected.team_digest.top_records.map((record) => (
                      <Link
                        key={record.id}
                        href={`/records/${record.id}`}
                        className="block min-h-[44px] border-2 border-foreground bg-background px-3 py-2 hover:bg-foreground hover:text-background"
                      >
                        <p className="font-mono text-[10px] font-bold uppercase">
                          {record.state} · REV {record.review_count}
                        </p>
                        <p className="font-semibold text-sm line-clamp-2">{record.title ?? record.preview}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>

              <section className="mb-8 border-4 border-foreground bg-card p-4">
                <p className="mb-3 font-black text-xl uppercase flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  {t("projects.graph", "KNOWLEDGE GRAPH")}
                </p>
                {graphLayout ? (
                  <div className="overflow-x-auto border-2 border-foreground bg-background">
                    <svg viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`} className="h-[360px] w-[920px]">
                      {graphLayout.edges.map((edge) => {
                        const source = graphLayout.positions.get(edge.source)
                        const target = graphLayout.positions.get(edge.target)
                        if (!source || !target) {
                          return null
                        }
                        return (
                          <line
                            key={`${edge.source}:${edge.target}`}
                            x1={source.x}
                            y1={source.y}
                            x2={target.x}
                            y2={target.y}
                            stroke="currentColor"
                            strokeOpacity="0.35"
                            strokeWidth={1 + edge.weight}
                          />
                        )
                      })}

                      {graphLayout.nodes.map((node) => {
                        const pos = graphLayout.positions.get(node.id)
                        if (!pos) {
                          return null
                        }

                        const radius = node.kind === "project" ? 26 : node.kind === "tag" ? 16 : 12
                        const fill = node.kind === "project" ? "var(--accent)" : node.kind === "tag" ? "var(--muted)" : "var(--card)"
                        const textColor = node.kind === "project" ? "white" : "currentColor"

                        return (
                          <g key={node.id}>
                            <circle
                              cx={pos.x}
                              cy={pos.y}
                              r={radius}
                              fill={fill}
                              stroke="currentColor"
                              strokeWidth={2}
                            />
                            <text
                              x={pos.x}
                              y={pos.y + radius + 14}
                              textAnchor="middle"
                              className="font-mono text-[10px] font-bold uppercase"
                              fill={textColor}
                            >
                              {node.label}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </div>
                ) : null}
              </section>

              <section className="border-4 border-foreground bg-card p-4">
                <p className="mb-3 font-black text-xl uppercase">{t("projects.records", "PROJECT RECORDS")}</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {selected.records.map((record) => (
                    <Link
                      key={record.id}
                      href={`/records/${record.id}`}
                      className="block min-h-[44px] border-2 border-foreground bg-background px-3 py-2 hover:bg-foreground hover:text-background"
                    >
                      <p className="font-mono text-[10px] font-bold uppercase">
                        {record.kind} · {record.state} · REV {record.review_count}
                      </p>
                      <p className="font-semibold text-sm line-clamp-3">
                        {record.source_title ?? record.content_preview}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {projectsQuery.isLoading ? (
            <p className="mt-6 font-mono text-xs font-bold uppercase text-muted-foreground">
              {t("projects.loading", "LOADING PROJECT MODE...")}
            </p>
          ) : null}

          {projectsQuery.error ? (
            <p className="mt-6 border-4 border-foreground bg-destructive p-3 font-mono text-xs font-bold uppercase text-white">
              ERR: {projectsQuery.error.message}
            </p>
          ) : null}
        </main>
      </AuthGate>
    </div>
  )
}
