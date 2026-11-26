import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as model from '../src/domain/model';
import type { MapLink, MapPoint } from '../src/domain/types';
function verifyRoute(source: MapPoint, waypoints: MapPoint[], target: MapPoint) {
  const link: MapLink = {
    id: 'test',
    source: 'source',
    target: 'target',
    name: '',
    medium: 'ethernet',
    speed: '1 Gbit/s',
    color: '#167d67',
    waypoints,
  };
  const snapshot = JSON.stringify({ source, waypoints, target });
  const route = model.route(link, source, target);
  assert.equal(JSON.stringify(route.points[0]), JSON.stringify(source));
  assert.equal(JSON.stringify(route.points.at(-1)), JSON.stringify(target));
  assert.equal(JSON.stringify({ source, waypoints, target }), snapshot);
  for (const point of waypoints)
    assert(
      route.points.some((vertex) => vertex.x === point.x && vertex.y === point.y),
      'Control points must remain on the route',
    );
  route.segments.forEach((segment, index) => {
    assert(
      segment.start.x === segment.end.x || segment.start.y === segment.end.y,
      'Segments must be orthogonal',
    );
    assert(
      segment.start.x !== segment.end.x || segment.start.y !== segment.end.y,
      'Segments must have nonzero length',
    );
    assert(
      segment.index >= 0 && segment.index <= waypoints.length,
      'Insertion indices must reference their anchor interval',
    );
    if (!index) return;
    const previous = route.segments[index - 1];
    assert.equal(
      JSON.stringify(previous.end),
      JSON.stringify(segment.start),
      'Route must remain connected',
    );
    const previousX = previous.end.x - previous.start.x,
      previousY = previous.end.y - previous.start.y;
    const currentX = segment.end.x - segment.start.x,
      currentY = segment.end.y - segment.start.y;
    assert(
      previousX * currentX + previousY * currentY >= 0,
      'Adjacent segments must not retrace each other',
    );
  });
  return route;
}

test('dragging a bend below the switch does not leave a dangling return segment', () => {
  verifyRoute({ x: 240, y: 460 }, [{ x: 400, y: 540 }], { x: 675, y: 480 });
});

test('aligned, duplicate, and overshooting control points remain connected without retracing', () => {
  const source = { x: 0, y: 0 },
    target = { x: 200, y: 100 };
  for (const waypoints of [
    [{ x: 200, y: 200 }],
    [
      { x: 300, y: 0 },
      { x: 100, y: 0 },
    ],
    [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 100 }, target],
    [
      { x: 0, y: 200 },
      { x: 0, y: -100 },
    ],
  ])
    verifyRoute(source, waypoints, target);
});

test('repeated dragging across endpoint axes keeps every route valid', () => {
  for (let pointX = -120; pointX <= 360; pointX += 40) {
    for (let pointY = -120; pointY <= 240; pointY += 40) {
      verifyRoute({ x: 0, y: 0 }, [{ x: pointX, y: pointY }], { x: 240, y: 120 });
    }
  }
});

test('automatic wired and wireless routes retain their default geometry', () => {
  const wired = verifyRoute({ x: 0, y: 0 }, [], { x: 200, y: 100 });
  assert.equal(wired.path, 'M0,0 L0,50 L200,50 L200,100');
  const wireless = model.route(
    {
      id: 'wireless',
      source: 'source',
      target: 'target',
      name: '',
      color: '#167d67',
      speed: '1 Gbit/s',
      medium: 'wireless',
    },
    { x: 0, y: 0 },
    { x: 200, y: 100 },
  );
  assert.equal(wireless.path, 'M0,0 L200,100');
});
