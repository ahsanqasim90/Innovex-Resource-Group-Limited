export const services = [
  "Healthcare Recruitment",
  "Care Home Staffing",
  "Nurse Placement",
  "Care Assistant Placement",
  "Registered Manager Recruitment",
  "Candidate Screening & Shortlisting",
  "Temporary Staffing",
  "Permanent Recruitment",
  "Reg 44 Visitor Support"
].map((title) => ({
  title,
  description:
    title === "Reg 44 Visitor Support"
      ? "Independent visitor support for care providers who need clear, compliant reporting."
      : "Specialist healthcare recruitment support delivered with speed, compliance, and care-sector knowledge."
}));

export const digitalServices = [
  {
    title: "Website Design & Development",
    description: "Modern, mobile-friendly websites for healthcare providers, recruiters, local businesses, startups, and service companies."
  },
  {
    title: "SEO & Google Visibility",
    description: "Search-focused pages, technical SEO, local SEO, keyword structure, and content improvements to help customers find you online."
  },
  {
    title: "Business Branding & Online Presence",
    description: "Professional layouts, conversion-focused content, social links, contact journeys, and brand presentation for any sector."
  },
  {
    title: "Digital Support Across All Sectors",
    description: "We support care, recruitment, retail, trades, consulting, hospitality, education, and other growing organisations."
  }
];

export const values = ["Compliance first", "Care-led recruitment", "Reliable communication", "Long-term partnerships"];

export const company = {
  name: "Innovex Resource Group Limited",
  siteUrl: "https://www.innovexresourcegroup.co.uk",
  compliance: [
    "Registered with Companies House",
    "Registered with the ICO for data protection"
  ]
};

export const contact = {
  email: "info@innovexresourcegroup.co.uk",
  phone: "+44 3300435830",
  phoneDisplay: "+44 330 043 5830",
  whatsappUrl: "https://wa.me/443300435830",
  address: "33 Forsythia Drive, Cardiff, United Kingdom, CF23 7HP",
  hours: "Monday - Friday, 9:00 - 17:30",
  socials: {
    instagram: "https://www.instagram.com/irg__ltd/",
    facebook: "https://www.facebook.com/profile.php?id=61566587935583",
    twitter: "https://x.com/IRG__LTD",
    linkedin: "https://www.linkedin.com/company/innovex-resource-group/"
  }
};
