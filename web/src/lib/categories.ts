export const categoryLabels: Record<string, string> = {
  tax: "Tax",
  legal: "Legal",
  finance: "Finance",
  "software-development": "Development",
  "data-analysis": "Data Analysis",
  marketing: "Marketing",
  research: "Research",
  writing: "Writing",
  design: "Design",
  "customer-support": "Support",
  sales: "Sales",
  "hr-recruiting": "HR & Recruiting",
  operations: "Operations",
  security: "Security",
  other: "Other",
};

export function getCategoryLabel(category: string): string {
  return categoryLabels[category] || category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
