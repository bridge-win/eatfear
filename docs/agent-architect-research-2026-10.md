# eatfear → Personal Trading Agent

Research briefing · October 2026  
Sources constrained to **September 2026 and later** where the industry moved; older specs (MCP 2024, LangGraph 1.0 Oct 2025, ROADMAP) are cited only as durable primitives.

This document is dual-purpose:

1. A product architecture plan for turning **eatfear** into a personal financial trading agent.
2. An interview brief for an **AI Agent Architect / Engineer Expert** role.

---

## 0. Demand, restated

You asked for three things at once. They are related but must not be collapsed into one backlog.

| Intent | What “done” looks like |
| --- | --- |
| Personal trading agent | A system that watches markets, explains evidence, proposes playbooks, backtests them without lookahead, paper-trades with a kill switch, and only then (opt-in) talks to a broker. |
| Interview-grade architecture | You can defend every layer: why it exists, what failure forced it, how it is observed, how it fails closed, and how it is evaluated. |
| 2026 enterprise literacy | You can map the same layers onto Agentforce, Agent Bricks, Bedrock AgentCore, Foundry, ADK, QuantConnect, Orbital, Invsto — and say what a solo product should **not** copy. |

The research scope you listed maps onto the 2026 agent stack as follows:

| You asked | Industry name | eatfear today |
| --- | --- | --- |
| Agent monitoring | AgentOps / AHM / MLflow Tracing | Vercel Analytics only |
| Multi-agent | Specialist fleet + orchestrator | None |
| Scheduled tasks | Durable jobs, not cron-on-HTTP | Vercel cron + GitHub Actions collectors |
| RAG | Knowledge layer (human-authored) | Static research corpus, not retrieval |
| Memory | Episodic + derived, distinct from RAG | localStorage + unused Supabase tables |
| Backtesting | Point-in-time, cost-aware, independent grader | Signal forward-stats MVP; BTC plan failed validation (honest) |
| Full-chain traces | OTel `gen_ai.*` + effect ledger | None |
| Skills | Agent Skills (`SKILL.md`) | Playbook spec only |
| MCP | Tool gateway | Cursor-dev Qveris rule, not product |
| Execution environment | Sandbox + durable run | Next.js route handlers, `maxDuration` 10s |
| Stability / consistency | Idempotency, as-of time, replay, kill switch | Partial (signal-state library unused) |

**Non-negotiable product contract (already in ROADMAP, keep it):**  
The LLM never owns the tape. Rules propose, risk engine sizes, human or mandate approves, execution worker is the only process that can create an order. “Precise timing” means a trigger + evidence chain + historical stats + invalidation — not a predicted top/bottom.

---

## 1. Current state of this repository

eatfear is a **rules-based market intelligence workspace**, not a running LLM agent. That is a feature, not an accident: the strongest 2026 trading-agent products (QuantConnect, Orbital, Invsto, EigenTrader) all put deterministic data, backtest, risk, and execution **under** the model.

### 1.1 What is shipped

- **Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, SWR + localStorage, Supabase Auth/Postgres, Vercel, GitHub Actions.
- **Markets:** crypto (OKX/Binance/Deribit/on-chain), US/HK/VN equities, FRED macro, China observatory, smart-money, yield discovery.
- **Signal engines:** Black Swan (long capitulation), Euphoria (short/overheat), regime score, opportunity radar, BTC multi-horizon trade plan (research-only; grouped-weight models **failed** holdout).
- **Learning loop (local-first):** watchlist, journal, pre-trade checklist, crash-alert subscriptions.
- **Backtest MVP:** `/api/crypto/signal-backtest` — 7/30/90d median forward return, hit rate, MAE from OKX daily candles, no lookahead on the event time.
- **Honest research culture:** `docs/btc-review-2026-09-12.md` publishes negative validation. This is closer to Invsto’s “proposer never grades” than to typical AI-trading marketing.

### 1.2 What is designed but not running

From `ROADMAP.md`, `docs/PLAYBOOKS_SPEC.md`, `scripts/003_trading_loop_schema.sql`:

- `lib/signal-state.ts` — state machine exists, **no worker writes `signal_events`**.
- Seven versioned playbooks — spec only; `lib/playbooks.ts` and `/playbooks` do not exist.
- Supabase tables for watchlist, journal, paper, alerts — **UI still localStorage**.
- Alert fan-out route exists — **not on the Vercel cron**.
- Paper positions schema + pure functions — **no mark-to-market worker**.
- Trade plan API: `executionEnabled: false`.

### 1.3 What is absent (the agent gap)

