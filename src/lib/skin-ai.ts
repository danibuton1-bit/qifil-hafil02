import type { Rarity } from "@/lib/economy";

export type AiSkin = { name: string; body: string; hat: string; rarity: Rarity; story: string };
const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Turn the AI's raw JSON into safe skins: valid colors, known rarity, short names, max `max` items. */
export function cleanAiSkins(raw: unknown, max = 6): AiSkin[] {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { skins?: unknown }).skins) ? (raw as { skins: unknown[] }).skins : [];
  const out: AiSkin[] = [];
  for (const it of list) {
    if (!it || typeof it !== "object") continue;
    const r = it as Record<string, unknown>;
    const name = typeof r["name"] === "string" ? r["name"].trim().slice(0, 30) : "";
    const body = typeof r["body"] === "string" ? r["body"].trim() : "";
    const hat = typeof r["hat"] === "string" ? r["hat"].trim() : "";
    const rar = typeof r["rarity"] === "string" ? r["rarity"].toLowerCase() : "";
    if (!name || !HEX.test(body) || !HEX.test(hat)) continue;
    out.push({ name, body: body.toUpperCase(), hat: hat.toUpperCase(), rarity: (RARITIES as string[]).includes(rar) ? (rar as Rarity) : "common", story: typeof r["story"] === "string" ? r["story"].slice(0, 120) : "" });
    if (out.length >= max) break;
  }
  return out;
}
