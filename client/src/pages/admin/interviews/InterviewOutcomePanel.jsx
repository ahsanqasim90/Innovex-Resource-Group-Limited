import { useEffect, useState } from "react";
import SubmitButton from "../../../components/SubmitButton.jsx";
import PlacementRevenueCalculator from "./PlacementRevenueCalculator.jsx";

function toOutcomeForm(interview) {
  return {
    candidateSelected: interview?.candidateSelected || "Pending",
    feedback: interview?.feedback || "",
    selectedPayRate: interview?.selectedPayRate || "",
    hoursPerWeek: interview?.hoursPerWeek || "",
    shiftType: interview?.shiftType || "",
    placementDate: interview?.placementDate ? interview.placementDate.slice(0, 10) : "",
    placementType: interview?.placementType || "Flat Fee",
    flatFeeAmount: interview?.flatFeeAmount || "",
    percentage: interview?.percentage || ""
  };
}

export default function InterviewOutcomePanel({ interview, saving, onSave }) {
  const [form, setForm] = useState(toOutcomeForm(interview));
  const selected = form.candidateSelected === "Yes";
  const rejected = form.candidateSelected === "No";

  useEffect(() => {
    setForm(toOutcomeForm(interview));
  }, [interview?._id]);

  if (!interview) return null;

  async function submit(event) {
    event.preventDefault();
    await onSave(form);
  }

  return (
    <form className="placement-section outcome-panel" onSubmit={submit}>
      <div>
        <span className="eyebrow">After interview</span>
        <h3>Outcome & placement tracking</h3>
      </div>
      <label>
        <span>Candidate outcome</span>
        <select value={form.candidateSelected} onChange={(e) => setForm({ ...form, candidateSelected: e.target.value })}>
          <option value="Pending">Awaiting outcome</option>
          <option value="Yes">Selected</option>
          <option value="No">Not selected</option>
        </select>
      </label>
      {rejected && <textarea placeholder="Feedback if not selected" value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} />}
      {selected && (
        <>
          <div className="form-grid">
            <input type="number" min="0" step="0.01" placeholder="Selected pay rate / salary" value={form.selectedPayRate} onChange={(e) => setForm({ ...form, selectedPayRate: e.target.value })} />
            <input type="number" min="0" step="0.01" placeholder="Hours per week" value={form.hoursPerWeek} onChange={(e) => setForm({ ...form, hoursPerWeek: e.target.value })} />
            <input placeholder="Shift type" value={form.shiftType} onChange={(e) => setForm({ ...form, shiftType: e.target.value })} />
            <input type="date" value={form.placementDate} onChange={(e) => setForm({ ...form, placementDate: e.target.value })} />
            <select value={form.placementType} onChange={(e) => setForm({ ...form, placementType: e.target.value })}><option>Flat Fee</option><option>Percentage of Annual Salary</option></select>
            {form.placementType === "Flat Fee" ? (
              <input type="number" min="0" step="0.01" placeholder="Flat fee amount" value={form.flatFeeAmount} onChange={(e) => setForm({ ...form, flatFeeAmount: e.target.value })} />
            ) : (
              <input type="number" min="0" max="100" step="0.01" placeholder="Percentage" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} />
            )}
          </div>
          <PlacementRevenueCalculator form={form} />
        </>
      )}
      <SubmitButton loading={saving} loadingText="Saving outcome...">Save Outcome</SubmitButton>
    </form>
  );
}
