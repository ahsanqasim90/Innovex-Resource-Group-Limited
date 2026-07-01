# Innovex Finance Centre

## Purpose

Finance Centre is the owner-only invoice and expense workspace inside the Innovex admin portal. It supports operational bookkeeping and accountant handover; it does not replace professional accounting or tax advice.

Innovex uses a reporting year from **1 September to 31 August**. The system assigns each invoice and expense to the correct reporting year automatically.

## Invoice workflow

1. Open **Admin > Finance Centre > Invoices**.
2. Enter the client billing details, invoice date and due date.
3. Add one or more invoice items.
   - Recruitment: enter hourly rate, hours per week, 52 weeks and the service-fee percentage; or enter annual salary directly.
   - Flat-fee recruitment: leave service-fee percentage at zero and enter the flat fee.
   - Training, website, SEO, compliance and other work: enter quantity and unit price.
4. Select the VAT rate shown on the transaction. Do not add VAT unless Innovex is required to charge it.
5. Save the invoice as a draft. Saving a draft does not create or send a PDF.
6. Select the invoice from the register.
7. Use **Download PDF** for review or **Send invoice** to generate the PDF and email it to the billing contact.
8. Record payments by editing **Amount already paid**. The system calculates the balance and changes the status to Partially Paid or Paid.

Only draft invoices can be deleted. Sent invoices should be cancelled instead so the audit trail remains intact.

## Payment reminders

- Automatic reminders start after the due date when reminders are enabled.
- The default frequency is seven days and can be changed per invoice.
- Paid, cancelled and zero-balance invoices are excluded.
- **Send reminder** sends a manual reminder immediately.
- The Vercel cron endpoint runs daily and records each reminder count and date.

## Expense workflow

1. Open **Finance Centre > Expenses**.
2. Record one expense per supplier invoice or receipt.
3. Enter the net amount and the VAT rate printed on the source document.
4. Attach the PDF or image receipt whenever possible.
5. Use Personal Card and Reimbursable only when Innovex owes the employee/director reimbursement.
6. Export the financial-year CSV and provide it with the source documents to the accountant.

Recommended evidence to retain includes sales invoices, supplier invoices, receipts, bank statements, payroll records and contracts. Confirm statutory retention, VAT treatment and filing requirements with the company accountant.

## Access and audit controls

- Finance Centre is visible only to `admin` and `super_admin` accounts.
- The API independently rejects non-owner users even if they manually enter the URL.
- Invoice creation, updates, sends, reminders and deletions are logged.
- Expense creation, updates and deletions are logged.
- Bank details are stored in deployment environment variables and copied into each invoice snapshot.

## Required production environment variables

```env
FINANCE_BANK_ACCOUNT_TITLE=Innovex Resource Group Limited
FINANCE_BANK_NAME=Your bank name
FINANCE_BANK_SORT_CODE=Your sort code
FINANCE_BANK_ACCOUNT_NUMBER=Your account number
FINANCE_BANK_BIC=Your BIC or SWIFT code
CRON_SECRET=use-a-long-random-secret
```

Existing SMTP variables are used for invoice delivery. The selected sender mailbox must already be configured in Email Centre.

Optional numbering and reporting settings:

```env
FINANCIAL_YEAR_START_MONTH=9
INVOICE_START_NUMBER=115
EXPENSE_START_NUMBER=1
```

`INVOICE_START_NUMBER=115` continues numbering after sample invoice `000114`. Once a counter exists in MongoDB, changing this variable does not rewrite existing numbers.
