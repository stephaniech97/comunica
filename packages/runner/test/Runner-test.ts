import { Actor, IAction, IActorOutput, IActorTest, Bus } from '@comunica/core';

import { Runner } from '../lib/Runner';

describe('Runner', () => {
  let bus: Bus<Actor<IAction, IActorTest, IActorOutput>, IAction, IActorTest, IActorOutput>;

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
  });

  describe('The Runner module', () => {
    it('should be a function', () => {
      expect(Runner).toBeInstanceOf(Function);
    });

    it('should be a Runner constructor', () => {
      expect(new (<any> Runner)({ busInit: bus, actors: []})).toBeInstanceOf(Runner);
    });

    it('should not be able to create new Runner objects without \'new\'', () => {
      expect(() => { (<any> Runner)(); }).toThrow();
    });

    it('should throw an error when constructed without actors', () => {
      expect(() => { new (<any> Runner)({ busInit: bus }); }).toThrow();
    });

    it('should throw an error when constructed without a bus', () => {
      expect(() => { new (<any> Runner)({ actors: []}); }).toThrow();
    });

    it('should throw an error when constructed without a name and bus', () => {
      expect(() => { new (<any> Runner)({}); }).toThrow();
    });

    it('should throw an error when constructed without arguments', () => {
      expect(() => { new (<any> Runner)(); }).toThrow();
    });
  });

  describe('A Runner instance', () => {
    let runner: Runner;
    let actor1: Actor<IAction, IActorTest, IActorOutput>;
    let actor2: Actor<IAction, IActorTest, IActorOutput>;

    const actorTest = (action: any) => {
      return new Promise(resolve => {
        resolve({ type: 'test', sent: action });
      });
    };
    const actorRun = (action: any) => {
      return new Promise(resolve => {
        resolve({ type: 'run', sent: action });
      });
    };

    beforeEach(() => {
      runner = new (<any> Runner)({ busInit: bus, actors: []});
      actor1 = new (<any> Actor)({ name: 'actor1', bus: new Bus({ name: 'bus1' }) });
      actor2 = new (<any> Actor)({ name: 'actor2', bus: new Bus({ name: 'bus2' }) });

      (<any> actor1).test = actorTest;
      (<any> actor2).test = actorTest;
      (<any> actor1).run = actorRun;
      (<any> actor2).run = actorRun;

      jest.spyOn(actor1, 'test');
      jest.spyOn(actor2, 'test');
      jest.spyOn(actor1, 'run');
      jest.spyOn(actor2, 'run');

      bus.subscribe(actor1);
      bus.subscribe(actor2);
    });

    it('should have a \'busInit\' field', () => {
      expect(runner.busInit).toEqual(bus);
    });

    it('should have an \'actors\' field', () => {
      expect(runner.actors).toEqual([]);
    });

    it('should delegate \'init\' actions to actors on the bus', async() => {
      await runner.run({ argv: [ 'a', 'b' ], env: { c: 'd' }, stdin: <any> undefined });

      expect(actor1.test).toHaveBeenCalledTimes(1);
      expect(actor2.test).toHaveBeenCalledTimes(1);
      expect(actor1.run).toHaveBeenCalledTimes(1);
      expect(actor2.run).toHaveBeenCalledTimes(1);

      expect(actor1.run).toHaveBeenCalledWith({ argv: [ 'a', 'b' ], env: { c: 'd' }});
      expect(actor2.run).toHaveBeenCalledWith({ argv: [ 'a', 'b' ], env: { c: 'd' }});
    });

    it('should be initializable', () => {
      (<any> runner).actors = [ actor1, actor2 ];
      return expect(runner.initialize()).resolves.toBeTruthy();
    });

    it('should be deinitializable', () => {
      (<any> runner).actors = [ actor1, actor2 ];
      return expect(runner.deinitialize()).resolves.toBeTruthy();
    });

    describe('collectActors', () => {
      it('should collect for no identifiers', () => {
        return expect(runner.collectActors({})).toEqual({});
      });

      it('should collect for valid identifiers', () => {
        (<any> runner).actors = [ actor1, actor2 ];
        return expect(runner.collectActors({
          a: 'actor1',
          b: 'actor2',
        })).toEqual({
          a: actor1,
          b: actor2,
        });
      });

      it('should throw for a missing actor', () => {
        (<any> runner).actors = [ actor1, actor2 ];
        return expect(() => runner.collectActors({
          a: 'actor1',
          b: 'actor2',
          c: 'actor3',
        })).toThrow(new Error('No actor for key c was found for IRI actor3.'));
      });
    });
  });
});