No system prompts, no tool-calling loop, no RAG index, no agent memory store, no OpenTelemetry / Langfuse, no eval datasets for agents, no sandbox, no MCP server for the product, no durable run record, no human-approval inbox for agent actions.

Catch-all API `maxDuration = 10`. That is enough for a score card. It is **not** enough for a research agent, a backtest that walks years of bars, or a multi-tool loop.

---

## 2. The 2026 agent stack (what to defend in interviews)

Consensus across Letta’s original map, Paolo Perrone’s 2026 O’Reilly update, and Eric Roby’s Jun 2026 rewrite: **six layers, two rails**. Add a layer only when a named failure appears.

```
Surface          chat, desk, Slack, approval queue, IDE
Orchestration    loop, graph, handoff, durable workflow
Memory           episodic traces + derived files  ← split from RAG in 2025–26
Knowledge        RAG / hybrid retrieval           ← human-authored
Tools / MCP      live systems, sandboxes
Models           routed, not a single god-model
     |  Rail A: Observability + Eval
     |  Rail B: Governance + Security
```

IBM’s Sep 2026 rule of thumb (Gustavo Aguiar, 12 Sep 2026):

| If the knowledge… | Use |
| --- | --- |
| was written down on purpose | RAG / knowledge |
| was learned from prior runs | Memory |
| is a repeatable procedure + judgment | Skill (`SKILL.md`) |
| only exists inside a live system | MCP / tools |

Agent Skills (open standard, Dec 2025; arXiv 2602.12430) reshape **context and permissions before** the model acts. MCP (donated to the Agentic AI Foundation, Dec 2025) is connectivity: tools, resources, prompts over JSON-RPC. They are orthogonal. A playbook skill should say *which* MCP tools to call, how to interpret them, and when to stop.

**Do not start with all six layers.** Roby’s rule: model + tools + knowledge first. Add orchestration when glue code hurts. Add memory when users repeat themselves. Add evals when you cannot tell if a prompt change helped. Add governance the moment money, PII, or production writes exist. Add multi-agent last — when one agent has too many tools or jobs.

LangChain *State of Agent Engineering*: 57% of orgs have agents in production; 89% have some observability, only 62% have detailed tracing, ~50% run offline evals. Gartner Market Guide for AI Evaluation and Observability (2 Feb 2026): 60% of SWE teams expected to use these platforms by 2028 (from 18% in 2025).

---

## 3. Enterprise practice since September 2026

### 3.1 Cloud control planes (same layers, different owners)

| Provider | Runtime | Memory | Tools | Observability | Notes (Sep–Oct 2026) |
| --- | --- | --- | --- | --- | --- |
| **AWS** | Bedrock AgentCore Runtime (microVM sessions, scale-to-zero, V2 snapshot startup) | AgentCore Memory | AgentCore Gateway (MCP) | CloudWatch + AgentCore | Sep: Managed Agents (OpenAI) preview; Strands harness −28% tokens; Strands Decider 2B ~115ms local router/guardrail; Managed Knowledge Base connectors (ServiceNow, Confluence DC, Salesforce, Zendesk) |
| **Databricks** | Agent Bricks + DurableAgentServer + Sandbox | MemCurrent on Lakebase (episodic + derived + dreaming) | MCP + Genie One + AI Search | MLflow Tracing in Unity Catalog | Docs updated **13 Oct 2026**. MemCurrent blog **20 Oct 2026**: 22.3% → 68.4% pass rate, −31% tokens, −26% latency vs no memory |
| **Microsoft** | Foundry Hosted Agents (GA) vs self-hosted Agent Framework vs Durable Extension | Sessions + external stores | Built-in + MCP | Foundry + App Insights | Protocol (Responses / A2A / MCP) ≠ who owns persistence |
| **Google** | Agent Engine / ADK; Gemini Managed Agents ≠ Cloud Agent Runtime | Sessions + Memory Bank | Tools + MCP + A2A | Cloud observability | Environments API still beta; default egress is open unless allowlisted |
| **Anthropic** | Managed Agents control plane; cloud or self-hosted sandbox workers | memory_store | MCP tunnels independent of sandbox location | Session traces | Worker claims work, runs tools locally, posts results; secrets stay in the environment |
| **Salesforce** | Agentforce | Data Cloud session context | Actions / flows | Agentforce Health Monitoring | See cases below |

Production deployment (AI Stack Current, updated **19 Sep 2026**) is the interview-critical distinction:

> The model call is one dependency. It is not the deployment architecture.

Separate: ingress (stateless) → durable run record → orchestrator → worker → sandbox → tool gateway → memory/knowledge → observability. Create the run ID **before** execution. Workers must be empty of unique durable state. Snapshot restore (AgentCore Runtime V2) means startup ≠ instance creation ≠ request init — never mint IDs, clocks, or short-lived credentials at snapshot time.

