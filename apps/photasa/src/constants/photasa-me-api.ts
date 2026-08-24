/** photasa.me public API base (RFC 0012 — issue submission from desktop) */
export const PHOTASA_ME_API_BASE =
    import.meta.env.VITE_PHOTASA_ME_API_BASE?.trim() || "https://photasa.me";

export const PHOTASA_ME_ISSUES_PATH = "/api/issues";

export const PHOTASA_ME_ISSUES_URL = `${PHOTASA_ME_API_BASE}${PHOTASA_ME_ISSUES_PATH}`;

/** RFC 0171: Help menu external links */
export const PHOTASA_ME_HOMEPAGE_URL = PHOTASA_ME_API_BASE;

export const PHOTASA_ME_DOCS_URL = `${PHOTASA_ME_API_BASE}/docs`;
