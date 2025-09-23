export default function handler(req, res) {
  res.json({ message: "Working", time: new Date().toISOString() });
}
