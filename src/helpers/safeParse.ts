export function safeParse<T>(payload: string): T {
  try {
    return JSON.parse(payload)
  } catch {
    return undefined
  }
}
