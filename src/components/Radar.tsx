import { useEffect, useMemo, useRef, useState } from "react";

import type { TowerSnapshot } from "../application";
import "./radar.css";

type RadarProps = {
  snapshot: Pick<
    TowerSnapshot,
    | "airport"
    | "aircraft"
    | "aircraftCapabilityProfiles"
    | "runwayResources"
    | "stagedClearancePlan"
    | "stagedRecoveryPlan"
    | "transmissions"
  >;
  selectedAircraftId?: string;
  onSelectAircraft?: (aircraftId: string) => void;
};

type RadarAircraft = RadarProps["snapshot"]["aircraft"][number];
type RadarPoint = { x: number; y: number };

const SCOPE_CENTER = 50;
const NAUTICAL_MILES_TO_VIEWBOX_UNITS = 5;
const FEET_PER_NAUTICAL_MILE = 6_076.12;
const VISUAL_INTERPOLATION_MS = 50;
const PIP_RADIUS = 1.65;
const HIT_RADIUS = 3.6;

const INTENTION_CODES = {
  departure: "DEP",
  arrival: "ARR",
  circuit: "CCT",
} as const;

const CLEARANCE_CODES = {
  "hold-short": "HS",
  "line-up-and-wait": "LUAW",
  "cancel-runway-clearance": "CXL",
  "clear-for-takeoff": "CFT",
  "clear-to-land": "CTL",
  "clear-touch-and-go": "T&G",
  "go-around": "GA",
} as const;

const CLEARANCE_LABELS = {
  "hold-short": "Hold short",
  "line-up-and-wait": "Line up and wait",
  "cancel-runway-clearance": "Runway clearance cancelled",
  "clear-for-takeoff": "Cleared for takeoff",
  "clear-to-land": "Cleared to land",
  "clear-touch-and-go": "Cleared touch-and-go",
  "go-around": "Go around",
} as const;

function projectPosition(position: {
  eastNauticalMiles: number;
  northNauticalMiles: number;
}): RadarPoint {
  return {
    x: SCOPE_CENTER + position.eastNauticalMiles * NAUTICAL_MILES_TO_VIEWBOX_UNITS,
    y: SCOPE_CENTER - position.northNauticalMiles * NAUTICAL_MILES_TO_VIEWBOX_UNITS,
  };
}

function pointsForAircraft(aircraft: readonly RadarAircraft[]) {
  return Object.fromEntries(
    aircraft.map((candidate) => [candidate.id, projectPosition(candidate.position)]),
  ) as Record<string, RadarPoint>;
}

function interpolate(from: RadarPoint, to: RadarPoint, progress: number): RadarPoint {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

/**
 * Retains only visual coordinates between immutable domain snapshots. The
 * deterministic engine remains the owner of aircraft positions and time.
 */
function useInterpolatedAircraftPoints(aircraft: readonly RadarAircraft[]) {
  const targets = useMemo(() => pointsForAircraft(aircraft), [aircraft]);
  const targetKey = aircraft
    .map(
      (candidate) =>
        `${candidate.id}:${candidate.position.eastNauticalMiles}:${candidate.position.northNauticalMiles}`,
    )
    .join("|");
  const [visualPoints, setVisualPoints] = useState<Record<string, RadarPoint>>(
    () => targets,
  );
  const visualPointsRef = useRef(visualPoints);

  useEffect(() => {
    visualPointsRef.current = visualPoints;
  }, [visualPoints]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const from = visualPointsRef.current;
    const startedAt = performance.now();
    let frameId = 0;

    const renderFrame = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / VISUAL_INTERPOLATION_MS);
      const nextPoints = Object.fromEntries(
        Object.entries(targets).map(([aircraftId, target]) => [
          aircraftId,
          interpolate(from[aircraftId] ?? target, target, progress),
        ]),
      ) as Record<string, RadarPoint>;
      visualPointsRef.current = nextPoints;
      setVisualPoints(nextPoints);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(renderFrame);
      }
    };

    frameId = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(frameId);
  }, [targetKey, targets]);

  return visualPoints;
}

