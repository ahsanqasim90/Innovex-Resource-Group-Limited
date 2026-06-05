import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../api/client.js";
import BlogCard from "../components/BlogCard.jsx";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import { company } from "../data/content.js";

const topics = [
  "Recruitment Tips",
  "Care Home Staffing",
  "Interview Guidance",
  "Website Advice",
  "SEO Growth",
  "Digital Marketing"
];

export default function Blogs() {
  const [blogs, setBlogs] = useState([]);
  const [filters, setFilters] = useState({ search: "", category: "" });
  const [status, setStatus] = useState(null);

  const categories = useMemo(() => [...new Set(blogs.map((blog) => blog.category).filter(Boolean))], [blogs]);

  function loadBlogs() {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    api(`/blogs${query ? `?${query}` : ""}`)
      .then(setBlogs)
      .catch((error) => setStatus({ type: "error", message: error.message }));
  }

  function applyTopic(topic) {
    const nextFilters = { search: topic, category: "" };
    setFilters(nextFilters);
    const query = new URLSearchParams({ search: topic }).toString();
    api(`/blogs?${query}`)
      .then(setBlogs)
      .catch((error) => setStatus({ type: "error", message: error.message }));
  }

  useEffect(() => {
    loadBlogs();
  }, []);

  return (
    <section className="section blog-page">
      <SEO
        title="Insights & Blog"
        path="/blogs"
        description="Read Innovex Resource Group Limited insights on healthcare recruitment, care home staffing, interviews, compliance, websites, SEO, and digital growth."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: `${company.name} Insights`,
          url: `${company.siteUrl}/blogs`,
          description: "Healthcare recruitment, staffing, website, SEO and business growth insights."
        }}
      />
      <div className="blog-hero">
        <SectionHeading eyebrow="Insights" title="Healthcare, recruitment and digital growth insights">
          Practical weekly advice for care providers, candidates, partners, and businesses improving their online visibility.
        </SectionHeading>
        <div className="blog-hero-card">
          <Search size={26} />
          <h3>SEO content hub</h3>
          <p>Fresh articles help Google understand your services, locations, expertise, and authority.</p>
        </div>
      </div>

      <div className="topics-card card">
        <h2>Topics We Cover</h2>
        <div className="chip-cloud">
          {topics.map((topic) => (
            <button
              className="topic-chip"
              type="button"
              key={topic}
              onClick={() => applyTopic(topic)}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      <div className="card filters blog-filters">
        <div className="form-grid">
          <input placeholder="Search articles" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category}>{category}</option>)}
          </select>
          <button className="button" onClick={loadBlogs}>Search Blogs</button>
        </div>
      </div>

      <StatusMessage status={status} />

      {blogs.length === 0 ? (
        <div className="card empty-blog-card">
          <h2>Insights coming soon</h2>
          <p className="muted">The Innovex team is preparing useful articles for care providers, candidates, and business owners.</p>
        </div>
      ) : (
        <div className="blog-grid">
          {blogs.map((blog, index) => <BlogCard key={blog._id} blog={blog} featured={index === 0} />)}
        </div>
      )}
    </section>
  );
}
