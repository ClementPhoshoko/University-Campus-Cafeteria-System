export function getHealth(req, res) {
  res.json({ success: true, service: 'merchant-munchies-api', status: 'ok', timestamp: new Date().toISOString() });
}