### 3.2 Memory: MemCurrent (20 Oct 2026)

Three access patterns, use all three:

| Pattern | When | Cost |
| --- | --- | --- |
| Plugin | Log every step; inject `memory.md` index at session start | Predictable, some wasted tokens |
| Tool | `search_memory` / `fetch_memory` / add-update-delete | Flexible, quality = model skill |
| Offline “dreaming” | Distill, split, merge, conflict-resolve | Cheap, delayed |

Ablations: derived memory does most of the work (66.1% vs 35.8% episodic-only vs 22.3% none). Dreaming beats online tools alone (~10 pts). Combination wins. Memory must be **user-scoped, versioned, and able to move across models** — it is not a prompt dump.

For eatfear this means: do **not** put the whole journal into the system prompt. Store run traces as episodic rows; distill “user never shorts on funding-positive strength”, “BTC 2d grouped-weight failed holdout”, “risk 0.5% / 25% cap” into derived files.

### 3.3 Observability: silent failures

Salesforce Agentforce Health Monitoring (engineering blog, **22 Sep 2026**):

- Traditional green metrics lie. The agent can look healthy while the LLM gateway is dark.
- Telemetry was fragmented across ~5–6 stores (session, reason, tool, error, escalation).
- Alerting latency was ~20 minutes; streaming ingestion brought it to minutes; north-star is **<120s from alert click to session page**.
- 16+ built-in metrics; roadmap: cost, TTFT/TTLT, toxicity, feedback, RAG quality.
- Lifecycle: detect → notify → diagnose → fix. They are still on the first two; next is a runtime insight agent, then approved auto-remediation.

FSE Companion ’26 tutorial (Ezzati-Jivan): traces must include intent, plan, model decision, memory R/W, tool call, retry, inter-agent message, side effect, and outcome. Failures look like goal drift and false success, not crashes.

Langfuse v4 (Aug 2026), acquired by ClickHouse Jan 2026, is the open-source default that speaks OTLP `gen_ai.*`. Pair with **eval datasets**, not just replay. AgentOps is lighter (session replay + cost) and weaker on datasets/scorers.

### 3.4 Enterprise cases (Sep 2026)

**Crocs × Agentforce — 10 Sep 2026**  
Retail “superagent” Rivet. 3 agents in 5 months. Five jobs, not one job title: product discovery, FAQ, order tracking, returns, conversational checkout. Voice reuse of the same actions in 7 weeks. Analytics on autonomous resolution and FAQ accuracy from day one. Lesson: **jobs to be done**, shared action catalog, measure competency.

**Siemens × Agentforce — 14 Sep 2026**  
Two specialists (engagement + qualification), not one “SDR agent”. 6 weeks prototype → production. ~2,500 inbound leads/month, 132 countries, response time days → minutes, 11% engagement, 6% qualification, 80% Good/Very Good. Lesson: coverage of a **narrow task** at constant quality beats replacing a role.

**Live Nation — 16 Sep 2026 (Dreamforce)**  
Melody at BottleRock: headless React, Data Cloud, <30 days, 37k interactions / 17k sessions in 12 days, 85% answered in ≤3 turns. Venue Agent: one system, venue-specific grounding via Data Cloud, Slack handoff, **95%** resolved without human. Lesson: one agent system + retrieved venue facts > N forked bots; always a human path that **keeps session context**.

**Salesforce internal (Applied AI, 2026; still the doctrine)**  
Agents ≠ software. Manage them like employees. ADLC: autonomy is earned against a **human baseline**. Engagement Agent: first beat the bottom 10% of SDRs; after measuring top-seller emails/CTAs, beat 90% on those tasks; >$120M annualized pipeline on specific follow-up jobs. Account POV: 4–5 hours → 100% coverage.

**JPMorgan (LangGraph, cited 2026 stack literature)**  
Investment-research assistant: graph orchestration, RAG, human-in-the-loop. The bank did not let the model file a research note unreviewed. Same pattern eatfear needs for any “opportunity” that could become an order.

### 3.5 Stability / consistency (what enterprises actually buy)

1. **Graduated autonomy** (Salesforce ADLC).
2. **Durable run + idempotency key** before any side effect.
3. **Effect ledger** — every tool that can change the world is append-only and replayable (Invsto “replay on every order”).
4. **Point-in-time data** — backtest never sees the future; live never uses a simulated print (Invsto Oracle).
5. **Policy at the gateway**, not in the prompt (EigenTrader, Invsto, OWASP MCP Top 10). Agents cannot route around limits.
6. **Kill switch + time budget** — stalled steps are skipped, not awaited (Invsto cloud agents).
7. **Silent-failure monitors** — availability, not just HTTP 200 (AHM).
8. **Eval gates** — prompt/skill/playbook changes do not ship on vibes.
9. **Snapshot-safe init** if using snapshot runtimes.
10. **Human interrupt** that survives process death (approval is durable state).

