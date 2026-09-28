// PLACEHOLDER PRICES — replace with the real tiers. Everything on the pricing
// section is rendered from this file.
export type ChildrenRange = "lt30" | "30_60" | "60_100" | "100_150" | "gt150";

export interface Tier {
  range: ChildrenRange;
  price: number;
  kids: number; // number of little faces drawn on the card
  popular?: boolean;
}

export const currency = "$";

export const tiers: Tier[] = [
  { range: "lt30", price: 50, kids: 3 },
  { range: "30_60", price: 75, kids: 5, popular: true },
  { range: "60_100", price: 100, kids: 7 },
  { range: "100_150", price: 125, kids: 9 },
  { range: "gt150", price: 150, kids: 11 },
];

export const whiteLabelPrice = 30;
