import { Datastore } from '@google-cloud/datastore';
import { BadRequestException } from '@nestjs/common';

export interface QueryResult {
  pageSize?: number;
  cursor?: string;
  moreResults?: boolean;
  data?: any[];
}

export interface PaginationParams {
  pageSize?: string;
  cursor?: string;
}

export class GoogleDatastoreProvider {
  private static readonly MAX_RESULTS = 1000;

  private kind: string;
  public datastore: Datastore;

  constructor(kind: string) {
    const options = {
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}'),
      namespace: process.env.DATASTORE_NAMESPACE,
    };
    this.datastore = new Datastore(options);
    this.kind = kind;
  }

  // @Cleanup: We can receive a Query object directly so that the caller can filter and order without having to manually do everything. - Fernando Nunes, 22 October, 2021.
  async findAllPaginated(pagination: PaginationParams, skipDeleted = false): Promise<QueryResult> {
    const result: QueryResult = {
      pageSize: !pagination.pageSize || pagination.pageSize == '' ? 15 : parseInt(pagination.pageSize),
    };

    if (isNaN(result.pageSize)) {
      throw new BadRequestException('Invalid pageSize');
    }
    if (result.pageSize <= 0 || result.pageSize > GoogleDatastoreProvider.MAX_RESULTS) {
      throw new BadRequestException(`pageSize must be between 1 and ${GoogleDatastoreProvider.MAX_RESULTS}`);
    }
    if (pagination.cursor && pagination.cursor == '') {
      throw new BadRequestException('cursor must be a valid string returned from a previous get request');
    }

    const query = this.datastore.createQuery(this.kind).limit(result.pageSize);
    if (skipDeleted) query.filter('deleted', '=', false);
    if (pagination.cursor) query.start(pagination.cursor);

    const [data, info] = await this.datastore.runQuery(query);
    result.cursor = info.endCursor;
    result.moreResults = info.moreResults != 'NO_MORE_RESULTS';
    result.data = data;

    return result;
  }

  // @TODO: This is broken, we are not finding the existing thing.
  async findOneByKey(key: string, skipDeleted = false): Promise<any> {
    const query = this.datastore
      .createQuery(this.kind)
      .filter('__key__', '=', this.datastore.key([this.kind, key]))
      .limit(1);
    if (skipDeleted) query.filter('deleted', '=', false);

    const [data] = await this.datastore.runQuery(query);
    return data[0];
  }

  async getKindPropertiesByNamespace(namespace: string, kind: string): Promise<string[]> {
    const datastore = new Datastore({ namespace });
    const query = datastore.createQuery('__property__').select('__key__');
    const [entities] = await datastore.runQuery(query);

    const entitiesFiltered = entities.filter((entity) => entity[datastore.KEY].parent.name === kind && entity[datastore.KEY].kind === '__property__');

    const properties = entitiesFiltered.map((entity) => entity[datastore.KEY].name);

    return properties;
  }

  async exists(key: string, skipDeleted = false): Promise<boolean> {
    const query = this.datastore
      .createQuery(this.kind)
      .select('__key__')
      .filter('__key__', '=', this.datastore.key([this.kind, key]))
      .limit(1);

    if (skipDeleted) query.filter('deleted', '=', false);

    const [data] = await this.datastore.runQuery(query);

    if (data[0]) return true;
    return false;
  }

  async createOne(obj: Record<string, unknown>, id?: string): Promise<any> {
    const key = this.datastore.key([this.kind, id]);

    await this.datastore.insert({
      key,
      data: { ...obj },
    });

    return obj;
  }

  async mergeOne(key: string, obj: Record<string, unknown>) {
    await this.datastore.merge({
      key: this.datastore.key([this.kind, key]),
      data: obj,
    });
  }
}
