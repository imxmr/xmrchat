import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Coin } from './coin.entity';
import { Repository } from 'typeorm';
import { InitSwapData, TrocadorRate, TrocadorTrade } from 'src/shared/types';
import { ConfigService } from '@nestjs/config';
import { CronExpression } from '@nestjs/schedule';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class TrocadorService {
  private logger = new Logger(TrocadorService.name);
  private EXCLUDED_EXCHANGES = ['BitcoinVN'];
  private MIN_KYCRATING = 'C';
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
    @InjectRepository(Coin) private repo: Repository<Coin>,
  ) {}
  async getCoinsApi() {
    try {
      const { data } = await this.httpService.axiosRef.get<Coin[]>('/coins');

      return data;
    } catch (error) {
      console.log(error.response);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async getAndSaveCoins() {
    const coins = await this.getCoinsApi();

    if (!coins)
      throw new BadRequestException('Could not get coins from trocador!');

    await this.repo.upsert(coins, ['name', 'ticker', 'network']);
    return coins;
  }

  async newRate(coin: Coin, amount: number) {
    const { data } = await this.httpService.axiosRef.get<TrocadorRate>(
      '/new_rate',
      {
        params: {
          ticker_from: coin.ticker,
          network_from: coin.network,
          ticker_to: 'xmr',
          network_to: 'Mainnet',
          amount_to: amount,
          payment: true,
          min_kycrating: this.MIN_KYCRATING,
        },
      },
    );

    const quotes = [...data.quotes.quotes]
      .sort((qa, qb) => qa.eta - qb.eta)
      .filter((q) => !this.EXCLUDED_EXCHANGES.includes(q.provider));

    const preferredQuote = quotes.find(
      (q) => (q.kycrating === 'A' || q.kycrating === 'B') && q.eta <= 10,
    );
    this.logger.log({
      quotes: quotes.map((q) => ({
        provider: q.provider,
        eta: q.eta,
        kyc: q.kycrating,
      })),
    });
    this.logger.log({ preferredQuote });

    const selectedQuote = preferredQuote || quotes[0];

    return { id: data.trade_id, quote: selectedQuote };
  }

  async newTrade(coin: Coin, amount: number, address: string, webhook: string) {
    try {
      const { id: rateId, quote } = await this.newRate(coin, amount);

      const { data } = await this.httpService.axiosRef.get<TrocadorTrade>(
        '/new_trade',
        {
          params: {
            ticker_from: coin.ticker,
            network_from: coin.network,
            ticker_to: 'xmr',
            network_to: 'Mainnet',
            amount_to: amount,
            address: address,
            payment: true,
            webhook,
            min_kycrating: this.MIN_KYCRATING,
            id: rateId,
            provider: quote?.provider,
          },
        },
      );

      const trade = await this.getTrade(data.trade_id);

      return trade;
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      console.log('New Trade Error:', errorMessage);

      throw new Error(errorMessage);
    }
  }

  async getTrade(tradeId: string) {
    const { data } = await this.httpService.axiosRef.get<TrocadorTrade[]>(
      `/trade`,
      {
        params: { id: tradeId },
      },
    );

    return data[0];
  }

  async initSwap(data: InitSwapData & { coin: Coin }) {
    const webhookBaseUrl = this.configService.get('WEBHOOK_BASE_URL');
    const trocadorWebhookToken = this.configService.get(
      'TROCADOR_WEBHOOK_TOKEN',
    );
    const webhookUrl = `${webhookBaseUrl}/webhooks/trocator/${trocadorWebhookToken}`;

    const trade = await this.newTrade(
      data.coin,
      data.amountTo,
      data.address,
      webhookUrl,
    );
    return trade;
  }

  async isActive() {
    if (!this.configService.get('TROCADOR_API_KEY')) return false;
    try {
      await this.httpService.axiosRef.get('/exchanges');
      return true;
    } catch (error) {
      this.logger.log(error);
      return false;
    }
  }
  async getStatus() {
    if (!this.configService.get('TROCADOR_API_KEY')) return {};
    try {
      await this.httpService.axiosRef.get('/exchanges');
      return { active: true };
    } catch (error) {
      this.logger.log(error);
      return { active: false, reason: error.message };
    }
  }
}
