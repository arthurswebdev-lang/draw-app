import { Change } from '../types';

export class History {
  private undoStack: Change[] = [];
  private redoStack: Change[] = [];

  push(change: Change) {
    this.undoStack.push(change);
    this.redoStack = [];
  }
  undo(): Change | undefined {
    const c = this.undoStack.pop();
    if (c) this.redoStack.push(c);
    return c;
  }
  redo(): Change | undefined {
    const c = this.redoStack.pop();
    if (c) this.undoStack.push(c);
    return c;
  }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
}
