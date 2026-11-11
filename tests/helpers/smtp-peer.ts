import { createServer, type Socket } from "node:net";

/** Ephemeral loopback-only SMTP peer. It captures/discards synthetic messages and
 * never forwards anything or contacts a third-party mail service. */
export async function smtpPeer(rejectRecipient = false) {
  const sockets = new Set<Socket>();
  const messages: string[] = [];
  let recipients = 0;
  const server = createServer(socket => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.setEncoding("utf8");
    socket.write("220 local-mizan-test ESMTP\r\n");
    let buffered = "", message = "", inData = false;
    socket.on("data", chunk => {
      buffered += chunk;
      while (buffered.includes("\r\n")) {
        const end = buffered.indexOf("\r\n"), line = buffered.slice(0, end);
        buffered = buffered.slice(end + 2);
        if (inData) {
          if (line === ".") { messages.push(message); message = ""; inData = false; socket.write("250 accepted for local test only\r\n"); }
          else message += `${line}\r\n`;
        } else if (/^EHLO|^HELO/i.test(line)) socket.write("250-local-mizan-test\r\n250 8BITMIME\r\n");
        else if (/^MAIL FROM/i.test(line)) socket.write("250 sender OK\r\n");
        else if (/^RCPT TO/i.test(line)) { recipients++; socket.write(rejectRecipient ? "550 synthetic recipient rejected\r\n" : "250 recipient OK\r\n"); }
        else if (/^DATA$/i.test(line)) { inData = true; socket.write("354 end with dot\r\n"); }
        else if (/^QUIT$/i.test(line)) socket.end("221 bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Local SMTP test failed to bind.");
  return {
    url: `smtp://127.0.0.1:${address.port}`, messages, recipients: () => recipients,
    close: async () => { for (const socket of sockets) socket.destroy(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); },
  };
}
