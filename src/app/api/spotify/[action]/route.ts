import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ApiError, config, cookieOptions, readSession, SCOPES, seal, SESSION, STATE, spotify, token, type Session } from "@/lib/spotify/server";
import { lookupBpm } from "@/lib/spotify/reccobeats";
import type { Playback, Track } from "@/lib/spotify/dj";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
const idPattern = /^[a-zA-Z0-9]{22}$/;

async function handle(request: NextRequest, context: Context) {
  const { action } = await context.params;
  let session: Session | null = null;
  let refreshed = false;
  function finish(response: NextResponse) {
    response.headers.set("Cache-Control", "no-store");
    if (refreshed && session) response.cookies.set(SESSION, seal(session), { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
    return response;
  }
  try {
    if (request.method === "POST" && request.headers.get("origin") !== new URL(config().redirectUri).origin) throw new ApiError("Request origin rejected.", 403);
    if (action === "connect" && request.method === "GET") {
      const c = config();
      const state = randomBytes(32).toString("hex");
      const url = new URL("https://accounts.spotify.com/authorize");
      url.search = new URLSearchParams({ client_id: c.clientId, response_type: "code", redirect_uri: c.redirectUri, scope: SCOPES, state, show_dialog: "true" }).toString();
      const response = NextResponse.redirect(url);
      response.cookies.set(STATE, state, { ...cookieOptions, maxAge: 600 });
      return finish(response);
    }
    if (action === "callback" && request.method === "GET") {
      const state = request.nextUrl.searchParams.get("state") ?? "";
      const expected = (await cookies()).get(STATE)?.value ?? "";
      const code = request.nextUrl.searchParams.get("code");
      const response = NextResponse.redirect(new URL("/whoop/music", config().redirectUri));
      response.cookies.set(STATE, "", { ...cookieOptions, maxAge: 0 });
      if (!expected || Buffer.byteLength(state) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(state), Buffer.from(expected)) || !code || request.nextUrl.searchParams.has("error")) {
        response.headers.set("Location", new URL("/whoop/music?spotify_error=authorization_failed", config().redirectUri).toString());
        return finish(response);
      }
      session = await token(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: config().redirectUri }));
      refreshed = true;
      return finish(response);
    }
    if (action === "disconnect" && request.method === "POST") {
      const response = NextResponse.json({ ok: true });
      for (const name of [SESSION, STATE]) response.cookies.set(name, "", { ...cookieOptions, maxAge: 0 });
      return finish(response);
    }
    session = await readSession();
    if (!session) {
      if (action === "status" && request.method === "GET") {
        let configured = true;
        try { config(); } catch { configured = false; }
        return finish(NextResponse.json({ connected: false, configured }));
      }
      throw new ApiError("Connect Spotify first.", 401);
    }
    if (session.expiresAt < Date.now() + 60_000) {
      session = await token(new URLSearchParams({ grant_type: "refresh_token", refresh_token: session.refreshToken }), session);
      refreshed = true;
    }
    if (request.method === "GET") {
      if (action === "status") {
        const me = await spotify<{ id: string; display_name?: string }>(session, "me");
        return finish(NextResponse.json({ connected: true, configured: true, id: me.id, name: me.display_name ?? me.id }));
      }
      if (action === "playlists") {
        const offset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new ApiError("Invalid playlist offset.", 400);
        const page = await spotify<{ items: ({ id: string; name: string; owner?: { id: string }; collaborative?: boolean } | null)[]; next: string | null }>(session, `me/playlists?limit=50&offset=${offset}`);
        const me = await spotify<{ id: string }>(session, "me");
        return finish(NextResponse.json({ playlists: page.items.flatMap(p => p && idPattern.test(p.id) ? [{ id: p.id, name: p.name, importable: p.owner?.id === me.id || p.collaborative === true }] : []), nextOffset: page.next ? offset + 50 : null }));
      }
      if (action === "playlist-tracks") {
        const id = request.nextUrl.searchParams.get("id") ?? "";
        const offset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
        if (!idPattern.test(id) || !Number.isSafeInteger(offset) || offset < 0) throw new ApiError("Invalid playlist or offset.", 400);
        type Item = Track & { type?: string };
        const page = await spotify<{ items: { item?: Item | null; track?: Item | null }[]; next: string | null; total: number }>(session, `playlists/${id}/items?limit=50&offset=${offset}`);
        const tracks = page.items.flatMap(entry => {
          const t = entry.item ?? entry.track;
          return t && idPattern.test(t.id) && t.uri === `spotify:track:${t.id}` && !t.is_local && t.is_playable !== false && (!t.type || t.type === "track") ? [t] : [];
        });
        return finish(NextResponse.json({ tracks, nextOffset: page.next ? offset + 50 : null, total: page.total }));
      }
      if (action === "library") {
        const offset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
        if (!Number.isSafeInteger(offset) || offset < 0) throw new ApiError("Invalid library offset.", 400);
        const page = await spotify<{ items: { track: Track | null }[]; next: string | null; total: number }>(session, `me/tracks?limit=50&offset=${offset}`);
        return finish(NextResponse.json({ tracks: page.items.flatMap(x => x.track && idPattern.test(x.track.id) && !x.track.is_local ? [x.track] : []), nextOffset: page.next ? offset + 50 : null, total: page.total }));
      }
      if (action === "bpm") {
        const id = request.nextUrl.searchParams.get("id") ?? "";
        if (!idPattern.test(id)) throw new ApiError("Invalid track ID.", 400);
        return finish(NextResponse.json({ bpm: await lookupBpm(id), provider: "reccobeats", fetchedAt: Date.now() }));
      }
      if (action === "playback") return finish(NextResponse.json(await spotify(session, "me/player")));
    }
    if (request.method === "POST" && ["queue", "play", "pause"].includes(action)) {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Expected a JSON object.", 400);
      if (action === "pause") {
        await spotify(session, "me/player/pause", "PUT");
        return finish(NextResponse.json({ ok: true }));
      }
      if (!idPattern.test(body.id ?? "")) throw new ApiError("Invalid track ID.", 400);
      const uri = `spotify:track:${body.id}`;
      if (action === "play") {
        await spotify(session, "me/player/play", "PUT", { uris: [uri] });
        return finish(NextResponse.json({ ok: true }));
      }
      const playback = await spotify<Playback | null>(session, "me/player");
      if (!playback?.item || playback.item.id !== body.currentId || playback.device.id !== body.deviceId || !playback.is_playing) throw new ApiError("Playback changed. The next song was not queued.", 409);
      if (playback.repeat_state !== "off" || playback.shuffle_state) throw new ApiError("Turn off repeat and shuffle in Spotify before starting the DJ.", 409);
      const queue = await spotify<{ queue: Track[] }>(session, "me/player/queue");
      if (queue.queue[0]?.uri === uri) return finish(NextResponse.json({ ok: true, alreadyQueued: true }));
      if (queue.queue.length) throw new ApiError("Spotify already has upcoming songs. Clear the queue and start a single song before restarting the DJ.", 409);
      await spotify(session, `me/player/queue?uri=${encodeURIComponent(uri)}&device_id=${encodeURIComponent(playback.device.id)}`, "POST");
      // Never retry a mutation automatically: a timeout may mean Spotify accepted it.
      const after = await spotify<{ queue: Track[] }>(session, "me/player/queue");
      if (after.queue[0]?.uri !== uri) throw new ApiError("Could not confirm the next song. Check Spotify's queue before restarting the DJ.", 409);
      return finish(NextResponse.json({ ok: true }));
    }
    throw new ApiError("Unknown Spotify operation.", 404);
  } catch (error) {
    if (action === "callback" || action === "connect") {
      const response = NextResponse.redirect(new URL("/whoop/music?spotify_error=authorization_failed", request.url));
      response.cookies.set(STATE, "", { ...cookieOptions, maxAge: 0 });
      return finish(response);
    }
    const known = error instanceof ApiError;
    return finish(NextResponse.json({ error: known ? error.message : "Connection failed. Check Spotify's queue before retrying playback commands." }, { status: known ? error.status : 502, headers: known && error.retryAfter ? { "Retry-After": error.retryAfter } : undefined }));
  }
}

export const GET = handle;
export const POST = handle;
