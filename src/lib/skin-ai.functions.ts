import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cleanAiSkins, type AiSkin } from "@/lib/skin-ai";

const SYSTEM = `Kamu desainer skin untuk game platformer 2D bergaya Pico Park. Karakter berbentuk kotak dengan warna badan (body) dan warna topi (hat).
Balas HANYA JSON: {"skins":[{"name":"nama skin bahasa Indonesia, maks 30 huruf","body":"#RRGGBB","hat":"#RRGGBB","rarity":"common|rare|epic|legendary","story":"1 kalimat pendek"}]}.
Pilih warna yang kontras dan cocok dengan tema. Skin legendary harus terasa paling mewah.`;

/** Admin-only: asks Groq to design Lucky Royale skins from a theme. */
export const generateSkins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ prompt: z.string().trim().min(2).max(300), count: z.number().int().min(1).max(6) }).parse(d))
  .handler(async ({ data, context }): Promise<{ skins: AiSkin[]; error?: string }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) return { skins: [], error: "Hanya admin." };
    const key = process.env["GROQ_API_KEY"];
    if (!key) return { skins: [], error: "Kunci Groq belum dipasang." };
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          temperature: 0.9,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `Buat ${data.count} skin dengan tema: ${data.prompt}` },
          ],
        }),
      });
      if (!res.ok) {
        console.error("groq", res.status, await res.text());
        return { skins: [], error: res.status === 429 ? "Kuota Groq habis, coba lagi sebentar." : res.status === 401 ? "Kunci Groq ditolak, periksa kuncinya." : "AI sedang bermasalah, coba lagi." };
      }
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const skins = cleanAiSkins(JSON.parse(j.choices?.[0]?.message?.content ?? "{}"), data.count);
      return skins.length ? { skins } : { skins: [], error: "AI tidak memberi skin yang valid, coba ubah idenya." };
    } catch (e) {
      console.error("groq", e);
      return { skins: [], error: "AI sedang bermasalah, coba lagi." };
    }
  });
