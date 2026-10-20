export type Phase = 'plan' | 'design' | 'delegate' | 'review' | 'close'

export type PlannedTask = {
  title: string
  tier: string
  after: number[]
  /** The timekeeper's budget for this task, as the plan gave it. */
  minutes?: number
}

export type Flow = {
  title: string
  total: number
  done: number
  running: number
  phase: Phase
  isFinished: boolean
  tasks: PlannedTask[]
  /** The timekeeper's budget for the whole plan, as the plan gave it. */
  minutes?: number
}

/** `stopped`: cut short on purpose (Esc, a release), shown neutral, never as an error. */
export type AgentStatus = 'running' | 'done' | 'failed' | 'stopped'

export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  effort?: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  contextTokens: number
  contextMax: number
  tokens: number
  costUsd: number
  steps: number
  round: number
  /** Self-reported by the worker through the `step` tool. */
  stepDone?: number
  stepTotal?: number
  stepNote?: string
  /** The agent that started this one; absent when the main session did. */
  parentAgentId?: string
  /** What it is doing right now, from its latest tool call ("reading register.tsx"). */
  activity?: string
  /** When it last showed a sign of life: a model request or a tool call. */
  lastProgressAt?: number
  /** Quiet too long while running; the panel flags it and pings once. */
  isStuck?: boolean
  /** The timekeeper's budget for this run, in minutes; absent while the timekeeper is off. */
  budgetMin?: number
  /** Past its budget: flagged like a stuck one, and alerted once. */
  isOverBudget?: boolean
  /** When Mission Control last checked in with the person about this quiet agent. */
  checkedInAt?: number
  /** Started in the background: its end queues a report the main loop still has to answer. */
  isBackground?: boolean
  /** Its tool calls still in flight: a long build or a permission prompt is no silence. */
  toolsInFlight?: number
}

export type Panel = {
  isCompact: boolean
  isDoneCollapsed: boolean
  /** Finished agents the person opened again; every other finished agent shows folded. */
  expanded?: string[]
  autoOpenedFor: string
}

/** What the session card shows: where Claude runs, how full its context is, what it is connected to. */
export type Env = {
  cwd: string
  model: string
  surface: string
  contextPct: number
  contextTokens: number
  contextWindow: number
  costUsd: number
  connectors: string[]
  /** Tokens each model has burned this session, the main session's and every sub-agent's. */
  modelTokens?: Record<string, number>
  /** The main session's effort level, as its last model request carried it. */
  effort?: string
  /** Usage windows as the last API response reported them: `five_hour`, `seven_day`. */
  limits: { kind: string; percentUsed: number; resetsAt?: string }[]
}

/** The main session: what the person last asked for, and whether it is at work. */
export type PlanStep = { content: string; status: 'pending' | 'in_progress' | 'completed' }

export type Manager = {
  task: string
  isWorking: boolean
  startedAt: number
  /** The manager's own task list, as the session's plan tool last set it. */
  plan?: PlanStep[]
  /** What the main session is doing right now. */
  activity?: string
  /** Until when the crew celebrates a finished job. */
  celebrateUntil?: number
  /** When the whole job finished: the turn over and no agent of its crew still running. */
  doneAt?: number
  /** The session's cost and tokens when this task began: the task's own spend is the difference. */
  costAtStart?: number
  tokensAtStart?: number
  /** The job's budget from its plan's `minutes`, when the progress tool gave one. */
  planMin?: number
  /** The job's budget in minutes: the plan's, else the default; absent while the timekeeper is off. */
  budgetMin?: number
  /** How the job ended short: Esc (`stopped`) or an API error or refusal (`error`). Never cheered. */
  outcome?: 'stopped' | 'error'
  /** When a background agent of the job ended: its report waits on a main turn to answer it. */
  reportDue?: number
  /** An earlier job still held open by its background work when this prompt came: the one that finishes. */
  carried?: { task: string; startedAt: number; costAtStart?: number; ids: string[] }
  /** Reopened by a turn Claude started after the job was done: it ends again quietly. */
  isFollowUp?: boolean
}

