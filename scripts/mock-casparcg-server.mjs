// scripts/mock-casparcg-server.mjs
import net from 'net';

const PORT = Number(process.env.PLAYOUT_SERVER_PORT || 5250);
const HOST = '0.0.0.0';

const server = net.createServer((socket) => {
  const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;

  socket.on('data', (data) => {
    const rawCommand = data.toString('utf-8').trim();
    const timestamp = new Date().toLocaleTimeString('fa-IR');
    console.log(`[${timestamp}] [AMCP RX from ${clientAddr}] -> ${rawCommand}`);

    const upper = rawCommand.toUpperCase();
    if (upper.startsWith('PLAY')) {
      socket.write(
        `202 PLAY OK - IRIB ISFAHAN SDI CHANNEL ACTIVE (${rawCommand})\r\n`
      );
    } else if (upper.startsWith('LOADBG')) {
      socket.write(
        `202 LOADBG OK - QUEUED IN BACKGROUND (${rawCommand})\r\n`
      );
    } else if (upper.startsWith('STOP')) {
      socket.write(`202 STOP OK - LAYER CLEARED\r\n`);
    } else if (upper.startsWith('INFO')) {
      socket.write(`201 INFO OK - 1080i5000 PAL/HD READY\r\n`);
    } else {
      socket.write(`202 OK (${rawCommand})\r\n`);
    }
  });

  socket.on('error', () => {
    // Ignore client disconnect errors
  });
});

server.listen(PORT, HOST, () => {
  console.log('================================================================');
  console.log(
    ` سرور سوکت پلی‌اوت (CasparCG AMCP Simulator) روی پورت ${PORT} فعال شد`
  );
  console.log(
    ` آماده دریافت فرامین PLAY / LOADBG / STOP از وب‌اپلیکیشن شبکه اصفهان`
  );
  console.log('================================================================\n');
});
