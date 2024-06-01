const net = require('net');

const PORT = 1080; // Укажите нужный порт

const server = net.createServer((clientSocket) => {
  clientSocket.once('data', (data) => {
    if (data[0] !== 0x05) {
      clientSocket.end();
      return;
    }

    clientSocket.write(Buffer.from([0x05, 0x00]));

    clientSocket.once('data', (request) => {
      if (request[1] !== 0x01) {
        clientSocket.end();
        return;
      }

      let address;
      let port;
      let offset;

      if (request[3] === 0x01) {
        // IPv4
        address = request.slice(4, 8).join('.');
        port = request.readUInt16BE(8);
        offset = 10;
      } else if (request[3] === 0x03) {
        // Доменное имя
        const domainLength = request[4];
        address = request.slice(5, 5 + domainLength).toString();
        port = request.readUInt16BE(5 + domainLength);
        offset = 7 + domainLength;
      } else if (request[3] === 0x04) {
        // IPv6
        address = Array.from(request.slice(4, 20)).map(b => b.toString(16).padStart(2, '0')).join(':');
        port = request.readUInt16BE(20);
        offset = 22;
      } else {
        clientSocket.end();
        return;
      }

      const serverSocket = net.createConnection({ host: address, port: port }, () => {
        clientSocket.write(
          Buffer.from([0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
        );

        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
      });

      serverSocket.on('error', () => {
        clientSocket.end();
      });
    });
  });

  clientSocket.on('error', () => {
    clientSocket.end();
  });
});

server.listen(PORT, () => {
  console.log(`SOCKS proxy server listening on port ${PORT}`);
});

