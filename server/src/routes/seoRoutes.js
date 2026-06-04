import express from "express";
import Blog from "../models/Blog.js";
import Job from "../models/Job.js";

const router = express.Router();
const SITE_URL = process.env.SITE_URL || "https://www.innovexresourcegroup.co.uk";

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry({ loc, lastmod, changefreq = "weekly", priority = "0.7" }) {
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : "",
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>"
  ].filter(Boolean).join("\n");
}

router.get("/sitemap.xml", async (req, res, next) => {
  try {
    const staticPages = [
      { path: "/", changefreq: "weekly", priority: "1.0" },
      { path: "/about", changefreq: "monthly", priority: "0.8" },
      { path: "/services", changefreq: "monthly", priority: "0.9" },
      { path: "/jobs", changefreq: "daily", priority: "0.9" },
      { path: "/blogs", changefreq: "weekly", priority: "0.8" },
      { path: "/testimonials", changefreq: "monthly", priority: "0.6" },
      { path: "/partners", changefreq: "monthly", priority: "0.7" },
      { path: "/contact", changefreq: "monthly", priority: "0.8" },
      { path: "/upload-cv", changefreq: "monthly", priority: "0.7" }
    ];

    const [blogs, jobs] = await Promise.all([
      Blog.find({ isPublished: true }).select("slug updatedAt publishedAt").sort({ publishedAt: -1 }).limit(500),
      Job.find({ isActive: true }).select("_id updatedAt").sort({ createdAt: -1 }).limit(500)
    ]);

    const urls = [
      ...staticPages.map((page) => urlEntry({ loc: `${SITE_URL}${page.path}`, changefreq: page.changefreq, priority: page.priority })),
      ...blogs.map((blog) => urlEntry({ loc: `${SITE_URL}/blogs/${blog.slug}`, lastmod: blog.updatedAt || blog.publishedAt, changefreq: "weekly", priority: "0.75" })),
      ...jobs.map((job) => urlEntry({ loc: `${SITE_URL}/jobs?job=${job._id}`, lastmod: job.updatedAt, changefreq: "weekly", priority: "0.65" }))
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (error) {
    next(error);
  }
});

export default router;
