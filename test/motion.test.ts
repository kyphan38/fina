import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  barScale,
  dragOffset,
  leavingItems,
  reducedMotion,
  rowChanges,
  sheetShouldClose,
} from '@/lib/motion';

const a = { id: 'a' };
const b = { id: 'b' };
const c = { id: 'c' };

test('reducedMotion - true in Node, where matchMedia does not exist', () => {
  assert.equal(reducedMotion(), true);
});

test('leavingItems - a removed item is leaving', () => {
  assert.deepEqual(leavingItems([a, b, c], [a, c]), [b]);
});

test('leavingItems - the same list leaves nothing', () => {
  assert.deepEqual(leavingItems([a, b], [a, b]), []);
});

test('leavingItems - a new item is not leaving', () => {
  assert.deepEqual(leavingItems([a], [a, b]), []);
});

test('leavingItems - works with number ids', () => {
  assert.deepEqual(leavingItems([{ id: 1 }, { id: 2 }], [{ id: 2 }]), [{ id: 1 }]);
});

test('sheetShouldClose - past a quarter of the height closes', () => {
  assert.equal(sheetShouldClose(120, 400, 0), true);
});

test('sheetShouldClose - a short slow drag springs back', () => {
  assert.equal(sheetShouldClose(40, 400, 0.1), false);
});

test('sheetShouldClose - a short fast flick closes', () => {
  assert.equal(sheetShouldClose(40, 400, 0.8), true);
});

test('dragOffset - dragging up is damped', () => {
  assert.equal(dragOffset(-50), -10);
});

test('dragOffset - dragging down follows the finger', () => {
  assert.equal(dragOffset(30), 30);
});

test('barScale - half used is half full', () => {
  assert.equal(barScale(50, 100), 0.5);
});

test('barScale - over the limit stops at full', () => {
  assert.equal(barScale(150, 100), 1);
});

test('barScale - no limit or a zero limit is empty', () => {
  assert.equal(barScale(10, 0), 0);
  assert.equal(barScale(10, undefined), 0);
});

test('barScale - a negative amount is empty', () => {
  assert.equal(barScale(-5, 100), 0);
});

test('barScale - not a number is empty', () => {
  assert.equal(barScale(Number.NaN, 100), 0);
});

test('rowChanges - one added row', () => {
  assert.deepEqual(rowChanges(['a', 'b'], ['c', 'a', 'b']), { added: ['c'], removed: [] });
});

test('rowChanges - one removed row', () => {
  assert.deepEqual(rowChanges(['a', 'b', 'c'], ['a', 'c']), { added: [], removed: ['b'] });
});

test('rowChanges - nothing changed', () => {
  assert.deepEqual(rowChanges(['a', 'b'], ['b', 'a']), { added: [], removed: [] });
});

test('rowChanges - a swapped list is not an edit', () => {
  assert.equal(rowChanges(['a', 'b', 'c'], ['x', 'y', 'z']), null);
});

test('rowChanges - the limit can be raised', () => {
  assert.deepEqual(rowChanges([], ['a', 'b', 'c', 'd'], 5), { added: ['a', 'b', 'c', 'd'], removed: [] });
});
