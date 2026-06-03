import { useEffect, useState } from "react";
import { api } from "../../api/client.js";

export default function AdminTestimonials() {
  const [items, setItems] = useState([]);
  const load = () => api("/testimonials?admin=true").then(setItems).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function update(item, status) {
    await api(`/testimonials/${item._id}`, { method: "PUT", body: { ...item, status } });
    load();
  }

  async function remove(id) {
    if (!confirm("Delete this testimonial?")) return;
    await api(`/testimonials/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <div className="admin-top"><h1>Admin Testimonials</h1></div>
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Review</th><th>Rating</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {items.map((item) => <tr key={item._id}><td>{item.name}<br /><span className="muted">{item.role}</span></td><td>{item.message}</td><td>{item.rating}</td><td>{item.status}</td><td className="actions"><button className="button small" onClick={() => update(item, "Approved")}>Approve</button><button className="button secondary small" onClick={() => update(item, "Rejected")}>Reject</button><button className="button small" onClick={() => remove(item._id)}>Delete</button></td></tr>)}
      </tbody></table></div>
    </>
  );
}
