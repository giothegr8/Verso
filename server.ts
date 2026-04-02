import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Reminder Registration Endpoint
  app.post("/api/reminders/register", async (req, res) => {
    try {
      const { 
        enabled,
        type,
        time,
        timezone
      } = req.body;

      // In a real production app, you would:
      // 1. Validate the input
      // 2. Store these settings in a database (e.g. Firestore) linked to the user
      // 3. Schedule a background job (e.g. using Cloud Tasks or a CRON job) to trigger the reminder
      
      console.log("Reminder registration received:", { 
        enabled, 
        type, 
        time, 
        timezone
      });

      // For App Notifications, you'd use Web Push protocol

      res.json({ success: true, message: "Reminder settings updated on server" });
    } catch (error) {
      console.error("Reminder Registration Error:", error);
      res.status(500).json({ error: "Failed to register reminder" });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
