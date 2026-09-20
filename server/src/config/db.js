import mongoose from "mongoose";
import Organization from "../models/Organization.js";
import { setDefaultOrganization } from "../tenancy/tenantContext.js";

async function ensureDefaultOrganization() {
  const slug = String(process.env.DEFAULT_ORGANIZATION_SLUG || "innovex-resource-group").toLowerCase();
  let organization = await Organization.findOne({ slug });
  if (!organization) {
    organization = await Organization.findOneAndUpdate(
      { slug },
      {
        $setOnInsert: {
        name: process.env.DEFAULT_ORGANIZATION_NAME || "Innovex Resource Group Limited",
        slug,
        legalName: process.env.DEFAULT_ORGANIZATION_NAME || "Innovex Resource Group Limited",
        companyNumber: process.env.COMPANY_NUMBER || "15975820",
        status: "Active",
        contact: {
          email: process.env.CONTACT_EMAIL || "info@innovexresourcegroup.co.uk",
          phone: process.env.CONTACT_PHONE || "+44 330 043 5830"
        },
        subscription: { plan: "Enterprise", status: "Active", seatLimit: 100, storageLimitMb: 10240 },
        onboarding: { status: "Complete", completedSteps: ["profile", "team", "branding", "security"], completedAt: new Date() }
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  setDefaultOrganization(organization);
  return organization;
}

export async function connectDB() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  mongoose.set("strictQuery", true);
  // Atlas SRV records can advertise IPv6 addresses that are unreachable from
  // some serverless regions. Forcing IPv4 avoids a long failed IPv6 attempt
  // before every cold-start connection.
  await mongoose.connect(process.env.MONGO_URI, {
    family: 4,
    serverSelectionTimeoutMS: 12000,
    connectTimeoutMS: 12000,
    socketTimeoutMS: 45000,
    // The dashboard loads several independent summaries in parallel. A pool of
    // ten prevents those reads from queueing behind one another while keeping
    // each serverless instance within a modest Atlas connection budget.
    maxPoolSize: 10,
    minPoolSize: 0
  });
  await ensureDefaultOrganization();
  console.log("MongoDB connected");
  return mongoose.connection;
}
