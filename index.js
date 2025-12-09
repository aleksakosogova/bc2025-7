import { Command } from "commander";
import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const program = new Command();
program
  .option("--host <host>", "Server host", process.env.APP_HOST || "0.0.0.0")
  .option("--port <port>", "Server port", process.env.APP_PORT || "3000")
  .option("--cache <path>", "Cache directory", process.env.CACHE_DIR || "./cache");
program.parse(process.argv);
const options = program.opts();

let db;
async function connectDB() {
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: 'utf8mb4'
    });
    
    await db.execute("SET NAMES utf8mb4");
    await db.execute("SET CHARACTER SET utf8mb4");
    
    console.log("✅ Connected to MySQL database");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
}

if (!fs.existsSync(options.cache)) {
  fs.mkdirSync(options.cache, { recursive: true });
  console.log(`📁 Cache directory created: ${options.cache}`);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(".")); 

const upload = multer({ dest: options.cache });

app.post("/register", upload.single("photo"), async (req, res) => {
  const { inventory_name, description } = req.body;
  if (!inventory_name) {
    return res.status(400).json({ error: "Missing inventory name" });
  }
  try {
    const [result] = await db.execute(
      "INSERT INTO inventory (name, description, photo) VALUES (?, ?, ?)",
      [inventory_name, description || "", req.file ? req.file.filename : null]
    );
    const newItem = {
      id: result.insertId,
      name: inventory_name,
      description: description || "",
      photo: req.file ? req.file.filename : null,
    };
    res.status(201).json({ message: "Inventory item created successfully", item: newItem });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/inventory", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM inventory");
    const itemsWithPhotoUrl = rows.map(item => ({
      ...item,
      photoUrl: item.photo ? `http://localhost:3000/inventory/${item.id}/photo` : null
    }));
    res.json({ count: itemsWithPhotoUrl.length, items: itemsWithPhotoUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/inventory/:id", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }
    const item = rows[0];
    res.json({ ...item, photoUrl: item.photo ? `http://localhost:3000/inventory/${item.id}/photo` : null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
});

app.put("/inventory/:id", async (req, res) => {
  const { name, description } = req.body;
  try {
    const [rows] = await db.execute("SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }
    await db.execute(
      "UPDATE inventory SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?",
      [name, description, req.params.id]
    );
    const [updated] = await db.execute("SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    res.json({ message: "Item updated successfully", item: updated[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
});

app.delete("/inventory/:id", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }
    const item = rows[0];
    if (item.photo) {
      fs.unlink(path.join(options.cache, item.photo), () => {});
    }
    await db.execute("DELETE FROM inventory WHERE id = ?", [req.params.id]);
    res.json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/inventory/:id/photo", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }
    const item = rows[0];
    if (!item.photo) {
      return res.status(404).json({ error: "Photo not found" });
    }
    const filePath = path.resolve(options.cache, item.photo);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Photo file missing" });
    }
    res.setHeader("Content-Type", "image/jpeg");
    res.sendFile(filePath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
});

app.put("/inventory/:id/photo", upload.single("photo"), async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No photo uploaded" });
    }
    const item = rows[0];
    if (item.photo) {
      fs.unlink(path.join(options.cache, item.photo), () => {});
    }
    await db.execute("UPDATE inventory SET photo = ? WHERE id = ?", [req.file.filename, req.params.id]);
    const [updated] = await db.execute("SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    res.json({ message: "Photo updated", item: updated[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/search", async (req, res) => {
  const { id, has_photo } = req.body;
  try {
    const [rows] = await db.execute("SELECT * FROM inventory WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }
    const item = rows[0];
    const result = { ...item, photoUrl: item.photo ? `http://localhost:3000/inventory/${item.id}/photo` : null };
    if ((has_photo === "on" || has_photo === "true" || has_photo === "1") && item.photo) {
      result.description = (result.description || "") + `\nPhoto: ${result.photoUrl}`;
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
});

const specs = swaggerJsdoc({
  definition: { openapi: "3.0.0", info: { title: "Inventory API", version: "1.0.0" } },
  apis: ["./index.js"],
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(specs));

app.use((req, res) => {
  res.status(405).json({ error: "Method Not Allowed" });
});

await connectDB();

app.listen(options.port, options.host, () => {
  console.log(`🚀 Server running at http://${options.host}:${options.port}`);
  console.log(`📚 API Docs available at http://${options.host}:${options.port}/docs`);
});