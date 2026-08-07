type Direction = 'in' | 'out';
let pendingDirection: Direction | null = null;
let returnTab: string | null = null;

export const recordDirection = {
  set: (dir: Direction, fromTab?: string) => { pendingDirection = dir; returnTab = fromTab ?? null; },
  consume: (): { dir: Direction; returnTab: string | null } | null => {
    if (!pendingDirection) return null;
    const d = pendingDirection;
    const t = returnTab;
    pendingDirection = null;
    returnTab = null;
    return { dir: d, returnTab: t };
  },
};
