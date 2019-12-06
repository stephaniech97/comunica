import {IActorQueryOperationOutput, IActorQueryOperationOutputBindings} from "@comunica/bus-query-operation";
import {ActorRdfJoin, IActionRdfJoin} from "@comunica/bus-rdf-join";
import {IActorArgs, IActorTest, Mediator} from "@comunica/core";
import {IMediatorTypeIterations} from "@comunica/mediatortype-iterations";

/**
 * A Multi Smallest RDF Join Actor.
 * It accepts 3 or more streams, joins the smallest two, and joins the result with the remaining streams.
 */
export class ActorRdfJoinMultiSmallest extends ActorRdfJoin {

  public readonly mediatorJoin: Mediator<ActorRdfJoin,
    IActionRdfJoin, IMediatorTypeIterations, IActorQueryOperationOutput>;

  constructor(args: IActorRdfJoinMultiSmallestArgs) {
    super(args, 3, true);
  }

  /**
   * Get the n smallest pattern ids
   * @param {number[]} totalItems An array of total item counts
   * @param {number} count The number (n) of smallest patterns to look for.
   * @return {number[]} An array (size count) of the smallest patterns.
   */
  public static getSmallestPatternIds(totalItems: number[], count: number): number[] {
    // Initialize the array of smallest elements
    const smallest = [];
    for (let j = 0; j < count; ++j) {
      smallest.push({ id: -1, count: Infinity });
    }

    // Iterate over all items once (O(n))
    for (let i = 0; i < totalItems.length; i++) {
      const countI: number = totalItems[i];
      for (let k = count - 1; k >= 0; --k) {
        // Insert new entry if it is smaller
        if (countI < smallest[k].count) {
          smallest[k].id = i;
          smallest[k].count = countI;
        }

        // Stop if the next entry would be larger (or we reached the end)
        if (countI >= smallest[k].count || k === 0) {
          // Shift larger entries to the right
          if (k < countI - 1) {
            smallest[k + 1] = smallest[k];
          }
          break;
        }
      }
    }
    return smallest.map((element) => element.id);
  }

  protected async getOutput(action: IActionRdfJoin): Promise<IActorQueryOperationOutputBindings> {
    const entries: IActorQueryOperationOutputBindings[] = action.entries.slice();

    // Determine the two smallest streams by estimated count
    const entriesTotalItems = (await Promise.all(action.entries.map((entry) => entry.metadata())))
      .map((metadata) => 'totalItems' in metadata ? metadata.totalItems : Infinity);
    const smallestPatternsIds = ActorRdfJoinMultiSmallest.getSmallestPatternIds(entriesTotalItems, 2);
    const smallestPatterns: IActorQueryOperationOutputBindings[] = smallestPatternsIds
      .map((patternId) => entries[patternId]);
    console.log(smallestPatternsIds); // TODO

    // Determine the remaining streams
    const remainingPatterns: IActorQueryOperationOutputBindings[] = [];
    for (let i = 0; i < entries.length; i++) {
      if (smallestPatternsIds.indexOf(i) < 0) {
        remainingPatterns.push(entries[i]);
      }
    }

    // Join the two selected streams, and then join the result with the remaining streams
    const firstEntry: IActorQueryOperationOutputBindings = <IActorQueryOperationOutputBindings> await
      this.mediatorJoin.mediate({ entries: smallestPatterns });
    remainingPatterns.push(firstEntry);
    return <IActorQueryOperationOutputBindings> await this.mediatorJoin.mediate({ entries: remainingPatterns });
  }

  protected async getIterations(action: IActionRdfJoin): Promise<number> {
    return (await Promise.all(action.entries.map((entry) => entry.metadata())))
      .reduce((acc, value) => acc * value.totalItems, 1);
  }

}

export interface IActorRdfJoinMultiSmallestArgs
  extends IActorArgs<IActionRdfJoin, IActorTest, IActorQueryOperationOutput> {
  mediatorJoin: Mediator<ActorRdfJoin,
    IActionRdfJoin, IMediatorTypeIterations, IActorQueryOperationOutput>;
}
