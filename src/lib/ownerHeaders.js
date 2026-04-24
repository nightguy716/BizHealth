// Returns extra headers to attach to backend requests when the current user
// is the app owner. Requires setting VITE_OWNER_KEY in the frontend env to a
// value that matches OWNER_KEY on the backend. If unset, returns an empty
// object and rate limits apply normally.
export function ownerHeaders() {
  const key = import.meta.env.VITE_OWNER_KEY;
  return key ? { 'x-owner-key': key } : {};
}
