export const getValidFileUrl = (fileUrl?: string, apiUrl?: string) => {
  const imageUrl = fileUrl?.includes('/v1/file') && !fileUrl?.includes('http') ? `${apiUrl}${fileUrl}` : fileUrl

  return imageUrl || ''
}
