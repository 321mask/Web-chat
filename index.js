const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const users = new Map(); // username => ws
const clients = new Map(); // ws => { username, channel }

app.use(express.static("public"));

function broadcastUserList() {
  const users = Array.from(clients.values()).map((u) => u.username);
  for (const [client] of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "userlist",
          users,
        })
      );
    }
  }
}

wss.on("connection", (ws) => {
  clients.set(ws, { username: "Inconnu", channel: "général" });

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    const user = clients.get(ws);

    if (data.type === "username") {
      const user = clients.get(ws);
      if (user) {
        user.username = data.username;
        users.set(data.username, ws);
        broadcastUserList();
      }
      return;
    }

    if (data.type === "switch") {
      user.channel = data.channel;
      return;
    }
    if (data.type === "privateMessage") {
      const targetUser = data.to;
      const currentUser = clients.get(ws)?.username;

      if (
        users.has(targetUser) &&
        users.get(targetUser).readyState === WebSocket.OPEN
      ) {
        users.get(targetUser).send(
          JSON.stringify({
            type: "privateMessage",
            from: currentUser,
            content: data.content,
            timestamp: new Date().toISOString(),
          })
        );
      } else {
        ws.send(
          JSON.stringify({
            type: "system",
            content: `L'utilisateur ${targetUser} n'est pas connecté ou est indisponible.`,
          })
        );
      }
    }

    if (data.type === "chat") {
      const { channel, username } = user;
      for (const [client, meta] of clients) {
        if (client.readyState === WebSocket.OPEN && meta.channel === channel) {
          client.send(
            JSON.stringify({
              type: "chat",
              channel,
              text: `${username}: ${data.text}`,
            })
          );
        }
      }
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    broadcastUserList();
  });
  ws.send(JSON.stringify({ type: "chat", text: "Hello" }));
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
