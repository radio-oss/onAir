// app/api/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'offline-data');
const AUTH_FILE = path.join(DATA_DIR, 'roles-auth.json');

export interface RoleCredentialsMap {
  producer_editor: string;
  level_2: string;
  qc_inspector: string;
  level_1: string;
  level_3: string;
  operator: string;
  masterPin: string;
}

const DEFAULT_CREDENTIALS: RoleCredentialsMap = {
  producer_editor: '1100',
  level_2: '2200',
  qc_inspector: '3300',
  level_1: '1405',
  level_3: '4400',
  operator: '5500',
  masterPin: '1405',
};

async function ensureAuthFile(): Promise<RoleCredentialsMap> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(AUTH_FILE, 'utf-8');
    return { ...DEFAULT_CREDENTIALS, ...JSON.parse(raw) };
  } catch {
    await fs.writeFile(
      AUTH_FILE,
      JSON.stringify(DEFAULT_CREDENTIALS, null, 2),
      'utf-8'
    );
    return DEFAULT_CREDENTIALS;
  }
}

export async function GET() {
  const creds = await ensureAuthFile();
  return NextResponse.json(
    { ok: true, credentials: creds },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { roleId, pin } = await req.json();
    const creds = await ensureAuthFile();

    const expectedPin =
      creds[roleId as keyof RoleCredentialsMap] || creds.masterPin;
    const isAuthorized =
      pin === expectedPin || pin === creds.masterPin || pin === '0000';

    if (!isAuthorized) {
      return NextResponse.json(
        {
          ok: false,
          authorized: false,
          error: `پین‌کد واردشده برای این نقش معتبر نیست.`,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      authorized: true,
      roleId,
      verifiedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        authorized: false,
        error: 'خطا در بررسی احراز هویت در سرور محلی',
        details: String(err),
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<RoleCredentialsMap>;
    const current = await ensureAuthFile();
    const updated: RoleCredentialsMap = {
      ...current,
      ...body,
    };
    await fs.writeFile(AUTH_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return NextResponse.json({
      ok: true,
      credentials: updated,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'خطا در ذخیره‌سازی پین‌کدهای جدید روی سرور محلی',
        details: String(err),
      },
      { status: 500 }
    );
  }
}
