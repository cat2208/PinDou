import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PatternService } from './pattern.service';
import { Public } from '../../common/auth.guard';

/** 上传限制：15MB */
const MAX_SIZE = 15 * 1024 * 1024;

@Controller()
export class PatternController {
  constructor(private readonly patternService: PatternService) {}

  /** POST /api/pattern/generate 图片转拼豆图纸（登录用户）
   *  formData: file, beadSize, boardType(SMALL|MIDDLE|LARGE 可省略走自定义网格), gridWidth, gridHeight, maxColors, style
   */
  @Post('pattern/generate')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async generate(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { beadSize?: string; boardType?: string; gridWidth?: string; gridHeight?: string; maxColors?: string; style?: string },
  ) {
    if (!file) throw new Error('请上传图片文件');
    const result = await this.patternService.generateFromFile(file, {
      beadSize: body?.beadSize ? Number(body.beadSize) : 5,
      boardType: (body?.boardType as any) || undefined,
      gridWidth: body?.gridWidth ? Number(body.gridWidth) : 32,
      gridHeight: body?.gridHeight ? Number(body.gridHeight) : undefined,
      maxColors: body?.maxColors ? Number(body.maxColors) : 16,
      style: (body?.style as any) || 'CARTOON',
    });
    return result;
  }

  /** GET /api/pattern/preview-list 已生成结果列表（调试/复用） */
  @Public()
  @Get('pattern/palettes')
  palettes() {
    return { palettes: this.patternService.listPalettes() };
  }

  /** GET /api/pattern/:id 读取生成结果缓存（按 patternId） */
  @Public()
  @Get('pattern/:id')
  detail(@Param('id') id: string) {
    const cached = this.patternService.readCached(id);
    if (!cached) throw new Error('图纸不存在或已过期');
    return cached;
  }
}