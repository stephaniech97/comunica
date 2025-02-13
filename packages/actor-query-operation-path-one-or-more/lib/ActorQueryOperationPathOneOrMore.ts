import { ActorAbstractPath } from '@comunica/actor-abstract-path';
import {
  ActorQueryOperation,
  Bindings, IActorQueryOperationOutputBindings,
  IActorQueryOperationTypedMediatedArgs,
} from '@comunica/bus-query-operation';
import { ActionContext } from '@comunica/core';
import { BufferedIterator, MultiTransformIterator, TransformIterator } from 'asynciterator';
import { Term } from 'rdf-js';
import { termToString } from 'rdf-string';
import { Algebra } from 'sparqlalgebrajs';

/**
 * A comunica Path OneOrMore Query Operation Actor.
 */
export class ActorQueryOperationPathOneOrMore extends ActorAbstractPath {
  public constructor(args: IActorQueryOperationTypedMediatedArgs) {
    super(args, Algebra.types.ONE_OR_MORE_PATH);
  }

  public async runOperation(path: Algebra.Path, context: ActionContext): Promise<IActorQueryOperationOutputBindings> {
    const predicate = <Algebra.OneOrMorePath> path.predicate;

    const sVar = path.subject.termType === 'Variable';
    const oVar = path.object.termType === 'Variable';

    if (!sVar && oVar) {
      // Get all the results of applying this once, then do zeroOrMore for those
      const single = ActorAbstractPath.FACTORY.createPath(path.subject, predicate.path, path.object, path.graph);
      const results = ActorQueryOperation.getSafeBindings(
        await this.mediatorQueryOperation.mediate({ context, operation: single }),
      );
      const objectString = termToString(path.object);

      // All branches need to share the same termHashes to prevent duplicates
      const termHashes = {};

      const bindingsStream: MultiTransformIterator<Bindings, Bindings> = new MultiTransformIterator(
        results.bindingsStream,
        {
          multiTransform: (bindings: Bindings) => {
            const val = bindings.get(objectString);
            return new TransformIterator<Bindings>(
              async() => {
                const it = new BufferedIterator<Term>();
                await this.ALP(val, predicate.path, context, termHashes, it, { count: 0 });
                return it.transform<Bindings>({
                  transform(item, next, push) {
                    push(Bindings({ [objectString]: item }));
                    next();
                  },
                });
              }, { maxBufferSize: 128 },
            );
          },
          autoStart: false,
        },
      );
      return { type: 'bindings', bindingsStream, variables: [ objectString ]};
    }
    if (sVar && oVar) {
      throw new Error('ZeroOrMore path expressions with 2 variables not supported yet');
    } else if (sVar && !oVar) {
      return <Promise<IActorQueryOperationOutputBindings>> this.mediatorQueryOperation.mediate({
        context,
        operation: ActorAbstractPath.FACTORY.createPath(
          path.object,
          ActorAbstractPath.FACTORY.createOneOrMorePath(
            ActorAbstractPath.FACTORY.createInv(predicate.path),
          ),
          path.subject,
          path.graph,
        ),
      });
    } else {
      // If (!sVar && !oVar)
      const blankNode = this.generateBlankNode();
      const bString = termToString(blankNode);
      const results = ActorQueryOperation.getSafeBindings(await this.mediatorQueryOperation.mediate({
        context,
        operation: ActorAbstractPath.FACTORY.createPath(path.subject, predicate, blankNode, path.graph),
      }));
      const bindingsStream = results.bindingsStream.transform<Bindings>({
        filter: item => item.get(bString).equals(path.object),
        transform(item, next, push) {
          push(Bindings({ }));
          next();
        },
      });
      return { type: 'bindings', bindingsStream, variables: []};
    }
  }
}
