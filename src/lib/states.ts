// India's 28 states and 8 union territories, as named in the First Schedule to the
// Constitution after the Jammu and Kashmir Reorganisation Act, 2019 and the merger of
// Dadra and Nagar Haveli and Daman and Diu (26 January 2020). Aliases are common short or
// former names used for search only.

export type Region = { name: string; kind: "State" | "Union territory"; aliases?: string[] };

export const INDIAN_REGIONS: Region[] = [
  { name: "Andaman and Nicobar Islands", kind: "Union territory" },
  { name: "Andhra Pradesh", kind: "State", aliases: ["AP"] },
  { name: "Arunachal Pradesh", kind: "State" },
  { name: "Assam", kind: "State" },
  { name: "Bihar", kind: "State" },
  { name: "Chandigarh", kind: "Union territory" },
  { name: "Chhattisgarh", kind: "State" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", kind: "Union territory" },
  { name: "Delhi", kind: "Union territory", aliases: ["NCT of Delhi", "New Delhi"] },
  { name: "Goa", kind: "State" },
  { name: "Gujarat", kind: "State" },
  { name: "Haryana", kind: "State" },
  { name: "Himachal Pradesh", kind: "State", aliases: ["HP"] },
  { name: "Jammu and Kashmir", kind: "Union territory", aliases: ["J&K", "JK"] },
  { name: "Jharkhand", kind: "State" },
  { name: "Karnataka", kind: "State" },
  { name: "Kerala", kind: "State" },
  { name: "Ladakh", kind: "Union territory" },
  { name: "Lakshadweep", kind: "Union territory" },
  { name: "Madhya Pradesh", kind: "State", aliases: ["MP"] },
  { name: "Maharashtra", kind: "State" },
  { name: "Manipur", kind: "State" },
  { name: "Meghalaya", kind: "State" },
  { name: "Mizoram", kind: "State" },
  { name: "Nagaland", kind: "State" },
  { name: "Odisha", kind: "State", aliases: ["Orissa"] },
  { name: "Puducherry", kind: "Union territory", aliases: ["Pondicherry"] },
  { name: "Punjab", kind: "State" },
  { name: "Rajasthan", kind: "State" },
  { name: "Sikkim", kind: "State" },
  { name: "Tamil Nadu", kind: "State", aliases: ["TN"] },
  { name: "Telangana", kind: "State" },
  { name: "Tripura", kind: "State" },
  { name: "Uttar Pradesh", kind: "State", aliases: ["UP"] },
  { name: "Uttarakhand", kind: "State", aliases: ["Uttaranchal"] },
  { name: "West Bengal", kind: "State", aliases: ["WB"] },
];

const NAMES = new Set(INDIAN_REGIONS.map((r) => r.name));

export function isIndianRegion(value: string): boolean {
  return NAMES.has(value);
}
