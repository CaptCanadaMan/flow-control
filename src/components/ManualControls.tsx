import { useState } from "react";

import type { TowerSnapshot } from "../application";
import "./ManualControls.css";

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

type RunwayChoice = {
  value: `${ManualRunwayClearance["runwayId"]}:${ManualRunwayClearance["runwayEnd"]}`;
  label: string;
};

const RUNWAY_CHOICES: readonly RunwayChoice[] = [
  { value: "09-27:09", label: "Runway 09" },
  { value: "09-27:27", label: "Runway 27" },
  { value: "04-22:04", label: "Runway 04" },
  { value: "04-22:22", label: "Runway 22" },
];

const RUNWAY_CLEARANCE_OPTIONS: readonly {
  value: ManualRunwayClearance["kind"];
  label: string;
}[] = [
  { value: "hold-short", label: "Hold short" },
  { value: "line-up-and-wait", label: "Line up and wait" },
  { value: "cancel-runway-clearance", label: "Cancel runway clearance" },
  { value: "clear-for-takeoff", label: "Clear for takeoff" },
  { value: "clear-to-land", label: "Clear to land" },
  { value: "clear-touch-and-go", label: "Clear touch-and-go" },
  { value: "go-around", label: "Go around" },
];

function parseOptionalNumber(value: string) {
  return value === "" ? undefined : Number(value);
}

