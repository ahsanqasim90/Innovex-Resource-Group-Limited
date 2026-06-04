export function calculatePlacementRevenue(form) {
  if (form.candidateSelected !== "Yes") return { annualSalary: 0, revenue: 0 };
  if (form.placementType === "Percentage of Annual Salary") {
    const annualSalary = Number(form.selectedPayRate || 0) * Number(form.hoursPerWeek || 0) * 52;
    return {
      annualSalary,
      revenue: (annualSalary * Number(form.percentage || 0)) / 100
    };
  }
  return { annualSalary: 0, revenue: Number(form.flatFeeAmount || 0) };
}

export default function PlacementRevenueCalculator({ form }) {
  const { annualSalary, revenue } = calculatePlacementRevenue(form);
  return (
    <div className="placement-calculator">
      <div><span>Annual salary</span><strong>£{annualSalary.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div>
      <div><span>Expected revenue</span><strong>£{revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div>
      {form.placementType === "Percentage of Annual Salary" && <small>Calculated as pay rate x hours per week x 52 x percentage.</small>}
    </div>
  );
}
