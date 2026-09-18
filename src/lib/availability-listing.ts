import { verifiedPublicListingUrl } from "./availability-finder";

/** A live read of the public page, without cookies, auth, or any provider write. */
export async function activePublicListing(url: string, fetcher: typeof fetch = fetch) {
  const canonical = verifiedPublicListingUrl(url);
  if (!canonical) return false;
  try {
    const response = await fetcher(canonical, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000) });
    return response.ok && verifiedPublicListingUrl(response.url) === canonical &&
      (response.headers.get("content-type") ?? "").includes("text/html");
  } catch { return false; }
}
