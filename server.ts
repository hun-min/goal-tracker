import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";

// Initialize SQLite Database
const db = new Database("database.sqlite");
db.exec(`
  CREATE TABLE IF NOT EXISTS user_sync (
    user_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for large JSON data
  app.use(express.json({ limit: "50mb" }));

  // API Route: Pull data from cloud
  app.get("/api/sync/:userId", (req, res) => {
    try {
      const row = db.prepare("SELECT data, updated_at FROM user_sync WHERE user_id = ?").get(req.params.userId) as any;
      if (row) {
        res.json({ success: true, data: JSON.parse(row.data), updatedAt: row.updated_at });
      } else {
        res.json({ success: true, data: null });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // API Route: Push data to cloud
  app.post("/api/sync/:userId", (req, res) => {
    try {
      const { data, updatedAt } = req.body;
      db.prepare(`
        INSERT INTO user_sync (user_id, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          data = excluded.data,
          updated_at = excluded.updated_at
      `).run(req.params.userId, JSON.stringify(data), updatedAt || Date.now());
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
