import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductTemplate } from '../database/entities/catalog/product-template.entity';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { RatingRating } from '../database/entities/reputation/rating-rating.entity';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [TypeOrmModule.forFeature([RatingRating, ProductTemplate, ResPartner])],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
