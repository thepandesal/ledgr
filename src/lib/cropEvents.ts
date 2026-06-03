type Handler = (data: string) => void;
let handler: Handler | null = null;

export const cropEvents = {
  on: (fn: Handler) => { handler = fn; },
  off: () => { handler = null; },
  emit: (data: string) => { handler?.(data); },
};
