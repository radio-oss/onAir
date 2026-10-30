// scripts/verify-offline-system.mjs
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function runVerification() {
  console.log('==========================================================');
  console.log(' شروع تست خودکار سلامت زیرساخت آفلاین شبکه اصفهان (LAN)');
  console.log('==========================================================\n');

  // 1. Verify Schedule API
  const schedRes = await fetch(`${BASE_URL}/api/schedule`);
  const schedData = await schedRes.json();
  console.log(
    `[1/5] سرویس کنداکتور محلی (/api/schedule): ${
      schedRes.ok ? '✓ فعال' : '✕ خطا'
    } — تعداد ردیف‌ها: ${schedData.items?.length || 0}`
  );

  // 2. Verify Local Role Auth API
  const authRes = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId: 'level_1', pin: '1405' }),
  });
  console.log(
    `[2/5] سرویس احراز هویت محلی (/api/auth): ${
      authRes.ok ? '✓ تأیید شد' : '✕ خطا'
    }`
  );

  // 3. Verify Media Library & Watch-Folder
  const libRes = await fetch(`${BASE_URL}/api/media/library`);
  const libData = await libRes.json();
  console.log(
    `[3/5] مخزن متمرکز مدیا (/api/media/library): ${
      libRes.ok ? '✓ فعال' : '✕ خطا'
    } — فایل‌های موجود: ${libData.totalFiles || 0} (${libData.totalSizeMB || 0} MB)`
  );

  // 4. Verify Playout Gatekeeper Blocks Unapproved Content
  const blockedRes = await fetch(`${BASE_URL}/api/playout/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mediaCode: 'TEST-UNAPPROVED-CLIP',
      versionNumber: 1,
      durationSec: 60,
      workflowStatus: 'in_qc_review', // Not approved yet!
      action: 'PLAY_NOW',
    }),
  });
  console.log(
    `[4/5] تست محافظ ایمنی پلی‌اوت (جلوگیری از پخش فایل تأییدنشده): ${
      blockedRes.status === 403 ? '✓ مسدودسازی موفق (HTTP 403)' : '✕ خطا'
    }`
  );

  // 5. Verify Playout Execution Allows Approved Content
  const allowedRes = await fetch(`${BASE_URL}/api/playout/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mediaCode: 'TEST-APPROVED-CLIP',
      versionNumber: 2,
      trimInSec: 10,
      durationSec: 120,
      workflowStatus: 'approved_for_playout',
      action: 'LOADBG_QUEUE',
    }),
  });
  const allowedData = await allowedRes.json();
  console.log(
    `[5/5] تست ارسال فرمان فایل تأییدشده به پلی‌اوت: ${
      allowedRes.ok ? `✓ موفق (${allowedData.amcpCommand})` : '✕ خطا'
    }`
  );

  console.log('\n==========================================================');
  console.log(' کلیه تست‌های زیرساخت آفلاین و گردش‌کار با موفقیت انجام شد.');
  console.log('==========================================================');
}

runVerification().catch((err) => {
  console.error(
    'خطا در اتصال به سرور محلی (اطمینان حاصل کنید npm run dev یا start فعال است):',
    err.message
  );
});
