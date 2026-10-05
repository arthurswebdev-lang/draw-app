import { Stroke } from '../types';

export class History {
  private undoStack: Stroke[] = [];
  private redoStack: Stroke[] = [];

  push(stroke: Stroke) {
    this.undoStack.push(stroke);
    this.redoStack = [];
  }
  undo(): Stroke | undefined {
    const s = this.undoStack.pop();
    if (s) this.redoStack.push(s);
    return s;
  }
  redo(): Stroke | undefined {
    const s = this.redoStack.pop();
    if (s) this.undoStack.push(s);
    return s;
  }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
}
