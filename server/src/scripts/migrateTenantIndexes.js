import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Attendance from "../models/Attendance.js";
import Blog from "../models/Blog.js";
import ClientTerms from "../models/ClientTerms.js";
import CompliancePassport from "../models/CompliancePassport.js";
import Expense from "../models/Expense.js";
import Invoice from "../models/Invoice.js";
import MailboxMessage from "../models/MailboxMessage.js";
import NewsletterCampaign from "../models/NewsletterCampaign.js";
import NewsletterSubscriber from "../models/NewsletterSubscriber.js";
import OfferLetter from "../models/OfferLetter.js";
import PortalAccount from "../models/PortalAccount.js";
import RecruitmentSubmission from "../models/RecruitmentSubmission.js";
import SalarySlip from "../models/SalarySlip.js";
import TrainingQuotation from "../models/TrainingQuotation.js";
import User from "../models/User.js";
import WebLeadCategory from "../models/WebLeadCategory.js";

dotenv.config();

const models = [Attendance, Blog, ClientTerms, CompliancePassport, Expense, Invoice, MailboxMessage, NewsletterCampaign, NewsletterSubscriber, OfferLetter, PortalAccount, RecruitmentSubmission, SalarySlip, TrainingQuotation, User, WebLeadCategory];
const apply = process.argv.includes("--apply");

function unsafeGlobalUnique(index) {
  if (!index.unique || index.name === "_id_") return false;
  return !Object.prototype.hasOwnProperty.call(index.key || {}, "organization");
}

async function migrate() {
  await connectDB();
  const changes = [];
  for (const Model of models) {
    const indexes = await Model.collection.indexes();
    const obsolete = indexes.filter(unsafeGlobalUnique);
    for (const index of obsolete) {
      changes.push({ collection: Model.collection.collectionName, index: index.name, key: index.key });
      if (apply) await Model.collection.dropIndex(index.name);
    }
    if (apply) await Model.createIndexes();
  }

  if (!changes.length) console.log("No obsolete global unique indexes were found.");
  else {
    console.table(changes.map(({ collection, index, key }) => ({ collection, index, key: JSON.stringify(key) })));
    console.log(apply ? "Tenant-aware indexes applied successfully." : "Dry run only. Re-run with --apply during a maintenance window to apply these changes.");
  }
}

migrate()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