---

## 4. Financial quant agent products (feature + implementation)

| Product | Positioning | Agent model | Backtest | Execution | Governance | What to steal |
| --- | --- | --- | --- | --- | --- | --- |
| **QuantConnect** | Quant IDE + LEAN + agent harness | Conductor + specialists (Mia generalist; idea, validate, code, paper, live-monitor). Server-side next to data. Persistent memory + skills. Wake-on-backtest-complete, no polling. | LEAN + **results analyzer that feeds the AI** (fatal, strategy, execution, overfitting, lucky-curve Monte Carlo, 17 crisis windows) | Paper then live; live write is a separate permission | Per-domain R/W; chat edits need diff approval; MCP under same ACL | Specialist team; analyzer-as-tool; live permission split; context hygiene |
| **Orbital** | “From idea to order” | Named agents with jobs, missions, monitors. Ask-by-default. Receipts + Show work. | Own **deterministic Rust** engine, byte-reproducible; daily since 2016, minute since Sep 2023 | Limits; person in the loop wherever it matters | Needs-you inbox; every order on one timeline with who approved | Approval cards; receipts; market-hours gated schedules |
| **Invsto** | Agentic infra for capital markets | Model-agnostic; MCP in build; CLI versions **mandate beside strategy** | Isolated workers; proposer never grades; Market Agent Eval | Non-custodial, 17+ brokers, one Trade ID | Mandates, pre-trade, kill switch, order replay | Mandate-as-code; PIT data; independent grader |
| **EigenTrader OS** | Agent platform for autonomous trading | Builder or BYOA via MCP; fleets (trade / risk / portfolio) | Strategy tools as products | Order gateway, server-side | Identity registry, capital budgets, circuit breakers | Policy at boundary; per-agent identity |
| **Obside** | 24/7 NL agents | Describe → deploy | Up to 20y | 100+ brokers, non-custodial; demo portfolio | Alerts on commit | NL → rules, but keep rules inspectable |
| **FMZ** | Quant OS + MCP to your coding agent | External agent writes strategy, runs backtest, reads logs | High-precision, full tape | Docker robot; keys never leave host | Permission revoke | Local execution of keys; MCP as the IDE bridge |
| **Composer (SoFi)** | No-code symphony | NL draft → visual rules | Historical allocation graph, fees/slippage | Composer **is** the broker; scheduled rebalance ≠ instant buy | Human edits rules | NL must compile to editable rules |
| **Trade Ideas Holly / TrendSpider** | Scan + signal / chart+bot | Vendor strategies or visual rules | Vendor testers | Optional auto via brokers | Mixed | eatfear should not become a black-box signal vendor |

**Shared architecture of the serious ones:**

```
NL / agent  →  typed strategy or playbook
            →  point-in-time backtest (independent metrics kernel)
            →  paper / replay
            →  mandate + pre-trade + approval
            →  non-custodial order
            →  one timeline (decision, hold, fill, who approved)
```

The LLM is a **researcher and workflow driver**. The tape, fills, and risk are deterministic services.

---

## 5. Gap analysis: eatfear vs that bar

| Capability | Industry bar | eatfear | Priority |
| --- | --- | --- | --- |
| Evidence-rich monitoring | Multi-source, as-of stamped | Strong (crypto/stock/macro/CN/smart-money) | Keep; add as-of + source health everywhere |
| Opportunity → method | Playbook with trigger/confirm/invalidate/size/exit | Scores + radar; playbooks spec-only | P0 |
| Backtest honesty | PIT, costs, independent grader, failure cases | Forward-stats MVP; BTC plan published as failed | P0 — promote this culture into a kernel |
| Trigger worker | 1–5 min eval, state machine, alerts | Library + schema, no writer | P0 |
| Persistence | Server of record | localStorage | P0 |
| Paper trading | Mark-to-market vs signal | Schema only | P1 |
| Agent surface | Chat + desk + approval inbox | None | P1 (copilot first) |
| Multi-agent | Named jobs, tiny toolsets | None | P2 |
| Memory | Episodic + derived + dream | None | P2 |
| RAG | Hybrid over methods + notes + filings | Static corpus | P2 |
| Skills | Versioned SKILL.md bound to engines | Spec | P1 with playbooks |
| MCP | First-party tool server + ACL | None in product | P1 |
| Traces | OTel + session drill-down <120s | None | P1 with first agent |
| Durable runtime | Run record, resume, time budget | 10s HTTP | P1 |
| Execution | Gateway, mandate, kill switch | Explicitly off | P3, after paper trust |
| Evals | Dataset + judges + backtest kernel | Unit tests on detectors | P1 |

