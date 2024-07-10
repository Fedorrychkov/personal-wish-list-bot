export const URL_REGEXP = /[-a-zA-Z0-9@:%._\\+~#=]{1,256}\.[a-zA-Z0-9()]{1,256}\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)?/gi

const isUrlValid = (string) => {
  try {
    new URL(string)

    return true
  } catch (err) {
    return false
  }
}

const isHttpValid = (str) => {
  try {
    const newUrl = new URL(str)

    return newUrl.protocol === 'http:' || newUrl.protocol === 'https:'
  } catch (err) {
    return false
  }
}

export const tryToGetUrlOrEmptyString = (url?: string) => {
  if (typeof url === 'string' && url.match(URL_REGEXP)) {
    const match = url.match(URL_REGEXP)
    const [finalUrl] = match

    const isValid = !!finalUrl && isUrlValid(url) && isHttpValid(url)

    if (isValid) {
      const finalUrl = new URL(url)

      return finalUrl?.href
    }

    return null
  }

  return null
}
