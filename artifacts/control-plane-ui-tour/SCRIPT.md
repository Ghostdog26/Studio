# Control Plane — UI walkthrough (16:9, 77.0 s)

Treatment: The real Control Plane UI, page by page, with spoken commentary explaining why each page matters. Dark ink stage (#17202b), paper (#f3efe6), mint (#4fbf94) and amber (#e59a4b) review rings, using the product's own fonts: Space Grotesk headings, DM Sans text, DM Mono labels. Hero: authentic 1600x900 screenshots in one large screen window, with a virtual camera that pans and zooms inside it. Arc: the problem, then six pages, then the review guardrails and a light lockup that fades back to dark for the loop. Sidebar wordmark in the captures is covered by a "Control Plane" patch (BrandPatch) that scales with each zoom.

## Timeline (from SCENE_DURATIONS in VideoTemplate.tsx)

| # | Key | Start–End (s) | Dur | File |
|---|-----|---------------|-----|------|
| 1 | intro | 0.0–7.5 | 7.5 | video_scenes/Intro.tsx |
| 2 | overview | 7.5–19.0 | 11.5 | video_scenes/Pages.tsx |
| 3 | knowledge | 19.0–27.5 | 8.5 | video_scenes/Pages.tsx |
| 4 | catalogue | 27.5–37.0 | 9.5 | video_scenes/Pages.tsx |
| 5 | builder | 37.0–48.5 | 11.5 | video_scenes/Pages.tsx |
| 6 | mcp | 48.5–57.0 | 8.5 | video_scenes/Pages.tsx |
| 7 | agents | 57.0–66.5 | 9.5 | video_scenes/Pages.tsx |
| 8 | outro | 66.5–77.0 | 10.5 | video_scenes/Outro.tsx |

Each voiceover starts 0.45 s after its scene begins.

## Shared page-scene mechanics (scenes 2–7)
- Screen window 62vw wide (16:9), placed right of the caption column or left of it, alternating each scene. On entry: clipPath inset 8%→0, scale 1.06→1, opacity 0→1 over 0.9 s. On exit: scale 0.94, rise 3vh over 0.55 s, while the scene fades out over 0.45 s.
- Camera: the screenshot pans and zooms between its listed poses (focus point fx/fy, scale), 1.5 s eased moves, clamped so no empty edges show.
- Rings: an amber outline over the region, with a DM Mono label at bottom-left of the window. Only one ring is active at a time.
- Caption column: outlined chapter numeral 17vmin. Route label at 0.35 s, headline lines unmask at 0.7 s, "WHY IT MATTERS" line at 2.4 s. A mint progress hairline fills along the bottom for the scene's length.

## Shots

**1 Intro 0–7.5 s.** Dark grid background. Spring punches (stiffness 300): "Every team." 0.15 s, "Every integration." 0.65 s, "Hand-coded." 1.15 s, "Again." (amber, 15vmin) 1.65 s. At 2.5 s the stack dims and the right side shows "01 / INSTEAD — One shared foundation." From 3.1 s, six screenshot thumbnails spring up one every 0.4 s. From 3.5 s, the label "CONTROL PLANE · SECOND BRAIN · AGENT FACTORY · MCP BUILDER". Exit: fade over 0.5 s.
VO: "Most teams hand-code every integration separately. Control Plane gives them one shared foundation instead." (6.50 s)

**2 Overview 7.5–19.0 s.** The window sits on the right. Chapter "02", route "/ OVERVIEW", headline "One view of / everything shared." Why: "Teams see what already exists before they build, and what isn't live yet." Poses (ms): 0 full, 1800 stats ×1.6, 6200 adapters ×1.75, 9600 pull-out ×1.08. Rings: 2600 "4,252 shared documents · 1 agent · 2 components"; 7000 "Runtime adapters: not connected, said plainly".
VO: "The overview puts shared knowledge, agent definitions and MCP components in one place, and says plainly that runtimes aren't connected yet." (10.48 s)

**3 Knowledge 19.0–27.5 s.** The window sits on the left. "03", "/ KNOWLEDGE", headline "Answers / with receipts." Why: "Cited sources mean every agent builds on context people can verify." Poses: 0 ×1.1, 1500 badge ×1.7, 4300 sources ×1.5, 6900 retrieval ×1.25. Rings: 2100 "OpenMetadata: reference only, not connected"; 4700 "Every source linked and version-qualified"; 7000 "Cited retrieval: answer and evidence together".
VO: "Knowledge comes with receipts. Answers cite their sources, so teams build on context they can actually check." (7.05 s)

**4 Catalogue 27.5–37.0 s.** The window sits on the right. "04", "/ CATALOGUE", headline "Start from / what exists." Why: "4,210 community references to reuse first. Every one stays unreviewed until checked." Poses: 0 full, 1500 count ×1.9, 4200 filters ×1.45, 7200 listings ×1.35. Rings: 2200 "4,210 entries, linked to source"; 4800 "Twelve priority review areas"; 7600 "References, not approved integrations".
VO: "The catalogue starts from what already exists: over four thousand community references, treated as unreviewed until someone checks them." (8.44 s)

**5 Guided builder 37.0–48.5 s.** The window sits on the left. "05", "/ GUIDED BUILDER", headline "Goal in. / Reviewable / package out." Why: "Matching is deterministic. AI drafts only the specification. Nothing is built or deployed for you." Poses: 0 ×1.15, 1700 goal ×1.55, 5200 ledger ×1.9, 8200 not-happened ×1.9, 10200 pull-out ×1.1. Rings: 2300 "Describe the goal in plain language"; 5800 "Journey ledger tracks every decision"; 8600 "What has not happened: no build, no deploy".
VO: "The guided builder turns a plain-language goal into a reviewable package. Matching is deterministic. AI only drafts the specification." (10.53 s)

**6 MCP components 48.5–57.0 s.** The window sits on the right. "06", "/ MCP COMPONENTS", headline "Official standards, / any language." Why: "Eleven languages, ten official SDKs, with provenance pinned to exact revisions." Poses: 0 ×1.1, 1500 provenance ×1.9, 4000 language ×1.7, 7000 ×1.15. Rings: 2100 "Protocol revision and spec provenance"; 4500 "Language + target: Python → OpenShell"; 6200 "Official SDK repo, exact revision".
VO: "Servers are grounded in the official MCP specification and SDKs, across eleven languages, with provenance attached." (7.18 s)

**7 Agents 57.0–66.5 s.** The window sits on the left. "07", "/ AGENTS", headline "Agents as / portable / definitions." Why: "Instructions, input schema and model, saved once. A draft, ready for review, not a running agent." Poses: 0 ×1.1, 1500 card ×1.75, 4300 schema ×2.2, 7400 ×1.2. Rings: 2000 "Workspace Researcher: saved definition"; 4800 "Explicit input contract"; 6800 "Status: Draft".
VO: "Agents become saved, portable definitions. Instructions, input schema and model, written once, for any runtime." (8.12 s)

**8 Outro 66.5–77.0 s.** The builder screenshot sits dimmed behind, slowly pushing in. Stamps spring in: "Saved is not approved." (amber) 0.3 s, "People review." 1.5 s, "Verification stays separate." 2.8 s. At 4.3 s the stamps lift away, the background turns paper and "Control Plane" (19vmin) unmasks. "Build from shared context." 5.2 s; "KNOWLEDGE · CATALOGUE · BUILDER · MCP · AGENTS" 6.0 s. From 6.8 s the frame fades to ink over 3.2 s, handing off to the dark intro on loop.
VO: "And saving is not approval. People review, and verification stays separate. Control Plane. Build from shared context." (8.72 s)

## Audio spec
- Runtime: 77.0 s (SCENE_DURATIONS total 77,000 ms).
- Music: public/audio/bg_music.mp3, an ambient atmospheric instrumental (soft pads, pulsing plucks, light percussion, 90 BPM, no vocals), generated at 77 s. Cuts are set by the voiceover line lengths, not aligned to beats in the music (alignment not measured).
- Voiceover (requested): public/audio/vo_intro, vo_overview, vo_knowledge, vo_catalogue, vo_builder, vo_mcp, vo_agents, vo_outro (.mp3). Voice: "Frederick Surrey" (voice ID j9jfwdrw7BRfcR43Qohk), eleven_multilingual_v2. Each line is delayed to its scene start + 0.45 s.
- SFX: none.
- Mix: ffmpeg amix (normalize=0) with music at 0.22 and voiceover at 1.0, clamped to 77 s, giving public/audio/composite_audio.mp3.
- Playback file: composite_audio.mp3 (element volume 0.9). Playback seeks to each scene's start time when the scene changes.
