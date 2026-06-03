import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import Job from "./models/Job.js";
import Partner from "./models/Partner.js";
import Testimonial from "./models/Testimonial.js";
import User from "./models/User.js";

dotenv.config();

await connectDB();

await User.findOneAndUpdate(
  { email: process.env.ADMIN_EMAIL },
  {
    name: "Innovex Admin",
    email: process.env.ADMIN_EMAIL,
    password: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
    role: "admin",
    isActive: true
  },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

if ((await Job.countDocuments()) === 0) {
  await Job.insertMany([
    {
      title: "Registered Nurse",
      location: "Manchester",
      salary: "£21 - £28 per hour",
      type: "Temporary",
      shift: "Days / Nights",
      description: "Support a respected care provider with safe, compassionate nursing cover.",
      requirements: ["NMC registration", "Care home experience", "Right to work in the UK"]
    },
    {
      title: "Senior Care Assistant",
      location: "Birmingham",
      salary: "£13.50 - £16 per hour",
      type: "Permanent",
      shift: "Full time",
      description: "Lead care shifts, support residents, and mentor care assistants."
    },
    {
      title: "Registered Manager",
      location: "Leeds",
      salary: "£45,000 - £55,000",
      type: "Permanent",
      shift: "Office hours",
      description: "Manage compliance, staff leadership, and quality outcomes for a growing care service."
    }
  ]);
}

if ((await Testimonial.countDocuments()) === 0) {
  await Testimonial.insertMany([
    {
      name: "Sarah Mitchell",
      role: "Care Home Manager",
      company: "Northview Care",
      rating: 5,
      message: "Innovex understood our staffing pressures and supplied reliable healthcare professionals quickly.",
      status: "Approved"
    },
    {
      name: "Daniel Okafor",
      role: "Registered Nurse",
      rating: 5,
      message: "The team guided me into a role that matched my skills, rota preferences, and career plans.",
      status: "Approved"
    }
  ]);
}

if ((await Partner.countDocuments()) === 0) {
  await Partner.insertMany([
    { name: "Northview Care", serviceProvided: "Care Home Staffing", location: "Manchester", isActive: true },
    { name: "Harbour Health Group", serviceProvided: "Nurse Placement", location: "Liverpool", isActive: true },
    { name: "Oakbridge Support", serviceProvided: "Reg 44 Visitor Support", location: "Leeds", isActive: true }
  ]);
}

console.log("Seed complete");
process.exit(0);
