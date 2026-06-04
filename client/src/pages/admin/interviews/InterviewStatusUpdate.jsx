export default function InterviewStatusUpdate({ form, setForm }) {
  return (
    <div className="form-grid">
      <select value={form.interviewStatus} onChange={(e) => setForm({ ...form, interviewStatus: e.target.value })}>
        <option>Pending</option>
        <option>Completed</option>
        <option>Cancelled</option>
      </select>
      <select value={form.candidateSelected} onChange={(e) => setForm({ ...form, candidateSelected: e.target.value })}>
        <option>Pending</option>
        <option>Yes</option>
        <option>No</option>
      </select>
    </div>
  );
}
