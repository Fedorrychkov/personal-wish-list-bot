export const safeAtob = (path: string, tries = 1) => {
  if (!tries) return undefined

  try {
    return atob(path)
  } catch {
    if (tries && path?.[path?.length - 1] !== '=') {
      return safeAtob(`${path}=`, 0)
    }

    return undefined
  }
}
