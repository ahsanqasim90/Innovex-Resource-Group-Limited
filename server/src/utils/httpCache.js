export function cachePublicResponse(res, { browserSeconds = 30, edgeSeconds = 60, staleSeconds = 300 } = {}) {
  res.set("Cache-Control", `public, max-age=${browserSeconds}, s-maxage=${edgeSeconds}, stale-while-revalidate=${staleSeconds}`);
  res.removeHeader("Pragma");
}
