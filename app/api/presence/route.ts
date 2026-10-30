// app/api/presence/route.ts
import { NextRequest, NextResponse } from 'next/server';

export interface ActiveLanSession {
  clientId: string;
  roleId: string;
  roleTitle: string;
  personName: string;
  activeTab: string;
  editingItemId?: string;
  ipAddress: string;
  lastSeenMs: number;
}

// In-memory LAN session registry (auto-expires after 15 seconds of inactivity)
const activeSessions = new Map<string, ActiveLanSession>();
const SESSION_TTL_MS = 15000;

function pruneStaleSessions() {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.lastSeenMs > SESSION_TTL_MS) {
      activeSessions.delete(id);
    }
  }
}

export async function GET() {
  pruneStaleSessions();
  return NextResponse.json(
    {
      ok: true,
      onlineCount: activeSessions.size,
      sessions: Array.from(activeSessions.values()),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  try {
    pruneStaleSessions();
    const body = await req.json();
    const clientId = String(body.clientId || 'local-station');
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : 'LAN-Station';

    const session: ActiveLanSession = {
      clientId,
      roleId: body.roleId || 'level_1',
      roleTitle: body.roleTitle || 'کاربر شبکه',
      personName: body.personName || 'ایستگاه کاری',
      activeTab: body.activeTab || 'schedule',
      editingItemId: body.editingItemId || undefined,
      ipAddress,
      lastSeenMs: Date.now(),
    };

    activeSessions.set(clientId, session);

    return NextResponse.json({
      ok: true,
      onlineCount: activeSessions.size,
      sessions: Array.from(activeSessions.values()),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to update LAN presence',
        details: String(err),
      },
      { status: 500 }
    );
  }
}
