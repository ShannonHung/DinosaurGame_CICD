var express = require('express'),
    http = require('http'),
    app = express(),
    server = http.createServer(app),
    port = process.env.PORT || 3001;

server.listen(port);
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});
// Log that the servers running
console.log("Server running on port: " + port);


// Socket operations
var io = require('socket.io').listen(server);
var game_sockets = {};
var controller_sockets = {};
io.sockets.on('connection', function (socket) {
    // Getting the localhost adress
    socket.on('load_ip', function () {
        var os = require('os');
        var networkInterfaces = os.networkInterfaces();
        var etho = networkInterfaces.eth0[0].address;
        socket.emit('host_id', etho);
    });

    socket.on('controller_connect', function (game_socket_id) {
        if (game_sockets[game_socket_id] && !game_sockets[game_socket_id].controller_id) {
            console.log("Controller connected");
            controller_sockets[socket.id] = {
                socket: socket,
                game_id: game_socket_id
            };
            game_sockets[game_socket_id].controller_id = socket.id;
            game_sockets[game_socket_id].socket.emit("controller_connected", true);
            // Forward the changes onto the relative game socket
            socket.on('controller_state_change', function (data) {
                if (game_sockets[game_socket_id]) {
                    // Notify relevant game socket of controller state change
                    game_sockets[game_socket_id].socket.emit("controller_state_change", data)
                }
            });
            socket.emit("controller_connected", true);
        } else {
            console.log("Controller attempted to connect but failed");
            socket.emit("controller_connected", false);
        }
    });

    socket.on('disconnect', function () {
        // Game
        if (game_sockets[socket.id]) {
            console.log("Game disconnected");
            if (controller_sockets[game_sockets[socket.id].controller_id]) {
                controller_sockets[game_sockets[socket.id].controller_id].socket.emit("controller_connected", false);
                controller_sockets[game_sockets[socket.id].controller_id].game_id = undefined;
            }
            delete game_sockets[socket.id];
        }
        // Controller
        if (controller_sockets[socket.id]) {
            console.log("Controller disconnected");
            if (game_sockets[controller_sockets[socket.id].game_id]) {
                game_sockets[controller_sockets[socket.id].game_id].socket.emit("controller_connected", false);
                game_sockets[controller_sockets[socket.id].game_id].controller_id = undefined;
            }
            delete controller_sockets[socket.id];
        }
    });

    socket.on('game_connect', function () {
        console.log("Game connected");
        game_sockets[socket.id] = {
            socket: socket,
            controller_id: undefined
        };
        socket.emit("game_connected");
    });
});

app.use("/resources", express.static(__dirname + '/resources'));
app.use("/static", express.static('./static/'));