eatfear’s **unfair advantage** versus Orbital/Obside: you already have on-chain/derivatives/macro evidence and an honest “we failed validation” research posture. Do not throw that away for a chat wrapper.

---

## 6. Target architecture for this project

Keep Next.js as the **desk**. Add a **control plane** and a **worker plane**. Do not run the agent loop inside a 10s Vercel function.

```
┌──────────────────────────────── desk (Next.js) ────────────────────────────────┐
│  Market dashboards (existing) │ Agent HQ │ Runs/Traces │ Playbooks │ Paper/OMS │
└──────────────┬─────────────────┴──────────┴─────────────┴───────────┴──────────┘
               │  runId, stream, approval
┌──────────────▼──────── control plane (Node worker / Inngest) ──────────────────┐
│  Ingress: auth, quota, idempotency, create agent_runs                          │
│  Orchestrator: graph of specialists OR single copilot with tools               │
│  Scheduler: collector 5m │ signal worker 5m │ dream nightly │ paper MTM 1m     │
│  Policy: mandate, tool ACL, HITL interrupts                                    │
└──┬─────────────┬──────────────┬──────────────┬──────────────┬─────────────────┘
   │             │              │              │              │
 models       MCP gw        sandbox       memory         knowledge
 (router)    (eatfear      (backtest      (Supabase      (pgvector +
  cheap       + news        WASM/LEAN      episodic       BM25 on
  vs          + FRED        or Node        + derived      corpus,
  frontier)   + read-only   isolate)       + dream)       playbooks,
              exchange)                                   journal)
   │
 observability: OTel → Langfuse  +  effect_ledger  +  eval datasets
```

### 6.1 Specialist fleet (jobs to be done, not “one trading GPT”)

| Agent | Trigger | Tools (keep ≤8) | May spend money? |
| --- | --- | --- | --- |
| **Watcher** | 5 min cron / price event | market MCP, signal engines | No |
| **Regime officer** | on snapshot | regime, macro, vol, correlation | No — can freeze playbooks |
| **Scout** | when score crosses band | opportunity radar, news RAG | No |
| **Researcher** | user ask / scout handoff | corpus RAG, web fetch, citations | No |
| **Backtester** | on playbook edit / scout proposal | PIT kernel, costs, analyzer | No (compute budget only) |
| **Playbook runner** | trigger state = fired | paper OMS, checklist | Paper only until mandate |
| **Journal coach** | after fill or skip | journal, memory write | No |
| **Ops / trace** | on error / silent fail | traces, source health | No |
| **Conductor** | user goal | handoff only | No |

Handoff style: OpenAI Agents SDK **handoff** or a thin LangGraph. One conductor, specialists with disjoint tools. QuantConnect’s lesson: twenty tools make the model slower and worse.

### 6.2 Memory design (MemCurrent-shaped, on Postgres you already have)

```
agent_run_steps     append-only episodic (plugin)
agent_memory_files  derived tree (persona, mandates, lessons, workflows)
memory.md           generated index injected at session start
dream_job           nightly: distill, conflict, drop stale
```

Derived files to start with:

- `user/risk.md` — 0.5% risk, 25% cap, no perp shorts until validated
- `user/preferences.md` — language, horizons, assets
- `research/btc-grouped-weight.md` — **failed** holdout, do not revive without new evidence
- `playbooks/<id>.md` — distilled win/loss notes, not the rules themselves (rules live in code)
- `workflows/how-to-backtest.md`

### 6.3 Knowledge / RAG

Do not embed candles. Embed **methods, papers, playbook prose, journal notes, CN policy texts**.

Hybrid: BM25 (tickers, rule IDs, paper titles) + dense (theses) + RRF. Every chunk carries `as_of`, `source`, `license`. Retrieval is an **eval problem** first (LongMemEval lesson): measure whether the right playbook/failure-case reached the model.

### 6.4 Skills

Each playbook is dual:

1. Machine-checkable `Playbook` record (already specified) — worker evaluates, backtest kernel scores, alerts fire.
2. `skills/playbooks/<id>/SKILL.md` — when to use it, which MCP tools, how to talk to the user, escalation (“ask before tracking or spending compute”).

Skills load on trigger; they do not sit in every prompt.

### 6.5 MCP (product, not just Cursor)

First-party `eatfear` MCP server, tenant-scoped, audited:

