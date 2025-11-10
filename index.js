require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://B12-A10-server:cPphu7RoRa9DP6Si@b12-a10-server.g9l3hzm.mongodb.net/?appName=B12-A10-server";
const DB_NAME = process.env.DB_NAME || "B12-A10";
const COLL_NAME = process.env.COLL_NAME || "A10-Collection";

const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (_req, res) => res.send("StudyMate API"));

async function run() {
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const col = db.collection(COLL_NAME);
    await db.command({ ping: 1 });

    app.get("/users", async (_req, res, next) => {
      try {
        const result = await col.find({}).toArray();
        res.json(result);
      } catch (err) {
        next(err);
      }
    });

    app.get("/api/partners/top", async (req, res, next) => {
      try {
        const limit = Math.max(parseInt(req.query.limit) || 3, 3);
        const docs = await col
          .find({})
          .sort({ rating: -1, patnerCount: -1, createdAt: -1 })
          .limit(limit)
          .toArray();
        res.json(docs);
      } catch (err) {
        next(err);
      }
    });

    app.get("/api/partners/:id", async (req, res, next) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id))
          return res.status(400).json({ message: "Invalid id" });
        const doc = await col.findOne({ _id: new ObjectId(id) });
        if (!doc) return res.status(404).json({ message: "Partner not found" });
        res.json(doc);
      } catch (err) {
        next(err);
      }
    });

    app.post("/api/partners", async (req, res, next) => {
      try {
        const payload = { ...req.body, createdAt: new Date() };
        const { insertedId } = await col.insertOne(payload);
        res.status(201).json({ _id: insertedId, ...payload });
      } catch (err) {
        next(err);
      }
    });

    app.patch("/api/partners/:id", async (req, res, next) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id))
          return res.status(400).json({ message: "Invalid id" });
        const { value } = await col.findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $set: req.body },
          { returnDocument: "after" }
        );
        if (!value)
          return res.status(404).json({ message: "Partner not found" });
        res.json(value);
      } catch (err) {
        next(err);
      }
    });

    app.patch("/api/partners/:id/increment", async (req, res, next) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id))
          return res.status(400).json({ message: "Invalid id" });
        const inc = {};
        if (typeof req.body.rating === "number") inc.rating = req.body.rating;
        if (typeof req.body.patnerCount === "number")
          inc.patnerCount = req.body.patnerCount;
        const { value } = await col.findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $inc: inc },
          { returnDocument: "after" }
        );
        if (!value)
          return res.status(404).json({ message: "Partner not found" });
        res.json(value);
      } catch (err) {
        next(err);
      }
    });

    app.use((_req, res) =>
      res.status(404).json({ message: "Route not found" })
    );
    app.use((err, _req, res, _next) =>
      res.status(500).json({ message: "Server error", detail: err.message })
    );

    app.listen(port, () => console.log(`Server http://localhost:${port}`));
  } catch {
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  try {
    await client.close();
  } finally {
    process.exit(0);
  }
});

run();
