import { describe, it, expect } from 'vitest';
import { History } from '../src/state/history';
import { Change, Stroke } from '../src/types';

const add = (id: string): Change => ({ removed: [], added: [{ id } as Stroke] });

describe('history', () => {
  it('undo, redo, and new push clears redo', () => {
    const h = new History();
    h.push(add('a')); h.push(add('b'));
    expect(h.undo()?.added[0].id).toBe('b');
    expect(h.canRedo).toBe(true);
    expect(h.redo()?.added[0].id).toBe('b');
    h.undo();
    h.push(add('c'));
    expect(h.canRedo).toBe(false);
    expect(h.undo()?.added[0].id).toBe('c');
  });
});
