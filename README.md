# Flow Control

Flow Control is a WebMCP-powered pattern for supervising operational agents in one shared live workspace, demonstrated with a fictional air traffic control simulation.

The human works in the live interface while WebMCP gives the agent structured access to the same authoritative state. The Tower Agent handles routine traffic within delegated authority: it can inspect the exact state shown in the browser, issue validated runway clearances and tactical instructions, and stage multi-aircraft plans. Immediate protective actions do not wait for approval; consequential recovery decisions return to the human for approval, modification, partial dispatch, rejection, or takeover.

**Live demo:** https://flow.ahorsburgh.com

Flow Control is an illustrative simulation, not an operational air traffic control system, and makes no claim of regulatory or safety-critical readiness.

## How WebMCP is used

WebMCP is the core product surface, not a decorative integration. The page registers typed, authority-aware tools directly and refreshes them as authority changes:

- The Supervising Controller chooses an Operating Posture - Observe, Assist Me, or Take the Sector - and the agent's discoverable tools change with that authority.
- The agent inspects live state, waits on bounded `wait_for_tower_event` calls for material events, evaluates options, issues policy-validated routine actions, and stages exceptional recovery plans for human approval.
- The application independently revalidates every mutating request against the current State Version, authority, shared-resource occupancy, conflicts, and hard safety invariants. Stale or invalid requests return structured refusals.
- Every result - human or agent - is recorded as an inspectable Operational Receipt in the same workspace, with a scorecard and JSON export at the end of the Shift.

Human interface actions and WebMCP tool calls enter through the same command/query boundary, differing by actor and authority rather than by implementation path.

## Running the demo

Requirements: a WebMCP-capable browser host. Tested with ChatGPT's in-app browser.

1. Open https://flow.ahorsburgh.com in the WebMCP-capable browser.
2. On preflight, choose **Take the Sector** and the recommended 1.5x Shift pace, then arm the workspace.
3. Ask the browser agent to call `begin_tower_shift` with the displayed State Version and to monitor with bounded `wait_for_tower_event` calls.
4. Watch the live radar, selected-aircraft panel, command bar, active-plan panel, live feed, and Operational Receipts.

The seeded Shift injects a MAYDAY inbound, a rejected takeoff with runway occupancy, an independent go-around, and an unable readback. Verify that the agent discovers only authority-appropriate tools, reacts to the MAYDAY, stages exceptional recovery for your approval, and keeps monitoring until Stable Flow / Shift completion.

## Running locally

The app is a static React + TypeScript site built with Vite. A deterministic browser-local engine owns simulation, authority, policy, planning, evaluation, and audit - no backend and no API key are needed for operational state; the agent connects through WebMCP from the browser host.

```sh
npm install
npm run dev
```

Then open the printed localhost URL in a WebMCP-capable browser. To verify the build and test suite:

```sh
npm test
npm run build
```

## Architecture

The reusable layers are the authority model, capability registry, versioned command/query boundary, policy enforcement, counterfactual evaluation, staged-plan workflow, bounded event monitoring, and Operational Receipts. The ATC domain supplies entities, shared resources, constraints, tool schemas, and the SVG radar visualization; a different operational domain (warehouse robots, fleet dispatch, drones) can replace those without moving agent authority or state ownership outside the application.

## License

MIT - see [LICENSE](LICENSE).
