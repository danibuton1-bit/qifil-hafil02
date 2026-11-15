<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

<!-- AGENT-MEMORY:BEGIN -->
- Accounts use name+password only: the name maps to a synthetic email via `usernameToEmail` in src/lib/game.ts (auto-confirm on) — never ask for a real email.
- Multiplayer is peer-to-peer over Realtime broadcast/presence (`lobby` channel for invites, `room:<code>` per match); each phone simulates its own player, the inviter (QIFIL) decides level completion — no server game state.
- Game screen lives in src/components/Game.tsx (shared by online /play and offline /solo); solo mode uses the BOT in src/lib/bot.ts and skips Realtime so it works without login or internet.
- Offline PWA: vite-plugin-pwa in vite.config.ts; the service worker is registered only via src/lib/pwa.ts, which refuses dev/preview/iframes — keep /~oauth out of SW caching.
- Diamonds/Lucky Royale: balances and spins change only via security-definer RPCs (spin_lucky, admin_give_diamonds) so clients cannot edit wallets; admin panel lives at a hidden route with no lobby link.
- Lobby world chat (DUNIA) is persisted in `lobby_messages` with a trigger that stamps the sender name from profiles; team chat (TIM) stays broadcast-only on `party:<room>`.
<!-- AGENT-MEMORY:END -->
