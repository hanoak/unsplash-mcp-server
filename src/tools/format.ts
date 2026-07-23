import type { Photo } from '../schemas/photo.js'

const UNSPLASH_BASE = 'https://unsplash.com'
const DEFAULT_UTM_SOURCE = 'unsplash_mcp_server'

/** Ready-to-use attribution, per Unsplash API guidelines (with UTM params). */
export interface Attribution {
  /** Plain-text credit, e.g. `Photo by Jane Doe on Unsplash`. */
  readonly text: string
  /** HTML credit with links to the photographer and Unsplash (UTM-tagged). */
  readonly html: string
  readonly photographerName: string | undefined
  readonly photographerUrl: string | undefined
  readonly unsplashUrl: string
}

/** Token-efficient projection of a photo for tool output. */
export interface CompactPhoto {
  readonly id: string
  readonly description: string | null
  readonly width: number | undefined
  readonly height: number | undefined
  readonly color: string | null
  readonly blur_hash: string | null
  readonly urls: {
    readonly full: string | undefined
    readonly regular: string | undefined
    readonly small: string | undefined
  }
  readonly photo_page: string | undefined
  /** Call `unsplash_track_download` with this to comply with the download guideline. */
  readonly download_location: string | undefined
  readonly photographer: {
    readonly name: string | undefined
    readonly username: string | undefined
    readonly profile: string | undefined
  }
  readonly attribution: Attribution
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Build attribution links/text for a photo, tagged with the app's UTM source. */
export function buildAttribution(photo: Photo, appName: string | undefined): Attribution {
  const source = encodeURIComponent(appName ?? DEFAULT_UTM_SOURCE)
  const utm = `utm_source=${source}&utm_medium=referral`
  const name = photo.user?.name ?? undefined
  const username = photo.user?.username

  const photographerUrl = username
    ? `${UNSPLASH_BASE}/@${encodeURIComponent(username)}?${utm}`
    : (photo.user?.links?.html ?? undefined)
  const unsplashUrl = `${UNSPLASH_BASE}/?${utm}`

  const text = name ? `Photo by ${name} on Unsplash` : 'Photo on Unsplash'
  const namePart =
    name && photographerUrl
      ? `<a href="${photographerUrl}">${escapeHtml(name)}</a>`
      : (name ?? 'an Unsplash photographer')
  const html = `Photo by ${namePart} on <a href="${unsplashUrl}">Unsplash</a>`

  return { text, html, photographerName: name, photographerUrl, unsplashUrl }
}

/** Project a full photo into the compact shape returned by tools. */
export function toCompactPhoto(photo: Photo, appName: string | undefined): CompactPhoto {
  return {
    id: photo.id,
    description: photo.description ?? photo.alt_description ?? null,
    width: photo.width,
    height: photo.height,
    color: photo.color ?? null,
    blur_hash: photo.blur_hash ?? null,
    urls: {
      full: photo.urls?.full,
      regular: photo.urls?.regular,
      small: photo.urls?.small,
    },
    photo_page: photo.links?.html,
    download_location: photo.links?.download_location,
    photographer: {
      name: photo.user?.name ?? undefined,
      username: photo.user?.username,
      profile: photo.user?.links?.html,
    },
    attribution: buildAttribution(photo, appName),
  }
}
