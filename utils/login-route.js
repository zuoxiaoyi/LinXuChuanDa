function normalizeRedirect(encodedRedirect = '') {
  if (!encodedRedirect) return ''
  try {
    const decoded = decodeURIComponent(encodedRedirect)
    return decoded.startsWith('/pages/') ? decoded : ''
  } catch {
    return ''
  }
}

function buildLoginUrl(redirectUrl = '') {
  if (!redirectUrl || !redirectUrl.startsWith('/pages/')) {
    return '/pages/login/login'
  }
  return `/pages/login/login?redirect=${encodeURIComponent(redirectUrl)}`
}

module.exports = {
  normalizeRedirect,
  buildLoginUrl
}
