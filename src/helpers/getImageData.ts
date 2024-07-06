import { request } from 'src/utils/request'

export const getImageBuffer = async (url: string) => {
  const response = await request({
    method: 'GET',
    url,
    responseType: 'arraybuffer',
  })

  const buffer = Buffer.from(response.data, 'binary')

  return {
    buffer,
  }
}
