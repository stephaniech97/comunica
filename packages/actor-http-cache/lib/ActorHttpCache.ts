import {ActorHttp, IActionHttp, IActorHttpOutput} from "@comunica/bus-http";
import {IActorArgs, IActorTest} from "@comunica/core";
import {IMediatorTypeTime} from "@comunica/mediatortype-time";
import {ActionObserverHttp} from "./ActionObserverHttp";

/**
 * A comunica Cache Http Actor.
 */
export class ActorHttpCache extends ActorHttp {

  private readonly httpObserver: ActionObserverHttp;

  constructor(args: IActorHttpCacheArgs) {
    super(args);
  }

  public async test(action: IActionHttp): Promise<IMediatorTypeTime> {
    if (!this.httpObserver.isCached(action)) {
      throw new Error(this.name + ' has no valid cache entry (yet) for the given action');
    }
    return { time: 0 };
  }

  public async run(action: IActionHttp): Promise<IActorHttpOutput> {
    return this.httpObserver.getCached(action);
  }

}

export interface IActorHttpCacheArgs extends IActorArgs<IActionHttp, IActorTest, IActorHttpOutput> {
  httpObserver: ActionObserverHttp;
}
