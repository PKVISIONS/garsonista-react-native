export function createPosClientUnid(): string {
  return `AUTB${new Date().toISOString()}-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}
