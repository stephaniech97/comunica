import { Bus } from '@comunica/core';
import { ActorHttpInvalidateListenable, IInvalidateListener } from '..';

describe('ActorHttpInvalidateListenable', () => {
  const bus = new Bus({ name: 'bus' });

  describe('The ActorHttpInvalidateListenable module', () => {
    it('should be a function', () => {
      expect(ActorHttpInvalidateListenable).toBeInstanceOf(Function);
    });

    it('should be a ActorHttpInvalidateListenable constructor', () => {
      expect(new (<any> ActorHttpInvalidateListenable)({ bus: new Bus({ name: 'bus' }),
        name: 'actor' })).toBeInstanceOf(ActorHttpInvalidateListenable);
    });

    it('should not be able to create new ActorHttpInvalidateListenable objects without \'new\'', () => {
      expect(() => { (<any> ActorHttpInvalidateListenable)(); }).toThrow();
    });
  });

  describe('An ActorHttpInvalidateListenable instance without listeners', () => {
    let actor: ActorHttpInvalidateListenable;
    beforeEach(() => {
      actor = new ActorHttpInvalidateListenable({ bus, name: 'actor' });
    });

    it('should test', () => {
      return expect(actor.test({})).resolves.toBeTruthy();
    });

    it('should run', () => {
      return expect(actor.run({})).resolves.toBeTruthy();
    });
  });

  describe('An ActorHttpInvalidateListenable instance with listeners', () => {
    let actor: ActorHttpInvalidateListenable;
    let l0: IInvalidateListener;
    let l1: IInvalidateListener;
    beforeEach(() => {
      actor = new ActorHttpInvalidateListenable({ bus, name: 'actor' });
      l0 = jest.fn();
      l1 = jest.fn();
      actor.addInvalidateListener(l0);
      actor.addInvalidateListener(l1);
    });

    it('should test', async() => {
      expect(await actor.test({})).toBeTruthy();
      expect(l0).not.toHaveBeenCalled();
      expect(l1).not.toHaveBeenCalled();
    });

    it('should run without URL', async() => {
      expect(await actor.run({})).toBeTruthy();
      expect(l0).toHaveBeenCalledWith({});
      expect(l1).toHaveBeenCalledWith({});
    });

    it('should run with URL', async() => {
      expect(await actor.run({ url: 'abc' })).toBeTruthy();
      expect(l0).toHaveBeenCalledWith({ url: 'abc' });
      expect(l1).toHaveBeenCalledWith({ url: 'abc' });
    });
  });
});
