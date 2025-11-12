require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const DB_NAME = process.env.DB_NAME;
const COLL_NAME = process.env.COLL_NAME;
const REQ_COLL_NAME = process.env.REQ_COLL_NAME;

function idQuery(id) {
  const or = [{ id }];
  if (ObjectId.isValid(id)) or.unshift({ _id: new ObjectId(id) });
  or.push({ _id: id });
  return { $or: or };
}

async function run() {
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const col = db.collection(COLL_NAME);
    const reqCol = db.collection(REQ_COLL_NAME);

    await db.command({ ping: 1 });
    console.log("✅ MongoDB connected successfully!");

    // Default route
    app.get("/", (_req, res) => res.send("StudyMate API running!"));

    // -------------------
    // PARTNERS ROUTES
    // -------------------

    app.get("/api/partners", async (req, res, next) => {
      try {
        const { subject, studyMode, location, email, sort } = req.query;
        const q = {};
        if (subject) q.subject = { $regex: subject, $options: "i" };
        if (studyMode) q.studyMode = studyMode;
        if (location) q.location = { $regex: location, $options: "i" };
        if (email) q.email = email;
        const s =
          sort === "new"
            ? { createdAt: -1 }
            : { rating: -1, patnerCount: -1, createdAt: -1 };
        const docs = await col.find(q).sort(s).toArray();
        res.json(docs);
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
        const { id } = req.params;
        const doc = await col.findOne(idQuery(id));
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
        const { id } = req.params;
        const update = { ...req.body };
        delete update._id;
        const { value } = await col.findOneAndUpdate(
          idQuery(id),
          { $set: update },
          { returnDocument: "after" }
        );
        if (!value)
          return res.status(404).json({ message: "Partner not found" });
        res.json(value);
      } catch (err) {
        next(err);
      }
    });

    app.delete("/api/partners/:id", async (req, res, next) => {
      try {
        const { id } = req.params;
        const r = await col.findOneAndDelete(idQuery(id));
        if (!r.value)
          return res.status(404).json({ message: "Partner not found" });
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    });

    app.patch("/api/partners/:id/increment", async (req, res, next) => {
      try {
        const { id } = req.params;
        const inc = {};
        if (typeof req.body.rating === "number") inc.rating = req.body.rating;
        if (typeof req.body.patnerCount === "number")
          inc.patnerCount = req.body.patnerCount;
        const { value } = await col.findOneAndUpdate(
          idQuery(id),
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

    app.post("/api/partners/:id/request", async (req, res, next) => {
      try {
        const { id } = req.params;
        const { requesterEmail } = req.body;
        if (!requesterEmail)
          return res.status(400).json({ message: "requesterEmail required" });

        const partner = await col.findOne(idQuery(id));
        if (!partner)
          return res.status(404).json({ message: "Partner not found" });

        await reqCol.insertOne({
          partnerId: partner._id,
          partnerEmail: partner.email || null,
          requesterEmail,
          partnerSnapshot: {
            name: partner.name,
            profileimage: partner.profileimage,
            subject: partner.subject,
            studyMode: partner.studyMode,
            availabilityTime: partner.availabilityTime,
            location: partner.location,
            experienceLevel: partner.experienceLevel,
            rating: partner.rating || 0,
            patnerCount: partner.patnerCount || 0,
          },
          createdAt: new Date(),
        });

        const { value: updated } = await col.findOneAndUpdate(
          idQuery(id),
          { $inc: { patnerCount: 1 } },
          { returnDocument: "after" }
        );

        res.json({ ok: true, partner: updated });
      } catch (err) {
        next(err);
      }
    });

    // -------------------
    // REQUESTS ROUTES
    // -------------------

    app.get("/api/requests", async (req, res, next) => {
      try {
        const { requesterEmail } = req.query;
        if (!requesterEmail)
          return res.status(400).json({ message: "requesterEmail required" });
        const docs = await reqCol
          .find({ requesterEmail })
          .sort({ createdAt: -1 })
          .toArray();
        res.json(docs);
      } catch (err) {
        next(err);
      }
    });

    app.patch("/api/requests/:id", async (req, res, next) => {
      try {
        const { id } = req.params;
        const update = { ...req.body };
        delete update._id;
        const { value } = await reqCol.findOneAndUpdate(
          idQuery(id),
          { $set: update },
          { returnDocument: "after" }
        );
        if (!value)
          return res.status(404).json({ message: "Request not found" });
        res.json(value);
      } catch (err) {
        next(err);
      }
    });

    app.delete("/api/requests/:id", async (req, res, next) => {
      try {
        const { id } = req.params;
        const r = await reqCol.findOneAndDelete(idQuery(id));
        if (!r.value)
          return res.status(404).json({ message: "Request not found" });
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    });

    // -------------------
    // 404 & error handling
    // -------------------
    app.use((_req, res) =>
      res.status(404).json({ message: "Route not found" })
    );

    app.use((err, _req, res, _next) =>
      res.status(500).json({ message: "Server error", detail: err.message })
    );

    app.listen(port, () =>
      console.log(`🚀 Server running on http://localhost:${port}`)
    );
  } catch (e) {
    console.error("❌ Startup error:", e);
  }
}

process.on("SIGINT", async () => {
  try {
    await client.close();
  } finally {
    process.exit(0);
  }
});

run().catch(console.dir);
