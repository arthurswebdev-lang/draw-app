// Types for board.mjs, so the TypeScript app and tests can import it.

export type WireItem = { id: string; createdAt: number; [key: string]: unknown };
export type WireChange = { removed: string[]; added: WireItem[] };

export function sig(item: unknown): string;

export function createBoard(data?: { items?: Record<string, WireItem>; deleted?: string[] }): {
  readonly size: number;
  applyChange(change: WireChange): void;
  want(ids: string[]): string[];
  diffFor(have: Record<string, string>): WireItem[];
  ids(): string[];
  list(): WireItem[];
  toJSON(): { items: Record<string, WireItem>; deleted: string[] };
};
