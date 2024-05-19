const net = require('net');

const PORT = 1080;
const AUTH_USERNAME = 'user';
const AUTH_PASSWORD = 'password';

const server = net.createServer((socket) => {
  socket.once('data', (data) => {
    // Чтение приветственного сообщения от клиента
    if (data[0] !== 0x05) {
      socket.end();
      return;
    }

    // Отправляем ответ о поддержке аутентификации (логин/пароль)
    socket.write(Buffer.from([0x05, 0x02]));

    socket.once('data', (authData) => {
      if (authData[0] !== 0x01) {
        socket.end();
        return;
      }

      const usernameLength = authData[1];
      const username = authData.slice(2, 2 + usernameLength).toString();
      const passwordLength = authData[2 + usernameLength];
      const password = authData.slice(3 + usernameLength, 3 + usernameLength + passwordLength).toString();

      if (username !== AUTH_USERNAME || password !== AUTH_PASSWORD) {
        // Аутентификация не удалась
        socket.write(Buffer.from([0x01, 0x01]));
        socket.end();
        return;
      }

      // Аутентификация успешна
      socket.write(Buffer.from([0x01, 0x00]));

      socket.once('data', (request) => {
        if (request[0] !== 0x05 || request[1] !== 0x01 || request[2] !== 0x00) {
          socket.end();
          return;
        }

        // Обработка запроса на соединение (CONNECT)
        const addressType = request[3];
        let address;
        let port;
        let offset;

        if (addressType === 0x01) {
          // IPv4
          address = request.slice(4, 8).join('.');
          port = request.readUInt16BE(8);
          offset = 10;
        } else if (addressType === 0x03) {
          // Доменное имя
          const domainLength = request[4];
          address = request.slice(5, 5 + domainLength).toString();
          port = request.readUInt16BE(5 + domainLength);
          offset = 7 + domainLength;
        } else {
          socket.end();
          return;
        }

        const proxySocket = net.createConnection({ host: address, port: port }, () => {
          socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
          proxySocket.pipe(socket);
          socket.pipe(proxySocket);
        });

        proxySocket.on('error', () => {
          socket.end();
        });
      });
    });
  });

  socket.on('error', () => {
    socket.end();
  });
});

server.listen(PORT, () => {
  console.log(`SOCKS5 proxy server listening on port ${PORT}`);
});
