import { extractOpenGraph } from '@devmehq/open-graph-extractor'
import { ogClient } from 'src/utils/ogRequest'
import { request } from 'src/utils/request'

const getFreeOgContainer = async (url: string, method: 'GET' | 'OPTIONS') => {
  const response = await request({
    url,
    withCredentials: true,
    method,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Connection: 'keep-alive',
      Accept: '*/*',
      Cookie:
        'JSESSIONID=E771A3E1028DB02822751D44F25F8A6D; acs_usuc_t=x_csrf=89eulk1f580y&acs_rt=a779cd5f578a4270934d60d970ca45b4; aep_usuc_f=b_locale=ru_RU&c_tp=RUB&region=RU&site=rus&province=917477670000000000&city=917477679070000000; aer_abid=799daee845239711..513a78cb515dc88c; aer_ec=jwril8yc0YdJJLSsPBxP0ureP4hrZ/c1LDLd05m3BKCnzenDiyyfke2FjzvAttrNnHpEGibeVYn75TtVW3B82q1ZBQsyCq4JixYcZxnnuqY=; aer_rh=1242915127; ali_apache_id=33.22.87.198.1729869111913.022151.2; intl_common_forever=Qv2JSp3yHF9dLnTNn5Ew6+igp14MQpVCnnyDRVRYEK9qUPYx+QeK3g==; xman_f=B6TyXHsB7xLpAFm6DQrqs293wW/1PD3sFmqRAafz5iizdtf8gEd/X2Fj0ET4KbRkvuxFbJX9wDMy1zVZYr0AH71TbHAGMx87QkGBKKDulUFSNgfBUzuX9A==; xman_t=v8on83/VnfYC4JISZVHCm13YV3TLfDiDtJevzBKhzuT2Umw9HY7X20taQOOVKJxZ; xman_us_f=x_locale=ru_RU&x_l=0&x_c_chg=1&acs_rt=a779cd5f578a4270934d60d970ca45b4',
    },
    maxRedirects: 5,
  })

  console.info('Get Free Opengraph Container', { url, method })
  const openGraphResponse = extractOpenGraph(response?.data)

  const openGraph = {
    title: openGraphResponse?.ogTitle?.replaceAll('<p>', '').replaceAll('</p>', ''),
    description: openGraphResponse?.ogDescription?.replaceAll('<p>', '').replaceAll('</p>', ''),
    imageUrl: openGraphResponse?.ogImage?.url,
    wishUrl: url,
  }

  console.info('Get Free Opengraph', { url, openGraph })

  return openGraph
}

export const getUrlMetadata = async (url: string) => {
  try {
    return await getFreeOgContainer(url, 'GET')
  } catch (error) {
    console.error('Get Free Opengraph error by GET', error?.message)

    try {
      return await getFreeOgContainer(url, 'OPTIONS')
    } catch (error) {
      console.error('Get Free Opengraph error by OPTION S', error?.message)

      // Fallback after developed
      try {
        const response = await ogClient.getSiteInfo(url)

        const openGraph = {
          title:
            response?.hybridGraph?.title?.replaceAll('<p>', '').replaceAll('</p>', '') ||
            response?.openGraph?.title?.replaceAll('<p>', '').replaceAll('</p>', ''),
          description:
            response?.hybridGraph?.description?.replaceAll('<p>', '').replaceAll('</p>', '') ||
            response?.openGraph?.description?.replaceAll('<p>', '').replaceAll('</p>', ''),
          imageUrl: response?.hybridGraph?.image || response?.openGraph?.image?.url,
          wishUrl: url,
        }

        console.info('Get OpenGraphIO', { url, openGraph })

        return openGraph
      } catch (error) {
        console.error('Get OpenGraphIO error', error?.message)
        console.error('Unavailable get opengraph meta', { url })

        return undefined
      }
    }
  }
}
