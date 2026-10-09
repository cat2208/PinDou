import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { Product, Gallery } from '../../entities/content.entity';
import { User } from '../../entities/user.entity';
import { Store } from '../../entities/store.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Gallery, User, Store]),
  ],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}