# Flow Control

Flow Control is a WebMCP-powered control layer for human-supervised autonomy. Its hackathon demonstration places a Tower Agent and an accountable Supervising Controller in the same live fictional airport workspace.

The Tower Agent handles routine traffic within delegated authority. It can inspect the exact state shown in the browser, issue validated runway clearances and tactical instructions, and stage multi-aircraft plans. Immediate protective actions do not wait for approval; consequential recovery decisions return to the human for approval, modification, partial dispatch, rejection, or takeover.

## What the demonstration proves

- One human kickoff starts a continuous observe-reason-act-monitor loop.
- WebMCP exposes live browser-local traffic, selection, plans, authority, and actions.
- Observe, Assist, and Take the Sector postures progressively change agent capability.
- An independent policy layer revalidates every mutation against current state and hard constraints.
- Emergency arrival, rejected takeoff, and go-around events produce causal traffic outcomes.
- The webpage records an inspectable operational audit and exports it as JSON.

Flow Control is an illustrative simulation, not an operational air traffic control system or a claim of regulatory or safety-critical readiness.

## Technical direction

The application is a static React and TypeScript site. A deterministic browser-local engine owns simulation, policy, evaluation, plans, and audit. A responsive SVG radar consumes display snapshots at approximately 20 frames per second. ChatGPT supplies the Tower Agent through WebMCP; the project does not require an application backend or an OpenAI API key.

Implementation, setup, compatibility, and deployment instructions will be added as the application is built.