function endpoint(point: RadarPoint, headingDegrees: number, distance: number): RadarPoint {
  const radians = (headingDegrees * Math.PI) / 180;
  return {
    x: point.x + Math.sin(radians) * distance,
    y: point.y - Math.cos(radians) * distance,
  };
}

function runwayEndpoints(runway: RadarProps["snapshot"]["airport"]["runways"][number]) {
  const center = projectPosition(runway.center);
  const halfLength =
    (runway.lengthFeet / FEET_PER_NAUTICAL_MILE / 2) *
    NAUTICAL_MILES_TO_VIEWBOX_UNITS;
  const end = endpoint(center, runway.headingDegrees, halfLength);
  return { x1: 2 * center.x - end.x, y1: 2 * center.y - end.y, x2: end.x, y2: end.y };
}

function clearanceCode(aircraft: RadarAircraft) {
  const clearance = aircraft.activeRunwayClearance;
  if (!clearance) {
    return undefined;
  }
  const code = CLEARANCE_CODES[clearance.kind];
  return clearance.kind === "go-around" ||
    clearance.kind === "cancel-runway-clearance"
    ? code
    : `${code} ${clearance.runwayEnd}`;
}

function statusLine(aircraft: RadarAircraft) {
  const parts = [
    INTENTION_CODES[aircraft.intention],
    `${aircraft.altitudeFeet.toLocaleString()} ft`,
  ];
  const code = clearanceCode(aircraft);
  if (code) {
    parts.push(code);
  }
  return parts.join(" · ");
}