| Tool | Side effect | ACL |
| --- | --- | --- |
| `get_series` / `get_score` / `get_regime` | read | default on |
| `run_backtest` | compute $ | budget + approve above N |
| `list_watchlist` / `add_watchlist` | user data | user scope |
| `get_playbook` / `propose_playbook_edit` | propose only | edit needs approval |
| `paper_order` | paper ledger | runner agent + mandate |
| `live_order` | real money | **off** until Phase E; server-side deny |
| `search_knowledge` / `search_memory` | read | default on |
| `write_memory` | derived memory | scoped paths |

Gateway logs: tool name, args, claims, outcome (OWASP MCP / Azure enterprise patterns, 2026). Secrets never in memory files.

### 6.6 Backtest kernel (promote what you already believe)

Unify `lib/backtest/signal-backtest.ts`, `lib/crypto-plan-backtest.ts`, and playbook clauses:

- Point-in-time bars only; embargo for fundamentals.
- Costs: commission + slippage + funding if perps.
- Split: chronological, frozen rules, no holdout search (you already did this for BTC).
- Metrics: n, hit rate, median fwd, MAE, max DD, vs EMA/B&H **same risk budget**, min trade gate.
- **Independent grader** process: the agent that proposes weights cannot write the score row.
- Analyzer findings (steal QuantConnect’s list, shrink it): wiped out, lucky curve, >10 free params, stale fills, warmup orders.
- Status `candidate` until `minSampleSize` — already in PLAYBOOKS_SPEC; implement it.

### 6.7 Tracing (full chain)

One `trace_id` on: agent_runs, run_steps, model generations, MCP calls, retrievals, memory R/W, signal_events, alerts_log, paper_positions, journal rows.

Span attributes beyond `gen_ai.*`:

- `eatfear.signal_id`, `playbook.id`, `playbook.version`
- `market.as_of`, `market.symbol`, `market.venue`
- `mandate.id`, `approval.id`
- `effect.id` (ledger)

UI north-star: alert or “show work” → session waterfall in **< 2 minutes**.

### 6.8 Scheduling

| Job | Cadence | Where |
| --- | --- | --- |
| Market collector | 5 min | existing GH Action / keep |
| Signal worker (watchlist × playbooks) | 5 min | **new** Inngest / pg_cron + worker, not Vercel 10s |
| Alert dispatch | on `signal_events` | worker |
| Paper MTM | 1 min during session | worker |
| Dreaming | nightly | worker |
| Eval suite | on playbook/prompt change | CI |
| Macro warm cache | daily | existing Vercel cron OK |

### 6.9 Execution environment

- **Read path:** current Node route handlers.
- **Research/backtest path:** isolated worker with CPU/time quota; no network except data APIs.
- **Agent tool path:** MCP gateway; no raw `eval`.
- **Order path:** single OMS function; agent can only enqueue an `Intent`; OMS checks mandate, risk, session hours, then paper or (later) broker.
- Never put exchange keys in the Next.js app or in prompts. FMZ/Invsto/Obside pattern: non-custodial, keys in a sealed worker or the user’s broker.

### 6.10 Recommended selection (solo + interview portfolio)

Stay boring on purpose. Interviewers reward judgment.

| Layer | Pick | Why |
| --- | --- | --- |
| Desk | keep Next.js | already strong |
| Worker | Inngest or Trigger.dev on the same repo | durable, TS, approvals as waits |
| Agent loop | Vercel AI SDK + tools first | native to Next; swap to LangGraph JS only if branching explodes |
| Models | cheap classifier + frontier researcher | Strands/Bedrock routing pattern |
| Memory | Supabase Postgres | you have it; add pgvector |
| RAG | pgvector + Postgres FTS | hybrid without new vendor |
| Observability | OpenTelemetry → Langfuse (self-host or cloud) | OTLP, evals, ClickHouse-backed |
| Evals | fixtures from frozen BTC + playbook cases | you already have negative cases — gold |
| MCP | first-party server | interview demo piece |
| Sandbox | none until code-gen exists; then E2B/Daytona | don’t buy it for card scores |
| Broker | none until paper + audit exist | ROADMAP is correct |

Do **not** copy AgentCore/Agent Bricks as infra for a personal app. Copy their **contracts**: durable session, sandbox, memory split, gateway policy, traces in a catalog.

---

## 7. Function roadmap (camera-ready phases)

### Phase A — Close the deterministic loop (interview: “we earned the agent”)

1. Persist watchlist/journal to Supabase with local fallback.
2. Implement `lib/playbooks.ts` + `/playbooks` from PLAYBOOKS_SPEC.
3. 5-minute worker writes `signal_events` through `signal-state`.
4. Bell + `alerts_log`; wire `alerts/dispatch` to a schedule.
5. Paper blotter + MTM worker.
6. Promote backtest kernel; every active playbook shows n / hit / MAE / named failure.