/** The timekeeper: its settings (kept in `$.store`) and which job it already alerted for. */
export type Timekeeper = {
  on: boolean
  jobMin: number
  agentMin: number
  /** The `startedAt` of the job already warned at 80%, and of the one alerted past 100%. */
  warnedFor: number
  overFor: number
}

/** What the token manager watches: recent burn, how much was cached, its settings. */
export type Watch = {
  burn: { at: number; n: number }[]
  cacheRead: number
  promptAll: number
  autopilot: boolean
  budgetUsd: number
}

/** Tokens per model over every session: seeded once from the history files, then kept up. */
export type AllTime = {
  since: string
  models: Record<string, number>
}

/** This session's turn stats, as the session band used to show them. */
export type SessionStats = {
  turn: number
  /** Output tokens per second of the main session's last timed response. */
  speed: number | null
  costAtStart: number
  /** When the prompt cache goes cold, an hour after the last answer. */
  cacheUntil: number | null
  /** Seconds left on it, kept by the clock so the band redraws. */
  cacheLeft: number | null
  isBusy: boolean
  /** The smallest warning minute already toasted since the last answer; 0 none. */
  warned: number
  /** Why this task runs in crew mode (a big job), or empty. */
  crewMode?: string
}

/** Today's totals, kept across sessions. */
export type Today = {
  date: string
  tasks: number
  agents: number
  tokens: number
  costUsd: number
}

/** One piece of background work, as the last Stop or SubagentStop hook listed it. */
export type BgTask = {
  id: string
  /** 'shell', 'subagent', 'monitor', 'workflow', or the engine's own word for another kind. */
  type: string
  status: string
  description: string
  /** A shell's command line. */
  command?: string
  /** A subagent's type. */
  agentType?: string
  /** A monitor's MCP server and tool. */
  server?: string
  tool?: string
  /** A workflow's name. */
  name?: string
  /** Since when it has stood at this status: first listed, or its status last changed. */
  seenAt?: number
  /** When Mission Control last checked in with the person about it, quiet an hour. */
  checkedInAt?: number
  /** Let go by the person (/missioncontrol release): still listed, no longer holding the job. */
  released?: boolean
}

/** A scheduled wake-up (CronCreate, ScheduleWakeup, /loop) that will start a turn later. */
export type BgCron = { id: string; schedule: string; recurring: boolean; prompt: string }

/** Claude's background work. The engine lists it only as a turn or a subagent stops: `at` says when. */
export type Background = { tasks: BgTask[]; crons: BgCron[]; at: number }

declare module 'claude-code' {
  interface PluginState {
    'crab-progress': {
      flow: Flow | null
      agents: AgentRun[]
      panel: Panel
      now: number
      /** The band's tick: moves only when something the band draws from the time changes. */
      bandTick: number
      /** The pane's tick, the same for Mission Control's desktop drawing. */
      paneTick: number
      /** The person's answer-style rules, mirrored from `$.store` for drawing. */
      memory: string[]
      env: Env
      manager: Manager
      watch: Watch
      today: Today
      allTime: AllTime
      /** The id of the skin Mission Control and the band are drawn in. */
      skin: string
      /** Mission Control's settings, mirrored from `$.store` so the pane redraws. */
      settings: { openOnStart: boolean; crewMode: boolean; currency: string; sounds: boolean }
      /** Street Cred: XP, the counts badges are earned on, the badges. Mirrored from `$.store`. */
      cred: { xp: number; jobs: number; longJobs: number; agents: number; crewJobs: number; nightJobs: number; chromed: boolean; samurai: boolean; badges: string[] }
      /** The session's tool calls, for the Braindance replay. */
      timeline: { at: number; tool: string; text: string; who: string }[]
      /** The beat the replay shows; -1 follows the newest. */
      bdPick: number
      session: SessionStats
      /** The timekeeper's settings and alert marks; the marks live here so a hot reload never re-alerts. */
      timekeeper: Timekeeper
      /** Background tasks and scheduled wake-ups, as the last Stop or SubagentStop listed them. */
      background: Background
      /** Today and All-time as this session last read or wrote them: a save adds only its own share. */
      saved: { today: Today; allTime: AllTime }
    }
  }
}
