import express from "express";
import Blog from "../models/Blog.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { fileMeta, uploadBlogImage } from "../middleware/upload.js";
import { pick, requireFields } from "../utils.js";

const router = express.Router();
const fields = ["title", "slug", "category", "excerpt", "content", "metaTitle", "metaDescription", "author", "isPublished", "publishedAt"];

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function serializeBlog(blog) {
  const item = blog.toObject ? blog.toObject() : blog;
  if (item.featuredImage?.filename) item.featuredImage.url = `/api/blogs/${item._id}/image`;
  delete item.featuredImage?.data;
  return item;
}

function blogPayload(req) {
  const payload = pick(req.body, fields);
  payload.slug = slugify(payload.slug || payload.title);
  payload.isPublished = payload.isPublished === true || payload.isPublished === "true";
  if (payload.publishedAt) payload.publishedAt = new Date(payload.publishedAt);
  if (payload.isPublished && !payload.publishedAt) payload.publishedAt = new Date();
  if (!payload.isPublished && !payload.publishedAt) payload.publishedAt = undefined;
  if (req.file) payload.featuredImage = fileMeta(req.file);
  return payload;
}

function publicFilter(req) {
  const filter = { isPublished: true };
  if (req.query.search) filter.$text = { $search: req.query.search };
  if (req.query.category) filter.category = new RegExp(req.query.category, "i");
  return filter;
}

function protectAdminQuery(req, res, next) {
  if (req.query.admin) return protect(req, res, () => requirePermission("blogs.view")(req, res, next));
  next();
}

router.get("/", protectAdminQuery, async (req, res, next) => {
  try {
    const filter = req.query.admin ? {} : publicFilter(req);
    const blogs = await Blog.find(filter).select("-featuredImage.data").sort({ publishedAt: -1, createdAt: -1 });
    res.json(blogs.map(serializeBlog));
  } catch (error) {
    next(error);
  }
});

router.get("/slug/:slug", async (req, res, next) => {
  try {
    const filter = { slug: req.params.slug };
    if (!req.query.admin) filter.isPublished = true;
    const blog = await Blog.findOne(filter).select("-featuredImage.data");
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json(serializeBlog(blog));
  } catch (error) {
    next(error);
  }
});

router.get("/:id/image", async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id).select("featuredImage");
    if (!blog?.featuredImage?.data) return res.status(404).json({ message: "Image not found" });
    res.setHeader("Content-Type", blog.featuredImage.mimetype || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(blog.featuredImage.data);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", protect, requirePermission("blogs.view"), async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id).select("-featuredImage.data");
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json(serializeBlog(blog));
  } catch (error) {
    next(error);
  }
});

router.post("/", protect, requirePermission("blogs.view"), uploadBlogImage.single("featuredImage"), async (req, res, next) => {
  try {
    requireFields(req.body, ["title", "excerpt", "content"]);
    const blog = await Blog.create(blogPayload(req));
    res.status(201).json(serializeBlog(blog));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", protect, requirePermission("blogs.view"), uploadBlogImage.single("featuredImage"), async (req, res, next) => {
  try {
    const payload = blogPayload(req);
    const blog = await Blog.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true }).select("-featuredImage.data");
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json(serializeBlog(blog));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", protect, requirePermission("blogs.view"), async (req, res, next) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json({ message: "Blog deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
