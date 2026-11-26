import type { MapDocument, MapLink, MapPoint, MapRouteSegment } from './types';

export function route(link: MapLink, source: MapPoint, target: MapPoint) {
  let segments: MapRouteSegment[];
  if (link.waypoints?.length) segments = routedSegments([source, ...link.waypoints, target]);
  else {
    const middleY = (source.y + target.y) / 2;
    const points =
      link.medium === 'wireless' || source.x === target.x || source.y === target.y
        ? [source, target]
        : [source, { x: source.x, y: middleY }, { x: target.x, y: middleY }, target];
    segments = toSegments(points, 0);
  }
  const points = [source, ...segments.map((item) => item.end)];
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
  const total = segments.reduce(
    (sum, item) => sum + Math.hypot(item.end.x - item.start.x, item.end.y - item.start.y),
    0,
  );
  let remaining = total / 2,
    label = source;
  for (const item of segments) {
    const length = Math.hypot(item.end.x - item.start.x, item.end.y - item.start.y);
    if (remaining <= length) {
      const ratio = remaining / length;
      label = {
        x: item.start.x + (item.end.x - item.start.x) * ratio,
        y: item.start.y + (item.end.y - item.start.y) * ratio,
      };
      break;
    }
    remaining -= length;
  }
  return { path, points, segments, label };
}

function toSegments(points: MapPoint[], index: number): MapRouteSegment[] {
  return points.slice(1).flatMap((end, offset) => {
    const start = points[offset];
    return start.x === end.x && start.y === end.y ? [] : [{ start, end, index }];
  });
}

function direction(segment: MapRouteSegment) {
  return segment.end.x !== segment.start.x
    ? Math.sign(segment.end.x - segment.start.x)
    : Math.sign(segment.end.y - segment.start.y) * 2;
}

function routedSegments(anchors: MapPoint[]): MapRouteSegment[] {
  let states = new Map<number, { cost: number; segments: MapRouteSegment[] }>([
    [0, { cost: 0, segments: [] }],
  ]);
  for (let index = 0; index < anchors.length - 1; index++) {
    const start = anchors[index],
      end = anchors[index + 1];
    const middleX = (start.x + end.x) / 2,
      middleY = (start.y + end.y) / 2;
    const candidates =
      start.x === end.x && start.y === end.y
        ? [[]]
        : [
            [start, { x: end.x, y: start.y }, end],
            [start, { x: start.x, y: end.y }, end],
            ...[middleY, Math.min(start.y, end.y) - 20, Math.max(start.y, end.y) + 20].map((y) => [
              start,
              { x: start.x, y },
              { x: end.x, y },
              end,
            ]),
            ...[middleX, Math.min(start.x, end.x) - 20, Math.max(start.x, end.x) + 20].map((x) => [
              start,
              { x, y: start.y },
              { x, y: end.y },
              end,
            ]),
          ].map((points) => toSegments(points, index));
    const next = new Map<number, { cost: number; segments: MapRouteSegment[] }>();
    for (const [previousDirection, state] of states)
      for (const candidate of candidates) {
        const firstDirection = candidate.length ? direction(candidate[0]) : 0;
        if (previousDirection && firstDirection === -previousDirection) continue;
        if (
          candidate.some(
            (segment, offset) =>
              offset > 0 && direction(segment) === -direction(candidate[offset - 1]),
          )
        )
          continue;
        const lastDirection = candidate.length
          ? direction(candidate[candidate.length - 1])
          : previousDirection;
        const length = candidate.reduce(
          (sum, segment) =>
            sum +
            Math.abs(segment.end.x - segment.start.x) +
            Math.abs(segment.end.y - segment.start.y),
          0,
        );
        const turns =
          Math.max(0, candidate.length - 1) +
          (previousDirection && firstDirection && previousDirection !== firstDirection ? 1 : 0);
        const cost = state.cost + length + turns * 20;
        const existing = next.get(lastDirection);
        if (!existing || cost < existing.cost)
          next.set(lastDirection, { cost, segments: [...state.segments, ...candidate] });
      }
    states = next;
  }
  return [...states.values()].reduce((best, state) => (state.cost < best.cost ? state : best))
    .segments;
}

export function bounds(model: MapDocument) {
  const boxes = [
    ...model.devices.map((item) => ({ x: item.x - 85, y: item.y - 45, width: 170, height: 125 })),
    ...model.rooms,
    ...model.links.flatMap((link) => {
      const labelPosition = link.labelPosition;
      const labelWidth = Math.max(70, (link.name || link.speed).length * 6.4);
      return [
        ...(link.waypoints || []).map((point) => ({ ...point, width: 1, height: 1 })),
        ...(labelPosition
          ? [
              {
                x: labelPosition.x - labelWidth / 2,
                y: labelPosition.y - 10,
                width: labelWidth,
                height: 20,
              },
            ]
          : []),
      ];
    }),
  ];
  if (!boxes.length) return { x: 0, y: 0, width: 800, height: 600 };
  const edges = boxes.reduce(
    (result, item) => ({
      left: Math.min(result.left, item.x),
      top: Math.min(result.top, item.y),
      right: Math.max(result.right, item.x + item.width),
      bottom: Math.max(result.bottom, item.y + item.height),
    }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  );
  return {
    x: edges.left - 40,
    y: edges.top - 40,
    width: edges.right - edges.left + 80,
    height: edges.bottom - edges.top + 80,
  };
}
