import ApiService from '@/services/api.service';

export default class ProductService {
  private api = new ApiService();

  async getProduct(params?: any) {
    const api = await this.api.getApi();
    return await api.get(`campaigns/products`, { params });
  }
}
