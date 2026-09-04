import { useEffect, useState } from "react";

import type { TowerSnapshot } from "../application";
import "./CommandBar.css";

type Aircraft = TowerSnapshot["aircraft"][number];

export type ManualRunwayClearance = {
  kind:
    | "hold-short"
    | "line-up-and-wait"
    | "cancel-runway-clearance"
    | "clear-for-takeoff"
    | "clear-to-land"
    | "clear-touch-and-go"
    | "go-around";
  runwayId: "09-27" | "04-22";
  runwayEnd: "09" | "27" | "04" | "22";
};

export type ManualTacticalInstruction = {
  headingDegrees?: number;
  altitudeFeet?: number;
  speedKnots?: number;
  circuit?: { action: "enter" | "adjust"; circuitId: "runway-09-left" };
  sequenceBehindAircraftId?: string;
  extendCircuitLeg?: "upwind" | "crosswind" | "downwind" | "base";
  localHoldId?: "northwest-hold" | "southeast-hold";
  orbitDirection?: "left" | "right";
};

type RunwayVerb = ManualRunwayClearance["kind"];
type TacticalVerb =
  | "climb"
  | "descend"
  | "turn-left"
  | "turn-right"
  | "speed"
  | "extend-leg"
  | "sequence-behind";
type Verb = RunwayVerb | TacticalVerb;

const RUNWAY_VERBS: ReadonlyArray<{ id: RunwayVerb; label: string; phrase: string }> = [
  { id: "clear-to-land", label: "Land", phrase: "cleared to land" },
  { id: "clear-for-takeoff", label: "Takeoff", phrase: "cleared for takeoff" },
  { id: "clear-touch-and-go", label: "Touch-and-go", phrase: "cleared touch-and-go" },
  { id: "line-up-and-wait", label: "Line up", phrase: "line up and wait" },
  { id: "hold-short", label: "Hold short", phrase: "hold short" },
  { id: "cancel-runway-clearance", label: "Cancel", phrase: "cancel runway clearance" },
  { id: "go-around", label: "Go around", phrase: "go around" },
];

const TACTICAL_VERBS: ReadonlyArray<{ id: TacticalVerb; label: string }> = [
  { id: "climb", label: "Climb" },
  { id: "descend", label: "Descend" },
  { id: "turn-left", label: "Turn L" },
  { id: "turn-right", label: "Turn R" },
  { id: "speed", label: "Speed" },
  { id: "extend-leg", label: "Extend leg" },
  { id: "sequence-behind", label: "Sequence behind" },
];

const RUNWAY_ENDS: ReadonlyArray<{
  runwayId: ManualRunwayClearance["runwayId"];
  runwayEnd: ManualRunwayClearance["runwayEnd"];
}> = [
  { runwayId: "09-27", runwayEnd: "09" },
  { runwayId: "09-27", runwayEnd: "27" },
  { runwayId: "04-22", runwayEnd: "04" },
  { runwayId: "04-22", runwayEnd: "22" },
];

const ALTITUDES = [1_000, 1_500, 2_000, 2_500, 3_000, 3_500, 4_000, 5_000, 6_000];
const SPEEDS = [80, 90, 100, 110, 120, 140, 160, 180, 200, 220, 250];
const RELATIVE_TURNS = [10, 20, 30, 45, 90];
const ABSOLUTE_HEADINGS = [360, 45, 90, 135, 180, 225, 270, 315];
const CIRCUIT_LEGS: ManualTacticalInstruction["extendCircuitLeg"][] = [
  "upwind",
  "crosswind",
  "downwind",
  "base",
];

function normalizeHeading(headingDegrees: number) {
  const normalized = ((Math.round(headingDegrees) % 360) + 360) % 360;
  return normalized === 0 ? 360 : normalized;
}

