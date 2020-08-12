var Redis = require('ioredis');
import { Log } from './../log';
import { Subscriber } from './subscriber';

export class RedisSubscriber implements Subscriber {
    /**
     * Redis pub/sub client.
     *
     * @type {object}
     */
    private _redis: any;

    /**
     *
     * KeyPrefix for used in the redis Connection
     *
     * @type {String}
     */
    private _keyPrefix: string;

    /**
     * Create a new instance of subscriber.
     *
     * @param {any} options
     * @param {any} node
     */
    constructor(private options, private node) {
        this._keyPrefix = node.prefix || '';
        this._redis = new Redis(node);
        // this._redis.hset("echo-server-set", this._keyPrefix, options.public);
        // if (node.world) {
        //     this._redis.sadd(node.world + "-echo-server", options.public);
        // } else {
        //     node.world = '';
        // }
    }

    /**
     * Subscribe to events to broadcast.
     *
     * @return {Promise<any>}
     */
    subscribe(callback): Promise<any> {

        return new Promise((resolve, reject) => {
            this._redis.on('message', (channel, message) => {
                try {
                    message = JSON.parse(message);

                    if (this.options.devMode) {
                        Log.info("Channel: " + channel);
                        Log.info("Event: " + message.event);
                        Log.info("Event: " + message.data);
                    }

                    callback(channel, message);
                } catch (e) {
                    if (this.options.devMode) {
                        Log.info("No JSON message");
                    }
                }
            });

            // this._redis.psubscribe(`${this._keyPrefix}*`, (err, count) => {
            //     if (err) {
            //         reject('Redis could not subscribe.')
            //     }

                Log.success('Listening for redis events...');

                resolve();
            // });
        });
    }

    /**
     * Unsubscribe from events to broadcast.
     *
     * @return {Promise}
     */
    unsubscribe(): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                this._redis.disconnect();
                resolve();
            } catch(e) {
                reject('Could not disconnect from redis -> ' + e);
            }
        });
    }

    subscribeChannel(channel:string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (channel.startsWith(this.node.world)) {
                this._redis.subscribe(channel, (err, count) => {
                    if (err) {
                        reject('Redis could not subscribe.')
                    }
                    Log.success('Subscribe channel : ' + channel);
                })
            }
            resolve();
        });
    }

    unsubscribeChannel(channel:string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (channel.startsWith(this.node.world)) {
                this._redis.unsubscribe(channel, (err, count) => {
                    if (err) {
                        reject('Redis could not unsubscribe.')
                    }
                    Log.success('Unsubscribe channel : ' + channel);
                });
            }
            resolve();
        });
    }
}
