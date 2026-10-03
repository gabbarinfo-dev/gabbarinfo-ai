export default function handler(req, res) {
  const { id } = req.query;
  const fileName = id ? `google${id}.html` : "google0f508b164a828c08.html";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(`google-site-verification: ${fileName}`);
}
