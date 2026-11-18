export type EmoteScope = "self" | "duo" | "all";
export type EmoteDef = { id: string; icon: string; label: string; anim: string; scope: EmoteScope; dark?: boolean; tag?: string };

export const ALL_EMOTES: EmoteDef[] = [
  { id: "love", icon: "❤️", label: "Love", anim: "", scope: "self" },
  { id: "kiss", icon: "💋", label: "Cium", anim: "", scope: "self" },
  { id: "salting", icon: "😖", label: "Salting", anim: "emo-shake", scope: "self" },
  { id: "dance", icon: "💃", label: "Joget", anim: "emo-dance", scope: "self" },
  { id: "laugh", icon: "🤣", label: "Ngakak", anim: "emo-bounce", scope: "self" },
  { id: "cry", icon: "😭", label: "Nangis", anim: "emo-sad", scope: "self" },
  { id: "angry", icon: "😡", label: "Marah", anim: "emo-shake", scope: "self" },
  { id: "spin", icon: "🌀", label: "Putar", anim: "emo-spin", scope: "self" },
  { id: "dark", icon: "💀", label: "Raja Gelap", anim: "emo-dark", scope: "self", dark: true, tag: "2 JUTA" },
  { id: "shadow", icon: "🦇", label: "Bayangan", anim: "emo-dark emo-float", scope: "self", dark: true, tag: "2 JUTA" },
  { id: "bucin", icon: "🥰", label: "Bucin", anim: "emo-bounce", scope: "self", tag: "BUCIN" },
  { id: "party", icon: "🎉", label: "Joget Massal", anim: "emo-dance", scope: "all", tag: "1 LOBI" },
  { id: "couple", icon: "💞", label: "Bucin Berdua", anim: "emo-sway", scope: "duo", tag: "2 LOBI" },
];

export const MAX_LOADOUT = 7;
export const DEFAULT_LOADOUT = ["love", "kiss", "salting", "dance", "laugh", "party", "couple"];
export const emoteById = (id: string) => ALL_EMOTES.find((e) => e.id === id);

/** Tap an emote in the Vault: remove it if equipped, add it if there is room. */
export function toggleLoadout(cur: string[], id: string): string[] {
  if (cur.includes(id)) return cur.filter((x) => x !== id);
  if (cur.length >= MAX_LOADOUT || !emoteById(id)) return cur;
  return [...cur, id];
}
export function cleanLoadout(raw: unknown): string[] {
  if (!Array.isArray(raw)) return DEFAULT_LOADOUT;
  const ids = [...new Set(raw.filter((x): x is string => typeof x === "string" && !!emoteById(x)))].slice(0, MAX_LOADOUT);
  return ids.length ? ids : DEFAULT_LOADOUT;
}
