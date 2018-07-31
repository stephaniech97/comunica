import {ActorHttp} from "@comunica/bus-http";
import {Bus} from "@comunica/core";
import {ActorHttpCache} from "../lib/ActorHttpCache";

describe('ActorHttpCache', () => {
  let bus;

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
  });

  describe('The ActorHttpCache module', () => {
    it('should be a function', () => {
      expect(ActorHttpCache).toBeInstanceOf(Function);
    });

    it('should be a ActorHttpCache constructor', () => {
      expect(new (<any> ActorHttpCache)({ name: 'actor', bus })).toBeInstanceOf(ActorHttpCache);
      expect(new (<any> ActorHttpCache)({ name: 'actor', bus })).toBeInstanceOf(ActorHttp);
    });

    it('should not be able to create new ActorHttpCache objects without \'new\'', () => {
      expect(() => { (<any> ActorHttpCache)(); }).toThrow();
    });
  });

  describe('An ActorHttpCache instance', () => {
    let actor: ActorHttpCache;

    beforeEach(() => {
      actor = new ActorHttpCache({ name: 'actor', bus });
    });

    it('should test', () => {
      return expect(actor.test({ todo: true })).resolves.toEqual({ todo: true }); // TODO
    });

    it('should run', () => {
      return expect(actor.run({ todo: true })).resolves.toMatchObject({ todo: true }); // TODO
    });
  });
});
