// app/api/audit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'offline-data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-trail.json');

export interface ServerAuditEntry {
  id: string;
  timestamp: string;
  actorRole: string;
  actorName: string;
  itemOrder?: number;
  mediaCode?: string;
  itemTitle?: string;
  versionNumber?: number;
  fromStage?: string;
  toStage?: string;
  actionType:
    | 'UPLOAD_VERSION'
    | 'WORKFLOW_TRANSITION'
    | 'PLAYOUT_TRIM'
    | 'PLAYOUT_EXECUTE'
    | 'ROLE_AUTH'
    | 'SCHEDULE_UPDATE';
  details: string;
}

async function readAuditFile(): Promise<ServerAuditEntry[]> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(AUDIT_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const logs = await readAuditFile();
  return NextResponse.json(
    { ok: true, count: logs.length, logs },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ServerAuditEntry>;
    const existing = await readAuditFile();

    const newEntry: ServerAuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleString('fa-IR'),
      actorRole: body.actorRole || 'level_1',
      actorName: body.actorName || 'کاربر سامانه',
      itemOrder: body.itemOrder,
      mediaCode: body.mediaCode,
      itemTitle: body.itemTitle,
      versionNumber: body.versionNumber || 1,
      fromStage: body.fromStage,
      toStage: body.toStage,
      actionType: body.actionType || 'WORKFLOW_TRANSITION',
      details: body.details || '',
    };

    const updated = [newEntry, ...existing].slice(0, 1000);
    await fs.writeFile(AUDIT_FILE, JSON.stringify(updated, null, 2), 'utf-8');

    return NextResponse.json({ ok: true, entry: newEntry });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to append server audit log',
        details: String(err),
      },
      { status: 500 }
    );
  }
}
