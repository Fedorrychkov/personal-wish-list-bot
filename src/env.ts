const ENV = process.env.NODE_ENV

export const isDevelop = ENV === 'development'
export const isProduction = ENV === 'production'
