"use strict";
function addPlayer(room, clientId, player) {
  room.players.set(clientId, player);
}

function removePlayer(room, clientId) {
  room.players.delete(clientId);
}

module.exports = { addPlayer, removePlayer };
