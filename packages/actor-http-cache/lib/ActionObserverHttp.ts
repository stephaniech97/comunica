import {IActionHttp, IActorHttpOutput} from "@comunica/bus-http";
import {ActionObserver, Actor, IActionObserverArgs, IActorTest} from "@comunica/core";
import LRU = require("lru-cache");
import {ActorHttpCache} from "./ActorHttpCache";

export class ActionObserverHttp extends ActionObserver<IActionHttp, IActorHttpOutput> {

  private static readonly CACHECONTROL_MAXAGE: RegExp = /max-age=\([0-9]*\)/;

  public readonly cacheSize: number;
  private readonly cache: LRU.Cache<string, [number, Response]>;

  constructor(args: IActionObserverHttpArgs) {
    super(args);
    this.cache = this.cacheSize ? new LRU<string, any>({ max: this.cacheSize }) : null;
    if (this.cache) {
      this.bus.subscribeObserver(this);
    }
  }

  public static getTime(): number {
    return new Date().getTime() / 1000;
  }

  public static hashAction(action: IActionHttp): string {
    const options: any = {};
    // input can be a Request object or a string
    // if it is a Request object it can contain the same settings as the init object
    if ((<any> action.input).url) {
      options.url = (<Request> action.input).url;
      Object.assign(options, action.input);
    } else {
      options.url = action.input;
    }

    if (action.init) {
      Object.assign(options, action.init);
    }

    if (options.headers) {
      const headers: any = {};
      (<Headers> options.headers).forEach((val: any, key: any) => {
        headers[key] = val;
      });
      options.headers = headers;
    }

    if (!options.cache) {
      options.cache = 'default';
    }

    options.method = options.method || 'GET';
    return JSON.stringify(options);
  }

  public static getCacheMode(action: IActionHttp): string {
    return (typeof action.input === 'string' ? null : action.input.cache)
      || (action.init ? action.init.cache : null)
      || 'default';
  }

  public static findRegexMatch(regex: RegExp, value: string) {
    const match = regex.exec(value);
    if (match) {
      return match[1];
    }
    return null;
  }

  public static isCacheValueFresh(cacheValue: [number, Response]) {
    return cacheValue && ActionObserverHttp.isFresh(cacheValue[1], ActionObserverHttp.getTime() - cacheValue[0]);
  }

  // TODO: rm, not needed anymore because LRU does this automatically
  public static isFresh(response: Response, age: number) {
    return age < ActionObserverHttp.getMaxAge(response);
  }

  public static getMaxAge(response: Response) {
    const cacheControl = response.headers.get('Cache-control');
    if (cacheControl) {
      const maxAge = ActionObserverHttp.findRegexMatch(ActionObserverHttp.CACHECONTROL_MAXAGE, cacheControl);
      if (maxAge) {
        return parseInt(maxAge, 10);
      }
    }

    const expires = response.headers.get('Expires');
    const date = response.headers.get('Date');
    if (expires && date) {
      return (Date.parse(expires) / 1000 - Date.parse(date) / 1000);
    }

    const lastModified = response.headers.get('Last-Modified');
    if (lastModified && date) {
      return ((Date.parse(date) / 1000 - Date.parse(lastModified) / 1000) / 10);
    }

    return 0;
  }

  public onRun(actor: Actor<IActionHttp, IActorTest, IActorHttpOutput>,
               action: IActionHttp, output: Promise<IActorHttpOutput>): void {
    const cacheMode: string = ActionObserverHttp.getCacheMode(action);

    if (!(actor instanceof ActorHttpCache) && cacheMode !== 'no-store' && cacheMode !== 'no-local-store') {
      output.then((response) => {
        // setImmediate to give a slightly lower priority to this caching job
        setImmediate(() => this.cache.set(ActionObserverHttp.hashAction(action),
          [ ActionObserverHttp.getTime(), response.clone() ], ActionObserverHttp.getMaxAge(response) * 1000));
      });
    }
  }

  public isCached(action: IActionHttp): boolean {
    const cacheMode: string = ActionObserverHttp.getCacheMode(action);

    // Only cache if the cache entry is fresh
    if (cacheMode === 'default') {
      const cacheKey: string = ActionObserverHttp.hashAction(action);
      const cacheValue = this.cache.get(cacheKey);
      return ActionObserverHttp.isCacheValueFresh(cacheValue);
    }

    // Bypass cache
    if (cacheMode === 'no-store' || cacheMode === 'no-local-store'
      || cacheMode === 'reload' || cacheMode === 'no-cache') {
      return false;
    }

    // Ensure cache retrieval if it is present
    if (cacheMode === 'force-cache') {
      return !!this.cache.get(ActionObserverHttp.hashAction(action));
    }

    // Force cache retrieval, even if it is not present
    return cacheMode === 'only-if-cached';
  }

  public getCached(action: IActionHttp): Response {
    const cacheKey: string = ActionObserverHttp.hashAction(action);
    const cacheValue = this.cache.get(cacheKey);

    if (!cacheValue) {
      return new Response('Resource was not found in cache', {
        status: 504,
        statusText: 'Gateway timeout',
      });
    }

    return cacheValue[1].clone();
  }

}

export interface IActionObserverHttpArgs extends IActionObserverArgs<IActionHttp, IActorHttpOutput> {
  cacheSize: number;
}
