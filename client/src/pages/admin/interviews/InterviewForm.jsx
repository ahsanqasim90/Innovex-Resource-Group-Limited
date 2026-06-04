import SubmitButton from "../../../components/SubmitButton.jsx";
import InterviewStatusUpdate from "./InterviewStatusUpdate.jsx";
import PlacementRevenueCalculator from "./PlacementRevenueCalculator.jsx";

export const emptyInterview = {
  candidateName: "",
  candidateEmail: "",
  candidatePhone: "",
  candidatePostcode: "",
  visaStatus: "",
  jobTitle: "",
  clientName: "",
  interviewDate: "",
  interviewTime: "",
  interviewType: "Phone",
  interviewStatus: "Pending",
  notes: "",
  reminderEmailEnabled: true,
  candidateSelected: "Pending",
  feedback: "",
  selectedPayRate: "",
  hoursPerWeek: "",
  shiftType: "",
  placementDate: "",
  placementType: "Flat Fee",
  flatFeeAmount: "",
  percentage: ""
};

export function toInterviewForm(interview = {}) {
  return {
    ...emptyInterview,
    ...interview,
    interviewDate: interview.interviewDate ? interview.interviewDate.slice(0, 10) : "",
    placementDate: interview.placementDate ? interview.placementDate.slice(0, 10) : "",
    selectedPayRate: interview.selectedPayRate || "",
    hoursPerWeek: interview.hoursPerWeek || "",
    flatFeeAmount: interview.flatFeeAmount || "",
    percentage: interview.percentage || ""
  };
}

export default function InterviewForm({ form, setForm, editing, saving, onSubmit, onCancel }) {
  const selected = form.candidateSelected === "Yes";
  const rejected = form.candidateSelected === "No";
  const reminderText = `Reminder: ${form.candidateName || "[Candidate Name]"} has an interview today for ${form.jobTitle || "[Job Title]"} at ${form.interviewTime || "[Interview Time]"} with ${form.clientName || "[Client Name]"}.`;

  return (
    <form className="card form interview-form" onSubmit={onSubmit}>
      <div className="admin-form-title">
        <div>
          <span className="eyebrow">Interview tracker</span>
          <h2>{editing ? "Edit interview" : "Add interview"}</h2>
        </div>
        {editing && <button type="button" className="button secondary small" onClick={onCancel}>Cancel edit</button>}
      </div>
      <div className="interview-form-section">
        <h3>Candidate details</h3>
        <div className="form-grid">
          <input placeholder="Candidate name" value={form.candidateName} onChange={(e) => setForm({ ...form, candidateName: e.target.value })} required />
          <input type="email" placeholder="Candidate email" value={form.candidateEmail} onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })} required />
          <input placeholder="Candidate phone" value={form.candidatePhone} onChange={(e) => setForm({ ...form, candidatePhone: e.target.value })} required />
          <input placeholder="Candidate post code" value={form.candidatePostcode} onChange={(e) => setForm({ ...form, candidatePostcode: e.target.value })} />
          <input placeholder="Visa status" value={form.visaStatus} onChange={(e) => setForm({ ...form, visaStatus: e.target.value })} />
        </div>
      </div>
      <div className="interview-form-section">
        <h3>Interview details</h3>
        <div className="form-grid">
          <input placeholder="Job title" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} required />
          <input placeholder="Client / company name" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} required />
          <input type="date" value={form.interviewDate} onChange={(e) => setForm({ ...form, interviewDate: e.target.value })} required />
          <input type="time" value={form.interviewTime} onChange={(e) => setForm({ ...form, interviewTime: e.target.value })} required />
          <select value={form.interviewType} onChange={(e) => setForm({ ...form, interviewType: e.target.value })}><option>Phone</option><option>Teams</option><option>Zoom</option><option>Face-to-face</option></select>
        </div>
      </div>
      <InterviewStatusUpdate form={form} setForm={setForm} />
      <div className="reminder-preview">
        <label className="checkbox-line"><input type="checkbox" checked={form.reminderEmailEnabled} onChange={(e) => setForm({ ...form, reminderEmailEnabled: e.target.checked })} /> Auto email reminder enabled</label>
        <p>{reminderText}</p>
        <small>Subject: Interview reminder</small>
      </div>

      <div className="placement-section">
        <h3>Outcome tracking</h3>
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
      </div>
      <SubmitButton loading={saving} loadingText="Saving interview...">{editing ? "Update Interview" : "Create Interview"}</SubmitButton>
    </form>
  );
}
