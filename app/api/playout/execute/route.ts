// app/api/playout/execute/route.ts
import { NextRequest, NextResponse } from 'next/server';
import net from 'net';

interface PlayoutExecuteRequest {
  host?: string;
  port?: number;
  channel?: number;
  layer?: number;
  mediaCode: string;
  versionNumber: number;
  trimInSec?: number;
  durationSec: number;
  workflowStatus: string;
  action: 'PLAY_NOW' | 'LOADBG_QUEUE' | 'STOP' | 'STANDBY_FILLER';
}

const APPROVED_STAGES = new Set(['approved_for_playout', 'on_air', 'aired']);

function sendAMCPCommandOverTCP(
  host: string,
  port: number,
  command: string,
  timeoutMs = 1500
): Promise<{ connected: boolean; response: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let responseData = '';
    let settled = false;

    const finish = (connected: boolean, response: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ connected, response });
    };

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      socket.write(`${command}\r\n`);
    });

    socket.on('data', (chunk) => {
      responseData += chunk.toString('utf-8');
      if (responseData.includes('\r\n')) {
        finish(true, responseData.trim());
      }
    });

    socket.on('timeout', () => {
      finish(
        false,
        'پاسخی از سرور سخت‌افزاری CasparCG در مهلت مقرر دریافت نشد (حالت شبیه‌ساز محلی فعال است).'
      );
    });

    socket.on('error', (err) => {
      finish(
        false,
        `عدم اتصال فیزیکی به پورت سوکت پلی‌اوت (${host}:${port}): ${err.message}`
      );
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PlayoutExecuteRequest;
    const host = body.host || process.env.PLAYOUT_SERVER_HOST || '127.0.0.1';
    const port = Number(body.port || process.env.PLAYOUT_SERVER_PORT || 5250);
    const channel = body.channel || 1;
    const layer = body.layer || 10;
    const fps = 25;

    // Server-side safety gatekeeper: block unapproved files from hardware execution
    if (
      (body.action === 'PLAY_NOW' || body.action === 'LOADBG_QUEUE') &&
      !APPROVED_STAGES.has(body.workflowStatus)
    ) {
      return NextResponse.json(
        {
          ok: false,
          blockedByGatekeeper: true,
          error:
            'خطای ایمنی سرور پلی‌اوت: ارسال فایل به زنجیره پخش مسدود شد؛ این پرونده هنوز مراحل تأیید نهایی شبکه را نگذرانده است.',
        },
        { status: 403 }
      );
    }

    const seekFrames = Math.max(0, Math.round((body.trimInSec || 0) * fps));
    const lengthFrames = Math.max(25, Math.round((body.durationSec || 60) * fps));
    const clipIdentifier = `${body.mediaCode}_v${body.versionNumber || 1}`;

    let amcpCommand = '';
    if (body.action === 'PLAY_NOW') {
      amcpCommand = `PLAY ${channel}-${layer} "${clipIdentifier}" SEEK ${seekFrames} LENGTH ${lengthFrames}`;
    } else if (body.action === 'LOADBG_QUEUE') {
      amcpCommand = `LOADBG ${channel}-${layer} "${clipIdentifier}" SEEK ${seekFrames} LENGTH ${lengthFrames} AUTO`;
    } else if (body.action === 'STANDBY_FILLER') {
      amcpCommand = `PLAY ${channel}-${layer} "IRIB_ISFAHAN_STANDBY_FILLER" LOOP`;
    } else {
      amcpCommand = `STOP ${channel}-${layer}`;
    }

    const tcpResult = await sendAMCPCommandOverTCP(host, port, amcpCommand);

    return NextResponse.json({
      ok: true,
      hardwareConnected: tcpResult.connected,
      targetEndpoint: `${host}:${port}`,
      amcpCommand,
      serverResponse: tcpResult.response,
      executedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'خطا در پردازش فرمان پلی‌اوت در سرور محلی',
        details: String(err),
      },
      { status: 500 }
    );
  }
}
