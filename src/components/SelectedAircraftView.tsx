import type { TowerSnapshot } from "../application";
import "./SelectedAircraftView.css";

type SelectedAircraftSnapshot = Pick<
  TowerSnapshot,
  "aircraft" | "aircraftCapabilityProfiles"
>;

const CLEARANCE_LABELS = {
  "hold-short": "Hold short",
  "line-up-and-wait": "Line up and wait",
  "cancel-runway-clearance": "Cancel runway clearance",
  "clear-for-takeoff": "Cleared for takeoff",
  "clear-to-land": "Cleared to land",
  "clear-touch-and-go": "Cleared touch-and-go",
  "go-around": "Go around",
} as const;

function titleCase(value: string) {
  return value.replace(/(^|-)([a-z])/g, (_, prefix: string, letter: string) =>
    `${prefix === "-" ? " " : ""}${letter.toUpperCase()}`,
  );
}

function formatPosition(position: {
  eastNauticalMiles: number;
  northNauticalMiles: number;
}) {
  const eastWest = position.eastNauticalMiles >= 0 ? "east" : "west";
  const northSouth = position.northNauticalMiles >= 0 ? "north" : "south";
  return `${Math.abs(position.eastNauticalMiles).toFixed(1)} NM ${eastWest} · ${Math.abs(position.northNauticalMiles).toFixed(1)} NM ${northSouth}`;
}

function tacticalInstructionSummary(instruction: {
  headingDegrees?: number;
  altitudeFeet?: number;
  speedKnots?: number;
  circuit?: { action: "enter" | "adjust"; circuitId: string };
  sequenceBehindAircraftId?: string;
  extendCircuitLeg?: string;
  localHoldId?: "northwest-hold" | "southeast-hold";
  orbitDirection?: "left" | "right";
}) {
  const localHoldNames = {
    "northwest-hold": "Northwest Hold",
    "southeast-hold": "Southeast Hold",
  } as const;
  const parts = [
    instruction.headingDegrees === undefined
      ? undefined
      : `Heading ${instruction.headingDegrees.toString().padStart(3, "0")}°`,
    instruction.altitudeFeet === undefined
      ? undefined
      : `Altitude ${instruction.altitudeFeet.toLocaleString()} ft`,
    instruction.speedKnots === undefined ? undefined : `Speed ${instruction.speedKnots} kt`,
    instruction.circuit === undefined
      ? undefined
      : `${titleCase(instruction.circuit.action)} circuit ${instruction.circuit.circuitId}`,
    instruction.sequenceBehindAircraftId === undefined
      ? undefined
      : `Sequence behind ${instruction.sequenceBehindAircraftId}`,
    instruction.extendCircuitLeg === undefined
      ? undefined
      : `Extend ${instruction.extendCircuitLeg}`,
    instruction.localHoldId === undefined
      ? undefined
      : `Hold at ${localHoldNames[instruction.localHoldId]}`,
    instruction.orbitDirection === undefined
      ? undefined
      : `${titleCase(instruction.orbitDirection)} 360`,
  ].filter((part): part is string => part !== undefined);

  return parts.join(" · ");
}

export function SelectedAircraftView({
  snapshot,
  selectedAircraftId,
}: {
  snapshot: SelectedAircraftSnapshot;
  selectedAircraftId?: string;
}) {
  const aircraft = snapshot.aircraft.find(
    (candidate) => candidate.id === selectedAircraftId,
  );

  if (!aircraft) {
    return (
      <section className="selected-aircraft-view" aria-labelledby="selected-aircraft-heading">
        <p>Selected Aircraft</p>
        <h2 id="selected-aircraft-heading">No aircraft selected</h2>
        <p>Select an aircraft on the radar to inspect its operational context.</p>
      </section>
    );
  }

  const profile = snapshot.aircraftCapabilityProfiles.find(
    (candidate) => candidate.id === aircraft.capabilityProfileId,
  );
  const runwayClearance = aircraft.activeRunwayClearance;
  const tacticalInstruction = aircraft.activeTacticalInstruction;

  return (
    <section className="selected-aircraft-view" aria-labelledby="selected-aircraft-heading">
      <p>Selected Aircraft</p>
      <h2 id="selected-aircraft-heading">
        {aircraft.callsign} · {profile?.displayName ?? aircraft.capabilityProfileId}
      </h2>
      <p className="selected-aircraft-state">
        Phase {aircraft.flightPhase} · {titleCase(aircraft.intention)} · Pilot {titleCase(aircraft.pilotState)}
      </p>
      <dl className="selected-aircraft-details">
        <div>
          <dt>Position</dt>
          <dd>{formatPosition(aircraft.position)}</dd>
        </div>
        <div>
          <dt>Track / heading</dt>
          <dd>
            Track {aircraft.trackDegrees.toString().padStart(3, "0")}° · Heading {aircraft.headingDegrees.toString().padStart(3, "0")}°
          </dd>
        </div>
        <div>
          <dt>Altitude / speed</dt>
          <dd>{aircraft.altitudeFeet.toLocaleString()} ft · {aircraft.speedKnots} kt</dd>
        </div>
        {profile ? (
          <div>
            <dt>Type profile</dt>
            <dd>
              Wake {profile.wakeCategory} · Approach {profile.approachSpeedKnots} kt · Minimum runway {profile.minimumRunway.lengthFeet.toLocaleString()} × {profile.minimumRunway.widthFeet.toLocaleString()} ft
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="selected-aircraft-instructions">
        <h3>Current instructions</h3>
        {runwayClearance ? (
          <p>{CLEARANCE_LABELS[runwayClearance.kind]} runway {runwayClearance.runwayEnd}</p>
        ) : null}
        {tacticalInstruction ? <p>{tacticalInstructionSummary(tacticalInstruction)}</p> : null}
        {!runwayClearance && !tacticalInstruction ? (
          <p>No current clearance or tactical instruction.</p>
        ) : null}
      </div>
    </section>
  );
}