function describeInstruction(
  instruction: ManualTacticalInstruction,
  callsigns: Map<string, string>,
): Array<{ part: keyof ManualTacticalInstruction; text: string }> {
  const parts: Array<{ part: keyof ManualTacticalInstruction; text: string }> = [];
  if (instruction.altitudeFeet !== undefined) {
    parts.push({ part: "altitudeFeet", text: `${instruction.altitudeFeet.toLocaleString()} ft` });
  }
  if (instruction.headingDegrees !== undefined) {
    parts.push({
      part: "headingDegrees",
      text: `heading ${String(instruction.headingDegrees).padStart(3, "0")}`,
    });
  }
  if (instruction.speedKnots !== undefined) {
    parts.push({ part: "speedKnots", text: `${instruction.speedKnots} kt` });
  }
  if (instruction.localHoldId) {
    parts.push({
      part: "localHoldId",
      text: instruction.localHoldId === "northwest-hold" ? "hold NW" : "hold SE",
    });
  }
  if (instruction.orbitDirection) {
    parts.push({ part: "orbitDirection", text: `orbit ${instruction.orbitDirection}` });
  }
  if (instruction.circuit) {
    parts.push({ part: "circuit", text: `${instruction.circuit.action} circuit` });
  }
  if (instruction.extendCircuitLeg) {
    parts.push({ part: "extendCircuitLeg", text: `extend ${instruction.extendCircuitLeg}` });
  }
  if (instruction.sequenceBehindAircraftId) {
    parts.push({
      part: "sequenceBehindAircraftId",
      text: `sequence behind ${callsigns.get(instruction.sequenceBehindAircraftId) ?? instruction.sequenceBehindAircraftId}`,
    });
  }
  return parts;
}

