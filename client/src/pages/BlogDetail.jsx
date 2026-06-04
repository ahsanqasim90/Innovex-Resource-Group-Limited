import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { api, publicAssetUrl } from "../api/client.js";
import BlogContent from "../components/BlogContent.jsx";
import SEO from "../components/SEO.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import { company } from "../data/content.js";

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "";
}

export default function BlogDetail() {
  const { slug } = useParams();
  const [blog, setBlog] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api(`/blogs/slug/${slug}`)
      .then(setBlog)
      .catch((error) => setStatus({ type: "error", message: error.message }));
  }, [slug]);

  if (status?.type === "error") {
    return (
      <section className="section">
        <SEO title="Blog not found" path={`/blogs/${slug}`} description="The requested Innovex article could not be found." noIndex />
        <StatusMessage status={status} />
        <Link className="button secondary" to="/blogs">Back to Blogs</Link>
      </section>
    );
  }

  if (!blog) {
    return (
      <section className="section">
        <SEO title="Loading Blog" path={`/blogs/${slug}`} description="Loading Innovex Resource Group Limited article." noIndex />
        <div className="card"><p className="muted">Loading article...</p></div>
      </section>
    );
  }

  const imageUrl = blog.featuredImage?.url ? publicAssetUrl(blog.featuredImage.url) : `${company.siteUrl}/Logo.png`;
  const articleUrl = `${company.siteUrl}/blogs/${blog.slug}`;
  const description = blog.metaDescription || blog.excerpt;

  return (
    <article className="section blog-detail-page">
      <SEO
        title={blog.metaTitle || blog.title}
        path={`/blogs/${blog.slug}`}
        description={description}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: blog.title,
          description,
          image: imageUrl,
          datePublished: blog.publishedAt || blog.createdAt,
          dateModified: blog.updatedAt,
          author: { "@type": "Organization", name: blog.author || company.name },
          publisher: {
            "@type": "Organization",
            name: company.name,
            logo: { "@type": "ImageObject", url: `${company.siteUrl}/Logo.png` }
          },
          mainEntityOfPage: articleUrl
        }}
      />
      <Link className="text-link back-link" to="/blogs"><ArrowLeft size={16} /> Back to insights</Link>
      <header className="blog-detail-hero">
        <div>
          <span className="eyebrow">{blog.category || "Insights"}</span>
          <h1>{blog.title}</h1>
          <p>{blog.excerpt}</p>
          <div className="blog-meta-row article-meta">
            <span><CalendarDays size={16} /> {dateLabel(blog.publishedAt || blog.createdAt)}</span>
            <span>{blog.author || company.name}</span>
          </div>
        </div>
        <div className="blog-detail-image">
          {blog.featuredImage?.url ? <img src={imageUrl} alt={blog.title} loading="eager" /> : <span>{blog.category?.slice(0, 2) || "IR"}</span>}
        </div>
      </header>
      <div className="blog-article-shell">
        <BlogContent content={blog.content} />
        <aside className="blog-cta-card">
          <h3>Need recruitment, website or SEO support?</h3>
          <p>Talk to Innovex about staffing, candidate support, websites, and Google visibility.</p>
          <Link className="button" to="/contact">Contact Innovex</Link>
        </aside>
      </div>
    </article>
  );
}
