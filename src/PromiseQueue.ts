//jshint esversion:8
//jshint node:true
/**
 * Promise Queue class
 * @date 12/16/2019
 * @author Michael A. Leonetti
 * @copyright Sonarcloud, 2019
 */

type ItemType<ItemResultType> =
        | (() => PromiseLike<ItemResultType>)
        | (() => ItemResultType);

export default class PromiseQueue {
        // Our queue
        private queueEnd: Promise<any> = Promise.resolve();

        /**
         * Append to queue
         */
        _append<ItemResultType>(item: ItemType<ItemResultType>): Promise<ItemResultType> {
                // Wrap the item
                let wrapped;

                // Wrap a promise in a promise of a promise?
                // I guess this only works because promise executes immediately
                const p = new Promise<ItemResultType>((resolve, reject) => {
                        wrapped = async () => {
                                try {
                                        // Call the function
                                        resolve(item());
                                }
                                catch (e) {
                                        // Throw it
                                        reject(e);
                                }
                        };
                });

                // Add to the queue end
                this.queueEnd.then(wrapped);

                // Set the end to our promise
                this.queueEnd = p.catch(e => {
                        // Should we stop on the next catch?
                        console.error("Promise chain termination.", e);
                });

                return (p);
        }

        /**
         * Queue and get the promise
         */
        queue<ItemResultType>(item: ItemType<ItemResultType>): Promise<ItemResultType> {
                return (this._append(item));
        }

        /**
         * Enqueue a function
         */
        chain<ItemResultType>(item: ItemType<ItemResultType>): PromiseQueue {
                // Append it to the queue
                this._append(item);

                // Rreturn the promise also
                return (this);
        }
}