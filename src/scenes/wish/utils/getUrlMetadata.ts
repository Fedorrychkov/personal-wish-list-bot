import { extractOpenGraph } from '@devmehq/open-graph-extractor'
import { ogClient } from 'src/utils/ogRequest'
import { request } from 'src/utils/request'

export const getUrlMetadata = async (url: string) => {
  try {
    const response = await request({
      url,
      withCredentials: true,
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Connection: 'keep-alive',
      },
    })
    const openGraphResponse = extractOpenGraph(response?.data)

    const openGraph = {
      title: openGraphResponse?.ogTitle,
      description: openGraphResponse?.ogDescription,
      imageUrl: openGraphResponse?.ogImage?.url,
      wishUrl: url,
    }

    console.log('Get Free Opengraph', { url })

    return openGraph
  } catch {
    // Fallback after developed
    try {
      const response = await ogClient.getSiteInfo(url)

      const openGraph = {
        title: response?.hybridGraph?.title || response?.openGraph?.title,
        description: response?.hybridGraph?.description || response?.openGraph?.description,
        imageUrl: response?.hybridGraph?.image || response?.openGraph?.image?.url,
        wishUrl: url,
      }

      console.log('Get OpenGraphIO', { url })

      return openGraph
    } catch {
      console.error('Unavailable get opengraph meta', { url })

      return undefined
    }
  }
}