function titleCase(value: string) {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function instructionSummary(aircraft: RadarAircraft) {
  const instruction = aircraft.activeTacticalInstruction;
  if (!instruction) {
    return undefined;
  }
  const parts: string[] = [];
  if (instruction.headingDegrees !== undefined) {
    parts.push(`heading ${String(instruction.headingDegrees).padStart(3, "0")}°`);
  }
  if (instruction.altitudeFeet !== undefined) {
    parts.push(`${instruction.altitudeFeet.toLocaleString()} ft`);
  }
  if (instruction.speedKnots !== undefined) {
    parts.push(`${instruction.speedKnots} kt`);
  }
  if (instruction.circuit) {
    parts.push(`${instruction.circuit.action} circuit`);
  }
  if (instruction.sequenceBehindAircraftId) {
    parts.push(`sequence behind ${instruction.sequenceBehindAircraftId}`);
  }
  if (instruction.extendCircuitLeg) {
    parts.push(`extend ${instruction.extendCircuitLeg}`);
  }
  if (instruction.localHoldId) {
    parts.push(`hold ${instruction.localHoldId.replace("-hold", "")}`);
  }
  if (instruction.orbitDirection) {
    parts.push(`orbit ${instruction.orbitDirection}`);
  }
  return parts.join(" · ");
}

function Pip({
  aircraft,
  point,
}: {
  aircraft: RadarAircraft;
  point: RadarPoint;
}) {
  if (aircraft.intention === "departure") {
    return (
      <polygon
        className="radar-pip"
        points={`${point.x},${point.y - 2} ${point.x - 1.8},${point.y + 1.2} ${point.x + 1.8},${point.y + 1.2}`}
      />
    );
  }
  if (aircraft.intention === "arrival") {
    return (
      <polygon
        className="radar-pip"
        points={`${point.x},${point.y + 2} ${point.x - 1.8},${point.y - 1.2} ${point.x + 1.8},${point.y - 1.2}`}
      />
    );
  }
  return <circle className="radar-pip" cx={point.x} cy={point.y} r={PIP_RADIUS} />;
}

export function Radar({
  snapshot,
  selectedAircraftId,
  onSelectAircraft,
}: RadarProps) {
  const aircraftInPlay = useMemo(
    () => snapshot.aircraft.filter(({ flightPhase }) => flightPhase !== "out-of-play"),
    [snapshot.aircraft],
  );
  const aircraftPoints = useInterpolatedAircraftPoints(aircraftInPlay);
  const activePlan = snapshot.stagedRecoveryPlan ?? snapshot.stagedClearancePlan;
  const aircraftById = new Map(aircraftInPlay.map((aircraft) => [aircraft.id, aircraft]));
  const emergencyAircraftIds = new Set(
    snapshot.transmissions
      .filter(({ speaker, text }) => speaker === "pilot" && text.startsWith("MAYDAY"))
      .map(({ aircraftId }) => aircraftId),
  );
  const activeHolds = aircraftInPlay.flatMap((aircraft) => {
    const holdId = aircraft.activeTacticalInstruction?.localHoldId;
    const hold = snapshot.airport.holdingAreas.find(({ id }) => id === holdId);
    return hold ? [{ aircraft, hold }] : [];
  });
  const selectedAircraft = aircraftById.get(selectedAircraftId ?? "");
  const selectedProfile = snapshot.aircraftCapabilityProfiles.find(
    ({ id }) => id === selectedAircraft?.capabilityProfileId,
  );

  return (
    <svg
      className="radar-scope"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={`${snapshot.airport.name} radar scope`}
    >
      <circle className="radar-scope-boundary" cx="50" cy="50" r="40" />
      <circle className="radar-scope-ring" cx="50" cy="50" r="20" />

      {activeHolds.map(({ aircraft, hold }) => {
        const point = projectPosition(hold.center);
        return (
          <g
            className="radar-hold-overlay"
            key={`${aircraft.id}-${hold.id}`}
            aria-label={`${hold.name} active for ${aircraft.callsign}`}
          >
            <circle
              cx={point.x}
              cy={point.y}
              r={hold.radiusNauticalMiles * NAUTICAL_MILES_TO_VIEWBOX_UNITS}
            />
            <text x={point.x} y={point.y - 4.8}>{hold.name}</text>
          </g>
        );
      })}

      {snapshot.airport.runways.map((runway) => {
        const points = runwayEndpoints(runway);
        return (
          <line
            className="radar-runway"
            data-runway-id={runway.id}
            key={runway.id}
            {...points}
          />
        );
      })}

      {snapshot.runwayResources.runwayOccupancy.map((occupancy) => {
        const runway = snapshot.airport.runways.find(
          ({ id }) => id === occupancy.runwayId,
        );
        if (!runway) {
          return null;
        }
        return (
          <line
            className="radar-runway-occupancy"
            key={`${occupancy.runwayId}-${occupancy.aircraftId}`}
            aria-label={`Runway ${occupancy.runwayId} occupied by ${occupancy.callsign}`}
            {...runwayEndpoints(runway)}
          />
        );
      })}

      {activePlan?.tacticalMembers
        .filter(({ selected }) => selected)
        .flatMap((member) => {
          const aircraft = aircraftById.get(member.aircraftId);
          const point = aircraftPoints[member.aircraftId];
          if (!aircraft || !point) {
            return [];
          }
          const heading = member.instruction.headingDegrees;
          if (heading === undefined) {
            return [];
          }
          const destination = endpoint(point, heading, 12);
          return [
            <line
              className="radar-staged-path"
              key={member.id}
              x1={point.x}
              y1={point.y}
              x2={destination.x}
              y2={destination.y}
              aria-label={`Staged heading ${heading} for ${aircraft.callsign}`}
            />,
          ];
        })}

      {aircraftInPlay.map((aircraft) => {
        const point = aircraftPoints[aircraft.id] ?? projectPosition(aircraft.position);
        const tail = endpoint(point, (aircraft.trackDegrees + 180) % 360, 7);
        const isSelected = aircraft.id === selectedAircraftId;
        const isEmergency = emergencyAircraftIds.has(aircraft.id);
        const isPending = aircraft.pilotState === "awaiting-contact";
        const placeLabelLeft = point.x >= 40 && point.x < SCOPE_CENTER;
        const labelX = point.x + (placeLabelLeft ? -2.8 : 2.8);
        const labelY = point.y - (placeLabelLeft ? 3.4 : 0.6);
        const className = [
          "radar-aircraft",
          `radar-aircraft-${aircraft.intention}`,
          isSelected ? "radar-aircraft-selected" : "",
          isEmergency ? "radar-aircraft-emergency" : "",
          isPending ? "radar-aircraft-pending" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <g key={aircraft.id}>
            <line
              className="radar-track-tail"
              x1={point.x}
              y1={point.y}
              x2={tail.x}
              y2={tail.y}
            />
            {isEmergency ? (
              <circle
                className="radar-emergency-ring"
                cx={point.x}
                cy={point.y}
                r={HIT_RADIUS}
              />
            ) : null}
            <g
              className={className}
              data-aircraft-id={aircraft.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`Select ${aircraft.callsign}, ${aircraft.intention}, ${aircraft.flightPhase}${isEmergency ? ", emergency" : ""}`}
              onClick={() => onSelectAircraft?.(aircraft.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectAircraft?.(aircraft.id);
                }
              }}
            >
              <circle className="radar-hit" cx={point.x} cy={point.y} r={HIT_RADIUS} />
              <Pip aircraft={aircraft} point={point} />
              <text
                className="radar-callsign"
                x={labelX}
                y={labelY}
                textAnchor={placeLabelLeft ? "end" : "start"}
              >
                {aircraft.callsign}
              </text>
              <text
                className="radar-status"
                x={labelX}
                y={labelY + 2.6}
                textAnchor={placeLabelLeft ? "end" : "start"}
              >
                {isEmergency ? `EMG · ${statusLine(aircraft)}` : statusLine(aircraft)}
              </text>
            </g>
          </g>
        );
      })}

      {selectedAircraft ? (
        (() => {
          const point =
            aircraftPoints[selectedAircraft.id] ?? projectPosition(selectedAircraft.position);
          const cardWidth = 40;
          const cardHeight = 22;
          const placeLeft = point.x > SCOPE_CENTER;
          const cardX = placeLeft ? point.x - cardWidth - 4 : point.x + 4;
          const cardY = Math.min(100 - cardHeight - 2, Math.max(2, point.y + 3));
          const clearance = selectedAircraft.activeRunwayClearance;
          const instruction = instructionSummary(selectedAircraft);
          return (
            <foreignObject
              className="radar-card"
              x={cardX}
              y={cardY}
              width={cardWidth}
              height={cardHeight}
              aria-label={`Selected Aircraft ${selectedAircraft.callsign}`}
            >
              <div className="radar-card-body">
                <p className="radar-card-eyebrow">Selected Aircraft</p>
                <p className="radar-card-title">
                  <span>{selectedAircraft.callsign}</span>
                  <span>{selectedProfile?.displayName ?? selectedAircraft.capabilityProfileId}</span>
                </p>
                <p className="radar-card-state">
                  {titleCase(selectedAircraft.intention)} · {titleCase(selectedAircraft.flightPhase)} · Pilot {titleCase(selectedAircraft.pilotState)}
                </p>
                <p className="radar-card-data">
                  {selectedAircraft.altitudeFeet.toLocaleString()} ft · {Math.round(selectedAircraft.speedKnots)} kt · hdg {String(Math.round(selectedAircraft.headingDegrees) % 360).padStart(3, "0")}°
                </p>
                <p className="radar-card-line">
                  {clearance
                    ? `${CLEARANCE_LABELS[clearance.kind]} runway ${clearance.runwayEnd}`
                    : "No active runway Clearance"}
                </p>
                <p className="radar-card-line">
                  {instruction ? `Instruction: ${instruction}` : "No Tactical Instruction"}
                </p>
              </div>
            </foreignObject>
          );
        })()
      ) : null}
    </svg>
  );
}
