import { useEffect, useState } from "react";
import { api, publicAssetUrl } from "../../api/client.js";
import FileUpload from "../../components/FileUpload.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";

const empty = {
  title: "",
  slug: "",
  category: "Healthcare Recruitment",
  excerpt: "",
  content: "",
  metaTitle: "",
  metaDescription: "",
  author: "Innovex Resource Group Limited",
  isPublished: false,
  publishedAt: ""
};

function slugify(value = "") {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toForm(blog = {}) {
  return {
    ...empty,
    ...blog,
    publishedAt: blog.publishedAt ? blog.publishedAt.slice(0, 10) : ""
  };
}

function toFormData(form, formElement) {
  const data = new FormData();
  Object.entries(form).forEach(([key, value]) => data.append(key, value ?? ""));
  data.set("isPublished", String(Boolean(form.isPublished)));
  const file = formElement.elements.featuredImage?.files?.[0];
  if (file) data.append("featuredImage", file);
  return data;
}

export default function AdminBlogs() {
  const [blogs, setBlogs] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api("/blogs?admin=true").then(setBlogs).catch((error) => setStatus({ type: "error", message: error.message }));

  useEffect(() => {
    load();
  }, []);

  async function save(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    try {
      await api(editing ? `/blogs/${editing}` : "/blogs", { method: editing ? "PUT" : "POST", body: toFormData(form, formElement) });
      setStatus({ message: editing ? "Blog updated." : "Blog created." });
      setForm(empty);
      setEditing(null);
      formElement.reset();
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this blog post?")) return;
    try {
      await api(`/blogs/${id}`, { method: "DELETE" });
      setStatus({ message: "Blog deleted." });
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  function edit(blog) {
    setEditing(blog._id);
    setForm(toForm(blog));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <div className="admin-top"><h1>Admin Blogs</h1></div>
      <StatusMessage status={status} />
      <form className="card form blog-admin-form" onSubmit={save}>
        <div className="admin-form-title">
          <div>
            <span className="eyebrow">SEO content</span>
            <h2>{editing ? "Edit blog post" : "Create blog post"}</h2>
          </div>
          {editing && <button type="button" className="button secondary small" onClick={() => { setEditing(null); setForm(empty); }}>Cancel edit</button>}
        </div>
        <div className="form-grid">
          <input placeholder="Blog title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slug || slugify(e.target.value) })} required />
          <input placeholder="URL slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
          <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input placeholder="Author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
          <input placeholder="Meta title (SEO)" value={form.metaTitle} onChange={(e) => setForm({ ...form, metaTitle: e.target.value })} />
          <input placeholder="Meta description (SEO)" value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} />
        </div>
        <textarea placeholder="Short excerpt for cards and meta description" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} required />
        <textarea className="blog-editor" placeholder={"Write blog content here.\n\nUse ## Heading, ### Subheading, - bullet points, and **bold text** for formatting."} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required />
        <div className="form-grid">
          <label><span>Publish date</span><input type="date" value={form.publishedAt} onChange={(e) => setForm({ ...form, publishedAt: e.target.value })} /></label>
          <label className="checkbox-line"><input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} /> Published</label>
        </div>
        <FileUpload name="featuredImage" label="Featured image" prompt="Choose or drag blog image here" helper="Recommended 1200 x 675px, JPG/PNG/WEBP/SVG up to 3MB" accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml" />
        <SubmitButton loading={saving} loadingText="Saving blog...">{editing ? "Update Blog" : "Create Blog"}</SubmitButton>
      </form>

      <div className="table-wrap" style={{ marginTop: 24 }}>
        <table>
          <thead><tr><th>Image</th><th>Title</th><th>Category</th><th>Status</th><th>Published</th><th>Actions</th></tr></thead>
          <tbody>
            {blogs.map((blog) => (
              <tr key={blog._id}>
                <td>{blog.featuredImage?.url ? <img className="admin-logo-thumb" src={publicAssetUrl(blog.featuredImage.url)} alt={`${blog.title} featured`} loading="lazy" /> : <span className="muted">No image</span>}</td>
                <td><strong>{blog.title}</strong><br /><span className="muted">/blogs/{blog.slug}</span></td>
                <td>{blog.category}</td>
                <td>{blog.isPublished ? "Published" : "Draft"}</td>
                <td>{blog.publishedAt ? new Date(blog.publishedAt).toLocaleDateString() : "-"}</td>
                <td className="actions"><button className="button small" onClick={() => edit(blog)}>Edit</button><button className="button secondary small" onClick={() => api(`/blogs/${blog._id}`, { method: "PUT", body: { ...toForm(blog), isPublished: !blog.isPublished } }).then(load).catch((error) => setStatus({ type: "error", message: error.message }))}>Toggle</button><button className="button small" onClick={() => remove(blog._id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
