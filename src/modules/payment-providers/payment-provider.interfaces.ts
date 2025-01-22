export interface IPaymentProviderService {
  healthcheck(): Promise<boolean>
  getBalance(address: string): Promise<{ amount: string; currency: string }>
}
