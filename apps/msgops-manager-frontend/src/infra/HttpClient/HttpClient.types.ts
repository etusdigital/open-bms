export interface HttpClient {
  get<T>(url: string): Promise<T>;
  post<T, Y>(url: string, body: T): Promise<Y>;
  put<T, Y>(url: string, body: T): Promise<Y>;
  delete(url: string): Promise<unknown>;
}
