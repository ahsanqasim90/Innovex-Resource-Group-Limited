import express from "express";
import Candidate from "../models/Candidate.js";
import ClientAccount from "../models/ClientAccount.js";
import Job from "../models/Job.js";
import { requireApiKey } from "../middleware/apiKeyAuth.js";

const router = express.Router();

function pageOptions(req) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  return { page, limit, skip: (page - 1) * limit };
}

async function paged(Model, filter, select, sort, req, res) {
  const { page, limit, skip } = pageOptions(req);
  const [data, total] = await Promise.all([Model.find(filter).select(select).sort(sort).skip(skip).limit(limit).lean(), Model.countDocuments(filter)]);
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

router.get("/", (req, res) => res.json({ name: "Innovex Public API", version: "v1", authentication: "X-API-Key" }));
router.get("/jobs", requireApiKey("jobs:read"), (req, res, next) => paged(Job, req.query.updatedSince ? { updatedAt: { $gte: new Date(req.query.updatedSince) } } : {}, "reference title location salary type shift priority openings vacancyStatus publicationStatus createdAt updatedAt", { updatedAt: -1 }, req, res).catch(next));
router.get("/candidates", requireApiKey("candidates:read"), (req, res, next) => paged(Candidate, req.query.updatedSince ? { updatedAt: { $gte: new Date(req.query.updatedSince) } } : {}, "name email phone postcode city desiredRole status source tags availability assignedRecruiter createdAt updatedAt", { updatedAt: -1 }, req, res).catch(next));
router.get("/clients", requireApiKey("clients:read"), (req, res, next) => paged(ClientAccount, req.query.updatedSince ? { updatedAt: { $gte: new Date(req.query.updatedSince) } } : {}, "name tradingName accountType status industry companyNumber website email phone address owner tags lastActivityAt createdAt updatedAt", { updatedAt: -1 }, req, res).catch(next));

export default router;
