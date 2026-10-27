// PostgREST builders are lazy: awaiting them is necessary to send the request.
// Tracking must never block navigation or expose query text/user data in logs.
export async function recordAnalytics(client, event, parameters, report = console.warn) {
  try {
    const { error } = await client.rpc(event, parameters);
    if (error) { report('Analytics request failed', event, error.code || 'unknown'); return false; }
    return true;
  } catch {
    report('Analytics request failed', event, 'network');
    return false;
  }
}
