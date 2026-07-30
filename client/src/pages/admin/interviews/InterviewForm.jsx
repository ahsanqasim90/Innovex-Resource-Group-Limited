import SubmitButton from "../../../components/SubmitButton.jsx";
import InterviewStatusUpdate from "./InterviewStatusUpdate.jsx";

export const emptyInterview = {
  candidateName: "",
  candidateEmail: "",
  candidatePhone: "",
  candidatePostcode: "",
  visaStatus: "",
  jobTitle: "",
  clientName: "",
  careHomeAddress: "",
  careHomePostcode: "",
  careHomeContactName: "",
  careHomeContactPhone: "",
  interviewInstructions: "",
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
  const reminderText = `Reminder: ${form.candidateName || "[Candidate Name]"} has an interview today for ${form.jobTitle || "[Job Title]"} at ${form.interviewTime || "[Interview Time]"} with ${form.clientName || "[Client Name]"}.`;
  const faceToFace = form.interviewType === "Face-to-face";

  return (
    <form className="card form interview-form" onSubmit={onSubmit}>
      <div className="admin-form-title">
        <div>
          <span className="eyebrow">Interview tracker</span>
          <h2>{editing ? "Edit interview booking" : "Book interview"}</h2>
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
      <div className="interview-form-section">
        <div className="interview-section-heading">
          <div>
            <h3>Care home / interview location</h3>
            <p>These details are included in the candidate confirmation email.</p>
          </div>
          {faceToFace && <span>Required for face-to-face</span>}
        </div>
        <div className="form-grid">
          <textarea
            className="interview-full-field"
            aria-label="Care home full address"
            placeholder="Care home full address"
            value={form.careHomeAddress}
            onChange={(e) => setForm({ ...form, careHomeAddress: e.target.value })}
            required={faceToFace}
          />
          <input
            placeholder="Care home post code"
            value={form.careHomePostcode}
            onChange={(e) => setForm({ ...form, careHomePostcode: e.target.value })}
            required={faceToFace}
          />
          <input placeholder="Contact person at care home" value={form.careHomeContactName} onChange={(e) => setForm({ ...form, careHomeContactName: e.target.value })} />
          <input placeholder="Care home contact number" value={form.careHomeContactPhone} onChange={(e) => setForm({ ...form, careHomeContactPhone: e.target.value })} />
          <textarea
            className="interview-full-field"
            aria-label="Joining or arrival instructions"
            placeholder="Joining link, arrival instructions, parking, who to ask for, or anything the candidate should bring"
            value={form.interviewInstructions}
            onChange={(e) => setForm({ ...form, interviewInstructions: e.target.value })}
          />
        </div>
      </div>
      <InterviewStatusUpdate form={form} setForm={setForm} />
      <div className="confirmation-preview">
        <strong>Candidate confirmation email</strong>
        <p>
          {editing
            ? "This booking has already been created. Updating it will not send a duplicate confirmation email."
            : `A professional booking confirmation will be sent automatically to ${form.candidateEmail || "[Candidate Email]"} when you create this interview.`}
        </p>
        <small>The email clearly confirms the booking and asks the candidate to reply so attendance can be added to Innovex records.</small>
      </div>
      <div className="reminder-preview">
        <label className="checkbox-line"><input type="checkbox" checked={form.reminderEmailEnabled} onChange={(e) => setForm({ ...form, reminderEmailEnabled: e.target.checked })} /> Auto email reminder enabled</label>
        <p>{reminderText}</p>
        <small>Subject: Interview reminder</small>
      </div>
      <SubmitButton loading={saving} loadingText="Saving booking...">{editing ? "Update Booking" : "Create Interview"}</SubmitButton>
    </form>
  );
}
