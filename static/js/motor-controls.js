const socket = io();

socket.on("connect", () => {
  console.log(`Connected: ${socket.id}`);
  socket.emit('json', {data: 'I\'m connected!'});
});

socket.on("disconnect", () => {
  console.log(`Disconnected: ${socket.id}`);
});