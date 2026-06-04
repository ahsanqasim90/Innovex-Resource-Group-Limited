import { ArrowRight, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { publicAssetUrl } from "../api/client.js";

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Draft";
}

export default function BlogCard({ blog, featured = false }) {
  return (
    <article className={`blog-card ${featured ? "featured" : ""}`}>
      <Link to={`/blogs/${blog.slug}`} className="blog-image-link" aria-label={`Read ${blog.title}`}>
        {blog.featuredImage?.url ? (
          <img src={publicAssetUrl(blog.featuredImage.url)} alt={blog.title} loading="lazy" />
        ) : (
          <span className="blog-image-placeholder">{blog.category?.slice(0, 2) || "IR"}</span>
        )}
      </Link>
      <div className="blog-card-body">
        <div className="blog-meta-row">
          <span>{blog.category || "Insights"}</span>
          <span><CalendarDays size={15} /> {dateLabel(blog.publishedAt || blog.createdAt)}</span>
        </div>
        <h2><Link to={`/blogs/${blog.slug}`}>{blog.title}</Link></h2>
        <p>{blog.excerpt}</p>
        <Link className="text-link" to={`/blogs/${blog.slug}`}>Read article <ArrowRight size={16} /></Link>
      </div>
    </article>
  );
}
