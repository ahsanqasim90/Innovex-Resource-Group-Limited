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

export default function InterviewOutcomePanel({ interview, saving, onSave, showFinance = false }) {
  const [form, setForm] = useState(toOutcomeForm(interview));
  const selected = form.candidateSelected === "Yes";
  const rejected = form.candidateSelected === "No";

  useEffect(() => {
    setForm(toOutcomeForm(interview));
  }, [interview?._id]);

  if (!interview) return null;

  async function submit(event) {
    event.preventDefault();
    const payload = showFinance ? form : {
      candidateSelected: form.candidateSelected,
      feedback: form.feedback,
      shiftType: form.shiftType,
      placementDate: form.placementDate
    };
    await onSave(payload);
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
      {selected && showFinance && (
        <>
          <div className="form-grid">
            <label><span>Pay rate / salary</span><input type="number" min="0" step="0.01" placeholder="e.g. 17" value={form.selectedPayRate} onChange={(e) => setForm({ ...form, selectedPayRate: e.target.value })} /></label>
            <label><span>Hours per week</span><input type="number" min="0" step="0.01" placeholder="e.g. 40" value={form.hoursPerWeek} onChange={(e) => setForm({ ...form, hoursPerWeek: e.target.value })} /></label>
            <label><span>Shift type</span><input placeholder="e.g. Days" value={form.shiftType} onChange={(e) => setForm({ ...form, shiftType: e.target.value })} /></label>
            <label><span>Placement date</span><input type="date" value={form.placementDate} onChange={(e) => setForm({ ...form, placementDate: e.target.value })} /></label>
            <label><span>Placement type</span><select value={form.placementType} onChange={(e) => setForm({ ...form, placementType: e.target.value })}><option>Flat Fee</option><option>Percentage of Annual Salary</option></select></label>
            {form.placementType === "Flat Fee" ? (
              <label><span>Flat fee amount</span><input type="number" min="0" step="0.01" placeholder="e.g. 800" value={form.flatFeeAmount} onChange={(e) => setForm({ ...form, flatFeeAmount: e.target.value })} /></label>
            ) : (
              <label><span>Percentage</span><input type="number" min="0" max="100" step="0.01" placeholder="e.g. 8" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} /></label>
            )}
          </div>
          <PlacementRevenueCalculator form={form} />
        </>
      )}
      {selected && !showFinance && (
        <div className="restricted-finance-note">
          Placement finance is restricted to owner accounts. You can save the candidate outcome here.
        </div>
      )}
      <SubmitButton loading={saving} loadingText="Saving outcome...">Save Outcome</SubmitButton>
    </form>
  );
}