export function CommandBar({
  selectedAircraft,
  aircraft,
  onIssueRunwayClearance,
  onIssueTacticalInstruction,
}: {
  selectedAircraft?: Aircraft;
  aircraft: readonly Aircraft[];
  onIssueRunwayClearance?: (request: {
    aircraftId: string;
    clearance: ManualRunwayClearance;
  }) => void;
  onIssueTacticalInstruction?: (request: {
    aircraftId: string;
    instruction: ManualTacticalInstruction;
  }) => void;
}) {
  const [verb, setVerb] = useState<Verb | undefined>();
  const [runwayEnd, setRunwayEnd] = useState<ManualRunwayClearance["runwayEnd"] | undefined>();
  const [instruction, setInstruction] = useState<ManualTacticalInstruction>({});
  const selectedId = selectedAircraft?.id;

  useEffect(() => {
    setVerb(undefined);
    setRunwayEnd(undefined);
    setInstruction({});
  }, [selectedId]);

  const callsigns = new Map(aircraft.map((candidate) => [candidate.id, candidate.callsign]));
  const isRunwayVerb = (candidate: Verb | undefined): candidate is RunwayVerb =>
    RUNWAY_VERBS.some(({ id }) => id === candidate);
  const runwayVerb = isRunwayVerb(verb) ? verb : undefined;
  const runwayPhrase = RUNWAY_VERBS.find(({ id }) => id === runwayVerb)?.phrase;
  const instructionParts = describeInstruction(instruction, callsigns);
  const enabled = Boolean(selectedAircraft);
  const canSend = enabled && (runwayVerb ? Boolean(runwayEnd) : instructionParts.length > 0);

  const chooseVerb = (next: Verb) => {
    if (isRunwayVerb(next)) {
      setInstruction({});
      setVerb(verb === next ? undefined : next);
      // Preselect the runway end the aircraft is actually set up for (or the
      // one it already holds a clearance on); the other ends stay one tap away.
      const presetEnd =
        selectedAircraft?.activeRunwayClearance?.runwayEnd ??
        selectedAircraft?.assignedRunway?.runwayEnd;
      if (verb !== next && !runwayEnd && presetEnd) {
        setRunwayEnd(presetEnd);
      }
      return;
    }
    setRunwayEnd(undefined);
    if (runwayVerb) {
      setInstruction({});
    }
    setVerb(verb === next ? undefined : next);
  };

  const addPart = (changes: ManualTacticalInstruction) => {
    setInstruction((current) => ({ ...current, ...changes }));
    setVerb(undefined);
  };

  const removePart = (part: keyof ManualTacticalInstruction) => {
    setInstruction((current) => {
      const next = { ...current };
      delete next[part];
      return next;
    });
  };

  const clear = () => {
    setVerb(undefined);
    setRunwayEnd(undefined);
    setInstruction({});
  };

  const send = () => {
    if (!selectedAircraft || !canSend) {
      return;
    }
    if (runwayVerb && runwayEnd) {
      const end = RUNWAY_ENDS.find((candidate) => candidate.runwayEnd === runwayEnd);
      if (end) {
        onIssueRunwayClearance?.({
          aircraftId: selectedAircraft.id,
          clearance: { kind: runwayVerb, runwayId: end.runwayId, runwayEnd: end.runwayEnd },
        });
      }
    } else {
      onIssueTacticalInstruction?.({ aircraftId: selectedAircraft.id, instruction });
    }
    clear();
  };

  const currentHeading = selectedAircraft ? normalizeHeading(selectedAircraft.headingDegrees) : 360;
  const currentAltitude = selectedAircraft?.altitudeFeet ?? 0;

  const renderQuantities = () => {
    if (!enabled || !verb) {
      return null;
    }
    if (runwayVerb) {
      return RUNWAY_ENDS.map((end) => (
        <button
          type="button"
          key={end.runwayEnd}
          className={`command-chip command-chip-mono${runwayEnd === end.runwayEnd ? " command-chip-on" : ""}`}
          aria-pressed={runwayEnd === end.runwayEnd}
          onClick={() => setRunwayEnd(end.runwayEnd)}
        >
          {end.runwayEnd}
        </button>
      ));
    }
    if (verb === "climb" || verb === "descend") {
      const reachable = ALTITUDES.filter((altitude) =>
        verb === "climb" ? altitude > currentAltitude : altitude < currentAltitude,
      );
      return (reachable.length > 0 ? reachable : ALTITUDES).map((altitude) => (
        <button
          type="button"
          key={altitude}
          className="command-chip command-chip-mono"
          onClick={() => addPart({ altitudeFeet: altitude })}
        >
          {altitude.toLocaleString()}
        </button>
      ));
    }
    if (verb === "turn-left" || verb === "turn-right") {
      const sign = verb === "turn-left" ? -1 : 1;
      return [
        ...RELATIVE_TURNS.map((degrees) => (
          <button
            type="button"
            key={`relative-${degrees}`}
            className="command-chip command-chip-mono"
            onClick={() =>
              addPart({ headingDegrees: normalizeHeading(currentHeading + sign * degrees) })
            }
          >
            {verb === "turn-left" ? "−" : "+"}
            {degrees}°
          </button>
        )),
        <span key="divider" className="command-divider" aria-hidden="true" />,
        ...ABSOLUTE_HEADINGS.map((heading) => (
          <button
            type="button"
            key={`absolute-${heading}`}
            className="command-chip command-chip-mono"
            onClick={() => addPart({ headingDegrees: heading })}
          >
            {String(heading).padStart(3, "0")}
          </button>
        )),
      ];
    }
    if (verb === "speed") {
      return SPEEDS.map((speed) => (
        <button
          type="button"
          key={speed}
          className="command-chip command-chip-mono"
          onClick={() => addPart({ speedKnots: speed })}
        >
          {speed}
        </button>
      ));
    }
    if (verb === "extend-leg") {
      return CIRCUIT_LEGS.map((leg) => (
        <button
          type="button"
          key={leg}
          className="command-chip"
          onClick={() => addPart({ extendCircuitLeg: leg })}
        >
          {leg}
        </button>
      ));
    }
    if (verb === "sequence-behind") {
      return aircraft
        .filter(
          (candidate) =>
            candidate.id !== selectedAircraft?.id && candidate.flightPhase !== "out-of-play",
        )
        .map((candidate) => (
          <button
            type="button"
            key={candidate.id}
            className="command-chip command-chip-mono"
            onClick={() => addPart({ sequenceBehindAircraftId: candidate.id })}
          >
            {candidate.callsign}
          </button>
        ));
    }
    return null;
  };

  const quantities = renderQuantities();
  const verbLabel =
    RUNWAY_VERBS.find(({ id }) => id === verb)?.label ??
    TACTICAL_VERBS.find(({ id }) => id === verb)?.label ??
    "";

  return (
    <section className="command-bar" aria-label="Command bar">
      <div className="command-bar-line">
        {selectedAircraft ? (
          <>
            <span className="command-bar-callsign">{selectedAircraft.callsign}</span>
            {runwayVerb ? (
              <span className="command-chip command-chip-on command-chip-part">
                {runwayPhrase}
                {runwayEnd ? ` ${runwayEnd}` : " …"}
              </span>
            ) : instructionParts.length > 0 ? (
              instructionParts.map(({ part, text }) => (
                <button
                  type="button"
                  key={part}
                  className="command-chip command-chip-on command-chip-part"
                  aria-label={`Remove ${text}`}
                  onClick={() => removePart(part)}
                >
                  {text} ×
                </button>
              ))
            ) : verb ? (
              <span className="command-bar-hint">{TACTICAL_VERBS.find(({ id }) => id === verb)?.label.toLowerCase()} …</span>
            ) : (
              <span className="command-bar-hint">Tap an action, then a value. Tactical parts combine before Send.</span>
            )}
          </>
        ) : (
          <span className="command-bar-hint">Tap an aircraft on the radar to command it.</span>
        )}
        <span className="command-bar-spacer" />
        <button type="button" className="command-chip command-chip-quiet" onClick={clear} disabled={!enabled}>
          Clear
        </button>
        <button type="button" className="command-chip command-chip-send" onClick={send} disabled={!canSend}>
          Send
        </button>
      </div>

      {quantities ? (
        <div
          className="command-bar-row command-bar-quantities"
          role="group"
          aria-label={`Values for ${verbLabel}`}
        >
          <button
            type="button"
            className="command-chip command-chip-quiet"
            onClick={() => setVerb(undefined)}
          >
            ← Back
          </button>
          <span className="command-bar-step">{verbLabel}</span>
          {quantities}
        </div>
      ) : (
        <div className="command-bar-row" role="group" aria-label="Runway Clearances and Tactical Instructions">
          {RUNWAY_VERBS.map(({ id, label }) => (
            <button
              type="button"
              key={id}
              className={`command-chip${verb === id ? " command-chip-on" : ""}`}
              aria-pressed={verb === id}
              disabled={!enabled}
              onClick={() => chooseVerb(id)}
            >
              {label}
            </button>
          ))}
          <span className="command-divider" aria-hidden="true" />
          {TACTICAL_VERBS.map(({ id, label }) => (
            <button
              type="button"
              key={id}
              className={`command-chip${verb === id ? " command-chip-on" : ""}`}
              aria-pressed={verb === id}
              disabled={!enabled}
              onClick={() => chooseVerb(id)}
            >
              {label}
            </button>
          ))}
          <span className="command-divider" aria-hidden="true" />
          <button
            type="button"
            className={`command-chip${instruction.localHoldId === "northwest-hold" ? " command-chip-on" : ""}`}
            disabled={!enabled}
            onClick={() => addPart({ localHoldId: "northwest-hold" })}
          >
            Hold NW
          </button>
          <button
            type="button"
            className={`command-chip${instruction.localHoldId === "southeast-hold" ? " command-chip-on" : ""}`}
            disabled={!enabled}
            onClick={() => addPart({ localHoldId: "southeast-hold" })}
          >
            Hold SE
          </button>
          <button
            type="button"
            className={`command-chip${instruction.orbitDirection === "left" ? " command-chip-on" : ""}`}
            disabled={!enabled}
            onClick={() => addPart({ orbitDirection: "left" })}
          >
            Orbit L
          </button>
          <button
            type="button"
            className={`command-chip${instruction.orbitDirection === "right" ? " command-chip-on" : ""}`}
            disabled={!enabled}
            onClick={() => addPart({ orbitDirection: "right" })}
          >
            Orbit R
          </button>
          <button
            type="button"
            className={`command-chip${instruction.circuit ? " command-chip-on" : ""}`}
            disabled={!enabled}
            onClick={() => addPart({ circuit: { action: "enter", circuitId: "runway-09-left" } })}
          >
            Enter circuit
          </button>
        </div>
      )}
    </section>
  );
}
