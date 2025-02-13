import { ActorQueryOperation, ActorQueryOperationTypedMediated, Bindings, BindingsStream,
  IActorQueryOperationOutputBindings, IActorQueryOperationTypedMediatedArgs } from '@comunica/bus-query-operation';
import { ActionContext, IActorTest } from '@comunica/core';
import { BlankNodeScoped } from '@comunica/data-factory';
import { blankNode } from '@rdfjs/data-model';
import { termToString } from 'rdf-string';
import { Algebra } from 'sparqlalgebrajs';

/**
 * A comunica Project Query Operation Actor.
 */
export class ActorQueryOperationProject extends ActorQueryOperationTypedMediated<Algebra.Project> {
  public constructor(args: IActorQueryOperationTypedMediatedArgs) {
    super(args, 'project');
  }

  public async testOperation(pattern: Algebra.Project, context: ActionContext): Promise<IActorTest> {
    return true;
  }

  public async runOperation(pattern: Algebra.Project, context: ActionContext):
  Promise<IActorQueryOperationOutputBindings> {
    // Resolve the input
    const output: IActorQueryOperationOutputBindings = ActorQueryOperation.getSafeBindings(
      await this.mediatorQueryOperation.mediate({ operation: pattern.input, context }),
    );

    // Find all variables that should be deleted from the input stream.
    const variables: string[] = pattern.variables.map(x => termToString(x));
    const deleteVariables = output.variables.filter(variable => !variables.includes(variable));

    // Error if there are variables that are not bound in the input stream.
    const missingVariables = variables.filter(variable => !output.variables.includes(variable));
    if (missingVariables.length > 0) {
      throw new Error(`Variables '${missingVariables}' are used in the projection result, but are not assigned.`);
    }

    // Make sure the project variables are the only variables that are present in the bindings.
    let bindingsStream: BindingsStream = deleteVariables.length === 0 ?
      output.bindingsStream :
      output.bindingsStream.map(
        (binding: Bindings) => {
          for (const deleteVariable of deleteVariables) {
            binding = binding.delete(deleteVariable);
          }
          return binding;
        },
      );

    // Make sure that blank nodes with same labels are not reused over different bindings, as required by SPARQL 1.1.
    // Required for the BNODE() function: https://www.w3.org/TR/sparql11-query/#func-bnode
    // When we have a scoped blank node, make sure the skolemized value is maintained.
    let blankNodeCounter = 0;
    bindingsStream = bindingsStream.map((bindings: Bindings) => {
      blankNodeCounter++;
      return <Bindings> bindings.map(term => {
        if (term && term.termType === 'BlankNode') {
          if (term instanceof BlankNodeScoped) {
            return new BlankNodeScoped(`${term.value}${blankNodeCounter}`, term.skolemized);
          }
          return blankNode(`${term.value}${blankNodeCounter}`);
        }
        return term;
      });
    });

    return { type: 'bindings', bindingsStream, metadata: output.metadata, variables };
  }
}
