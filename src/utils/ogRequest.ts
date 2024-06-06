import { OpenGraphIO } from 'opengraph-io'

const options = {
  appId: '18dec6fa-5201-4ced-809e-d54899c5b895', // This is your OpenGraph.io App ID and Required.  Sign up for a free one at https://www.opengraph.io/
  service: 'site', // We currently have three services: site, extract, and scrape. Site will be the default
  cacheOk: true, // If a cached result is available, use it for quickness
  useProxy: false, // Proxies help avoid being blocked and can bypass capchas
  maxCacheAge: 432000000, // The maximum cache age to accept
  acceptLang: 'en-US,en;q=0.9', // Language to present to the site.
  fullRender: false, // This will cause JS to execute when rendering to deal with JS dependant sites
}

export const ogClient = new OpenGraphIO(options)
