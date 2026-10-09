import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

const SQL_ERROR_PATTERN = /(ER_|QueryFailedError|insert into|duplicate entry|Unknown column|syntax error)/i;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = '服务器开小差了，请稍后再试';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') message = body;
      else if (body && typeof body === 'object') {
        const b = body as { message?: string | string[]; error?: string };
        message = b.message ?? b.error ?? '请求错误';
      }
    } else if (exception instanceof Error) {
      const msg = exception.message || 'unknown error';
      // SQL 层 / 未预期技术错误 → 500 兜底文案，不外泄
      if (SQL_ERROR_PATTERN.test(msg)) {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = '服务器开小差了，请稍后再试';
      } else {
        // 业务异常：Error.message 即用户可读提示，返回 400
        status = HttpStatus.BAD_REQUEST;
        message = msg;
      }
      this.logger.error(`${req.method} ${req.originalUrl} -> ${msg}`, exception.stack);
    }

    res.status(status).json({
      code: status,
      msg: Array.isArray(message) ? message.join('；') : message,
      data: null,
    });
  }
}