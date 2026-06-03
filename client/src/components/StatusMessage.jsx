export default function StatusMessage({ status }) {
  if (!status) return null;
  return <p className={`status ${status.type || "info"}`}>{status.message}</p>;
}
