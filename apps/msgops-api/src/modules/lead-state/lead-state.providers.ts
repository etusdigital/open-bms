import { Injectable } from '@nestjs/common';
import { Datastore } from '@google-cloud/datastore';

@Injectable()
export class LeadStateProvider {
  /**
   * @param {string} [activeStepId] - This value is automation title and automation key concat with step id. e.g. fluxo-emp-pessoal-35-76
   */
  async findByStepId(activeStepId: string): Promise<number> {
    const datastore = new Datastore({ namespace: process.env.DATASTORE_NAMESPACE });
    const query = datastore.createQuery(process.env.DATASTORE_KIND_LEAD).filter('activeStepId', '=', activeStepId);
    const response = await datastore.runQuery(query);
    console.log('TESTE 1', JSON.stringify(response));

    return response[0].length;
  }
}
