import { Module } from '@nestjs/common';
import { PatternController } from './pattern.controller';
import { PatternService } from './pattern.service';

@Module({
  controllers: [PatternController],
  providers: [PatternService],
  exports: [PatternService],
})
export class PatternModule {}