export function ManualControls({
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
  const [runwayClearanceKind, setRunwayClearanceKind] =
    useState<ManualRunwayClearance["kind"]>("hold-short");
  const [runwayResource, setRunwayResource] = useState<RunwayChoice["value"]>("09-27:09");
  const [headingDegrees, setHeadingDegrees] = useState("");
  const [altitudeFeet, setAltitudeFeet] = useState("");
  const [speedKnots, setSpeedKnots] = useState("");
  const [circuitAction, setCircuitAction] = useState<"" | "enter" | "adjust">("");
  const [sequenceBehindAircraftId, setSequenceBehindAircraftId] = useState("");
  const [extendCircuitLeg, setExtendCircuitLeg] = useState<
    "" | "upwind" | "crosswind" | "downwind" | "base"
  >("");
  const [localHoldId, setLocalHoldId] = useState<
    "" | "northwest-hold" | "southeast-hold"
  >("");
  const [orbitDirection, setOrbitDirection] = useState<"" | "left" | "right">("");

  const runwayDispatchAvailable = Boolean(selectedAircraft && onIssueRunwayClearance);
  const tacticalDispatchAvailable = Boolean(selectedAircraft && onIssueTacticalInstruction);
  const hasTacticalDirection = [
    headingDegrees,
    altitudeFeet,
    speedKnots,
    circuitAction,
    sequenceBehindAircraftId,
    extendCircuitLeg,
    localHoldId,
    orbitDirection,
  ].some(Boolean);
  const disabledReason = selectedAircraft
    ? "Manual dispatch is unavailable while the workspace reconnects."
    : "Select an aircraft to issue a structured manual instruction.";

  return (
    <section className="manual-controls" aria-labelledby="manual-controls-heading">
      <p>Manual Controls</p>
      <h2 id="manual-controls-heading">
        {selectedAircraft ? `Manual instruction · ${selectedAircraft.callsign}` : "No aircraft selected"}
      </h2>
      <p>
        {selectedAircraft
          ? `Issue a structured instruction to ${selectedAircraft.callsign}.`
          : disabledReason}
      </p>
      {selectedAircraft && (!onIssueRunwayClearance || !onIssueTacticalInstruction) ? (
        <p className="manual-controls-unavailable">{disabledReason}</p>
      ) : null}
      <div className="manual-control-forms">
        <form
          aria-label="Runway Clearance"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedAircraft || !onIssueRunwayClearance) {
              return;
            }
            const [runwayId, runwayEnd] = runwayResource.split(":") as [
              ManualRunwayClearance["runwayId"],
              ManualRunwayClearance["runwayEnd"],
            ];
            onIssueRunwayClearance({
              aircraftId: selectedAircraft.id,
              clearance: { kind: runwayClearanceKind, runwayId, runwayEnd },
            });
          }}
        >
          <h3>Runway Clearance</h3>
          <label>
            Clearance
            <select
              name="runway-clearance-kind"
              value={runwayClearanceKind}
              onChange={(event) => setRunwayClearanceKind(event.target.value as ManualRunwayClearance["kind"])}
            >
              {RUNWAY_CLEARANCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Runway
            <select
              name="runway-resource"
              value={runwayResource}
              onChange={(event) => setRunwayResource(event.target.value as RunwayChoice["value"])}
            >
              {RUNWAY_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>{choice.label}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={!runwayDispatchAvailable}>Issue Runway Clearance</button>
        </form>

        <form
          aria-label="Tactical Instruction"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedAircraft || !onIssueTacticalInstruction || !hasTacticalDirection) {
              return;
            }
            onIssueTacticalInstruction({
              aircraftId: selectedAircraft.id,
              instruction: {
                headingDegrees: parseOptionalNumber(headingDegrees),
                altitudeFeet: parseOptionalNumber(altitudeFeet),
                speedKnots: parseOptionalNumber(speedKnots),
                circuit: circuitAction ? { action: circuitAction, circuitId: "runway-09-left" } : undefined,
                sequenceBehindAircraftId: sequenceBehindAircraftId || undefined,
                extendCircuitLeg: extendCircuitLeg || undefined,
                localHoldId: localHoldId || undefined,
                orbitDirection: orbitDirection || undefined,
              },
            });
          }}
        >
          <h3>Tactical Instruction</h3>
          <div className="manual-control-grid">
            <label>Heading (°)<input name="heading-degrees" type="number" min="1" max="360" step="1" value={headingDegrees} onChange={(event) => setHeadingDegrees(event.target.value)} /></label>
            <label>Altitude (ft)<input name="altitude-feet" type="number" min="1" step="100" value={altitudeFeet} onChange={(event) => setAltitudeFeet(event.target.value)} /></label>
            <label>Speed (kt)<input name="speed-knots" type="number" min="1" step="1" value={speedKnots} onChange={(event) => setSpeedKnots(event.target.value)} /></label>
            <label>Circuit<select name="circuit-action" value={circuitAction} onChange={(event) => setCircuitAction(event.target.value as "" | "enter" | "adjust")}><option value="">None</option><option value="enter">Enter runway 09 left circuit</option><option value="adjust">Adjust runway 09 left circuit</option></select></label>
            <label>Sequence behind<select name="sequence-behind-aircraft" value={sequenceBehindAircraftId} onChange={(event) => setSequenceBehindAircraftId(event.target.value)}><option value="">None</option>{aircraft.filter((candidate) => candidate.id !== selectedAircraft?.id && candidate.flightPhase !== "out-of-play").map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.callsign}</option>)}</select></label>
            <label>Extend circuit leg<select name="extend-circuit-leg" value={extendCircuitLeg} onChange={(event) => setExtendCircuitLeg(event.target.value as typeof extendCircuitLeg)}><option value="">None</option><option value="upwind">Upwind</option><option value="crosswind">Crosswind</option><option value="downwind">Downwind</option><option value="base">Base</option></select></label>
            <label>Local hold<select name="local-hold" value={localHoldId} onChange={(event) => setLocalHoldId(event.target.value as typeof localHoldId)}><option value="">None</option><option value="northwest-hold">Northwest Hold</option><option value="southeast-hold">Southeast Hold</option></select></label>
            <label>Orbit<select name="orbit-direction" value={orbitDirection} onChange={(event) => setOrbitDirection(event.target.value as typeof orbitDirection)}><option value="">None</option><option value="left">Left 360</option><option value="right">Right 360</option></select></label>
          </div>
          <button type="submit" disabled={!tacticalDispatchAvailable || !hasTacticalDirection}>Issue Tactical Instruction</button>
        </form>
      </div>
    </section>
  );
}
