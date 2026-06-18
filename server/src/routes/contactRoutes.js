import express from "express";
import ContactMessage from "../models/ContactMessage.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { sendContactEmail } from "../services/emailService.js";
import { requireFields, validateEmail } from "../utils.js";

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "email", "subject", "message"]);
    validateEmail(req.body.email);
    const message = await ContactMessage.create(req.body);
    const email = await sendContactEmail(message);
    res.status(201).json({ message, email });
  } catch (error) {
    next(error);
  }
});

router.get("/", protect, requirePermission("contacts.view"), async (req, res, next) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    next(error);
  }
});

export default router;
