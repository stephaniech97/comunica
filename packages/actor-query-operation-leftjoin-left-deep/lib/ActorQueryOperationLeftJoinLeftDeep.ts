import {
  ActorQueryOperation,
  ActorQueryOperationTypedMediated,
  Bindings,
  BindingsStream, getMetadata,
  IActorQueryOperationOutputBindings,
  IActorQueryOperationTypedMediatedArgs,
  materializeOperation,
} from '@comunica/bus-query-operation';
import { ActorRdfJoin } from '@comunica/bus-rdf-join';
import { ActionContext, IActorTest } from '@comunica/core';
import { MultiTransformIterator, TransformIterator } from 'asynciterator';
import { Algebra, Factory } from 'sparqlalgebrajs';

/**
 * A comunica LeftJoin left-deep Query Operation Actor.
 */
export class ActorQueryOperationLeftJoinLeftDeep extends ActorQueryOperationTypedMediated<Algebra.LeftJoin> {
  private static readonly FACTORY = new Factory();

  public constructor(args: IActorQueryOperationTypedMediatedArgs) {
    super(args, 'leftjoin');
  }

  /**
   * Create a new bindings stream
   * that takes every binding of the base stream,
   * materializes the remaining patterns with it,
   * and emits all bindings from this new set of patterns.
   * @param {BindingsStream} leftStream The base stream.
   * @param {Algebra.Operation} rightOperation The operation to materialize with each binding of the base stream.
   * @param {Algebra.Operation => Promise<BindingsStream>} operationBinder A callback to retrieve the bindings stream
   *                                                                       of an operation.
   * @return {BindingsStream}
   */
  public static createLeftDeepStream(leftStream: BindingsStream, rightOperation: Algebra.Operation,
    operationBinder: (operation: Algebra.Operation) => Promise<BindingsStream>): BindingsStream {
    return new MultiTransformIterator(leftStream, {
      multiTransform(bindings: Bindings) {
        const bindingsMerger = (subBindings: Bindings): Bindings => subBindings.merge(bindings);
        return new TransformIterator(
          async() => (await operationBinder(materializeOperation(rightOperation, bindings)))
            .map(bindingsMerger), { maxBufferSize: 128 },
        );
      },
      optional: true,
    });
  }

  public async testOperation(pattern: Algebra.LeftJoin, context: ActionContext): Promise<IActorTest> {
    return true;
  }

  public async runOperation(pattern: Algebra.LeftJoin, context: ActionContext):
  Promise<IActorQueryOperationOutputBindings> {
    // Initiate left and right operations
    // Only the left stream will be used.
    // The right stream is ignored and only its metadata and variables are used.
    const left = ActorQueryOperation.getSafeBindings(await this.mediatorQueryOperation
      .mediate({ operation: pattern.left, context }));
    const right = ActorQueryOperation.getSafeBindings(await this.mediatorQueryOperation
      .mediate({ operation: pattern.right, context }));

    // Close the right stream, since we don't need that one
    right.bindingsStream.close();

    // If an expression was defined, wrap the right operation in a filter expression.
    const rightOperation = pattern.expression ?
      ActorQueryOperationLeftJoinLeftDeep.FACTORY.createFilter(pattern.right, pattern.expression) :
      pattern.right;

    // Create a left-deep stream with left and right.
    const bindingsStream = ActorQueryOperationLeftJoinLeftDeep.createLeftDeepStream(
      left.bindingsStream,
      rightOperation,
      async(operation: Algebra.Operation) => ActorQueryOperation.getSafeBindings(
        await this.mediatorQueryOperation.mediate({ operation, context }),
      ).bindingsStream,
    );

    // Determine variables and metadata
    const variables = ActorRdfJoin.joinVariables({ entries: [ left, right ]});
    const metadata = (): Promise<{[id: string]: any}> => Promise.all([ left, right ].map(x => getMetadata(x)))
      .then(metadatas => metadatas.reduce((acc, val) => acc * val.totalItems, 1))
      .catch(() => Infinity)
      .then(totalItems => ({ totalItems }));

    // TODO: We manually trigger the left metadata to be resolved.
    //       If we don't do this, the inner metadata event seems to be lost in some cases,
    //       the left promise above is never resolved, this whole metadata promise is never resolved,
    //       and the application terminates without producing any results.
    getMetadata(left).catch(() => {
      // Do nothing
    });

    return { type: 'bindings', bindingsStream, metadata, variables };
  }
}