### Phase B — Copilot, no authority

1. `/desk` chat bound to read-only MCP (scores, series, backtest, journal).
2. `agent_runs` + OTel + Langfuse.
3. Citations to engine fields, not free prose (“Black Swan 74 because FUNDING_NEGATIVE…”).
4. Eval set: 30 questions with gold evidence IDs.

### Phase C — Fleet + memory + skills

1. Watcher / Scout / Backtester / Coach as scheduled or handoff agents.
2. Needs-you inbox (Orbital): track playbook, spend backtest credits, edit rules.
3. MemCurrent-style files + nightly dream.
4. Playbook SKILL.md packages.

### Phase D — Paper autonomy with ADLC

1. Runner may paper-trade inside mandate after N successful copilot weeks.
2. Kill switch, time stop, regime freeze.
3. Replay any paper order from the effect ledger.
4. Competency dashboard vs your own journal baseline.

### Phase E — Live, optional, boring

1. Non-custodial, encrypted keys, pre-trade, two-person (you + confirm).
2. `live_order` tool denied at gateway until flag + mandate version.
3. Legal copy already implied by ROADMAP; keep it.

---

## 8. UI details (what to actually build)

Today’s nav is a **dashboard farm** (`/crypto /smart-money /stock /discover /watchlist /journal /macro /cn /methodology /news`). Keep it. Add an **operator plane** so the product feels like QuantConnect + Orbital, not another card wall.

### 8.1 Information architecture

```
Desk          /desk          conductor chat, context rail, run status
Inbox         /inbox         approvals, silent-fail alerts, source health
Runs          /runs/:id      waterfall trace, receipts, cost, tokens
Playbooks     /playbooks     catalog, clause pass/fail, backtest, version diff
Paper         /paper         positions, MTM, vs signal, kill
Memory        /memory        files + search + “why this was recalled”
Signals       existing dashboards, but each card links to playbook + run
```

Command palette (already ⌘K): add “approve last run”, “open trace”, “freeze playbooks”, “kill paper”.

### 8.2 Agent HQ (`/desk`) — primary new surface

Three columns, not a blank chat:

1. **Left — fleet.** Named agents with state: idle / running / waiting-on-you / frozen. Last receipt: “Watcher 04:12 UTC · 3 symbols zone_entered · $0.002”.
2. **Center — thread.** User goal. Tool cards inline (Orbital: apply / approve). Streaming of *what it is doing*, not token spam. Every assistant claim has a chip: engine field or retrieval chunk.
3. **Right — context rail.** Active playbook, mandate (risk 0.5%, 25% cap), as-of market snapshot, memory hits, open orders.

Empty state should still show the Watcher ticking — abundant-enterprise idea: coverage even when you are not chatting.

### 8.3 Needs-you inbox

Cards, not emails:

- “Scout wants to track PB-01 on ETH. Historical n=42, hit 58%, MAE 11%. Failure case: 2022-06 wick.” Buttons: Track / Refuse / Open backtest.
- “Backtester requests 12s compute.” 
- “Regime officer froze shorts: funding positive + euphoria < 40.”

Every card stores `approval_id` on the run. Timeline later shows who approved.

### 8.4 Trace / Show work (`/runs/:id`)

Waterfall:

```
00.0  user goal
00.1  memory plugin injected memory.md
00.4  conductor → scout handoff
00.5  MCP get_score black-swan ETH  as_of=...
00.7  RAG playbook PB-01 failureCases
01.2  model decision: propose track
01.3  interrupt: approval.waiting
...
```

Filters: LLM / tool / retrieval / memory / effect. Cost and tokens in the header. “Open Langfuse” is secondary; the in-app view is the product.

Silent-fail banner (AHM): if Watcher missed two cadences or OKX paginated empty, the desk goes amber even if chat still answers.

### 8.5 Playbooks

Table: id, market, direction, status (candidate/active/retired), n, hit, MAE, last trigger.

Detail: each `RuleClause` as a pass/fail row against the latest snapshot (this is in the spec — implement it). Version pin on journal rows. “Why retired” for the BTC grouped-weight model, linked from memory.

### 8.6 Paper blotter

Not a toy wallet. Columns: playbook version, entry as-of, stop, time-stop, MTM, MAE live vs backtest MAE, divergence flag (QuantConnect: live vs backtest baseline). Kill is a persistent button, not a setting buried in profile.

### 8.7 Memory browser

File tree + search. Show the **index the model saw**. Allow user edits (explicit tools). Show last dream diff. Never display secrets.

