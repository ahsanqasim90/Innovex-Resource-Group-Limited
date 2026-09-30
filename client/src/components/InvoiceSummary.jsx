import { useState } from "react";
import { CalendarClock, Download, FileSpreadsheet, FileText } from "lucide-react";
import { api, downloadFile } from "../api/client.js";
import "../styles/invoice-summary.css";

const localDate = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const dateLabel = (value) => new Date(value).toLocaleDateString("en-GB", { timeZone: "UTC" });
const money = (value, currency) => `${currency} ${Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InvoiceSummary() {
  const [dateFrom, setDateFrom] = useState(() => localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [dateTo, setDateTo] = useState(() => localDate(new Date()));
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const invalid = !dateFrom || !dateTo || dateFrom > dateTo;
  const changeDate = (setter, value) => { setter(value); setSummary(null); setError(""); };
  const generate = async (event) => {
    event.preventDefault();
    if (invalid || busy) return;
    setBusy("generate"); setError(""); setSummary(null);
    try {
      setSummary(await api(`/finance/invoices/summary?${new URLSearchParams({ dateFrom, dateTo })}`));
    } catch (failure) { setError(failure.message); }
    finally { setBusy(""); }
  };
  const download = async (format = "pdf") => {
    if (!summary || busy) return;
    setBusy(format); setError("");
    try {
      await downloadFile(`/finance/invoices/summary.${format}?${new URLSearchParams({ dateFrom: summary.dateFrom, dateTo: summary.dateTo })}`, `Invoice-Summary-${summary.dateFrom}-to-${summary.dateTo}.${format}`);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(""); }
  };

  return <section className="finance-panel invoice-summary" aria-labelledby="invoice-summary-title" aria-busy={Boolean(busy)}>
    <div className="finance-panel-head"><div><span className="eyebrow">Date range report</span><h2 id="invoice-summary-title"><CalendarClock size={22} /> Invoice summary</h2><p>Select invoice issue dates to generate a combined summary. Both dates are included, across all reporting years.</p></div></div>
    <form className="invoice-summary-controls" onSubmit={generate}>
      <label htmlFor="invoice-summary-from">From date<input id="invoice-summary-from" type="date" required max={dateTo || undefined} value={dateFrom} disabled={Boolean(busy)} onChange={(event) => changeDate(setDateFrom, event.target.value)} /></label>
      <label htmlFor="invoice-summary-to">To date<input id="invoice-summary-to" type="date" required min={dateFrom || undefined} value={dateTo} disabled={Boolean(busy)} onChange={(event) => changeDate(setDateTo, event.target.value)} /></label>
      <button className="button" type="submit" disabled={invalid || Boolean(busy)}><FileText size={17} /> {busy === "generate" ? "Generating..." : "Generate summary"}</button>
      {summary && <button className="button secondary" type="button" disabled={Boolean(busy)} onClick={() => download("pdf")}><Download size={17} /> {busy === "pdf" ? "Downloading..." : "Download PDF"}</button>}
      {summary && <button className="button secondary" type="button" disabled={Boolean(busy)} onClick={() => download("xls")}><FileSpreadsheet size={17} /> {busy === "xls" ? "Downloading..." : "Download Excel"}</button>}
    </form>
    {dateFrom && dateTo && dateFrom > dateTo && <p className="invoice-summary-error" role="alert">End date must be on or after the start date.</p>}
    {error && <p className="invoice-summary-error" role="alert">{error}</p>}
    {summary && <div className="invoice-summary-results">
      <div className="invoice-summary-caption" aria-live="polite"><strong>{dateLabel(summary.dateFrom)} - {dateLabel(summary.dateTo)}</strong><span>{summary.count} invoices · {summary.statuses.Draft || 0} drafts · {summary.statuses.Cancelled || 0} cancelled</span></div>
      <p className="invoice-summary-note">Totals exclude drafts and cancelled invoices. Paid and outstanding show current balances for these invoices, not payments received during the selected period.</p>
      {summary.totals.map((group) => <div key={group.currency} className="invoice-summary-totals" aria-label={`${group.currency} totals`}>
        <div><span>Issued invoices ({group.currency})</span><strong>{group.count}</strong></div>
        {[["Net", "subtotal"], ["VAT", "vatAmount"], ["Invoice total", "total"], ["Paid", "amountPaid"], ["Outstanding", "balanceDue"]].map(([label, field]) => <div key={field}><span>{label}</span><strong>{money(group[field], group.currency)}</strong></div>)}
      </div>)}
      {summary.count ? <div className="table-wrap"><table><caption className="invoice-summary-table-caption">Invoices issued in the selected date range</caption><thead><tr><th scope="col">Invoice</th><th scope="col">Client</th><th scope="col">Issued</th><th scope="col">Due</th><th scope="col">Status</th><th scope="col">Total</th><th scope="col">Paid</th><th scope="col">Outstanding</th></tr></thead><tbody>{summary.invoices.map((invoice) => <tr key={invoice._id}><td><strong>{invoice.invoiceNumber}</strong></td><td>{invoice.clientName}</td><td>{dateLabel(invoice.issueDate)}</td><td>{dateLabel(invoice.dueDate)}</td><td>{invoice.status}</td><td>{money(invoice.total, invoice.currency || "GBP")}</td><td>{money(invoice.amountPaid, invoice.currency || "GBP")}</td><td>{money(invoice.balanceDue, invoice.currency || "GBP")}</td></tr>)}</tbody></table></div> : <div className="finance-empty"><FileText /><strong>No invoices found for these dates</strong><span>Choose another date range to generate a summary.</span></div>}
    </div>}
  </section>;
}
