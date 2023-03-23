import { log, userInteractionProvider } from '../../io';
import { ProcessorContext } from '../../models';
import * as utils from '../../utils';

export type GqlLoadData = string | ((context: ProcessorContext) => Promise<string | undefined>);

export interface GqlData {
  operationName?: string;
  query?: GqlLoadData;
  fragments: Record<string, GqlLoadData>;
}

export interface GqlPostRequest {
  query: string;
  operationName?: string;
  variables?: Record<string, unknown>;
}

export class GqlAction {
  id = 'gql';
  before = ['http'];

  constructor(private readonly gqlData: GqlData) {}

  async process(context: ProcessorContext): Promise<boolean> {
    if (context.request && this.gqlData?.query) {
      utils.report(context, 'build GraphQL query');
      let query: string | undefined;
      if (utils.isString(this.gqlData.query)) {
        query = this.gqlData.query;
      } else {
        const result = await this.gqlData.query(context);
        if (result) {
          query = result;
        } else {
          const message = 'query import not found';
          userInteractionProvider.showWarnMessage?.(message);
          log.warn(message);
        }
      }

      if (query) {
        const usedFragmentsMap = await this.extractUsedFragments(context, query);
        const fragmentLines = Array.from(usedFragmentsMap, keyVal => keyVal[1]);

        if (fragmentLines.length > 0) {
          query = utils.toMultiLineString([query, ...fragmentLines]);
        }
        const gqlRequestBody: GqlPostRequest = {
          query,
        };
        if (this.gqlData.operationName) {
          gqlRequestBody.operationName = this.gqlData.operationName;
        }
        if (utils.isString(context.request.body)) {
          gqlRequestBody.variables = JSON.parse(context.request.body);
        }
        context.request.body = utils.stringifySafe(gqlRequestBody);
      }
    }
    return true;
  }

  /**
   * Return all used fragments
   */
  private async extractUsedFragments(
    context: ProcessorContext,
    query: string,
    seenFragments: Map<string, string> = new Map()
  ): Promise<Map<string, string>> {
    for (const [fragmentName, value] of Object.entries(this.gqlData.fragments)) {
      if (seenFragments.has(fragmentName) || query.indexOf(`...${fragmentName}`) < 0) {
        continue;
      }

      const fragment = await getFragmentValue(context, fragmentName, value);
      if (!fragment) {
        continue;
      }
      seenFragments.set(fragmentName, fragment);

      // need to check if the fragment references other fragments
      await this.extractUsedFragments(context, fragment, seenFragments);
    }

    return seenFragments;
  }
}

async function getFragmentValue(
  context: ProcessorContext,
  fragmentName: string,
  value: GqlLoadData
): Promise<string | undefined> {
  if (utils.isString(value)) {
    return value;
  }
  const result = await value(context);
  if (result) {
    return result;
  }
  const message = `query fragment ${fragmentName} not found`;
  userInteractionProvider.showWarnMessage?.(message);
  log.warn(message);
  return undefined;
}
