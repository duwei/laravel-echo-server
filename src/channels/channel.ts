import { PresenceChannel } from './presence-channel';
import { PrivateChannel } from './private-channel';
import { Log } from './../log';

export class Channel {
    /**
     * Channels and patters for private channels.
     */
    protected _privateChannels: string[] = ['private-*', 'presence-*'];

    /**
     * Allowed client events
     */
    protected _clientEvents: string[] = ['client-*'];

    /**
     * Private channel instance.
     */
    private: PrivateChannel;

    /**
     * Presence channel instance.
     */
    presence: PresenceChannel;

    /**
     * Create a new channel instance.
     */
    constructor(private io, private options, private subscribers) {
        this.private = new PrivateChannel(options);
        this.presence = new PresenceChannel(io, options);

        if (this.options.devMode) {
            Log.success('Channels are ready.');
        }
    }

    /**
     * Join a channel.
     */
    join(socket, data): void {
        if (data.channel) {
            // if (this.isPrivate(data.channel)) {
            //     this.joinPrivate(socket, data);
            // } else {
            //     socket.join(data.channel);
            //     this.onJoin(socket, data.channel);
            // }
            this.joinAuthChannel(socket, data)
        }
    }

    /**
     * Trigger a client message
     */
    clientEvent(socket, data): void {
        try {
            data = JSON.parse(data);
        } catch (e) {
            data = data;
        }

        if (data.event && data.channel) {
            if (this.isClientEvent(data.event) &&
                this.isPrivate(data.channel) &&
                this.isInChannel(socket, data.channel)) {
                this.io.sockets.connected[socket.id]
                    .broadcast.to(data.channel)
                    .emit(data.event, data.channel, data.data);
            }
        }
    }

    /**
     * Leave a channel.
     */
    leave(socket: any, channel: string, reason: string): void {
        if (channel) {
            if (this.isPresence(channel)) {
                this.presence.leave(socket, channel)
            }

        if (socket) {
            socket.leave(channel);
            }

            if (this.options.devMode) {
                Log.info(`[${new Date().toLocaleTimeString()}] - ${socket.id} left channel: ${channel} (${reason})`);
            }
            socket.emit("leave", channel, reason);

            this.io.of('/').in(channel).clients((error, socketIds) => {
                if (error) throw error;
                if (socketIds.length == 0){
                    this.subscribers.forEach(subscriber => {
                        subscriber.unsubscribeChannel(channel);
                    });
                };
            });
        }
    }

    /**
     * Check if the incoming socket connection is a private channel.
     */
    isPrivate(channel: string): boolean {
        let isPrivate = false;

        this._privateChannels.forEach(privateChannel => {
            let regex = new RegExp(privateChannel.replace('\*', '.*'));
            if (regex.test(channel)) isPrivate = true;
        });

        return isPrivate;
    }

    /**
     * Join private channel, emit data to presence channels.
     */
    joinPrivate(socket: any, data: any): void {
        this.private.authenticate(socket, data).then(res => {
            socket.join(data.channel);

            if (this.isPresence(data.channel)) {
                var member = res.channel_data;
                try {
                    member = JSON.parse(res.channel_data);
                } catch (e) { }

                this.presence.join(socket, data.channel, member);
            }

            this.onJoin(socket, data.channel);
        }, error => {
            if (this.options.devMode) {
                Log.error(error.reason);
            }

            this.io.sockets.to(socket.id)
                .emit('subscription_error', data.channel, error.status);
        });
    }

    /**
     * Join auth server channel
     */
    joinAuthChannel(socket: any, data: any): void {
        this.private.authenticate(socket, data).then(res => {
            if (res.channel_data) {
                this.io.of('/').in(res.channel_data.name).clients((error, socketIds) => {
                    if (error) throw error;
                    let maxClients = res.channel_data.user_info.max_clients || 1;
                    if (maxClients > 0) {
                        for(let i = maxClients-1; i < socketIds.length; i++) {
                            this.leave(this.io.sockets.sockets[socketIds[i]], res.channel_data.name, 'replaced');
                        }
                    }
                    // socketIds.forEach(socketId => this.leave(this.io.sockets.sockets[socketId], res.channel_data.name, 'replaced'));
                    socket.join(res.channel_data.name);

                    this.onJoin(socket, res.channel_data.name);
                });
            } else {
                Log.error(JSON.stringify(res));
                this.io.sockets.to(socket.id)
                    .emit('subscription_error', data.channel, "server internal error");
            }
        }, error => {
            if (this.options.devMode) {
                Log.error(error.reason);
            }

            this.io.sockets.to(socket.id)
                .emit('subscription_error', data.channel, error.status);
        });
    }


    /**
     * Check if a channel is a presence channel.
     */
    isPresence(channel: string): boolean {
        return channel.lastIndexOf('presence-', 0) === 0;
    }

    /**
     * On join a channel log success.
     */
    onJoin(socket: any, channel: string): void {
        if (this.options.devMode) {
            Log.info(`[${new Date().toLocaleTimeString()}] - ${socket.id} joined channel: ${channel}`);
        }
        this.io.of('/').in(channel).clients((error, socketIds) => {
            if (error) throw error;
            if (socketIds.length == 1) {
                this.subscribers.forEach(subscriber => {
                    subscriber.subscribeChannel(channel);
                });
            }
        });
    }

    doSubscribe(channel: string): void {
    }

    doUnsubscribe(channel: string): void {
    }

    /**
     * Check if client is a client event
     */
    isClientEvent(event: string): boolean {
        let isClientEvent = false;

        this._clientEvents.forEach(clientEvent => {
            let regex = new RegExp(clientEvent.replace('\*', '.*'));
            if (regex.test(event)) isClientEvent = true;
        });

        return isClientEvent;
    }

    /**
     * Check if a socket has joined a channel.
     */
    isInChannel(socket: any, channel: string): boolean {
        return !!socket.rooms[channel];
    }
}
