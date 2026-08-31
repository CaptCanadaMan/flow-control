import { useEffect, useMemo, useRef, useState } from "react";

import type { TowerSnapshot } from "../application";
import "./radar.css";

type RadarProps = {
  snapshot: Pick<
    TowerSnapshot,
    | "airport"
    | "aircraft"
    | "runwayResources"
    | "stagedClearancePlan"
    | "stagedRecoveryPlan"
  >;
  selectedAircraftId?: string;
  onSelectAircraft?: (aircraftId: string) => void;
};

type RadarPoint = { x: number; y: number };

const SCOPE_CENTER = 50;
const NAUTICAL_MILES_TO_VIEWBOX_UNITS = 5;
const FEET_PER_NAUTICAL_MILE = 6_076.12;
const VISUAL_INTERPOLATION_MS = 50;

function projectPosition(position: {
  eastNauticalMiles: number;
  northNauticalMiles: number;
}): RadarPoint {
  return {
    x: SCOPE_CENTER + position.eastNauticalMiles * NAUTICAL_MILES_TO_VIEWBOX_UNITS,
    y: SCOPE_CENTER - position.northNauticalMiles * NAUTICAL_MILES_TO_VIEWBOX_UNITS,
  };
}

function pointsForAircraft(snapshot: RadarProps["snapshot"]) {
  return Object.fromEntries(
    snapshot.aircraft.map((aircraft) => [aircraft.id, projectPosition(aircraft.position)]),
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
function useInterpolatedAircraftPoints(snapshot: RadarProps["snapshot"]) {
  const targets = useMemo(() => pointsForAircraft(snapshot), [snapshot]);
  const targetKey = snapshot.aircraft
    .map(
      (aircraft) =>
        `${aircraft.id}:${aircraft.position.eastNauticalMiles}:${aircraft.position.northNauticalMiles}`,
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

function compactAircraftLabel(callsign: string, altitudeFeet: number) {
  return `${callsign} · ${altitudeFeet.toLocaleString()} ft`;
}

export function Radar({
  snapshot,
  selectedAircraftId,
  onSelectAircraft,
}: RadarProps) {
  const aircraftPoints = useInterpolatedAircraftPoints(snapshot);
  const activePlan = snapshot.stagedRecoveryPlan ?? snapshot.stagedClearancePlan;
  const aircraftById = new Map(snapshot.aircraft.map((aircraft) => [aircraft.id, aircraft]));
  const activeHolds = snapshot.aircraft.flatMap((aircraft) => {
    const holdId = aircraft.activeTacticalInstruction?.localHoldId;
    const hold = snapshot.airport.holdingAreas.find(({ id }) => id === holdId);
    return hold ? [{ aircraft, hold }] : [];
  });

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

      {snapshot.aircraft.map((aircraft) => {
        const point = aircraftPoints[aircraft.id] ?? projectPosition(aircraft.position);
        const tail = endpoint(point, (aircraft.trackDegrees + 180) % 360, 7);
        const isSelected = aircraft.id === selectedAircraftId;
        const placeLabelLeft = point.x >= 40 && point.x < SCOPE_CENTER;
        const labelX = point.x + (placeLabelLeft ? -2.6 : 2.6);
        const labelY = point.y - (placeLabelLeft ? 5 : 1.8);
        const className = isSelected
          ? "radar-aircraft radar-aircraft-selected"
          : "radar-aircraft";

        return (
          <g key={aircraft.id}>
            <line
              className="radar-track-tail"
              x1={point.x}
              y1={point.y}
              x2={tail.x}
              y2={tail.y}
            />
            <g
              className={className}
              data-aircraft-id={aircraft.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`Select ${aircraft.callsign}, ${aircraft.flightPhase}`}
              onClick={() => onSelectAircraft?.(aircraft.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectAircraft?.(aircraft.id);
                }
              }}
            >
              <circle cx={point.x} cy={point.y} r="1.65" />
              <text
                x={labelX}
                y={labelY}
                textAnchor={placeLabelLeft ? "end" : "start"}
              >
                {compactAircraftLabel(aircraft.callsign, aircraft.altitudeFeet)}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
