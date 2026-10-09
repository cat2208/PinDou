import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ContentService } from './content.service';
import { CurrentUser, JwtUser, Public } from '../../common/auth.guard';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const uid = () => Math.random().toString(36).slice(2, 8);

@Controller()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  /** GET /api/home 首页聚合（免登录） */
  @Public()
  @Get('home')
  home() {
    return this.contentService.home();
  }

  /** GET /api/gallery 晒图墙（免登录） */
  @Public()
  @Get('gallery')
  gallery() {
    return this.contentService.gallery();
  }

  /** POST /api/gallery 发布晒图（登录） */
  @Post('gallery')
  publishGallery(@CurrentUser() user: JwtUser, @Body() body: { title?: string; tag?: string; images?: string[] }) {
    return this.contentService.publishGallery(user.uid, body);
  }

  /** POST /api/gallery/:id/like 点赞（登录） */
  @Post('gallery/:id/like')
  likeGallery(@Param('id') id: string) {
    return this.contentService.likeGallery(Number(id));
  }

  /** POST /api/upload 图片上传（登录；multipart file 或 JSON {path}） */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const fn = `u_${Date.now()}_${uid()}${extname(file.originalname || '.png')}`;
          cb(null, fn);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upload(@UploadedFile() file?: any, @Body() body: { path?: string } = {}) {
    if (file && file.filename) return { url: `/uploads/${file.filename}` };
    if (body && body.path) return { url: body.path };
    throw new Error('请选择要上传的图片');
  }
}