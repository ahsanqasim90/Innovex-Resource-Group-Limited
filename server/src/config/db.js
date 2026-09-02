import mongoose from "mongoose";
import Organization from "../models/Organization.js";
import { setDefaultOrganizationId } from "../tenancy/tenantContext.js";

async function ensureDefaultOrganization() {
  const slug = String(process.env.DEFAULT_ORGANIZATION_SLUG || "innovex-resource-group").toLowerCase();
  const organization = await Organization.findOneAndUpdate(
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
  setDefaultOrganizationId(organization._id);
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
  await mongoose.connect(process.env.MONGO_URI);
  await ensureDefaultOrganization();
  console.log("MongoDB connected");
  return mongoose.connection;
}
