export const URL_REGEXP = /[-a-zA-Z0-9@:%._\\+~#=]{1,256}\.[a-zA-Z0-9()]{1,256}\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)?/gi

export const tryToGetUrlOrEmptyString = (url?: string) => {
  if (typeof url === 'string' && url.match(URL_REGEXP)) {
    const [finalUrl] = url.match(URL_REGEXP)

    try {
      const result = new Date(finalUrl).getTime()

      if (!Number.isNaN(result)) {
        return null
      }
    } catch {}

    return finalUrl || null
  }

  return null
}