### 8.8 Existing dashboard upgrades (small, high leverage)

- Each signal card: **as-of**, source health, “open playbook”, “ask desk”.
- Opportunity radar items become **missions** (one click → scout run).
- Journal: bind row to `event_id` + `trace_id`.
- Watchlist: per-symbol agent state (watching / triggered / invalidated).
- Methodology: “load as skill” for researcher.

Visual language: keep eatfear’s honest copy (“rules-based trigger”, “not a timing guarantee”). Agent UI must not sound like a hedge fund AI. Receipts over confidence.

### 8.9 Mobile

Inbox + kill + panic banner first. Full trace is desktop. Watcher notifications already have Telegram schema — use it for approvals, not just crashes.

---

## 9. Interview narrative (how to talk about this repo)

**One-sentence positioning**  
“eatfear is a point-in-time market-intelligence desk with frozen, failed-validation research; I am adding an agent control plane that can only propose, backtest, and paper-trade through a mandate — the same split banks and 2026 trading-agent platforms use.”

**Stories to have ready**

1. **Jobs not jobs-titles** — Crocs/Siemens: five retail jobs, two SDR jobs. Your fleet table.
2. **ADLC** — autonomy earned vs your own journal + backtest kernel, not vs LMSYS.
3. **Memory ≠ RAG ≠ Skills ≠ MCP** — IBM Sep 2026 + MemCurrent Oct 2026 numbers (3× pass, −31% tokens).
4. **Silent failure** — AHM 20 min → minutes; your Watcher heartbeat.
5. **Proposer never grades** — Invsto + your BTC holdout loss. Show `btc-review-2026-09-12.md`.
6. **Durable run envelope** — `runId`, versions, `as_of`, idempotency, deadline.
7. **Policy at gateway** — `live_order` denied in MCP even if the model asks.
8. **When not to multi-agent** — Roby: add specialists when one agent has too many tools; you start with copilot.
9. **Snapshot/init** — AgentCore V2 gotcha, to show you read deployment docs, not just prompts.
10. **EU AI Act / OWASP MCP Top 10** — governance rail is why this is an architect role.

**What you will not claim**  
That the LLM found alpha. Your own 12 Sep 2026 review says the opposite. That is the mature answer.

---

## 10. Sources (Sep 2026 – Oct 2026 unless noted)

- Databricks Agent Bricks docs, updated 13 Oct 2026 — https://docs.databricks.com/aws/en/agents
- Databricks, “MemCurrent: Designing Persistent Memory for Production Agents”, 20 Oct 2026
- AWS ML blog, “ICYMI: What landed for AI builders in September 2026”, 9 Oct 2026
- Salesforce, Crocs Agentforce story, 10 Sep 2026
- Salesforce, Siemens Agentforce story, 14 Sep 2026
- Salesforce / Live Nation, Venue Agent expansion, 16 Sep 2026
- Salesforce Engineering, “AI Agent Observability: Detecting Silent AI Failures”, 22 Sep 2026
- Salesforce, “Applied AI: Lessons from Building Agents in the Enterprise” (ADLC doctrine)
- AI Stack Current, “Production deployment architecture for AI agents”, updated 19 Sep 2026
- Gustavo Aguiar, “MCP vs RAG vs Memory vs Skills”, 12 Sep 2026
- Eric Roby, “The 2026 AI Agent Stack, Drawn from Scratch”, 30 Jun 2026 (layer model; cites 2026 O’Reilly / Letta)
- Langfuse v4 / ClickHouse acquisition context; AgentOps vs Langfuse 2026 comparisons
- QuantConnect Agents + Mia docs (agent harness, analyzer, permissions)
- Orbital product, Invsto platform, EigenTrader Agentic, Obside, FMZ, Composer
- Anthropic Managed Agents self-hosted sandboxes
- OWASP MCP Top 10; Azure MCP enterprise patterns
- FSE Companion ’26, Observability and Runtime Governance for Agentic AI Systems
- eatfear: `README.md`, `ROADMAP.md`, `docs/PLAYBOOKS_SPEC.md`, `docs/btc-review-2026-09-12.md`

---

## 11. Immediate next implementation slice (when you say go)

Do not start with multi-agent. Start with the slice that makes the architecture real:

1. `agent_runs` + `run_steps` tables and a trace_id on `signal_events`.
2. Playbook catalog + `/playbooks` UI with live clause pass/fail.
3. Signal worker writing events every 5 minutes.
4. Read-only MCP + `/desk` copilot that can only cite engines and run the existing backtest API under a compute budget.
5. Langfuse OTLP from that copilot.

That is enough to demo an architect-level system in an interview, and enough to make eatfear a trading agent without lying about alpha.
