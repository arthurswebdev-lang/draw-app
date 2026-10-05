import { describe, it, expect } from 'vitest';
import { History } from '../src/state/history';
import { Stroke } from '../src/types';

const s = (id: string) => ({ id } as Stroke);

describe('history', () => {
  it('undo, redo, and new push clears redo', () => {
    const h = new History();
    h.push(s('a')); h.push(s('b'));
    expect(h.undo()?.id).toBe('b');
    expect(h.canRedo).toBe(true);
    expect(h.redo()?.id).toBe('b');
    h.undo();
    h.push(s('c'));
    expect(h.canRedo).toBe(false);
    expect(h.undo()?.id).toBe('c');
  });
});
