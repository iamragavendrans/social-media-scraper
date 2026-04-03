import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchSnapchatContent } from "./snapchat.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/snapchat", async (req, res) => {
  const input = req.query.q;
  if (!input) {
    return res.status(400).json({ error: "Missing q query parameter." });
  }

  try {
    const result = await fetchSnapchatContent(input);
    return res.json(result);
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`);
});
