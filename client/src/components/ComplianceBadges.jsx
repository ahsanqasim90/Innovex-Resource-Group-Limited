import { BadgeCheck, Building2, ShieldCheck } from "lucide-react";
import { company } from "../data/content.js";

const icons = [Building2, ShieldCheck];

export default function ComplianceBadges({ compact = false }) {
  return (
    <div className={compact ? "compliance-badges compact" : "compliance-badges"}>
      {company.compliance.map((item, index) => {
        const Icon = icons[index] || BadgeCheck;
        return (
          <div className="compliance-badge" key={item}>
            <span className="compliance-badge-seal">
              <Icon size={compact ? 16 : 22} />
            </span>
            <span>
              <strong>Registered</strong>
              <small>{item}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}
