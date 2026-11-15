export const SPIN_COST = 20;
export const STARTING_DIAMONDS = 200;
export type Rarity = "common" | "rare" | "epic" | "legendary";
export const RARITY: Record<Rarity, { label: string; color: string }> = {
  common: { label: "Common", color: "var(--es-dim, #9ca3af)" },
  rare: { label: "Rare", color: "#60a5fa" },
  epic: { label: "Epic", color: "#c084fc" },
  legendary: { label: "Legendary", color: "#facc15" },
};
export type LuckySkin = { id: string; name: string; body: string; hat: string; rarity: string; active: boolean };
/** Amount an admin may gift in one go: whole number 1..1,000,000. */
export const validGift = (n: number) => Number.isInteger(n) && n > 0 && n <= 1_000_000;
export const canSpin = (diamonds: number) => diamonds >= SPIN_COST;
