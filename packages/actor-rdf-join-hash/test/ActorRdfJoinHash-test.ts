import { Bindings, IActorQueryOperationOutputBindings } from '@comunica/bus-query-operation';
import { ActorRdfJoin, IActionRdfJoin } from '@comunica/bus-rdf-join';
import { Bus } from '@comunica/core';
import { literal } from '@rdfjs/data-model';
import { ArrayIterator } from 'asynciterator';
import { ActorRdfJoinHash } from '../lib/ActorRdfJoinHash';
const arrayifyStream = require('arrayify-stream');

function bindingsToString(b: Bindings): string {
  // eslint-disable-next-line @typescript-eslint/require-array-sort-compare
  const keys = b.keySeq().toArray().sort();
  return keys.map(k => `${k}:${b.get(k).value}`).toString();
}

describe('ActorRdfJoinHash', () => {
  let bus: any;

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
  });

  describe('The ActorRdfJoinHash module', () => {
    it('should be a function', () => {
      expect(ActorRdfJoinHash).toBeInstanceOf(Function);
    });

    it('should be a ActorRdfJoinHash constructor', () => {
      expect(new (<any> ActorRdfJoinHash)({ name: 'actor', bus })).toBeInstanceOf(ActorRdfJoinHash);
      expect(new (<any> ActorRdfJoinHash)({ name: 'actor', bus })).toBeInstanceOf(ActorRdfJoin);
    });

    it('should not be able to create new ActorRdfJoinHash objects without \'new\'', () => {
      expect(() => { (<any> ActorRdfJoinHash)(); }).toThrow();
    });
  });

  describe('An ActorRdfJoinHash instance', () => {
    let actor: ActorRdfJoinHash;
    let action: IActionRdfJoin;

    beforeEach(() => {
      actor = new ActorRdfJoinHash({ name: 'actor', bus });
      action = { entries: [
        {
          bindingsStream: new ArrayIterator([], { autoStart: false }),
          metadata: () => Promise.resolve({ totalItems: 4 }),
          type: 'bindings',
          variables: [],
        },
        {
          bindingsStream: new ArrayIterator([], { autoStart: false }),
          metadata: () => Promise.resolve({ totalItems: 5 }),
          type: 'bindings',
          variables: [],
        },
      ]};
    });

    it('should only handle 2 streams', () => {
      action.entries.push(<any> {});
      return expect(actor.test(action)).rejects.toBeTruthy();
    });

    it('should generate correct test metadata', async() => {
      await expect(actor.test(action)).resolves.toHaveProperty('iterations',
        (await (<any> action.entries[0]).metadata()).totalItems +
        (await (<any> action.entries[1]).metadata()).totalItems);
    });

    it('should generate correct metadata', async() => {
      await actor.run(action).then(async(result: IActorQueryOperationOutputBindings) => {
        return expect((<any> result).metadata()).resolves.toHaveProperty('totalItems',
          (await (<any> action.entries[0]).metadata()).totalItems *
          (await (<any> action.entries[1]).metadata()).totalItems);
      });
    });

    it('should not return metadata if there is no valid input', () => {
      delete action.entries[0].metadata;
      return expect(actor.run(action)).resolves.not.toHaveProperty('metadata');
    });

    it('should return an empty stream for empty input', () => {
      return actor.run(action).then(async(output: IActorQueryOperationOutputBindings) => {
        expect(output.variables).toEqual([]);
        expect(await arrayifyStream(output.bindingsStream)).toEqual([]);
      });
    });

    it('should join bindings with matching values', () => {
      action.entries[0].bindingsStream = new ArrayIterator([ Bindings({ a: literal('a'), b: literal('b') }) ]);
      action.entries[0].variables = [ 'a', 'b' ];
      action.entries[1].bindingsStream = new ArrayIterator([ Bindings({ a: literal('a'), c: literal('c') }) ]);
      action.entries[1].variables = [ 'a', 'c' ];
      return actor.run(action).then(async(output: IActorQueryOperationOutputBindings) => {
        expect(output.variables).toEqual([ 'a', 'b', 'c' ]);
        expect(await arrayifyStream(output.bindingsStream)).toEqual([
          Bindings({ a: literal('a'), b: literal('b'), c: literal('c') }),
        ]);
      });
    });

    it('should not join bindings with incompatible values', () => {
      action.entries[0].bindingsStream = new ArrayIterator([ Bindings({ a: literal('a'), b: literal('b') }) ]);
      action.entries[0].variables = [ 'a', 'b' ];
      action.entries[1].bindingsStream = new ArrayIterator([ Bindings({ a: literal('d'), c: literal('c') }) ]);
      action.entries[1].variables = [ 'a', 'c' ];
      return actor.run(action).then(async(output: IActorQueryOperationOutputBindings) => {
        expect(output.variables).toEqual([ 'a', 'b', 'c' ]);
        expect(await arrayifyStream(output.bindingsStream)).toEqual([]);
      });
    });

    it('should join multiple bindings', () => {
      action.entries[0].bindingsStream = new ArrayIterator([
        Bindings({ a: literal('1'), b: literal('2') }),
        Bindings({ a: literal('1'), b: literal('3') }),
        Bindings({ a: literal('2'), b: literal('2') }),
        Bindings({ a: literal('2'), b: literal('3') }),
        Bindings({ a: literal('3'), b: literal('3') }),
        Bindings({ a: literal('3'), b: literal('4') }),
      ]);
      action.entries[0].variables = [ 'a', 'b' ];
      action.entries[1].bindingsStream = new ArrayIterator([
        Bindings({ a: literal('1'), c: literal('4') }),
        Bindings({ a: literal('1'), c: literal('5') }),
        Bindings({ a: literal('2'), c: literal('6') }),
        Bindings({ a: literal('3'), c: literal('7') }),
        Bindings({ a: literal('0'), c: literal('4') }),
        Bindings({ a: literal('0'), c: literal('4') }),
      ]);
      action.entries[1].variables = [ 'a', 'c' ];
      return actor.run(action).then(async(output: IActorQueryOperationOutputBindings) => {
        const expected = [
          Bindings({ a: literal('1'), b: literal('2'), c: literal('4') }),
          Bindings({ a: literal('1'), b: literal('2'), c: literal('5') }),
          Bindings({ a: literal('1'), b: literal('3'), c: literal('4') }),
          Bindings({ a: literal('1'), b: literal('3'), c: literal('5') }),
          Bindings({ a: literal('2'), b: literal('2'), c: literal('6') }),
          Bindings({ a: literal('2'), b: literal('3'), c: literal('6') }),
          Bindings({ a: literal('3'), b: literal('3'), c: literal('7') }),
          Bindings({ a: literal('3'), b: literal('4'), c: literal('7') }),
        ];
        expect(output.variables).toEqual([ 'a', 'b', 'c' ]);
        // Mapping to string and sorting since we don't know order (well, we sort of know, but we might not!)
        expect((await arrayifyStream(output.bindingsStream)).map(bindingsToString).sort())
          // eslint-disable-next-line @typescript-eslint/require-array-sort-compare
          .toEqual(expected.map(bindingsToString).sort());
      });
    });
  });
});
