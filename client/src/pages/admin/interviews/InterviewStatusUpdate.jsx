export default function InterviewStatusUpdate({ form, setForm }) {
  return (
    <div className="status-choice-grid">
      <label>
        <span>Interview stage</span>
        <select value={form.interviewStatus} onChange={(e) => setForm({ ...form, interviewStatus: e.target.value })}>
          <option value="Pending">Pending interview</option>
          <option value="Completed">Interview completed</option>
          <option value="Cancelled">Interview cancelled</option>
        </select>
      </label>
    </div>
  );
}
