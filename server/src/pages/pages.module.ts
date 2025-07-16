import { forwardRef, Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Page } from './page.entity';
import { LwsModule } from 'src/lws/lws.module';
import { PaymentsModule } from 'src/payments/payments.module';
import { PagesGateway } from './pages.gateway';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { TwitchModule } from 'src/integrations/twitch/twitch.module';
import { Tip } from 'src/tips/tip.entity';
import { UsersModule } from 'src/users/users.module';
import { PricesModule } from 'src/prices/prices.module';
import { TipMessageModule } from 'src/tip-message/tip-message.module';
import { File } from 'src/files/file.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Page, Tip, File]),
    LwsModule,
    PaymentsModule,
    NotificationsModule,
    TwitchModule,
    UsersModule, // used on WsAuthGuard
    PricesModule,
    TipMessageModule,
  ],
  controllers: [PagesController],
  providers: [PagesService, PagesGateway],
  exports: [PagesService, PagesGateway],
})
export class PagesModule {}
