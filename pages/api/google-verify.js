export default function handler(req, res) {
  const { id } = req.query;
  if (id === "0f508b164a828c08") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send("google-site-verification: google0f508b164a828c08.html");
  }
  return res.status(404).send("Not Found");
}
