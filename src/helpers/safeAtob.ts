export const safeAtob = (path: string, tries = 2) => {
  if (!tries) return undefined

  tries -= 1

  try {
    return atob(path)
  } catch {
    if (tries) {
      return safeAtob(`${path}=`, tries)
    }

    return undefined
  }
}
