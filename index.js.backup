import { Command } from "commander";
import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

// --- 1. CLI ---
const program = new Command();
program
  .requiredOption("--host <host>", "Server host")
  .requiredOption("--port <port>", "Server port")
  .requiredOption("--cache <path>", "Cache directory");
program.parse(process.argv);
const options = program.opts();

// --- 2. Папка кешу ---
if (!fs.existsSync(options.cache)) {
  fs.mkdirSync(options.cache, { recursive: true });
  console.log(`📁 Створено директорію кешу: ${options.cache}`);
}

// --- 3. Express ---
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(".")); // щоб обслуговувати RegisterForm.html і SearchForm.html

// --- 4. "БД" у пам'яті ---
let inventory = [];
let idCounter = 1;

// --- 5. Multer для завантаження фото ---
const upload = multer({ dest: options.cache });

// --- 6. API ---

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Реєстрація нової речі
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: inventory_name
 *         type: string
 *         required: true
 *         description: Назва речі
 *       - in: formData
 *         name: description
 *         type: string
 *         description: Опис речі
 *       - in: formData
 *         name: photo
 *         type: file
 *         description: Фото речі
 *     responses:
 *       201:
 *         description: Створено новий інвентар
 *       400:
 *         description: Відсутня назва речі
 */
app.post("/register", upload.single("photo"), (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name) {
    return res.status(400).send("❌ Error: missing inventory name");
  }

  const newItem = {
    id: idCounter++,
    name: inventory_name,
    description: description || "",
    photo: req.file ? req.file.filename : null,
  };

  inventory.push(newItem);
  res.status(201).json({
    message: "✅ Inventory item created successfully",
    item: newItem,
  });
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Отримати список усіх речей
 *     responses:
 *       200:
 *         description: Успіх
 */
app.get("/inventory", (req, res) => {
  res.json({
    count: inventory.length,
    items: inventory,
  });
});

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Отримати річ за ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Річ знайдена
 *       404:
 *         description: Не знайдено
 */
app.get("/inventory/:id", (req, res) => {
  const item = inventory.find((i) => i.id == req.params.id);
  if (!item) return res.status(404).send("❌ Item not found");
  // повертаємо також посилання на фото (якщо є)
  const response = {
    ...item,
    photoUrl: item.photo ? `/inventory/${item.id}/photo` : null,
  };
  res.json(response);
});

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Оновити дані речі
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Оновлено успішно
 *       404:
 *         description: Не знайдено
 */
app.put("/inventory/:id", (req, res) => {
  const item = inventory.find((i) => i.id == req.params.id);
  if (!item) return res.status(404).send("❌ Item not found");

  const { name, description } = req.body;
  if (name) item.name = name;
  if (description) item.description = description;

  res.json({ message: "✅ Item updated successfully", item });
});

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Видалити річ
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Видалено успішно
 *       404:
 *         description: Не знайдено
 */
app.delete("/inventory/:id", (req, res) => {
  const index = inventory.findIndex((i) => i.id == req.params.id);
  if (index === -1) return res.status(404).send("❌ Item not found");

  // видалити файл фото якщо був
  const item = inventory[index];
  if (item.photo) {
    const filePath = path.join(options.cache, item.photo);
    fs.unlink(filePath, (err) => {
      // ігноруємо помилку видалення (файл міг бути відсутній)
    });
  }

  inventory.splice(index, 1);
  res.json({ message: "🗑️ Item deleted successfully" });
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Отримати фото речі
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Повертає зображення
 *       404:
 *         description: Не знайдено або без фото
 */
app.get("/inventory/:id/photo", (req, res) => {
  const item = inventory.find((i) => i.id == req.params.id);
  if (!item) return res.status(404).send("❌ Item not found");
  if (!item.photo) return res.status(404).send("❌ Photo not found");

  const filePath = path.join(options.cache, item.photo);
  if (!fs.existsSync(filePath)) return res.status(404).send("❌ Photo file missing");

  // Встановлюємо відповідний заголовок; sendFile сам поставить content-type, але додамо для гарантії
  res.setHeader("Content-Type", "image/jpeg");
  res.sendFile(filePath, (err) => {
    if (err) res.status(500).send("❌ Error sending file");
  });
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     summary: Оновити фото речі
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: formData
 *         name: photo
 *         type: file
 *     responses:
 *       200:
 *         description: Фото оновлено
 *       404:
 *         description: Річ не знайдена
 */
app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
  const item = inventory.find((i) => i.id == req.params.id);
  if (!item) return res.status(404).send("❌ Item not found");
  if (!req.file) return res.status(400).send("❌ No photo uploaded");

  // видаляємо старий файл, якщо є
  if (item.photo) {
    const oldPath = path.join(options.cache, item.photo);
    fs.unlink(oldPath, () => {});
  }

  item.photo = req.file.filename;
  res.json({ message: "✅ Photo updated", item });
});

/**
 * @swagger
 * /search:
 *   post:
 *     summary: Пошук речі за ID (через форму)
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               has_photo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Знайдено
 *       404:
 *         description: Не знайдено
 */
app.post("/search", (req, res) => {
  const { id, has_photo } = req.body;
  const item = inventory.find((i) => i.id == id);
  if (!item) return res.status(404).send("❌ Item not found");

  const result = {
    ...item,
    photoUrl: item.photo ? `/inventory/${item.id}/photo` : null,
  };

  // якщо прапорець встановлено (у формі це приходить як 'on' або 'true'), додаємо посилання у опис
  if ((has_photo === "on" || has_photo === "true" || has_photo === "1") && item.photo) {
    result.description = (result.description || "") + `\nФото: ${result.photoUrl}`;
  }

  res.json(result);
});

// --- 7. Swagger ---
const specs = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "Inventory API", version: "1.0.0" },
  },
  apis: ["./index.js"],
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(specs));

// --- 8. Обробник для невизначених маршрутів / методів ---
// Використовуємо app.use як універсальний "catch-all" після всіх маршрутів
app.use((req, res) => {
  res.status(405).send("❌ Method Not Allowed");
});

// --- 9. Запуск ---
app.listen(options.port, options.host, () => {
  console.log(`🚀 Server running at http://${options.host}:${options.port}`);
});
