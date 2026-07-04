import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DbModule } from './modules/db/db.module';
import { HealthModule } from './modules/health/health.module';
import { LocationsModule } from './modules/locations/locations.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { MapModule } from './modules/map/map.module';
import { AuthModule } from './modules/auth/auth.module';
import { StatsModule } from './modules/stats/stats.module';
import { TransactionsModule } from './modules/transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DbModule,
    HealthModule,
    LocationsModule,
    TransactionsModule,
    StatsModule,
    EquipmentModule,
    MapModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
